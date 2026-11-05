/* A tiny test harness with no dependencies, so the tests follow the same rule as the
 * site: plain HTML, CSS and JavaScript, nothing fetched from outside.
 *
 * Run the tests by serving the project folder and opening tests/index.html:
 *   python3 -m http.server 8123   ->   http://localhost:8123/tests/
 * Add ?grep=calculator to run only the tests whose name contains "calculator".
 * On GitHub, .github/workflows/tests.yml runs the same page in headless Chrome
 * through tests/ci.mjs on every pull request and every push to main.
 *
 * Static tests read the pages as text and parse them with DOMParser. Behaviour tests
 * load each page into an iframe (kept on screen, because IntersectionObserver and
 * requestAnimationFrame only run for visible frames) and drive it like a visitor.
 */
(function () {
  "use strict";

  const PAGES = ["index.html", "cyclones.html", "history.html", "calculator.html", "warnings.html", "prepare.html", "sources.html"];
  // The page keys used by the Sources page (data-pages) and its filter.
  const PAGE_KEYS = { "index.html": "home", "cyclones.html": "cyclones", "history.html": "history", "calculator.html": "calculator", "warnings.html": "warnings", "prepare.html": "prepare", "sources.html": "sources" };
  const STORAGE_KEYS = ["theme", "sound", "beforeLandfall.calculatorHistory.v1", "beforeLandfall.preparationChecklist.v1", "beforeLandfall.familyPlan.v1"];
  const SITE_FILES = PAGES.concat(["styles.css", "motion.css", "script.js", "sound.js", "motion.js", "images/logo.svg",
    "lib/lisse.js", "lib/rolltext.min.js", "lib/gsap.min.js", "lib/ScrollTrigger.min.js", "lib/SplitText.min.js"]);

  const tests = [];
  const site = (path) => new URL("../" + path, window.location.href).href;

  // ------------------------------------------------------------------------
  // Assertions
  // ------------------------------------------------------------------------
  class AssertionError extends Error {}
  const show = (value) => {
    try { return JSON.stringify(value); } catch (error) { return String(value); }
  };
  const prefix = (message) => (message ? message + ": " : "");

  const assert = {
    ok(value, message) {
      if (!value) throw new AssertionError(message || "expected a truthy value, got " + show(value));
    },
    equal(actual, expected, message) {
      if (!Object.is(actual, expected)) throw new AssertionError(prefix(message) + "expected " + show(expected) + ", got " + show(actual));
    },
    deepEqual(actual, expected, message) {
      if (show(actual) !== show(expected)) throw new AssertionError(prefix(message) + "expected " + show(expected) + ", got " + show(actual));
    },
    close(actual, expected, epsilon, message) {
      if (!(Math.abs(actual - expected) <= epsilon)) throw new AssertionError(prefix(message) + "expected " + expected + " ± " + epsilon + ", got " + actual);
    },
    match(actual, pattern, message) {
      if (!pattern.test(String(actual))) throw new AssertionError(prefix(message) + show(actual) + " does not match " + pattern);
    },
    // Collect every problem in a check, then fail once with the full list.
    none(problems, message) {
      if (problems.length) throw new AssertionError((message || "problems found") + " (" + problems.length + "):\n  - " + problems.join("\n  - "));
    },
  };

  // ------------------------------------------------------------------------
  // Fetching and parsing the site's files
  // ------------------------------------------------------------------------
  const textCache = new Map();
  function getText(path) {
    if (!textCache.has(path)) {
      textCache.set(path, fetch(site(path), { cache: "no-store" }).then((response) => {
        if (!response.ok) throw new Error("Could not load " + path + " (" + response.status + ")");
        return response.text();
      }));
    }
    return textCache.get(path);
  }

  const docCache = new Map();
  function getDoc(path) {
    if (!docCache.has(path)) {
      docCache.set(path, getText(path).then((text) => new DOMParser().parseFromString(text, "text/html")));
    }
    return docCache.get(path);
  }

  async function exists(path) {
    try {
      const response = await fetch(site(path), { method: "HEAD", cache: "no-store" });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // ------------------------------------------------------------------------
  // Loading pages into a visible iframe
  // ------------------------------------------------------------------------
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Wait for animation frames in a window, with a timeout in case the frame is throttled.
  function frames(win, count) {
    return new Promise((resolve) => {
      let left = count || 1;
      const timer = setTimeout(resolve, 500);
      const step = () => {
        left -= 1;
        if (left <= 0) {
          clearTimeout(timer);
          resolve();
        } else {
          win.requestAnimationFrame(step);
        }
      };
      win.requestAnimationFrame(step);
    });
  }

  // Records script errors, rejections, console errors and warnings. Resource errors
  // (an image that fails to load) are kept apart, since the hotlinked photos depend on
  // the network and the page handles them on purpose.
  function installCapture(win) {
    if (win.__errors) return;
    const errors = (win.__errors = []);
    const resources = (win.__resourceErrors = []);
    win.addEventListener("error", (event) => {
      if (event instanceof win.ErrorEvent) errors.push("error: " + event.message + " (" + (event.filename || "inline") + ":" + event.lineno + ")");
      else if (event.target && event.target !== win) resources.push(event.target.currentSrc || event.target.src || event.target.href || event.target.tagName);
    }, true);
    win.addEventListener("unhandledrejection", (event) => {
      errors.push("unhandled rejection: " + ((event.reason && event.reason.message) || event.reason));
    });
    ["error", "warn"].forEach((level) => {
      const original = win.console[level];
      win.console[level] = function () {
        errors.push("console." + level + ": " + Array.prototype.map.call(arguments, String).join(" "));
        return original.apply(win.console, arguments);
      };
    });
  }
  const CAPTURE_SOURCE = "(" + installCapture.toString() + ")(window);";

  let stage = null;
  function mountFrame(width, height) {
    stage = stage || document.getElementById("stage");
    const frame = document.createElement("iframe");
    frame.width = String(width);
    frame.height = String(height);
    frame.title = "Page under test";
    stage.replaceChildren(frame);
    // Scale the stage down to fit the window: the page inside keeps its own viewport size.
    const scale = Math.min(1, (window.innerWidth * 0.5) / width, (window.innerHeight - 24) / height);
    stage.style.width = width + "px";
    stage.style.height = height + "px";
    stage.style.transform = "scale(" + scale + ")";
    return frame;
  }

  function waitForLoad(frame, start) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("The page did not finish loading within 20 s")), 20000);
      frame.addEventListener("load", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      start();
    });
  }

  /* Open a page in the test frame and wait until it has settled.
   *   real: load the real URL (needed for links, the referrer and location.hash).
   *         Otherwise the page is loaded from its own source through srcdoc, with
   *         error capture (and `inject`) running before any of the page's own code.
   *   inject: HTML inserted at the top of <head>, e.g. a script that fakes the date.
   *   transform: a function that edits the page source first (e.g. removes scripts). */
  async function openPage(path, options) {
    const opts = Object.assign({ width: 1280, height: 800, inject: "", transform: null, real: false, hash: "" }, options);
    const frame = mountFrame(opts.width, opts.height);
    if (opts.real) {
      await waitForLoad(frame, () => { frame.src = site(path) + opts.hash; });
      installCapture(frame.contentWindow);
    } else {
      let html = await getText(path);
      if (opts.transform) html = opts.transform(html);
      const head = '<base href="' + site(path) + '"><script>' + CAPTURE_SOURCE + "<\/script>" + opts.inject;
      html = html.replace(/<head>/i, "<head>" + head);
      await waitForLoad(frame, () => { frame.srcdoc = html; });
    }
    const win = frame.contentWindow;
    if (win.document.fonts && win.document.fonts.ready) await win.document.fonts.ready;
    await frames(win, 2);
    return { frame, win, doc: win.document, $: (selector) => win.document.querySelector(selector), $$: (selector) => Array.from(win.document.querySelectorAll(selector)) };
  }

  // Wait for a navigation started inside the frame (a link click), then re-arm capture.
  async function nextLoad(page) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("No navigation within 10 s")), 10000);
      page.frame.addEventListener("load", () => { clearTimeout(timer); resolve(); }, { once: true });
    });
    const win = page.frame.contentWindow;
    installCapture(win);
    await frames(win, 2);
    return { frame: page.frame, win, doc: win.document, $: (selector) => win.document.querySelector(selector), $$: (selector) => Array.from(win.document.querySelectorAll(selector)) };
  }

  function errorsIn(page, options) {
    const allowResources = !options || options.allowResources !== false;
    const list = (page.win.__errors || []).slice();
    if (!allowResources) list.push(...(page.win.__resourceErrors || []).map((url) => "resource failed: " + url));
    return list;
  }

  // Events built in the frame's own realm, as a visitor's browser would make them.
  const fire = (element, type, init) => {
    const win = element.ownerDocument.defaultView;
    const Ctor = type.startsWith("key") ? win.KeyboardEvent : win.Event;
    return element.dispatchEvent(new Ctor(type, Object.assign({ bubbles: true, cancelable: true }, init)));
  };
  function setValue(input, value, events) {
    input.value = String(value);
    (events || ["input"]).forEach((type) => fire(input, type));
  }
  const key = (element, name) => fire(element, "keydown", { key: name });

  // Seeded random numbers, so a failing stress run can be repeated exactly.
  function random(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ------------------------------------------------------------------------
  // Running
  // ------------------------------------------------------------------------
  function test(name, fn, options) {
    tests.push({ name, fn, timeout: (options && options.timeout) || 30000 });
  }

  function withTimeout(promise, ms, name) {
    let timer;
    return Promise.race([
      promise,
      new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error(name + " timed out after " + ms / 1000 + " s")), ms); }),
    ]).finally(() => clearTimeout(timer));
  }

  async function run() {
    const list = document.getElementById("results");
    const summary = document.getElementById("summary");
    const grep = new URLSearchParams(window.location.search).get("grep");
    const selected = grep ? tests.filter((t) => t.name.toLowerCase().includes(grep.toLowerCase())) : tests;

    // Refresh the browser's HTTP cache, so pages in the test frame run the files as they
    // are on disk now rather than a copy cached before the last edit.
    summary.textContent = "Refreshing cached site files…";
    await Promise.all(SITE_FILES.map((path) => fetch(site(path), { cache: "reload" }).catch(() => null)));

    // The tests use the same localStorage as the site. Keep the visitor's own values.
    const saved = {};
    STORAGE_KEYS.forEach((name) => { saved[name] = localStorage.getItem(name); });

    const results = [];
    const started = performance.now();
    for (let i = 0; i < selected.length; i += 1) {
      const current = selected[i];
      summary.textContent = "Running " + (i + 1) + " of " + selected.length + ": " + current.name;
      STORAGE_KEYS.forEach((name) => localStorage.removeItem(name));
      const item = document.createElement("li");
      const t0 = performance.now();
      let error = null;
      try {
        await withTimeout(Promise.resolve().then(current.fn), current.timeout, current.name);
      } catch (caught) {
        error = caught;
      }
      const ms = Math.round(performance.now() - t0);
      item.className = error ? "fail" : "pass";
      const title = document.createElement("strong");
      title.textContent = (error ? "✗ " : "✓ ") + current.name;
      const time = document.createElement("small");
      time.textContent = " " + ms + " ms";
      item.append(title, time);
      if (error) {
        const detail = document.createElement("pre");
        detail.textContent = (error instanceof AssertionError ? "" : (error.name || "Error") + ": ") + error.message;
        item.append(detail);
        console.error("[FAIL] " + current.name + "\n" + error.message);
      }
      list.append(item);
      results.push({ name: current.name, pass: !error, ms, message: error ? error.message : "" });
    }

    STORAGE_KEYS.forEach((name) => {
      if (saved[name] === null) localStorage.removeItem(name);
      else localStorage.setItem(name, saved[name]);
    });
    if (stage) stage.replaceChildren();

    const failed = results.filter((r) => !r.pass);
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    summary.textContent = (failed.length ? "FAILED: " + failed.length + " of " : "PASSED: all ") + results.length + " tests (" + seconds + " s)";
    document.body.dataset.status = failed.length ? "fail" : "pass";
    document.title = (failed.length ? "FAIL " : "PASS ") + (results.length - failed.length) + "/" + results.length;
    window.__testResults = { passed: results.length - failed.length, failed: failed.length, total: results.length, seconds: Number(seconds), failures: failed, results };
  }

  window.Harness = { PAGES, PAGE_KEYS, test, run, assert, getText, getDoc, exists, site, openPage, nextLoad, errorsIn, fire, setValue, key, sleep, frames, random };
})();
