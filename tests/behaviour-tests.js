/* Behaviour and stress tests: each page is loaded into an iframe and driven like a visitor would. */
(function () {
  "use strict";

  const { PAGES, test, assert, getText, openPage, nextLoad, errorsIn, fire, setValue, key, sleep, frames, random } = window.Harness;

  const WIDTHS = [320, 390, 768, 1024, 1440];
  const STAGE_NAMES = { evacuate: "Evacuate now", prepare: "Prepare to leave", alert: "Stay alert" };
  const stageFor = (hours) => (hours < 6 ? "evacuate" : hours <= 24 ? "prepare" : "alert");
  const KEYS = {
    calculator: "beforeLandfall.calculatorHistory.v1",
    checklist: "beforeLandfall.preparationChecklist.v1",
    plan: "beforeLandfall.familyPlan.v1",
  };
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const text = (element) => (element ? element.textContent.replace(/\s+/g, " ").trim() : null);
  const isShown = (element) => {
    if (!element || element.closest("[hidden]")) return false;
    const style = element.ownerDocument.defaultView.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  };
  const noErrors = (page, label) => assert.none(errorsIn(page), (label ? label + ": " : "") + "errors in the page");
  const store = (name, value) => localStorage.setItem(name, typeof value === "string" ? value : JSON.stringify(value));
  const stored = (name) => JSON.parse(localStorage.getItem(name));

  // Scripts placed at the top of <head> before the page's own code runs.
  const fakeToday = (y, m, d) =>
    "<script>(function(){var R=Date;var t=new R(" + y + "," + m + "," + d + ",10,30).getTime();" +
    "function F(){if(!(this instanceof F))return new R(t).toString();var a=[].slice.call(arguments);return a.length?new (Function.prototype.bind.apply(R,[null].concat(a)))():new R(t);}" +
    "F.prototype=R.prototype;F.now=function(){return t;};F.UTC=R.UTC;F.parse=R.parse;window.Date=F;})();<\/script>";
  const REDUCED_MOTION =
    "<script>(function(){var o=window.matchMedia.bind(window);window.matchMedia=function(q){if(!/prefers-reduced-motion/.test(q))return o(q);" +
    "return{matches:/reduce/.test(q),media:q,onchange:null,addEventListener:function(){},removeEventListener:function(){},addListener:function(){},removeListener:function(){},dispatchEvent:function(){return false;}};};})();<\/script>";
  const STORAGE_BLOCKED =
    "<script>Object.defineProperty(window,'localStorage',{configurable:true,get:function(){throw new DOMException('Storage is disabled','SecurityError');}});<\/script>";
  const withoutScripts = (pattern) => (html) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (tag) => (pattern.test(tag) ? "" : tag));

  // Elements that stick out past the sides of the viewport (and so would be cut off or scroll sideways).
  function overflow(page) {
    const { win, doc } = page;
    const width = doc.documentElement.clientWidth;
    const problems = new Set();
    if (doc.documentElement.scrollWidth > width + 1) problems.add("the page scrolls sideways (" + doc.documentElement.scrollWidth + " px wide in a " + width + " px viewport)");
    doc.querySelectorAll("body *").forEach((element) => {
      if (element.closest(".visually-hidden, [aria-hidden='true'], svg, .skip-link")) return;
      // Scroll containers (wide tables, the storm track) must fit, but may hold wider content on purpose.
      if (element.parentElement && element.parentElement.closest(".plan-table-scroll, .table-scroll, .tl-track")) return;
      const style = win.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || style.position === "fixed") return;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      if (rect.right > width + 1 || rect.left < -1) {
        const name = element.tagName.toLowerCase() + (element.id ? "#" + element.id : "") + (element.classList.length ? "." + Array.from(element.classList).join(".") : "");
        problems.add(name + " spans " + Math.round(rect.left) + " to " + Math.round(rect.right) + " px");
      }
    });
    return Array.from(problems).slice(0, 12);
  }

  // ==========================================================================
  // Every page, at every width
  // ==========================================================================

  PAGES.forEach((path) => {
    test("load: " + path + " runs without errors and nothing sticks out at " + WIDTHS.join(", ") + " px", async () => {
      const problems = [];
      for (const width of WIDTHS) {
        const page = await openPage(path, { width, height: 820 });
        await sleep(200);
        errorsIn(page).forEach((error) => problems.push(width + " px: " + error));
        overflow(page).forEach((problem) => problems.push(width + " px: " + problem));
      }
      assert.none(problems);
    }, { timeout: 120000 });
  });

  test("load: pages work with reduced motion, and skip the motion extras", async () => {
    const problems = [];
    for (const path of PAGES) {
      const page = await openPage(path, { inject: REDUCED_MOTION });
      await sleep(100);
      errorsIn(page).forEach((error) => problems.push(path + ": " + error));
      if (page.doc.body.classList.contains("has-reveal")) problems.push(path + ": reveal animations are on");
      if (page.$(".motion-progress")) problems.push(path + ": the scroll progress bar was added");
      if (page.doc.documentElement.classList.contains("motion-pending")) problems.push(path + ": headings are still waiting to be split");
      if (page.$(".motion-line")) problems.push(path + ": headings were split into animated lines");
    }
    assert.none(problems);
  }, { timeout: 60000 });

  test("load: every page still reads properly with JavaScript off", async () => {
    const problems = [];
    for (const path of PAGES) {
      const page = await openPage(path, { transform: withoutScripts(/./) });
      const { $, $$ } = page;
      $$("h1, h2, h3, [data-reveal]").forEach((element) => {
        const style = page.win.getComputedStyle(element);
        if (!element.closest("[hidden], details:not([open])") && (style.visibility === "hidden" || Number(style.opacity) === 0)) problems.push(path + ": " + text(element).slice(0, 40) + " is invisible");
      });
      if (isShown($("#theme-switch")) || isShown($("#sound-toggle"))) problems.push(path + ": the theme or sound control shows, but cannot work");
      if (path === "cyclones.html") {
        if ($$(".step").some((step) => !isShown(step))) problems.push("cyclones.html: a formation step is hidden");
        if (isShown($(".step-controls")) || isShown($(".step-nav"))) problems.push("cyclones.html: step buttons show without script");
        if ($$("details.data-table:not([open])").length) problems.push("cyclones.html: a data table is folded away");
        if (isShown($(".category-live")) || isShown($(".chart-live"))) problems.push("cyclones.html: an interactive panel shows without script");
      }
      if (path === "history.html" && $$(".tl-panel").some((panel) => !isShown(panel))) problems.push("history.html: a storm is hidden");
      if (path === "warnings.html" && (isShown($("#warning-timeline")) || $$("[data-stage-advice]").some((p) => !text(p)))) problems.push("warnings.html: the stage list is incomplete");
      if (path === "calculator.html" && (isShown($("#calculator-result")) || !isShown($("#estimate-prompt")))) problems.push("calculator.html: the empty result card shows");
      if (path === "index.html" && (isShown($("#season")) || !isShown($("#hours")))) problems.push("index.html: the slider or season note is wrong");
    }
    assert.none(problems);
  }, { timeout: 60000 });

  test("load: pages work when the vendored libraries fail to load", async () => {
    const problems = [];
    for (const path of PAGES) {
      const page = await openPage(path, { transform: withoutScripts(/src="lib\//) });
      await sleep(100);
      errorsIn(page).forEach((error) => problems.push(path + ": " + error));
      if (path === "index.html") {
        setValue(page.$("#hours"), 3);
        if (text(page.$("#hours-number")) !== "3" || page.$("#panel").dataset.stage !== "evacuate") problems.push("index.html: the slider stopped updating");
      }
      if (path === "calculator.html") {
        setValue(page.$("#storm-distance"), 600);
        setValue(page.$("#storm-speed"), 30);
        if (text(page.$("#result-hours")) !== "20") problems.push("calculator.html: the result is " + text(page.$("#result-hours")));
      }
    }
    assert.none(problems);
  }, { timeout: 60000 });

  test("load: headings appear even if motion.js never runs (CSS failsafe)", async () => {
    const page = await openPage("index.html", { transform: withoutScripts(/src="motion\.js"/) });
    assert.ok(page.doc.documentElement.classList.contains("motion-pending"), "motion-pending should still be set");
    await sleep(2800);
    assert.equal(page.win.getComputedStyle(page.$("#hero-title")).visibility, "visible", "hero heading visibility");
    noErrors(page);
  });

  // ==========================================================================
  // Site-wide controls
  // ==========================================================================

  test("site: the theme switch applies, remembers and resets the theme", async () => {
    let page = await openPage("calculator.html");
    const root = page.doc.documentElement;
    const metas = page.$$('meta[name="theme-color"]');
    const originals = metas.map((meta) => meta.content);
    assert.ok(!page.$("#theme-switch").hidden, "the switch should be shown");
    assert.ok(page.$("#theme-system").checked, "System should start selected");

    page.$("#theme-dark").click();
    assert.equal(root.dataset.theme, "dark");
    assert.equal(localStorage.getItem("theme"), "dark");
    const dark = page.win.getComputedStyle(page.doc.body).backgroundColor;
    assert.equal(dark, "rgb(12, 30, 39)", "dark page colour");
    metas.forEach((meta) => assert.equal(meta.content, dark, "theme-color in dark mode"));

    page.$("#theme-light").click();
    assert.equal(root.dataset.theme, "light");
    metas.forEach((meta) => assert.equal(meta.content, "rgb(243, 247, 246)", "theme-color in light mode"));

    page.$("#theme-system").click();
    assert.equal(root.dataset.theme, undefined);
    assert.equal(localStorage.getItem("theme"), null);
    assert.deepEqual(metas.map((meta) => meta.content), originals, "theme-color restored");

    // Rapid switching ends on the last choice.
    const pick = random(7);
    let last = "system";
    for (let i = 0; i < 80; i += 1) {
      last = ["system", "light", "dark"][Math.floor(pick() * 3)];
      page.$("#theme-" + last).click();
    }
    assert.equal(root.dataset.theme, last === "system" ? undefined : last, "after 80 switches");
    noErrors(page);

    store("theme", "dark");
    page = await openPage("history.html");
    assert.equal(page.doc.documentElement.dataset.theme, "dark", "a saved theme applies before the scripts run");
    assert.ok(page.$("#theme-dark").checked, "the saved theme is selected");

    store("theme", "purple");
    page = await openPage("history.html");
    assert.equal(page.doc.documentElement.dataset.theme, undefined, "an unknown saved theme is ignored");
    assert.ok(page.$("#theme-system").checked, "System is selected for an unknown theme");
    noErrors(page);
  });

  test("site: the sound button turns sound off and on, and every sound plays without errors", async () => {
    const page = await openPage("index.html");
    const button = page.$("#sound-toggle");
    assert.ok(!button.hidden, "the button should be shown");
    assert.equal(button.getAttribute("aria-pressed"), "true");
    button.click();
    assert.equal(button.getAttribute("aria-pressed"), "false");
    assert.equal(localStorage.getItem("sound"), "off");
    assert.equal(page.win.Sound.enabled, false);
    button.click();
    assert.equal(button.getAttribute("aria-pressed"), "true");
    assert.equal(localStorage.getItem("sound"), null);
    const calls = [["tick", 1.1], ["select", 1.2], ["toggle", "down"], ["toggle", "up"], ["toggle", "mid"], ["push"], ["pop"],
      ["stage", "alert"], ["stage", "prepare"], ["stage", "evacuate"], ["stage", "nope"], ["category", 0], ["category", 9], ["category", "x"],
      ["success"], ["complete"], ["nudge"], ["add"], ["remove"], ["sweep"], ["check", true], ["check", false], ["no-such-sound"]];
    for (let round = 0; round < 3; round += 1) calls.forEach(([name, arg]) => page.win.Sound.play(name, arg));
    await sleep(300);
    noErrors(page);

    // Links load the next page straight away: sound never holds a page change back.
    let held = null;
    page.win.addEventListener("click", (event) => { held = event.defaultPrevented; event.preventDefault(); }, { once: true });
    page.$('a[href="cyclones.html"]').click();
    assert.equal(held, false, "a link to another page should not wait for a sound");

    store("sound", "off");
    const muted = await openPage("index.html");
    assert.equal(muted.$("#sound-toggle").getAttribute("aria-pressed"), "false", "a saved 'off' is remembered");
  });

  test("site: every sound is as loud the first time as later, everyday sounds stay below rare ones, and nothing clips", async () => {
    // Render the real sound.js offline and measure each sound's peak in dBFS. Every render gets
    // its own copy of sound.js in a blank frame, and the same seeded Math.random, so a sound
    // played at the start and one played a second later should match sample for sample.
    const source = await getText("sound.js");
    const page = await openPage("index.html", { transform: () => "<!DOCTYPE html><html><head><title>Sound levels</title></head><body></body></html>" });
    const win = page.win;
    async function peakOf(plays, seconds) {
      let seed = 1;
      win.Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
      let ctx = null;
      win.AudioContext = function () { ctx = new win.OfflineAudioContext(1, Math.round(48000 * seconds), 48000); return ctx; };
      win.localStorage.removeItem("sound");
      win.eval(source);
      win.dispatchEvent(new win.PointerEvent("pointerdown")); // creates the context, as a visitor's first tap does
      const resume = ctx.resume.bind(ctx);
      ctx.resume = () => Promise.resolve(); // rendering must not restart while a sound is still being scheduled
      new Set(plays.map(([time]) => time)).forEach((time) => {
        const playNow = () => plays.filter((play) => play[0] === time).forEach(([, name, arg]) => win.Sound.play(name, arg));
        if (time === 0) playNow();
        else ctx.suspend(time).then(() => { playNow(); resume(); });
      });
      const data = (await ctx.startRendering()).getChannelData(0);
      let peak = 0;
      for (let i = 0; i < data.length; i += 1) peak = Math.max(peak, Math.abs(data[i]));
      return 20 * Math.log10(peak);
    }

    const everyday = [["tick", 1], ["select"], ["add"], ["remove"]];
    const rare = [["stage", "alert"], ["stage", "prepare"], ["stage", "evacuate"], ["success"], ["complete"]];
    const others = [["check", true], ["check", false], ["sweep"], ["push"], ["pop"], ["toggle", "up"], ["toggle", "down"], ["toggle", "mid"],
      ["category", 1], ["category", 5], ["nudge"]];
    const label = ([name, arg]) => name + (arg === undefined ? "" : "(" + arg + ")");
    const levels = new Map();
    const problems = [];
    for (const sound of everyday.concat(rare, others)) {
      const first = await peakOf([[0, ...sound]], 1.2);
      const later = await peakOf([[1, ...sound]], 2.2);
      levels.set(label(sound), later);
      if (Math.abs(first - later) > 0.5) problems.push(label(sound) + " peaks at " + first.toFixed(1) + " dBFS the first time but " + later.toFixed(1) + " dBFS later");
      if (later > -6) problems.push(label(sound) + " peaks at " + later.toFixed(1) + " dBFS, too close to clipping");
      if (!(later > -40)) problems.push(label(sound) + " peaks at " + later.toFixed(1) + " dBFS, too quiet to hear");
    }
    assert.none(problems, "sound levels");

    const loudestEveryday = Math.max(...everyday.map((sound) => levels.get(label(sound))));
    const quietestRare = Math.min(...rare.map((sound) => levels.get(label(sound))));
    assert.ok(loudestEveryday <= quietestRare - 4, "everyday sounds (loudest " + loudestEveryday.toFixed(1) + " dBFS) should sit at least 4 dB below rare ones (quietest " + quietestRare.toFixed(1) + " dBFS)");

    // A visitor tapping as fast as they can still never drives the output near clipping.
    const tappedStages = await peakOf([0, 0.08, 0.16, 0.24, 0.32, 0.4].map((time) => [time, "stage", "evacuate"]), 2);
    const tappedChecklist = await peakOf([0, 0.1, 0.2, 0.3].map((time) => [time, "complete"]), 2);
    assert.ok(tappedStages <= -3, "\"Evacuate now\" tapped six times in half a second peaks at " + tappedStages.toFixed(1) + " dBFS");
    assert.ok(tappedChecklist <= -3, "the checklist finished four times in 0.4 s peaks at " + tappedChecklist.toFixed(1) + " dBFS");
    noErrors(page);
  });

  test("site: the header collapses on scroll on wide screens and stays compact on narrow ones", async () => {
    let page = await openPage("index.html", { width: 1280, height: 700 });
    const header = page.$(".site-header");
    assert.ok(!header.classList.contains("is-compact"), "expanded at the top");
    page.win.scrollTo({ top: 300, behavior: "instant" });
    await frames(page.win, 3);
    assert.ok(header.classList.contains("is-compact"), "compact after scrolling down");
    page.win.scrollTo({ top: 16, behavior: "instant" });
    await frames(page.win, 3);
    assert.ok(header.classList.contains("is-compact"), "stays compact inside the 8–24 px dead zone");
    page.win.scrollTo({ top: 0, behavior: "instant" });
    await frames(page.win, 3);
    assert.ok(!header.classList.contains("is-compact"), "expanded again at the top");
    assert.ok(!page.doc.documentElement.classList.contains("header-motion-initializing"), "start-up class removed");

    page = await openPage("index.html", { width: 800, height: 700 });
    assert.ok(page.$(".site-header").classList.contains("is-compact"), "compact at 800 px wide");
    noErrors(page);
  });

  // ==========================================================================
  // Home page
  // ==========================================================================

  test("home: the slider shows the right stage, words and label at every hour from 1 to 72", async () => {
    const page = await openPage("index.html");
    const slider = page.$("#hours");
    const problems = [];
    for (let hours = 1; hours <= 72; hours += 1) {
      setValue(slider, hours);
      const stage = stageFor(hours);
      const unit = hours === 1 ? "hour" : "hours";
      if (page.$("#panel").dataset.stage !== stage) problems.push(hours + " h: stage " + page.$("#panel").dataset.stage);
      if (text(page.$("#hours-number")) !== String(hours)) problems.push(hours + " h: readout " + text(page.$("#hours-number")));
      if (text(page.$("#hours-unit")) !== unit + " until landfall") problems.push(hours + " h: unit " + text(page.$("#hours-unit")));
      if (text(page.$("#stage-name")) !== STAGE_NAMES[stage]) problems.push(hours + " h: name " + text(page.$("#stage-name")));
      if (slider.getAttribute("aria-valuetext") !== hours + " " + unit + " until landfall. " + STAGE_NAMES[stage] + ".") problems.push(hours + " h: aria-valuetext " + slider.getAttribute("aria-valuetext"));
      const active = page.$$(".legend-button.is-active");
      if (active.length !== 1 || active[0].dataset.stage !== stage) problems.push(hours + " h: legend highlights " + active.map((b) => b.dataset.stage));
    }
    assert.none(problems);
    noErrors(page);
  });

  test("home: the legend buttons jump the slider to their stage", async () => {
    const page = await openPage("index.html");
    for (const button of page.$$("[data-jump-hours]")) {
      button.click();
      assert.equal(page.$("#hours").value, button.dataset.jumpHours, "slider value");
      assert.equal(page.$("#panel").dataset.stage, stageFor(Number(button.dataset.jumpHours)), "stage");
      assert.ok(button.classList.contains("is-active"), "the pressed button is highlighted");
    }
    noErrors(page);
  });

  test("home: stress — 3,000 rapid slider changes leave the panel, advice and thumb consistent", async () => {
    const page = await openPage("index.html");
    const slider = page.$("#hours");
    const pick = random(42);
    let hours = 18;
    for (let i = 0; i < 3000; i += 1) {
      hours = 1 + Math.floor(pick() * 72);
      setValue(slider, hours);
      if (i % 250 === 0) await frames(page.win, 1); // let some animation frames and timers interleave
    }
    await sleep(1600);
    const stage = stageFor(hours);
    assert.equal(page.$("#panel").dataset.stage, stage, "final stage");
    assert.equal(text(page.$("#hours-number")), String(hours), "final readout");
    const advice = page.$("#stage-advice");
    assert.ok(!advice.classList.contains("is-changing"), "the advice finished its swap");
    const js = await window.Harness.getText("script.js");
    const expectedAdvice = new RegExp('id: "' + stage + '",\\s*name: "[^"]+",\\s*advice: "([^"]+)"').exec(js)[1];
    assert.equal(text(advice), expectedAdvice, "advice matches the final stage");
    const position = parseFloat(page.$(".slider-visual").style.getPropertyValue("--slider-progress"));
    assert.close(position, ((hours - 1) / 71) * 100, 0.2, "the custom thumb settled on the value");
    noErrors(page);
  }, { timeout: 60000 });

  test("home: with reduced motion the thumb and advice change instantly", async () => {
    const page = await openPage("index.html", { inject: REDUCED_MOTION });
    setValue(page.$("#hours"), 3);
    assert.close(parseFloat(page.$(".slider-visual").style.getPropertyValue("--slider-progress")), (2 / 71) * 100, 0.01, "thumb position");
    assert.ok(!page.$("#stage-advice").classList.contains("is-changing"), "no fade");
    assert.match(text(page.$("#stage-advice")), /^Go to your shelter now/, "advice");
    noErrors(page);
  });

  test("home: the season note is right on every kind of date", async () => {
    const cases = [[2026, 0, 1], [2026, 2, 31], [2026, 3, 1], [2026, 4, 31], [2026, 5, 1], [2026, 8, 30], [2026, 9, 1], [2026, 10, 30], [2026, 11, 1], [2026, 11, 31], [2028, 1, 29], [2026, 2, 8]];
    const problems = [];
    for (const [y, m, d] of cases) {
      let expected;
      if ([3, 4, 9, 10].includes(m)) {
        expected = "Today falls in a main cyclone period (April–⁠May and October–⁠November).";
      } else {
        const today = Date.UTC(y, m, d);
        const next = [Date.UTC(y, 3, 1), Date.UTC(y, 9, 1), Date.UTC(y + 1, 3, 1)].find((start) => start > today);
        const days = Math.round((next - today) / 86400000);
        expected = "The next main cyclone period begins in " + days + (days === 1 ? " day" : " days") + ", on 1 " + MONTHS[new Date(next).getUTCMonth()] + ".";
      }
      const page = await openPage("index.html", { inject: fakeToday(y, m, d) });
      const label = y + "-" + (m + 1) + "-" + d;
      if (page.$("#season").hidden) problems.push(label + ": the note is hidden");
      if (page.$("#season-text").textContent !== expected) problems.push(label + ': "' + page.$("#season-text").textContent + '" should be "' + expected + '"');
      if (page.$("#season").dataset.state !== ([3, 4, 9, 10].includes(m) ? "in" : "out")) problems.push(label + ": wrong data-state");
      errorsIn(page).forEach((error) => problems.push(label + ": " + error));
    }
    assert.none(problems);
  }, { timeout: 90000 });

  // ==========================================================================
  // Cyclones page
  // ==========================================================================

  test("cyclones: the basin picker shows each name and its caption", async () => {
    const page = await openPage("cyclones.html");
    assert.equal(text(page.$("#names-word")), "cyclone", "starts on cyclone");
    for (const input of page.$$("#basin-options input")) {
      input.click();
      assert.equal(text(page.$("#names-word")), input.value);
      assert.equal(text(page.$("#names-caption")), input.dataset.caption);
    }
    noErrors(page);
  });

  test("cyclones: the formation stepper moves through four steps and stops at the ends", async () => {
    const page = await openPage("cyclones.html");
    const back = page.$("#step-back");
    const next = page.$("#step-next");
    const svg = page.$("#formation-svg");
    const visible = () => page.$$(".step").filter((step) => !step.hidden).map((step) => step.id);
    const check = (n) => {
      assert.deepEqual(visible(), ["step-" + n], "visible step");
      assert.equal(svg.dataset.step, String(n), "diagram layer");
      assert.equal(back.disabled, n === 1, "Back disabled");
      assert.equal(next.disabled, n === 4, "Next disabled");
      assert.deepEqual(page.$$(".step-tab").map((tab) => tab.getAttribute("aria-current")), [1, 2, 3, 4].map((i) => (i === n ? "step" : null)), "aria-current");
    };
    assert.ok(!page.$(".step-controls").hidden && !page.$(".step-nav").hidden, "controls are shown");
    check(1);
    back.click();
    check(1);
    for (let n = 2; n <= 4; n += 1) {
      next.click();
      check(n);
    }
    next.click();
    check(4);
    page.$$(".step-tab")[1].click();
    check(2);
    const pick = random(3);
    for (let i = 0; i < 300; i += 1) {
      const choice = Math.floor(pick() * 6);
      if (choice < 4) page.$$(".step-tab")[choice].click();
      else (choice === 4 ? back : next).click();
    }
    assert.equal(visible().length, 1, "exactly one step after 300 random presses");
    noErrors(page);
  });

  test("cyclones: the category picker starts on Nargis's category and shows each category", async () => {
    const page = await openPage("cyclones.html");
    const rows = page.$$("#category-picker tbody tr");
    const radios = page.$$("input[name='category']");
    assert.equal(radios.length, 5, "five categories");
    assert.ok(radios[2].checked, "category 3 starts selected");
    assert.equal(text(page.$(".seg-tag")), "Nargis");
    assert.ok(radios[2].parentElement.contains(page.$(".seg-tag")), "the Nargis tag sits on category 3");
    assert.ok(!page.$(".category-live").hidden, "the picker is shown");
    assert.ok(!page.$("#category-picker .data-table").open, "the table is folded away");
    radios.forEach((radio, i) => {
      radio.click();
      const max = rows[i].dataset.max;
      assert.equal(text(page.$("#category-range")), rows[i].dataset.min + (max ? "–" + max : "+"), "range for category " + (i + 1));
      assert.equal(text(page.$("#category-damage")), text(rows[i].cells[2]), "damage for category " + (i + 1));
    });
    noErrors(page);
  });

  test("cyclones: the township chart fills when scrolled to, and switches between people and share", async () => {
    const page = await openPage("cyclones.html");
    const rows = page.$$("#township-chart tbody tr").map((row) => ({ name: text(row.cells[0]), dead: Number(row.cells[1].dataset.value), share: text(row.cells[3]) }));
    const bars = () => page.$$("#bars .bar").map((bar) => ({ name: text(bar.querySelector(".bar-name")), width: parseFloat(bar.querySelector(".bar-fill").style.getPropertyValue("--w")), value: text(bar.querySelector(".bar-value")) }));
    assert.equal(bars().length, rows.length, "one bar per township");
    assert.ok(bars().every((bar) => bar.width === 0), "bars start empty");
    page.$("#bars").scrollIntoView({ block: "center", behavior: "instant" });
    await sleep(400);
    const largest = Math.max(...rows.map((row) => row.dead));
    bars().forEach((bar, i) => {
      assert.equal(bar.name, rows[i].name);
      assert.equal(bar.value, rows[i].dead.toLocaleString("en-US"), bar.name + " value");
      assert.close(bar.width, (rows[i].dead / largest) * 100, 0.001, bar.name + " width");
    });
    page.$("#metric-share").click();
    bars().forEach((bar, i) => assert.equal(bar.value, rows[i].share, bar.name + " share"));
    assert.equal(Math.max(...bars().map((bar) => bar.width)), 100, "the largest share fills the track");
    page.$("#metric-people").click();
    assert.equal(bars()[0].value, rows[0].dead.toLocaleString("en-US"), "back to people");
    noErrors(page);
  });

  test("cyclones: Typhoon Tip's size rolls up from 0 when it scrolls into view", async () => {
    const page = await openPage("cyclones.html");
    assert.equal(text(page.$("#tip-size")), "0", "starts at its count-from value");
    page.$("#tip-size").scrollIntoView({ block: "center", behavior: "instant" });
    await sleep(400);
    assert.equal(text(page.$("#tip-size")), "2,220");
    noErrors(page);
  });

  // ==========================================================================
  // History page
  // ==========================================================================

  test("history: the storm timeline works with clicks and the keyboard", async () => {
    const page = await openPage("history.html", { width: 1280 });
    const stops = page.$$(".tl-stop");
    const panels = page.$$(".tl-panel");
    assert.equal(stops.length, panels.length, "one stop per storm");
    assert.ok(page.$("#storm-timeline").classList.contains("is-interactive"));
    const current = () => {
      const active = panels.map((panel, i) => (panel.classList.contains("is-active") ? i : -1)).filter((i) => i >= 0);
      assert.equal(active.length, 1, "exactly one active panel");
      const chosen = stops.map((stop, i) => (stop.getAttribute("aria-current") === "true" ? i : -1)).filter((i) => i >= 0);
      assert.deepEqual(chosen, active, "aria-current matches the active panel");
      assert.deepEqual(stops.map((stop) => stop.tabIndex), stops.map((s, i) => (i === active[0] ? 0 : -1)), "roving tabindex");
      return active[0];
    };
    assert.equal(current(), 0);
    stops.forEach((stop, i) => assert.equal(text(stop.querySelector(".tl-stop-year")), panels[i].dataset.year));
    stops[2].click();
    assert.equal(current(), 2);
    key(stops[2], "ArrowRight");
    assert.equal(current(), 3);
    assert.equal(page.doc.activeElement, stops[3], "focus follows the arrow key");
    key(stops[3], "End");
    assert.equal(current(), stops.length - 1);
    key(stops[stops.length - 1], "ArrowRight");
    assert.equal(current(), 0, "wraps to the first storm");
    key(stops[0], "ArrowLeft");
    assert.equal(current(), stops.length - 1, "wraps to the last storm");
    key(stops[stops.length - 1], "Home");
    assert.equal(current(), 0);
    const pick = random(11);
    for (let i = 0; i < 400; i += 1) {
      const at = current();
      key(stops[at], ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End", "a"][Math.floor(pick() * 7)]);
    }
    current();
    noErrors(page);
  });

  test("history: on a phone only the chosen storm shows and its stop scrolls into view", async () => {
    const page = await openPage("history.html", { width: 360 });
    const stops = page.$$(".tl-stop");
    stops[stops.length - 1].click();
    await sleep(700);
    const shown = page.$$(".tl-panel").filter(isShown);
    assert.equal(shown.length, 1, "one storm shows");
    const track = page.$(".tl-track").getBoundingClientRect();
    const stop = stops[stops.length - 1].getBoundingClientRect();
    assert.ok(stop.left >= track.left - 1 && stop.right <= track.right + 1, "the last stop is scrolled into view");
    noErrors(page);
  });

  // ==========================================================================
  // Calculator page
  // ==========================================================================

  function calculator(page) {
    const distance = page.$("#storm-distance");
    const speed = page.$("#storm-speed");
    return {
      distance, speed,
      type(d, s) { setValue(distance, d); setValue(speed, s); },
      submit(d, s) { if (d !== undefined) this.type(d, s); page.$("#landfall-form").requestSubmit(); },
      hours: () => text(page.$("#result-hours")),
      shown: () => !page.$("#calculator-result").hidden,
      stage: () => page.$("#calculator-result").dataset.stage,
      error: () => (page.$("#calculator-error").hidden ? null : text(page.$("#calculator-error"))),
      history: () => page.$$("#calculation-history li strong").map(text),
    };
  }

  test("calculator: the answer and its stage are right on and around the 6 h and 24 h edges", async () => {
    const page = await openPage("calculator.html");
    const calc = calculator(page);
    const format = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    const cases = [[590, 100, 5.9], [599.9, 100, 6], [600, 100, 6], [2400, 100, 24], [2400.4, 100, 24], [2401, 100, 24.01], [1, 100, 0.01], [0.4, 100, 0.01], [600, 30, 20], [5000, 1, 5000], ["1e3", 30, 33.33]];
    const problems = [];
    let previous = -1;
    for (const [d, s, hours] of cases) {
      calc.submit(d, s);
      const label = d + " ÷ " + s;
      if (!calc.shown()) { problems.push(label + ": no result"); continue; }
      if (calc.hours() !== format(hours)) problems.push(label + ": shows " + calc.hours() + " instead of " + format(hours));
      if (calc.stage() !== stageFor(hours)) problems.push(label + ": stage " + calc.stage() + " instead of " + stageFor(hours));
      if (text(page.$("#result-stage")) !== STAGE_NAMES[stageFor(hours)]) problems.push(label + ": stage label " + text(page.$("#result-stage")));
      const gauge = parseFloat(page.$("#result-marker").style.getPropertyValue("--gauge-position"));
      if (!(gauge >= 3 && gauge <= 97)) problems.push(label + ": gauge at " + gauge + "%");
      if (calc.error()) problems.push(label + ": unexpected error " + calc.error());
      previous = gauge;
    }
    assert.ok(previous >= 0);
    // The gauge runs from far (left) to close (right): fewer hours sit further right.
    const gaugeAt = (h) => { calc.submit(h * 10, 10); return parseFloat(page.$("#result-marker").style.getPropertyValue("--gauge-position")); };
    const points = [100, 72, 48, 25, 24, 18, 12, 6, 5, 3, 1, 0.5].map(gaugeAt);
    for (let i = 1; i < points.length; i += 1) if (points[i] < points[i - 1]) problems.push("the gauge moves left between " + i + " and " + (i + 1));
    assert.none(problems);
    noErrors(page);
  });

  test("calculator: wrong or missing numbers give a clear message and point at the right box", async () => {
    const page = await openPage("calculator.html");
    const calc = calculator(page);
    const cases = [
      ["", "", /^Enter both/, "storm-distance"],
      ["600", "", /^Enter both/, "storm-speed"],
      ["", "30", /^Enter both/, "storm-distance"],
      ["0", "30", /^Enter a distance greater than 0 and no more than 5,000 km\.$/, "storm-distance"],
      ["-5", "30", /^Enter a distance/, "storm-distance"],
      ["5000.01", "30", /^Enter a distance/, "storm-distance"],
      ["600", "0", /^Enter a forward speed greater than 0 and no more than 100 km\/h\.$/, "storm-speed"],
      ["600", "100.5", /^Enter a forward speed/, "storm-speed"],
      ["600", "-1", /^Enter a forward speed/, "storm-speed"],
      ["600", "1e-12", /too large to estimate/, null],
    ];
    const problems = [];
    for (const [d, s, message, field] of cases) {
      calc.submit(d, s);
      const label = JSON.stringify(d) + " ÷ " + JSON.stringify(s);
      if (calc.shown()) problems.push(label + ": shows a result");
      if (page.$("#estimate-prompt").hidden) problems.push(label + ": the prompt is hidden");
      if (!message.test(calc.error() || "")) problems.push(label + ': message "' + calc.error() + '"');
      if (field && page.doc.activeElement.id !== field) problems.push(label + ": focus is on " + page.doc.activeElement.id + " instead of " + field);
    }
    assert.deepEqual(calc.history(), [], "nothing invalid is saved");
    assert.none(problems);
    noErrors(page);
  });

  test("calculator: errors wait until a box is left, and the live answer is not saved until committed", async () => {
    const page = await openPage("calculator.html");
    const calc = calculator(page);
    setValue(calc.distance, "6");
    assert.equal(calc.error(), null, "no error while typing the first box");
    fire(calc.distance, "blur", { bubbles: false });
    assert.equal(calc.error(), null, "no error for a missing second number");
    setValue(calc.distance, "0");
    setValue(calc.speed, "30");
    assert.match(calc.error(), /^Enter a distance/, "a left box with a wrong number shows its error");
    setValue(calc.distance, "60");
    assert.equal(calc.error(), null, "the error clears when fixed");
    assert.ok(calc.shown(), "the live answer shows");
    setValue(calc.distance, "600");
    assert.equal(calc.hours(), "20");
    assert.deepEqual(calc.history(), [], "typing alone saves nothing");
    fire(calc.distance, "change");
    assert.deepEqual(calc.history().length, 1, "leaving the box saves once");
    noErrors(page);
  });

  test("calculator: recent estimates keep five, newest first, without duplicates, and can be reused and cleared", async () => {
    let page = await openPage("calculator.html");
    let calc = calculator(page);
    assert.ok(!page.$("#history-empty").hidden && page.$("#clear-history").hidden, "starts empty");
    calc.submit(600, 30);
    calc.submit(600, 30);
    assert.equal(calc.history().length, 1, "the same numbers are saved once");
    [[100, 10], [200, 10], [300, 10], [400, 10], [500, 10]].forEach(([d, s]) => calc.submit(d, s));
    assert.equal(calc.history().length, 5, "at most five");
    assert.match(calc.history()[0], /^500 km ÷ 10 km\/h = 50 hours$/, "newest first");
    assert.equal(stored(KEYS.calculator).length, 5, "five in storage");
    assert.equal(text(page.$("#history-storage-status")), "Estimates are stored only in this browser.");

    page = await openPage("calculator.html");
    calc = calculator(page);
    assert.equal(calc.history().length, 5, "estimates survive a reload");
    page.$$(".history-reuse")[3].click();
    assert.equal(calc.distance.value, "200", "reuse fills the distance");
    assert.equal(calc.speed.value, "10", "reuse fills the speed");
    assert.equal(calc.hours(), "20");
    assert.match(calc.history()[0], /^200 km/, "the reused estimate moves to the top");
    page.$("#clear-history").click();
    assert.deepEqual(calc.history(), [], "cleared");
    assert.ok(!page.$("#history-empty").hidden && page.$("#clear-history").hidden, "back to the empty state");
    assert.equal(localStorage.getItem(KEYS.calculator), null, "storage cleared");
    noErrors(page);
  });

  test("calculator: the worked examples fill the boxes and light up when the numbers match", async () => {
    const page = await openPage("calculator.html");
    const calc = calculator(page);
    const buttons = page.$$(".example-button");
    buttons.forEach((button) => {
      button.click();
      assert.equal(calc.distance.value, button.dataset.exampleDistance);
      assert.equal(calc.hours(), String(Number(button.dataset.exampleDistance) / Number(button.dataset.exampleSpeed)));
      assert.deepEqual(buttons.map((b) => b.getAttribute("aria-pressed")), buttons.map((b) => String(b === button)), "only this example is pressed");
    });
    calc.type(601, 30);
    assert.ok(buttons.every((b) => b.getAttribute("aria-pressed") === "false"), "no example matches 601 ÷ 30");
    calc.type("120.0", "30");
    assert.equal(buttons[0].getAttribute("aria-pressed"), "true", "typed numbers that equal an example light it up");
    noErrors(page);
  });

  test("calculator: damaged or blocked storage never breaks the page", async () => {
    const problems = [];
    const payloads = ["not json", "{}", "null", "42", '"text"', JSON.stringify([null, 1, "x", { distance: "600", speed: 30, hours: 20, arrival: 1 }, { distance: 600, speed: 30, hours: 20, arrival: "soon" }, { distance: 600, speed: 30, hours: 20, arrival: 8.64e15 + 1 }, { distance: 9999, speed: 30, hours: 1, arrival: 1 }])];
    for (const payload of payloads) {
      store(KEYS.calculator, payload);
      const page = await openPage("calculator.html");
      const calc = calculator(page);
      if (calc.history().length) problems.push(payload.slice(0, 30) + ": shows " + calc.history().length + " estimates");
      if (text(page.$("#history-storage-status")) !== "Estimates are stored only in this browser.") problems.push(payload.slice(0, 30) + ': status "' + text(page.$("#history-storage-status")) + '"');
      calc.submit(600, 30);
      if (calc.history().length !== 1) problems.push(payload.slice(0, 30) + ": could not save a new estimate");
      errorsIn(page).forEach((error) => problems.push(payload.slice(0, 30) + ": " + error));
    }
    const valid = Array.from({ length: 50 }, (v, i) => ({ distance: 100 + i, speed: 10, hours: (100 + i) / 10, arrival: Date.now() }));
    store(KEYS.calculator, valid);
    let page = await openPage("calculator.html");
    if (calculator(page).history().length !== 5) problems.push("a long saved list is not cut to five");

    page = await openPage("calculator.html", { inject: STORAGE_BLOCKED });
    const calc = calculator(page);
    calc.submit(600, 30);
    if (calc.hours() !== "20") problems.push("blocked storage: no result");
    if (calc.history().length !== 1) problems.push("blocked storage: the estimate is not listed for this visit");
    if (!/unavailable/.test(text(page.$("#history-storage-status")))) problems.push("blocked storage: no notice that estimates will not be kept");
    page.$("#clear-history").click();
    errorsIn(page).forEach((error) => problems.push("blocked storage: " + error));
    assert.none(problems);
  }, { timeout: 60000 });

  test("calculator: stress — 600 random edits and submits never break the answer", async () => {
    const page = await openPage("calculator.html");
    const calc = calculator(page);
    const pick = random(2026);
    const values = ["", "0", "-3", "abc", "1e400", "0.0001", "5000", "5001", "100", "101", "6", "24", "599.99", "1e-9", "."];
    const any = () => (pick() < 0.4 ? values[Math.floor(pick() * values.length)] : String(Math.round(pick() * 6000) / (pick() < 0.5 ? 1 : 10)));
    for (let i = 0; i < 600; i += 1) {
      const box = pick() < 0.5 ? calc.distance : calc.speed;
      setValue(box, any());
      const action = pick();
      if (action < 0.1) page.$("#landfall-form").requestSubmit();
      else if (action < 0.2) fire(box, "change");
      else if (action < 0.3) fire(box, "blur", { bubbles: false });
      else if (action < 0.33) page.$$(".example-button")[Math.floor(pick() * 3)].click();
      if (i % 100 === 0) await frames(page.win, 1);
    }
    calc.submit(900, 30);
    assert.equal(calc.hours(), "30", "a final valid estimate is right");
    assert.equal(calc.stage(), "alert");
    assert.ok(calc.history().length <= 5, "history stays at five or fewer");
    const saved = stored(KEYS.calculator);
    assert.ok(Array.isArray(saved) && saved.every((item) => item.distance > 0 && item.distance <= 5000 && item.speed > 0 && item.speed <= 100), "only valid estimates are stored");
    noErrors(page);
  }, { timeout: 60000 });

  // ==========================================================================
  // Prepare page
  // ==========================================================================

  test("prepare: the checklist counts, saves, restores and resets", async () => {
    let page = await openPage("prepare.html");
    let checks = page.$$("[data-check-item]");
    const total = checks.length;
    [0, 2, 4].forEach((i) => checks[i].click());
    assert.equal(text(page.$("#checklist-count")), "3 of " + total + " done");
    assert.equal(page.$("#checklist-progress").value, 3);
    assert.equal(page.$("#checklist-progress").getAttribute("aria-valuetext"), "3 of " + total + " tasks complete");
    assert.deepEqual(stored(KEYS.checklist), [0, 2, 4].map((i) => checks[i].dataset.checkItem));
    assert.equal(text(page.$("#checklist-status")), "Progress saved on this device.");

    page = await openPage("prepare.html");
    checks = page.$$("[data-check-item]");
    assert.deepEqual(checks.map((c) => c.checked), checks.map((c, i) => [0, 2, 4].includes(i)), "restored after reload");
    assert.equal(text(page.$("#checklist-count")), "3 of " + total + " done");
    checks.forEach((check) => { if (!check.checked) check.click(); });
    assert.equal(text(page.$("#checklist-count")), "All " + total + " done");
    assert.ok(page.$(".checklist-panel").classList.contains("is-complete"));
    page.$("#reset-checklist").click();
    assert.ok(checks.every((check) => !check.checked), "all unticked");
    assert.equal(text(page.$("#checklist-count")), "0 of " + total + " done");
    assert.equal(localStorage.getItem(KEYS.checklist), null, "storage cleared");
    assert.ok(!page.$(".checklist-panel").classList.contains("is-complete"));
    noErrors(page);
  });

  test("prepare: the checklist ignores damaged saves", async () => {
    const problems = [];
    for (const payload of ["{", '{"shelter":true}', '"shelter"', "null", '["shelter","nope",5,null,{"a":1}]']) {
      store(KEYS.checklist, payload);
      const page = await openPage("prepare.html");
      const ticked = page.$$("[data-check-item]").filter((c) => c.checked).map((c) => c.dataset.checkItem);
      const expected = payload.startsWith("[") ? ["shelter"] : [];
      if (ticked.join() !== expected.join()) problems.push(payload + ": ticked " + ticked.join());
      errorsIn(page).forEach((error) => problems.push(payload + ": " + error));
    }
    assert.none(problems);
  });

  test("prepare: the water estimate multiplies valid numbers and flags the rest", async () => {
    const page = await openPage("prepare.html");
    const fields = ["household-size", "supply-days", "water-per-person"].map((id) => page.$("#" + id));
    const total = () => text(page.$("#water-total"));
    assert.equal(total(), "36 litres");
    const fmt = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 1 }) + (n === 1 ? " litre" : " litres");
    const cases = [[[2, 7, 2.5], fmt(35)], [[1, 1, 1], "1 litre"], [[1, 1, 0.5], fmt(0.5)], [[30, 14, 20], fmt(8400)], [[0, 3, 3], "Check the values"], [["", 3, 3], "Check the values"],
      [[31, 3, 3], "Check the values"], [[4, 15, 3], "Check the values"], [[4, 3, 2.3], "Check the values"], [[2.5, 3, 3], "Check the values"], [[4, 3, -1], "Check the values"], [[4, 3, 3], fmt(36)]];
    const problems = [];
    cases.forEach(([values, expected]) => {
      values.forEach((value, i) => setValue(fields[i], value));
      if (total() !== expected) problems.push(values.join(" × ") + " shows " + total() + " instead of " + expected);
    });
    assert.none(problems);
    noErrors(page);
  });

  function planPage(page) {
    return {
      field: (name) => page.$('#family-plan-form [name="' + name + '"]'),
      rows: () => page.$$("#plan-task-list [data-task-row]"),
      count: () => text(page.$("#plan-task-count")),
      status: () => text(page.$("#plan-status")),
      summaryShown: () => !page.$("#plan-summary").hidden,
      value: (key) => text(page.$('#plan-summary [data-plan-value="' + key + '"]')),
    };
  }

  test("prepare: the household plan autosaves, reloads and fills the printable copy", async () => {
    let page = await openPage("prepare.html");
    let plan = planPage(page);
    assert.ok(!plan.summaryShown() && page.$("#download-plan").disabled, "nothing to print before saving");
    setValue(plan.field("shelter"), "Monastery on the hill");
    setValue(plan.field("routeOne"), "Main road past the school");
    setValue(plan.field("household"), "The Aung family");
    setValue(plan.rows()[0].querySelectorAll("input")[2], "Ko Min");
    await sleep(450);
    const saved = stored(KEYS.plan);
    assert.equal(saved.shelter, "Monastery on the hill", "autosaved");
    assert.equal(saved.tasks[0].person, "Ko Min");
    assert.ok(plan.summaryShown() && !page.$("#download-plan").disabled, "the printable copy appears");
    assert.equal(plan.value("shelter"), "Monastery on the hill");
    assert.equal(plan.value("meeting"), "Not set");
    assert.equal(plan.value("household"), "The Aung family");

    page = await openPage("prepare.html");
    plan = planPage(page);
    assert.equal(plan.field("shelter").value, "Monastery on the hill", "restored after reload");
    assert.equal(plan.rows()[0].querySelectorAll("input")[2].value, "Ko Min");
    assert.equal(plan.status(), "Plan loaded from this browser on this device.");
    assert.ok(plan.summaryShown());
    page.$("#family-plan-form").requestSubmit();
    assert.match(plan.status(), /^Plan saved in this browser/);
    noErrors(page);
  });

  test("prepare: tasks can be added up to 30 and removed, with focus kept nearby", async () => {
    const page = await openPage("prepare.html");
    const plan = planPage(page);
    const add = page.$("#add-plan-task");
    for (let i = 0; i < 40; i += 1) add.click();
    assert.equal(plan.rows().length, 30, "capped at 30");
    assert.equal(plan.count(), "30 tasks");
    assert.equal(plan.status(), "A plan can have up to 30 tasks.");
    plan.rows()[4].querySelector(".task-remove").click();
    assert.equal(plan.rows().length, 29);
    assert.equal(page.doc.activeElement, plan.rows()[4].querySelector(".task-remove"), "focus moves to the next row's remove button");
    assert.equal(plan.rows()[4].querySelector(".task-remove").getAttribute("aria-label"), "Remove task 5", "rows are renumbered");
    while (plan.rows().length) plan.rows()[plan.rows().length - 1].querySelector(".task-remove").click();
    assert.equal(plan.count(), "0 tasks");
    assert.equal(page.doc.activeElement, add, "focus moves to the add button when no rows are left");
    add.click();
    assert.equal(plan.count(), "1 task");
    assert.equal(page.doc.activeElement, plan.rows()[0].querySelector("input"), "a new row's first box takes focus");
    noErrors(page);
  });

  test("prepare: the plan downloads as text, prints, and clears only after confirming", async () => {
    const page = await openPage("prepare.html");
    const plan = planPage(page);
    setValue(plan.field("planName"), "Ngwe Saung plan!");
    setValue(plan.field("contact"), "Aunty Hla, phone");
    page.$("#family-plan-form").requestSubmit();
    let blob = null;
    let fileName = null;
    page.win.URL.createObjectURL = (value) => { blob = value; return "blob:test"; };
    page.win.URL.revokeObjectURL = () => {};
    page.win.HTMLAnchorElement.prototype.click = function () { fileName = this.download; };
    page.$("#download-plan").click();
    assert.equal(fileName, "ngwe-saung-plan.txt");
    const body = await blob.text();
    assert.match(body, /^Ngwe Saung plan!\n/, "starts with the plan name");
    assert.match(body, /Trusted contact: Aunty Hla, phone/);
    assert.match(body, /Safe place: Not set/);
    assert.match(body, /1\. Pack an emergency kit \| When: Not set \| Responsible: Not set/);
    let printed = 0;
    page.win.print = () => { printed += 1; };
    page.$("#print-plan").click();
    assert.equal(printed, 1, "print opens");

    page.win.confirm = () => false;
    page.$("#clear-plan").click();
    assert.equal(plan.field("planName").value, "Ngwe Saung plan!", "cancelling keeps the plan");
    assert.ok(localStorage.getItem(KEYS.plan), "cancelling keeps the save");
    page.win.confirm = () => true;
    page.$("#clear-plan").click();
    assert.equal(localStorage.getItem(KEYS.plan), null, "save removed");
    assert.equal(plan.field("planName").value, "Our cyclone safety plan", "fields reset");
    assert.equal(plan.rows().length, 3, "example tasks back");
    assert.ok(!plan.summaryShown() && page.$("#download-plan").disabled && page.$("#print-plan").disabled, "printable copy hidden");
    await sleep(400);
    assert.equal(localStorage.getItem(KEYS.plan), null, "nothing re-saves after clearing");
    noErrors(page);
  });

  test("prepare: plan text is shown as text, never as HTML", async () => {
    const page = await openPage("prepare.html");
    const plan = planPage(page);
    const nasty = '<img src=x onerror="parent.__xss=1"><b>bold</b>';
    setValue(plan.field("shelter"), nasty);
    setValue(plan.rows()[0].querySelector("input"), nasty);
    page.$("#family-plan-form").requestSubmit();
    await sleep(100);
    assert.equal(plan.value("shelter"), nasty.slice(0, 120));
    assert.equal(page.$("#plan-summary img, #plan-summary b"), null, "no elements were created from the text");
    assert.equal(window.__xss, undefined);
    noErrors(page);
  });

  test("prepare: the plan survives damaged, old-format and oversized saves", async () => {
    const problems = [];
    const long = "x".repeat(1000);
    const cases = [
      { payload: "garbage{", check: (p, plan) => plan.status() === "A saved plan could not be read. Your current edits will stay in this browser." && plan.rows().length === 3 },
      { payload: "[1,2]", check: (p, plan) => plan.rows().length === 3 && !plan.summaryShown() },
      { payload: "null", check: (p, plan) => plan.rows().length === 3 && !plan.summaryShown() },
      { payload: { planName: 123, tasks: "x", shelter: { a: 1 } }, check: (p, plan) => plan.field("planName").value === "" && plan.field("shelter").value === "" && plan.rows().length === 3 },
      { payload: { tasks: Array.from({ length: 100 }, (v, i) => ({ title: "Task " + i })) }, check: (p, plan) => plan.rows().length === 30 && plan.count() === "30 tasks" },
      { payload: { planName: long, shelter: long, tasks: [{ title: long, person: long, when: "2026-12-01" }] }, check: (p, plan) => plan.field("planName").value.length === 72 && plan.field("shelter").value.length === 120 && plan.rows()[0].querySelectorAll("input")[0].value.length === 160 && plan.rows()[0].querySelectorAll("input")[2].value.length === 64 && plan.rows()[0].querySelectorAll("input")[1].value === "2026-12-01" },
      { payload: { householdName: "Old house", meetingPlace: "Big tree", tasks: [{ task: "Old task", who: "Mum", when: "2026-13-45" }] }, check: (p, plan) => plan.field("household").value === "Old house" && plan.field("meeting").value === "Big tree" && plan.rows()[0].querySelectorAll("input")[0].value === "Old task" && plan.rows()[0].querySelectorAll("input")[2].value === "Mum" && plan.value("household") === "Old house" },
      { payload: { tasks: [null, 5, "text", { title: 5, when: "tomorrow" }, []] }, check: (p, plan) => plan.rows().length === 5 && plan.rows().every((row) => row.querySelector("input").value === "") },
      { payload: { tasks: [] }, check: (p, plan) => plan.rows().length === 0 && plan.count() === "0 tasks" },
    ];
    for (const { payload, check } of cases) {
      store(KEYS.plan, payload);
      const page = await openPage("prepare.html");
      const label = (typeof payload === "string" ? payload : JSON.stringify(payload)).slice(0, 50);
      if (!check(page, planPage(page))) problems.push(label + ": not handled as expected");
      errorsIn(page).forEach((error) => problems.push(label + ": " + error));
    }
    assert.none(problems);
  }, { timeout: 60000 });

  test("prepare: everything still works when browser storage is blocked", async () => {
    const page = await openPage("prepare.html", { inject: STORAGE_BLOCKED });
    page.$$("[data-check-item]")[0].click();
    assert.equal(text(page.$("#checklist-status")), "Browser storage is unavailable; progress will not be saved.");
    const plan = planPage(page);
    setValue(plan.field("shelter"), "School");
    page.$("#family-plan-form").requestSubmit();
    assert.equal(plan.status(), "The plan preview is ready, but browser storage is unavailable.");
    assert.equal(plan.value("shelter"), "School");
    page.win.confirm = () => true;
    page.$("#clear-plan").click();
    page.$("#reset-checklist").click();
    noErrors(page);
  });

  test("prepare: stress — 300 random plan edits keep the editor, summary and save in step", async () => {
    const page = await openPage("prepare.html");
    const plan = planPage(page);
    const pick = random(99);
    const names = ["planName", "household", "shelter", "meeting", "routeOne", "routeTwo", "contact"];
    for (let i = 0; i < 300; i += 1) {
      const action = pick();
      if (action < 0.25) page.$("#add-plan-task").click();
      else if (action < 0.4 && plan.rows().length) plan.rows()[Math.floor(pick() * plan.rows().length)].querySelector(".task-remove").click();
      else if (action < 0.7) setValue(plan.field(names[Math.floor(pick() * names.length)]), "Value " + i);
      else if (action < 0.9 && plan.rows().length) setValue(plan.rows()[Math.floor(pick() * plan.rows().length)].querySelector("input"), "Task " + i);
      else page.$("#family-plan-form").requestSubmit();
    }
    page.$("#family-plan-form").requestSubmit();
    const saved = stored(KEYS.plan);
    assert.equal(saved.tasks.length, plan.rows().length, "saved task count matches the editor");
    assert.equal(page.$$("#saved-plan-tasks li").length, plan.rows().length, "printable task count matches the editor");
    assert.equal(plan.count(), plan.rows().length + (plan.rows().length === 1 ? " task" : " tasks"));
    names.forEach((name) => assert.equal(saved[name], plan.field(name).value, name + " saved"));
    plan.rows().forEach((row, i) => assert.equal(row.querySelector(".task-remove").getAttribute("aria-label"), "Remove task " + (i + 1)));
    noErrors(page);
  }, { timeout: 60000 });

  // ==========================================================================
  // Warnings page
  // ==========================================================================

  test("warnings: the stage timeline is built in order and opens each stage", async () => {
    const page = await openPage("warnings.html");
    assert.ok(!page.$("#warning-timeline").hidden, "the timeline is shown");
    const buttons = page.$$(".timeline-button");
    assert.deepEqual(buttons.map((b) => b.getAttribute("aria-controls")), ["warning-alert", "warning-prepare", "warning-evacuate"]);
    assert.deepEqual(buttons.map((b) => text(b.querySelector(".timeline-number"))), page.$$(".stage-mark").map(text), "numbers match the panels below");
    for (const button of buttons.slice().reverse()) {
      const panel = page.$("#" + button.getAttribute("aria-controls"));
      panel.open = false;
      button.click();
      assert.ok(panel.open, panel.id + " opens");
      assert.equal(page.doc.activeElement, panel.querySelector("summary"), "focus moves to its summary");
    }
    noErrors(page);
  });

  // ==========================================================================
  // Sources page
  // ==========================================================================

  test("sources: every reference shows its page tags, and none shows an empty list", async () => {
    const page = await openPage("sources.html");
    const order = ["home", "cyclones", "history", "calculator", "warnings", "prepare"];
    const labels = { home: "Home", cyclones: "Cyclones", history: "History", calculator: "Calculator", warnings: "Warnings", prepare: "Prepare" };
    const problems = [];
    page.$$("[data-reference]").forEach((reference) => {
      const tags = Array.from(reference.querySelectorAll(".reference-pages li")).map(text);
      const pages = order.filter((key) => reference.dataset.pages.split(/\s+/).includes(key)).map((key) => labels[key]);
      if (pages.length && tags.join() !== pages.join()) problems.push(reference.id + ": tags " + tags.join() + " instead of " + pages.join());
      const list = reference.querySelector(".reference-pages");
      if (list && !list.children.length) problems.push(reference.id + ": an empty list of pages");
    });
    assert.none(problems);
    noErrors(page);
  });

  test("sources: the page filter shows the right references and count", async () => {
    const page = await openPage("sources.html");
    const filter = page.$("#reference-filter");
    const references = page.$$("[data-reference]");
    const problems = [];
    for (const option of Array.from(filter.options)) {
      setValue(filter, option.value, ["change"]);
      const expected = references.filter((r) => option.value === "all" || r.dataset.pages.split(/\s+/).includes(option.value));
      const visible = references.filter((r) => !r.hidden);
      if (visible.map((r) => r.id).join() !== expected.map((r) => r.id).join()) problems.push(option.value + ": shows " + visible.length + " instead of " + expected.length);
      if (text(page.$("#reference-count")) !== expected.length + (expected.length === 1 ? " reference shown." : " references shown.")) problems.push(option.value + ": count says " + text(page.$("#reference-count")));
      if (page.$("#references-empty").hidden !== expected.length > 0) problems.push(option.value + ": wrong empty state");
    }
    assert.none(problems);
    noErrors(page);
  });

  test("sources: copy buttons copy the citation, have distinct labels, and report failure", async () => {
    const page = await openPage("sources.html");
    const buttons = page.$$("[data-copy-citation]");
    const labels = buttons.map((b) => b.getAttribute("aria-label"));
    assert.equal(new Set(labels).size, labels.length, "every copy button has its own label (duplicates: " + labels.filter((l, i) => labels.indexOf(l) !== i).join(" | ") + ")");
    let copied = null;
    Object.defineProperty(page.win.navigator, "clipboard", { configurable: true, value: { writeText: (value) => { copied = value; return Promise.resolve(); } } });
    buttons[2].click();
    await sleep(50);
    assert.equal(copied, text(buttons[2].closest("li").querySelector(".reference-citation")), "the citation text is copied");
    assert.equal(text(buttons[2]), "Copied");
    assert.equal(text(page.$("#copy-status")), "Citation copied.");
    Object.defineProperty(page.win.navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("denied")) } });
    page.doc.execCommand = () => false;
    buttons[3].click();
    await sleep(50);
    assert.match(text(page.$("#copy-status")), /^Copy is unavailable/);
    assert.equal(text(buttons[3]), "Copy citation", "the label is not changed after a failure");
    assert.equal(page.doc.activeElement, buttons[3], "focus stays on the button");
    noErrors(page);
  });

  test("sources: following a marker shows the entry even if it was filtered out, and offers a way back", async () => {
    let page = await openPage("cyclones.html", { real: true });
    page.$('sup.cite a[href="sources.html#ref-16"]').click();
    page = await nextLoad(page);
    assert.match(page.win.location.href, /sources\.html#ref-16$/);
    const back = page.$("#ref-16 .cite-back");
    assert.ok(back, "a back link is added to the entry");
    assert.equal(text(back), "← Back to Cyclones");
    assert.equal(page.$$(".cite-back").length, 1, "only one back link");

    setValue(page.$("#reference-filter"), "warnings", ["change"]);
    assert.ok(page.$("#ref-18").hidden, "ref-18 is filtered out");
    page.win.location.hash = "#ref-18";
    await sleep(100);
    assert.equal(page.$("#reference-filter").value, "all", "the filter resets");
    assert.ok(!page.$("#ref-18").hidden, "the entry is shown");
    assert.equal(page.$$(".cite-back").length, 1, "still one back link");
    assert.ok(page.$("#ref-18 .cite-back"), "the back link moves to the new entry");
    noErrors(page);

    page = await openPage("cyclones.html", { real: true });
    page.$('sup.cite a[href="sources.html#ref-16"]').click();
    page = await nextLoad(page);
    page.$("#ref-16 .cite-back").click();
    page = await nextLoad(page);
    assert.match(page.win.location.pathname, /cyclones\.html$/, "the back link returns to the Cyclones page");
    noErrors(page);
  }, { timeout: 60000 });

  // ==========================================================================
  // Accounts and the Community page
  // ==========================================================================

  const COMMUNITY = {
    users: "beforeLandfall.users.v1",
    session: "beforeLandfall.session.v1",
    events: "beforeLandfall.events.v1",
    posts: "beforeLandfall.posts.v1",
  };
  const isoDay = (win, offset) => {
    const date = new win.Date();
    date.setDate(date.getDate() + offset);
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  };
  const fieldError = (page, id) => {
    const box = page.$("#" + id + "-error");
    return box && !box.hidden ? text(box) : "";
  };
  // People saved straight into storage. Logging in only needs the session to name them,
  // so they need no password hash.
  const person = (id, name, role) => ({ id, name, username: name.toLowerCase(), email: "", salt: "", hash: "", role, joined: Date.UTC(2026, 0, 1) });
  function signedIn(user, others) {
    store(COMMUNITY.users, [user].concat(others || []));
    store(COMMUNITY.session, { userId: user.id, at: Date.now() });
  }
  function fillRegister(page, values) {
    Object.entries(values).forEach(([name, value]) => {
      const input = page.$("#register-" + name);
      if (input.type === "checkbox") {
        if (input.checked !== value) input.click();
      } else {
        setValue(input, value);
        fire(input, "blur", { bubbles: false });
      }
    });
  }
  const submit = (page, formId) => page.$("#" + formId + " button[type='submit']").click();

  test("account: the hash matches the published SHA-256 examples", async () => {
    const page = await openPage("account.html");
    const { sha256 } = page.win.BeforeLandfallCommunity;
    assert.equal(sha256(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    assert.equal(sha256("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"), "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
    assert.equal(sha256("a".repeat(1000)), "41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3", "several blocks");
    noErrors(page);
  });

  test("account: register checks every box, then saves a member without the password and logs them in", async () => {
    let page = await openPage("account.html");
    submit(page, "register-form");
    const empty = ["name", "username", "email", "password", "confirm", "agree"].filter((name) => !fieldError(page, "register-" + name));
    assert.deepEqual(empty, [], "every empty box shows an error");
    assert.equal(page.doc.activeElement.id, "register-name", "focus goes to the first problem");

    fillRegister(page, { name: "Mya", username: "Mya Storm", email: "mya@", password: "short", confirm: "other" });
    assert.match(fieldError(page, "register-username"), /letters, numbers or underscores/);
    assert.match(fieldError(page, "register-email"), /email address like/);
    assert.match(fieldError(page, "register-password"), /at least 8/);
    assert.match(fieldError(page, "register-confirm"), /do not match/);
    fillRegister(page, { password: "longenough" });
    assert.match(fieldError(page, "register-password"), /letter and one number/);
    fillRegister(page, { username: "aye_chan" });
    assert.match(fieldError(page, "register-username"), /taken/, "a sample member's username is taken");

    fillRegister(page, { username: "mya_storm", email: "mya@example.com", password: "typhoon2026", confirm: "typhoon2026", agree: true });
    assert.equal(page.$$(".field-error:not([hidden])").length, 0, "no errors remain");
    assert.equal(page.$("#password-strength").dataset.level, "weak", "lower-case letters and a number are weak");
    fillRegister(page, { password: "Typhoon-2026!", confirm: "Typhoon-2026!" });
    assert.equal(page.$("#password-strength").dataset.level, "strong", "long, mixed case and a symbol are strong");
    submit(page, "register-form");
    page = await nextLoad(page);
    assert.match(page.win.location.pathname, /community\.html$/, "goes on to the Community page");

    const saved = localStorage.getItem(COMMUNITY.users);
    const mya = JSON.parse(saved).find((user) => user.username === "mya_storm");
    assert.ok(mya && mya.role === "member", "saved as a member");
    assert.match(mya.hash, /^[0-9a-f]{64}$/, "the password is kept as a hash");
    assert.ok(!/typhoon-2026/i.test(saved), "the password itself is never saved");
    assert.deepEqual(stored(COMMUNITY.session).userId, mya.id, "logged in, and kept logged in");
    assert.equal(text(page.$("#account-link .account-label")), "Mya", "the header shows the name");
    assert.ok(page.$("#admin-tools").hidden, "a member does not see the admin tools");
    noErrors(page);
  }, { timeout: 60000 });

  test("account: log in refuses a wrong password, and 'keep me logged in' decides where the session lives", async () => {
    let page = await openPage("account.html");
    fillRegister(page, { name: "Ko Test", username: "ko_test", email: "ko@example.com", password: "surge2026a", confirm: "surge2026a", agree: true });
    submit(page, "register-form");
    page = await nextLoad(page);

    page = await openPage("account.html");
    assert.ok(!page.$("#signed-in-card").hidden && page.$("#account-forms").hidden, "a logged-in visitor sees who they are");
    page.$("#log-out-button").click();
    assert.equal(localStorage.getItem(COMMUNITY.session), null, "log out forgets the session");
    assert.ok(!page.$("#account-forms").hidden, "the forms come back");

    submit(page, "login-form");
    assert.match(fieldError(page, "login-id"), /username or email/);
    setValue(page.$("#login-id"), "ko_test");
    setValue(page.$("#login-password"), "wrong-pass1");
    submit(page, "login-form");
    assert.match(text(page.$("#login-error")), /do not match/);
    assert.equal(page.$("#login-password").value, "", "the wrong password is cleared");
    setValue(page.$("#login-id"), "nobody");
    setValue(page.$("#login-password"), "surge2026a");
    submit(page, "login-form");
    assert.match(text(page.$("#login-error")), /do not match/, "an unknown name gets the same message");

    page.$("#login-password").type = "password";
    page.$("[data-password-toggle][aria-controls='login-password']").click();
    assert.equal(page.$("#login-password").type, "text", "Show reveals the password");
    assert.equal(text(page.$("[data-password-toggle][aria-controls='login-password'] .toggle-word")), "Hide");

    setValue(page.$("#login-id"), "KO@example.com");
    setValue(page.$("#login-password"), "surge2026a");
    page.$("#login-remember").click();
    submit(page, "login-form");
    page = await nextLoad(page);
    assert.equal(localStorage.getItem(COMMUNITY.session), null, "unticked: not kept in localStorage");
    assert.ok(sessionStorage.getItem(COMMUNITY.session), "unticked: kept for this tab only");
    sessionStorage.removeItem(COMMUNITY.session);
    noErrors(page);
  }, { timeout: 60000 });

  test("community: guests can read, and the calendar moves by click, button and keyboard", async () => {
    const page = await openPage("community.html");
    const { win } = page;
    assert.ok(page.$("#post-form").hidden && !page.$("#post-prompt").hidden, "guests are asked to log in to post");
    assert.ok(page.$("#event-form").hidden, "guests cannot suggest meet-ups");
    assert.ok(page.$$("#post-list .post-card").length >= 4, "the sample posts show");
    assert.ok(page.$("#post-list .post-card").classList.contains("is-pinned"), "the pinned post comes first");
    assert.equal(page.$$("#post-list .reply-form").length, 0, "no reply boxes for guests");
    assert.ok(!text(page.$("#upcoming-events")).includes("evacuation route"), "a meet-up waiting for approval is hidden from guests");

    const now = new win.Date();
    const monthName = MONTHS[now.getMonth()] + " " + now.getFullYear();
    assert.equal(text(page.$("#calendar-month")), monthName);
    const selected = () => page.$('.calendar-day[aria-pressed="true"]').dataset.date;
    assert.equal(selected(), isoDay(win, 0), "today is chosen");
    assert.equal(page.$$('.calendar-day[tabindex="0"]').length, 1, "one day is in the tab order");

    key(page.$(".calendar-day[aria-pressed='true']"), "ArrowRight");
    assert.equal(selected(), isoDay(win, 1), "ArrowRight moves a day");
    key(page.doc.activeElement, "ArrowUp");
    assert.equal(selected(), isoDay(win, -6), "ArrowUp moves back a week");
    assert.equal(page.doc.activeElement.dataset.date, selected(), "focus follows the chosen day");
    const before = text(page.$("#calendar-month"));
    key(page.doc.activeElement, "PageDown");
    assert.ok(text(page.$("#calendar-month")) !== before, "PageDown shows another month");
    page.$("#calendar-today").click();
    assert.equal(selected(), isoDay(win, 0), "Today comes back");
    page.$("#calendar-prev").click();
    page.$("#calendar-next").click();
    assert.equal(text(page.$("#calendar-month")), monthName, "back and forward return to this month");

    const fanMeet = isoDay(win, 4);
    if (!page.$('[data-date="' + fanMeet + '"]')) page.$("#calendar-next").click();
    page.$('[data-date="' + fanMeet + '"]').click();
    assert.match(text(page.$("#day-events")), /fan meet/, "choosing a day lists its meet-ups");
    assert.match(page.$('[data-date="' + fanMeet + '"]').getAttribute("aria-label"), /1 meet-up/);
    noErrors(page);
  });

  test("community: members post as plain text, reply, and suggest meet-ups that wait for an admin", async () => {
    signedIn(person("u-tester", "Tester", "member"));
    let page = await openPage("community.html");
    page.win.confirm = () => true;
    assert.ok(!page.$("#post-form").hidden, "members can post");
    assert.ok(page.$('#new-post-topic option[value="Notice"]').disabled, "only admins can post a notice");

    submit(page, "post-form");
    assert.ok(fieldError(page, "new-post-title") && fieldError(page, "new-post-body"), "empty posts are refused");
    setValue(page.$("#new-post-title"), '<img src=x onerror="window.__hacked=1"> Surge facts');
    setValue(page.$("#new-post-body"), "First <b>paragraph</b>.\n\nSecond paragraph.");
    setValue(page.$("#new-post-topic"), "History", ["change"]);
    submit(page, "post-form");
    const card = page.$$("#post-list .post-card").find((item) => /Surge facts/.test(text(item)));
    assert.ok(card, "the post is listed");
    assert.equal(text(card.querySelector(".post-title")), '<img src=x onerror="window.__hacked=1"> Surge facts', "the title shows as text");
    assert.equal(page.$$("#post-list img, #post-list b").length, 0, "no HTML from the post is built");
    assert.equal(card.querySelectorAll(".post-body > p").length, 2, "blank lines make paragraphs");
    assert.ok(!page.win.__hacked);

    const details = card.querySelector("details");
    details.open = true;
    setValue(details.querySelector("textarea"), "A reply from me");
    details.querySelector("form button").click();
    const posts = stored(COMMUNITY.posts);
    assert.deepEqual(posts.find((post) => /Surge facts/.test(post.title)).replies.map((reply) => reply.body), ["A reply from me"]);

    const day = isoDay(page.win, 2);
    if (!page.$('[data-date="' + day + '"]')) page.$("#calendar-next").click();
    page.$('[data-date="' + day + '"]').click();
    submit(page, "event-form");
    assert.ok(fieldError(page, "meetup-title") && fieldError(page, "meetup-time") && fieldError(page, "meetup-place"), "a meet-up needs a name, time and place");
    setValue(page.$("#meetup-title"), "Rain gauge club");
    setValue(page.$("#meetup-time"), "16:45");
    setValue(page.$("#meetup-place"), "Science lab");
    submit(page, "event-form");
    const saved = stored(COMMUNITY.events).find((event) => event.title === "Rain gauge club");
    assert.ok(saved && saved.status === "pending" && saved.date === day, "a member's meet-up waits for approval");
    assert.ok(page.$("#day-events .event-card.is-pending"), "the person who suggested it can see it");

    page.$$("#day-events .event-card .text-button").find((button) => text(button) === "Delete").click();
    assert.ok(!stored(COMMUNITY.events).some((event) => event.title === "Rain gauge club"), "members can delete their own meet-up");
    assert.equal(page.$$("#post-list .post-card").filter((item) => !/Surge facts/.test(text(item))).flatMap((item) => Array.from(item.querySelectorAll(".post-actions .text-button"))).length, 0, "no delete buttons on other people's posts");
    noErrors(page);
  });

  test("community: admins approve meet-ups, pin and delete posts, and choose other admins", async () => {
    signedIn(person("u-boss", "Boss", "admin"), [person("u-pupil", "Pupil", "member")]);
    store(COMMUNITY.posts, [
      { id: "p-old", title: "Older post", body: "Older body text.", topic: "Science", authorId: "u-pupil", created: Date.now() - 2e8, pinned: false, replies: [] },
      { id: "p-new", title: "Newer post", body: "Newer body text.", topic: "Question", authorId: "u-pupil", created: Date.now() - 1e8, pinned: false, replies: [] },
    ]);
    const page = await openPage("community.html");
    page.win.confirm = () => true;
    const firstTitle = () => text(page.$("#post-list .post-title"));
    assert.ok(!page.$("#admin-tools").hidden, "admins see the admin tools");
    assert.ok(!page.$('#new-post-topic option[value="Notice"]').disabled, "admins can post a notice");
    assert.equal(firstTitle(), "Newer post", "newest first");

    page.$$("#post-list .text-button").find((button) => button.getAttribute("aria-label") === "Pin “Older post”").click();
    assert.equal(firstTitle(), "Older post", "a pinned post goes to the top");
    assert.ok(stored(COMMUNITY.posts).find((post) => post.id === "p-old").pinned);
    page.$$("#post-list .text-button").find((button) => button.getAttribute("aria-label") === "Delete the post “Newer post”").click();
    assert.deepEqual(stored(COMMUNITY.posts).map((post) => post.id), ["p-old"], "admins can delete anyone's post");

    const pending = page.$("#pending-events .event-card");
    assert.ok(pending && /evacuation route/.test(text(pending)), "the sample suggestion waits for approval");
    Array.from(pending.querySelectorAll("button")).find((button) => text(button) === "Approve").click();
    assert.equal(stored(COMMUNITY.events).find((event) => event.id === "e-sample-map").status, "approved");
    assert.ok(!page.$("#pending-empty").hidden, "nothing is left waiting");

    const rows = () => page.$$("#member-rows tr").map((row) => text(row));
    assert.ok(rows().some((row) => /^Lin Thuriya Pho Hlaing.*Not registered yet/.test(row)), "the group admins wait to register");
    const waiting = page.$('#member-rows button[aria-label="Make Zayar Win Htay a member"]');
    assert.ok(waiting && waiting.disabled, "a group admin keeps the role until they register");
    page.$('#member-rows button[aria-label="Make Pupil an admin"]').click();
    assert.equal(stored(COMMUNITY.users).find((user) => user.id === "u-pupil").role, "admin");
    assert.ok(rows().some((row) => /^Boss.*You$/.test(row)), "admins cannot change their own role");

    noErrors(page);
  });

  test("community: damaged saves and blocked storage never break the pages", async () => {
    const problems = [];
    const damaged = ["{", "null", "[]", '{"userId":"u-ghost"}', JSON.stringify([{ id: "x", title: 5 }, null, "a"]), JSON.stringify([{ id: "u-x", username: "<b>", name: "" }])];
    for (const value of damaged) {
      Object.values(COMMUNITY).forEach((name) => localStorage.setItem(name, value));
      for (const path of ["community.html", "account.html"]) {
        const page = await openPage(path);
        errorsIn(page).forEach((error) => problems.push(path + " with " + value + ": " + error));
      }
    }
    Object.values(COMMUNITY).forEach((name) => localStorage.removeItem(name));
    const blocked = await openPage("account.html", { inject: STORAGE_BLOCKED });
    errorsIn(blocked).forEach((error) => problems.push("blocked account.html: " + error));
    if (blocked.$("#account-storage-note").hidden) problems.push("blocked account.html: no storage message");
    const blockedCommunity = await openPage("community.html", { inject: STORAGE_BLOCKED });
    errorsIn(blockedCommunity).forEach((error) => problems.push("blocked community.html: " + error));
    if (!blockedCommunity.$$("#post-list .post-card").length) problems.push("blocked community.html: the sample posts are missing");
    assert.none(problems);
  }, { timeout: 60000 });

  // ==========================================================================
  // Storage fuzzing: random JSON in every saved key must never break a page
  // ==========================================================================

  test("stress: 60 random saved values across the storage keys never cause an error", async () => {
    const pick = random(1234);
    const value = (depth) => {
      const r = pick();
      if (depth > 3 || r < 0.15) return [null, true, false, 0, -1, 1e308, "", "x", "2026-01-01", "shelter"][Math.floor(pick() * 10)];
      if (r < 0.35) return Math.round((pick() - 0.5) * 1e6) / 100;
      if (r < 0.5) return "s".repeat(Math.floor(pick() * 300));
      if (r < 0.75) return Array.from({ length: Math.floor(pick() * 8) }, () => value(depth + 1));
      const keys = ["distance", "speed", "hours", "arrival", "title", "task", "when", "person", "who", "tasks", "planName", "household", "householdName", "shelter", "meeting", "meetingPlace", "routeOne", "contact",
        "id", "userId", "username", "name", "role", "hash", "date", "time", "status", "going", "body", "replies", "pinned", "created", "__proto__", "constructor"];
      const object = {};
      for (let i = Math.floor(pick() * 6); i > 0; i -= 1) object[keys[Math.floor(pick() * keys.length)]] = value(depth + 1);
      return object;
    };
    const targets = [["calculator.html", KEYS.calculator], ["prepare.html", KEYS.checklist], ["prepare.html", KEYS.plan], ["index.html", "theme"], ["index.html", "sound"], ["cyclones.html", "theme"],
      ["community.html", "beforeLandfall.users.v1"], ["community.html", "beforeLandfall.events.v1"], ["community.html", "beforeLandfall.posts.v1"], ["account.html", "beforeLandfall.session.v1"]];
    const problems = [];
    for (let round = 0; round < 6; round += 1) {
      for (const [path, name] of targets) {
        const payload = JSON.stringify(value(0));
        Object.values(KEYS).concat(["theme", "sound"], Object.values(COMMUNITY)).forEach((stale) => localStorage.removeItem(stale));
        localStorage.setItem(name, payload);
        const page = await openPage(path);
        errorsIn(page).forEach((error) => problems.push(name + " = " + payload.slice(0, 60) + ": " + error));
      }
    }
    assert.none(problems);
  }, { timeout: 120000 });
})();
