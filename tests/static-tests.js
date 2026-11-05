/* Static checks: the pages, styles and scripts read as files, without running them. */
(function () {
  "use strict";

  const { PAGES, PAGE_KEYS, test, assert, getText, getDoc, exists, site } = window.Harness;
  const SITE_SCRIPTS = ["script.js", "sound.js", "motion.js"];
  const LIB_SCRIPTS = ["lib/lisse.js", "lib/rolltext.min.js", "lib/gsap.min.js", "lib/ScrollTrigger.min.js", "lib/SplitText.min.js"];
  const STYLESHEETS = ["styles.css", "motion.css"];
  const COMMONS = "https://commons.wikimedia.org/wiki/Special:FilePath/";

  const isExternal = (url) => /^(?:[a-z]+:)?\/\//i.test(url);
  const normalize = (html) => html.replace(/\s+aria-current="page"/g, "").replace(/>\s+</g, "><").replace(/\s+/g, " ").trim();
  const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

  // Which Commons file an image URL points to, e.g. "Nargis_2008-05-01_0440Z.jpg".
  function commonsFile(url) {
    const match = /(?:Special:FilePath\/|\/wiki\/File:)([^?#\s]+)/.exec(url);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function srcsetCandidates(srcset) {
    return (srcset || "").split(",").map((part) => part.trim()).filter(Boolean).map((part) => {
      const [url, descriptor] = part.split(/\s+/);
      return { url, descriptor: descriptor || "" };
    });
  }

  // The accessible name a screen reader would read, roughly: aria-label, aria-labelledby,
  // or the text that is not aria-hidden.
  function accessibleName(element) {
    const doc = element.ownerDocument;
    if (element.getAttribute("aria-label")) return element.getAttribute("aria-label").trim();
    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) return labelledBy.split(/\s+/).map((id) => (doc.getElementById(id) || {}).textContent || "").join(" ").trim();
    const clone = element.cloneNode(true);
    clone.querySelectorAll("[aria-hidden='true']").forEach((node) => node.remove());
    return clone.textContent.replace(/\s+/g, " ").trim() || (element.getAttribute("title") || "").trim();
  }

  // Everything the pages cite: { page, ref: "ref-18", text, title, label } per marker.
  async function citations() {
    const list = [];
    for (const page of PAGES) {
      const doc = await getDoc(page);
      doc.querySelectorAll("sup.cite a").forEach((link) => {
        list.push({ page, href: link.getAttribute("href"), ref: (link.getAttribute("href") || "").split("#")[1], text: link.textContent.trim(), title: link.getAttribute("title"), label: link.getAttribute("aria-label") });
      });
    }
    return list;
  }

  // ==========================================================================
  // Documents
  // ==========================================================================

  test("static: every page has the document basics", async () => {
    const problems = [];
    const titles = new Map();
    for (const page of PAGES) {
      const text = await getText(page);
      const doc = await getDoc(page);
      if (!/^<!DOCTYPE html>/i.test(text)) problems.push(page + ": missing <!DOCTYPE html>");
      if (doc.documentElement.getAttribute("lang") !== "en") problems.push(page + ": <html lang> is not en");
      if (!doc.querySelector('meta[charset="utf-8"]')) problems.push(page + ": missing <meta charset>");
      const viewport = doc.querySelector('meta[name="viewport"]');
      if (!viewport || viewport.content !== "width=device-width, initial-scale=1") problems.push(page + ": viewport meta differs");
      const title = doc.title.trim();
      if (!title) problems.push(page + ": empty <title>");
      if (titles.has(title)) problems.push(page + ": same <title> as " + titles.get(title));
      titles.set(title, page);
      if (!(doc.querySelector('meta[name="description"]') || {}).content) problems.push(page + ": missing meta description");
      if (doc.querySelectorAll('meta[name="theme-color"]').length !== 2) problems.push(page + ": expected light and dark theme-color metas");
      if (doc.querySelectorAll("main").length !== 1 || !doc.querySelector("main#main")) problems.push(page + ": expected one <main id=\"main\">");
      const skip = doc.body.querySelector("a, button, input, select, textarea");
      if (!skip || skip.getAttribute("href") !== "#main") problems.push(page + ": the first focusable element is not the skip link");
      if (doc.querySelector("[style]")) problems.push(page + ": inline style attribute on <" + doc.querySelector("[style]").tagName.toLowerCase() + ">");
    }
    assert.none(problems);
  });

  test("static: ids are unique and every id reference resolves", async () => {
    const problems = [];
    const ID_LIST_ATTRS = ["for", "aria-labelledby", "aria-describedby", "aria-controls", "aria-owns", "aria-details", "headers", "list", "form"];
    for (const page of PAGES) {
      const doc = await getDoc(page);
      const seen = new Set();
      doc.querySelectorAll("[id]").forEach((element) => {
        if (seen.has(element.id)) problems.push(page + ": duplicate id #" + element.id);
        seen.add(element.id);
      });
      ID_LIST_ATTRS.forEach((attr) => {
        doc.querySelectorAll("[" + attr + "]").forEach((element) => {
          element.getAttribute(attr).split(/\s+/).filter(Boolean).forEach((id) => {
            if (!seen.has(id)) problems.push(page + ": " + attr + '="' + id + '" has no matching id');
          });
        });
      });
      doc.querySelectorAll('a[href^="#"]').forEach((link) => {
        const id = link.getAttribute("href").slice(1);
        if (id && !seen.has(id)) problems.push(page + ': link to "#' + id + '" has no target');
      });
      doc.querySelectorAll("*").forEach((element) => {
        Array.from(element.attributes).forEach((attribute) => {
          const match = /url\(#([^)]+)\)/.exec(attribute.value);
          if (match && !seen.has(match[1])) problems.push(page + ": " + attribute.name + " points at missing #" + match[1]);
        });
      });
    }
    assert.none(problems);
  });

  test("static: internal links point at pages and anchors that exist", async () => {
    const problems = [];
    for (const page of PAGES) {
      const doc = await getDoc(page);
      for (const link of doc.querySelectorAll("a[href]")) {
        const href = link.getAttribute("href");
        if (isExternal(href) || /^(mailto|tel):/.test(href) || href.startsWith("#")) continue;
        const url = new URL(href, site(page));
        const target = url.pathname.split("/").pop();
        if (!PAGES.includes(target)) {
          if (!(await exists(href))) problems.push(page + ": link to missing file " + href);
          continue;
        }
        if (url.hash) {
          const targetDoc = await getDoc(target);
          if (!targetDoc.getElementById(decodeURIComponent(url.hash.slice(1)))) problems.push(page + ": " + href + " has no matching id on " + target);
        }
      }
    }
    assert.none(problems);
  });

  test("static: every local file the pages and styles use exists", async () => {
    const wanted = new Set();
    for (const page of PAGES) {
      const doc = await getDoc(page);
      doc.querySelectorAll("script[src], img[src], source[src]").forEach((element) => {
        const src = element.getAttribute("src");
        if (!isExternal(src)) wanted.add(src);
      });
      doc.querySelectorAll("link[href]").forEach((link) => {
        if (!isExternal(link.getAttribute("href"))) wanted.add(link.getAttribute("href"));
      });
    }
    for (const sheet of STYLESHEETS) {
      const css = stripComments(await getText(sheet));
      for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
        if (!match[1].startsWith("#") && !match[1].startsWith("data:")) wanted.add(match[1]);
      }
    }
    const missing = [];
    for (const path of wanted) {
      if (!(await exists(path))) missing.push(path);
    }
    assert.none(missing, "missing files");
  });

  test("static: no external scripts, styles, fonts or network calls (Wikimedia photos are the one exception)", async () => {
    const problems = [];
    for (const page of PAGES) {
      const doc = await getDoc(page);
      doc.querySelectorAll("script[src]").forEach((script) => {
        if (isExternal(script.getAttribute("src"))) problems.push(page + ": external script " + script.getAttribute("src"));
      });
      doc.querySelectorAll("link[href]").forEach((link) => {
        if (isExternal(link.getAttribute("href"))) problems.push(page + ": external <link rel=" + link.rel + "> " + link.getAttribute("href"));
      });
      doc.querySelectorAll("iframe, object, embed, frame, audio, video, base, form[action]").forEach((element) => {
        problems.push(page + ": unexpected <" + element.tagName.toLowerCase() + ">");
      });
      doc.querySelectorAll("img").forEach((img) => {
        [img.getAttribute("src"), ...srcsetCandidates(img.getAttribute("srcset")).map((c) => c.url)].forEach((url) => {
          if (url && isExternal(url) && !url.startsWith(COMMONS)) problems.push(page + ": image from outside Wikimedia Commons " + url);
        });
      });
      doc.querySelectorAll("script:not([src])").forEach((script) => {
        if (/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts)\b|import\(/.test(script.textContent)) problems.push(page + ": inline script makes a network call");
      });
    }
    for (const sheet of STYLESHEETS) {
      const css = stripComments(await getText(sheet));
      if (/@import/.test(css)) problems.push(sheet + ": uses @import");
      if (/url\(\s*["']?(?:[a-z]+:)?\/\//i.test(css)) problems.push(sheet + ": loads a url() from another site");
    }
    for (const file of [...SITE_SCRIPTS, ...LIB_SCRIPTS]) {
      const js = await getText(file);
      const match = /\b(fetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts)|\bimport\(/.exec(js);
      if (match) problems.push(file + ": network call (" + match[0] + ")");
    }
    assert.none(problems);
  });

  // ==========================================================================
  // Shared page furniture
  // ==========================================================================

  test("static: header, footer, head scripts and script order are the same on every page", async () => {
    const problems = [];
    const reference = await getDoc("index.html");
    const parts = (doc) => ({
      header: normalize(doc.querySelector("body > header.site-header").outerHTML),
      footer: normalize(doc.querySelector("body > footer.site-footer").outerHTML),
      headScripts: Array.from(doc.head.querySelectorAll("script")).map((s) => normalize(s.textContent)).join("\n"),
      styles: Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map((l) => l.getAttribute("href")).join(","),
      scripts: Array.from(doc.querySelectorAll("script[src]")).map((s) => s.getAttribute("src") + (s.defer ? ":defer" : "")).join(","),
      icon: (doc.querySelector('link[rel="icon"]') || {}).outerHTML,
      themeColors: Array.from(doc.querySelectorAll('meta[name="theme-color"]')).map((m) => m.outerHTML).join(""),
    });
    const expected = parts(reference);
    for (const page of PAGES.slice(1)) {
      const actual = parts(await getDoc(page));
      Object.keys(expected).forEach((name) => {
        if (actual[name] !== expected[name]) problems.push(page + ": " + name + " differs from index.html");
      });
    }
    assert.none(problems);
  });

  test("static: the navigation marks the current page, and only it", async () => {
    const problems = [];
    for (const page of PAGES) {
      const doc = await getDoc(page);
      const main = Array.from(doc.querySelectorAll('.site-header nav a[aria-current="page"]')).map((a) => a.getAttribute("href"));
      const mainHasPage = !!doc.querySelector('.site-header nav a[href="' + page + '"]');
      if (mainHasPage && (main.length !== 1 || main[0] !== page)) problems.push(page + ": header nav marks " + JSON.stringify(main));
      if (!mainHasPage && main.length) problems.push(page + ": header nav marks another page " + JSON.stringify(main));
      const footer = Array.from(doc.querySelectorAll('.footer-nav a[aria-current="page"]')).map((a) => a.getAttribute("href"));
      if (footer.length !== 1 || footer[0] !== page) problems.push(page + ": footer nav marks " + JSON.stringify(footer));
      if (doc.querySelectorAll('[aria-current="page"]').length !== main.length + footer.length) problems.push(page + ": aria-current=page outside the navigation");
    }
    assert.none(problems);
  });

  test("static: the header's compact breakpoint matches in script.js and every page", async () => {
    const js = await getText("script.js");
    const width = Number((/const compactAtWidth = (\d+)/.exec(js) || [])[1]);
    assert.ok(width > 0, "compactAtWidth not found in script.js");
    const problems = [];
    for (const page of PAGES) {
      const doc = await getDoc(page);
      const inline = Array.from(doc.head.querySelectorAll("script")).map((s) => s.textContent).join("\n");
      const match = /innerWidth\)\s*<=\s*(\d+)/.exec(inline);
      if (!match || Number(match[1]) !== width) problems.push(page + ": inline script uses " + (match ? match[1] : "no") + " instead of " + width);
    }
    assert.none(problems);
  });

  // ==========================================================================
  // Accessibility basics
  // ==========================================================================

  test("static: one h1 per page and no skipped heading levels", async () => {
    const problems = [];
    for (const page of PAGES) {
      const doc = await getDoc(page);
      const headings = Array.from(doc.body.querySelectorAll("h1, h2, h3, h4, h5, h6"));
      if (doc.querySelectorAll("h1").length !== 1) problems.push(page + ": " + doc.querySelectorAll("h1").length + " h1 elements");
      if (!headings.length || headings[0].tagName !== "H1") problems.push(page + ": the first heading is not the h1");
      for (let i = 1; i < headings.length; i += 1) {
        const previous = Number(headings[i - 1].tagName[1]);
        const level = Number(headings[i].tagName[1]);
        if (level > previous + 1) problems.push(page + ': "' + headings[i].textContent.trim() + '" jumps from h' + previous + " to h" + level);
        if (!headings[i].textContent.trim()) problems.push(page + ": empty h" + level);
      }
    }
    assert.none(problems);
  });

  test("static: buttons, links, images and form fields all have accessible names", async () => {
    const problems = [];
    for (const page of PAGES) {
      const doc = await getDoc(page);
      doc.querySelectorAll("button").forEach((button) => {
        if (!button.hasAttribute("type")) problems.push(page + ": <button> without a type: " + button.outerHTML.slice(0, 80));
        if (!accessibleName(button)) problems.push(page + ": unnamed button " + button.outerHTML.slice(0, 80));
      });
      doc.querySelectorAll("a[href]").forEach((link) => {
        if (!accessibleName(link)) problems.push(page + ": unnamed link to " + link.getAttribute("href"));
      });
      doc.querySelectorAll("img").forEach((img) => {
        if (!img.hasAttribute("alt")) problems.push(page + ": <img> without alt " + img.getAttribute("src"));
        if (!img.getAttribute("width") || !img.getAttribute("height")) problems.push(page + ": <img> without width and height " + img.getAttribute("src"));
      });
      doc.querySelectorAll("svg[role='img']").forEach((svg) => {
        if (!accessibleName(svg)) problems.push(page + ": svg role=img without a name");
      });
      doc.querySelectorAll("input, select, textarea").forEach((field) => {
        const labelled = field.getAttribute("aria-label") || field.getAttribute("aria-labelledby") ||
          (field.id && doc.querySelector('label[for="' + field.id + '"]')) || field.closest("label");
        if (!labelled) problems.push(page + ": form field without a label " + field.outerHTML.slice(0, 80));
      });
      doc.querySelectorAll("input[type='radio']").forEach((radio) => {
        const fieldset = radio.closest("fieldset");
        if (!fieldset || !fieldset.querySelector("legend")) problems.push(page + ": radio " + radio.id + " is not in a fieldset with a legend");
      });
      doc.querySelectorAll('a[target="_blank"]').forEach((link) => {
        if (!/\bnoopener\b/.test(link.getAttribute("rel") || "")) problems.push(page + ": target=_blank without rel=noopener " + link.getAttribute("href"));
      });
      doc.querySelectorAll("[aria-hidden='true'] a, [aria-hidden='true'] button, [aria-hidden='true'] input").forEach((element) => {
        problems.push(page + ": focusable element inside aria-hidden: " + element.outerHTML.slice(0, 60));
      });
    }
    assert.none(problems);
  });

  // ==========================================================================
  // Images
  // ==========================================================================

  test("static: photos use consistent srcset widths and each Commons file appears on one page only", async () => {
    const problems = [];
    const used = new Map();
    for (const page of PAGES) {
      const doc = await getDoc(page);
      doc.querySelectorAll("img").forEach((img) => {
        const src = img.getAttribute("src");
        if (!src.startsWith(COMMONS)) return;
        const file = commonsFile(src);
        if (used.has(file)) problems.push(file + " is used on " + used.get(file) + " and " + page);
        used.set(file, page);
        if (img.getAttribute("loading") !== "lazy") problems.push(page + ": " + file + " is not lazy-loaded");
        if (!img.alt.trim()) problems.push(page + ": " + file + " has an empty alt but is a content photo");
        const candidates = srcsetCandidates(img.getAttribute("srcset"));
        if (candidates.length && !img.getAttribute("sizes")) problems.push(page + ": " + file + " has srcset without sizes");
        candidates.forEach(({ url, descriptor }) => {
          if (commonsFile(url) !== file) problems.push(page + ": srcset mixes files: " + url);
          const width = /[?&]width=(\d+)/.exec(url);
          if (width && descriptor !== width[1] + "w") problems.push(page + ": " + file + " candidate width=" + width[1] + " is described as " + descriptor);
        });
      });
    }
    assert.ok(used.size >= 13, "expected at least 13 photos, found " + used.size);
    assert.none(problems);
  });

  // ==========================================================================
  // Sources and citations
  // ==========================================================================

  test("static: every citation marker matches its Sources entry", async () => {
    const sources = await getDoc("sources.html");
    const problems = [];
    const titles = new Map();
    for (const cite of await citations()) {
      const where = cite.page + " → " + cite.href;
      if (!/^sources\.html#ref-\d{2}$/.test(cite.href)) {
        problems.push(where + ": unexpected href");
        continue;
      }
      const entry = sources.getElementById(cite.ref);
      if (!entry) {
        problems.push(where + ": no such entry on sources.html");
        continue;
      }
      const number = Number(cite.ref.slice(4));
      if (Number(cite.text) !== number) problems.push(where + ": marker text " + cite.text + " does not match");
      if (number <= 23 && cite.text !== entry.dataset.num) problems.push(where + ": marker text " + cite.text + " should be " + entry.dataset.num);
      if (cite.label !== "Source " + number + ": " + cite.title) problems.push(where + ': aria-label "' + cite.label + '" does not match its title');
      if (titles.has(cite.ref) && titles.get(cite.ref) !== cite.title) problems.push(where + ': title "' + cite.title + '" differs from "' + titles.get(cite.ref) + '"');
      titles.set(cite.ref, cite.title);
    }
    assert.none(problems);
  });

  test("static: each reference lists exactly the pages that cite it", async () => {
    const sources = await getDoc("sources.html");
    const citedOn = new Map();
    (await citations()).forEach((cite) => {
      if (!citedOn.has(cite.ref)) citedOn.set(cite.ref, new Set());
      citedOn.get(cite.ref).add(PAGE_KEYS[cite.page]);
    });
    const problems = [];
    sources.querySelectorAll("[data-reference]").forEach((entry) => {
      const listed = (entry.dataset.pages || "").split(/\s+/).filter((key) => key && key !== "none").sort();
      const actual = Array.from(citedOn.get(entry.id) || []).sort();
      if (listed.join(" ") !== actual.join(" ")) problems.push(entry.id + ': data-pages="' + entry.dataset.pages + '" but it is cited on [' + actual.join(", ") + "]");
    });
    assert.none(problems);
  });

  test("static: references are numbered in order, alphabetical, and counted correctly", async () => {
    const sources = await getDoc("sources.html");
    const problems = [];
    const references = Array.from(sources.querySelectorAll("[data-reference]"));
    references.forEach((entry, i) => {
      const expected = String(i + 1).padStart(2, "0");
      if (entry.id !== "ref-" + expected || entry.dataset.num !== expected) problems.push(entry.id + ": expected ref-" + expected + " with data-num " + expected);
      if (!entry.querySelector(".reference-citation") || !entry.querySelector("[data-copy-citation]")) problems.push(entry.id + ": missing citation text or copy button");
    });
    // APA order: by author, which is everything before the "(year)".
    const author = (entry) => entry.querySelector(".reference-citation").textContent.split("(")[0].trim().toLowerCase();
    for (let i = 1; i < references.length; i += 1) {
      if (author(references[i - 1]).localeCompare(author(references[i])) > 0) problems.push(references[i].id + " is out of alphabetical order");
    }
    const credits = Array.from(sources.querySelectorAll(".credit-list > li"));
    credits.forEach((credit, i) => {
      const expected = references.length + i + 1;
      if (credit.id !== "ref-" + expected) problems.push("credit " + (i + 1) + ": expected id ref-" + expected + ", got " + credit.id);
      const num = credit.querySelector(".credit-num");
      if (!num || Number(num.textContent) !== expected) problems.push(credit.id + ": credit number does not match its id");
    });
    const count = sources.getElementById("reference-count").textContent.trim();
    if (count !== references.length + " references shown.") problems.push('reference count says "' + count + '"');
    const options = Array.from(sources.querySelectorAll("#reference-filter option")).map((o) => o.value);
    const keys = PAGES.filter((p) => p !== "sources.html").map((p) => PAGE_KEYS[p]);
    if (options.join() !== ["all", ...keys].join()) problems.push("the filter options " + options.join() + " do not list every page");
    assert.none(problems);
  });

  test("static: image credits match the photos on the pages that use them", async () => {
    const sources = await getDoc("sources.html");
    const imagePages = new Map(); // Commons file -> [{page, cite}]
    for (const page of PAGES) {
      const doc = await getDoc(page);
      doc.querySelectorAll("figure.photo").forEach((figure) => {
        const img = figure.querySelector("img");
        const file = img && commonsFile(img.getAttribute("src"));
        const cite = figure.querySelector("sup.cite a");
        const caption = figure.querySelector(".photo-title");
        const title = caption ? caption.cloneNode(true) : null;
        if (title) title.querySelectorAll("sup").forEach((sup) => sup.remove());
        if (!imagePages.has(file)) imagePages.set(file, []);
        imagePages.get(file).push({ page, cite: cite ? cite.getAttribute("href").split("#")[1] : null, hasCredit: !!figure.querySelector(".photo-credit"), title: title ? title.textContent : "" });
      });
    }
    const problems = [];
    const credited = new Set();
    sources.querySelectorAll(".credit-list > li").forEach((credit) => {
      const link = credit.querySelector('a[href*="/wiki/File:"]');
      const file = link && commonsFile(link.getAttribute("href"));
      credited.add(file);
      const uses = imagePages.get(file) || [];
      const pages = uses.map((use) => PAGE_KEYS[use.page]).sort().join(" ");
      if (pages !== (credit.dataset.pages || "").split(/\s+/).sort().join(" ")) problems.push(credit.id + ' (' + file + '): data-pages="' + credit.dataset.pages + '" but the photo is on [' + pages + "]");
      uses.forEach((use) => {
        if (!use.hasCredit && use.cite !== credit.id) problems.push(use.page + ": the photo " + file + " cites " + use.cite + " instead of " + credit.id);
      });
      const heading = (credit.querySelector("strong") || {}).textContent || "";
      uses.forEach((use) => {
        if (use.title && heading.replace(/\.$/, "") !== use.title.trim()) problems.push(credit.id + ': credit title "' + heading + '" differs from the caption "' + use.title.trim() + '"');
      });
    });
    imagePages.forEach((uses, file) => {
      if (!credited.has(file)) problems.push(file + " (on " + uses.map((u) => u.page).join(", ") + ") has no credit on the Sources page");
    });
    assert.none(problems);
  });

  // ==========================================================================
  // Styles and scripts kept in sync by hand
  // ==========================================================================

  test("static: motion.css hides exactly the headings motion.js splits", async () => {
    const js = await getText("motion.js");
    const css = await getText("motion.css");
    const list = (text) => text.split(",").map((s) => s.trim()).filter(Boolean).sort().join(", ");
    const fromJs = list((/const HEADINGS = "([^"]+)"/.exec(js) || [])[1] || "");
    const fromCss = Array.from(css.matchAll(/html\.motion-pending :is\(([^)]+)\)/g)).map((m) => list(m[1]));
    assert.ok(fromJs, "HEADINGS not found in motion.js");
    assert.equal(fromCss.length, 2, "expected the heading list twice in motion.css");
    fromCss.forEach((selectors) => assert.equal(selectors, fromJs, "motion.css heading list"));
  });

  test("static: the two dark-theme token lists are identical, and theme-color metas match the page colour", async () => {
    const css = stripComments(await getText("styles.css"));
    const tokens = (block) => {
      const map = {};
      for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) map[match[1]] = match[2].trim();
      return map;
    };
    const system = /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/.exec(css);
    const forced = /:root\[data-theme="dark"\]\s*\{([^}]*)\}/.exec(css);
    const light = /:root\s*\{([^}]*)\}/.exec(css);
    assert.ok(system && forced && light, "could not find the theme blocks in styles.css");
    assert.deepEqual(tokens(forced[1]), tokens(system[1]), "dark tokens");
    const index = await getDoc("index.html");
    const metas = Array.from(index.querySelectorAll('meta[name="theme-color"]'));
    assert.equal(metas.find((m) => /light/.test(m.media)).content.toLowerCase(), tokens(light[1])["--paper"].toLowerCase(), "light theme-color");
    assert.equal(metas.find((m) => /dark/.test(m.media)).content.toLowerCase(), tokens(system[1])["--paper"].toLowerCase(), "dark theme-color");
  });

  test("static: every CSS custom property used without a fallback is defined", async () => {
    const defined = new Set();
    let used = [];
    for (const sheet of STYLESHEETS) {
      const css = stripComments(await getText(sheet));
      for (const match of css.matchAll(/(--[\w-]+)\s*:/g)) defined.add(match[1]);
      for (const match of css.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)) used.push(sheet + ": " + match[1]);
    }
    for (const file of SITE_SCRIPTS) {
      const js = await getText(file);
      for (const match of js.matchAll(/setProperty\(\s*["'](--[\w-]+)/g)) defined.add(match[1]);
    }
    for (const page of PAGES) {
      const text = await getText(page);
      for (const match of text.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)) used.push(page + ": " + match[1]);
    }
    used = Array.from(new Set(used)).filter((entry) => !defined.has(entry.split(": ")[1]));
    assert.none(used, "custom properties used but never defined");
  });

  test("static: no unused classes or ids in the stylesheets", async () => {
    // Every word that appears in the scripts counts as used, so classes added by code are not flagged.
    const known = new Set();
    const ids = new Set();
    for (const page of PAGES) {
      const doc = await getDoc(page);
      doc.querySelectorAll("[class]").forEach((element) => element.getAttribute("class").split(/\s+/).forEach((name) => known.add(name)));
      doc.querySelectorAll("[id]").forEach((element) => ids.add(element.id));
      // Inline scripts and handlers (the head script, an image's onerror) add classes too.
      const inline = Array.from(doc.querySelectorAll("script:not([src])")).map((s) => s.textContent);
      doc.querySelectorAll("*").forEach((element) => Array.from(element.attributes).forEach((a) => { if (a.name.startsWith("on")) inline.push(a.value); }));
      inline.forEach((code) => { for (const match of code.matchAll(/[A-Za-z_][\w-]*/g)) known.add(match[0]); });
    }
    for (const file of [...SITE_SCRIPTS, ...LIB_SCRIPTS]) {
      const js = await getText(file);
      for (const match of js.matchAll(/[A-Za-z_][\w-]*/g)) {
        known.add(match[0]);
        ids.add(match[0]);
      }
    }
    const unused = new Set();
    for (const sheet of STYLESHEETS) {
      const css = stripComments(await getText(sheet));
      for (const match of css.matchAll(/([^{}]+)\{/g)) {
        const selector = match[1].trim();
        if (selector.startsWith("@") || /^(from|to|[\d.]+%)(\s*,\s*(from|to|[\d.]+%))*$/.test(selector)) continue;
        const bare = selector.replace(/\[[^\]]*\]/g, "").replace(/url\([^)]*\)/g, "");
        for (const name of bare.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) if (!known.has(name[1])) unused.add(sheet + ": ." + name[1]);
        for (const name of bare.matchAll(/#(-?[_a-zA-Z][\w-]*)/g)) if (!ids.has(name[1])) unused.add(sheet + ": #" + name[1]);
      }
    }
    assert.none(Array.from(unused), "selectors that match nothing on any page");
  });

  test("static: no redundant [hidden] rules (a global rule already hides them)", async () => {
    const css = stripComments(await getText("styles.css"));
    assert.ok(/\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/.test(css), "the global [hidden] rule is missing");
    const extra = Array.from(css.matchAll(/([^{}]*\S\[hidden\][^{}]*)\{\s*display:\s*none;?\s*\}/g)).map((m) => m[1].trim());
    assert.none(extra, "rules that repeat the global [hidden] rule");
  });

  // ==========================================================================
  // Content that the scripts rebuild must match the static fallback
  // ==========================================================================

  test("static: the no-JavaScript fallback text matches the script's warning stages", async () => {
    const js = await getText("script.js");
    const stages = Array.from(js.matchAll(/id: "(\w+)",\s*name: "([^"]+)",\s*advice: "([^"]+)"/g)).map((m) => ({ id: m[1], name: m[2], advice: m[3] }));
    assert.equal(stages.length, 3, "STAGES in script.js");
    const evacuate = Number(/const EVACUATE_BELOW = (\d+)/.exec(js)[1]);
    const alert = Number(/const ALERT_ABOVE = (\d+)/.exec(js)[1]);
    const ranges = { evacuate: "Less than " + evacuate + " hours in this example", prepare: evacuate + " to " + alert + " hours in this example", alert: "More than " + alert + " hours in this example" };
    const problems = [];
    const warnings = await getDoc("warnings.html");
    stages.forEach((stage) => {
      const panel = warnings.querySelector('[data-warning-stage="' + stage.id + '"]');
      if (!panel) return problems.push("warnings.html: no panel for " + stage.id);
      if (panel.querySelector("[data-stage-name]").textContent !== stage.name) problems.push("warnings.html: " + stage.id + " name differs");
      if (panel.querySelector("[data-stage-advice]").textContent !== stage.advice) problems.push("warnings.html: " + stage.id + " advice differs");
      if (panel.querySelector("[data-stage-time]").textContent !== ranges[stage.id]) problems.push("warnings.html: " + stage.id + " time differs");
      return undefined;
    });
    const home = await getDoc("index.html");
    const slider = home.getElementById("hours");
    const value = Number(slider.value);
    const expected = value < evacuate ? stages[0] : value <= alert ? stages[1] : stages[2];
    if (home.getElementById("panel").dataset.stage !== expected.id) problems.push("index.html: the panel starts on the wrong stage");
    if (home.getElementById("hours-number").textContent !== String(value)) problems.push("index.html: the readout does not show the slider's value");
    if (home.getElementById("stage-name").textContent !== expected.name) problems.push("index.html: the stage name does not match");
    if (home.getElementById("stage-advice").textContent.replace(/\s+/g, " ").trim() !== expected.advice) problems.push("index.html: the stage advice does not match");
    [["evacuate", String(evacuate)], ["prepare", evacuate + "–" + alert], ["alert", String(alert)]].forEach(([id, text]) => {
      if (home.querySelector('[data-threshold="' + id + '"]').textContent !== text) problems.push("index.html: legend threshold " + id + " is not " + text);
    });
    home.querySelectorAll("[data-jump-hours]").forEach((button, i) => {
      const hours = Number(button.dataset.jumpHours);
      const stage = hours < evacuate ? "evacuate" : hours <= alert ? "prepare" : "alert";
      if (stage !== ["evacuate", "prepare", "alert"][i]) problems.push("index.html: legend button " + (i + 1) + " jumps to the wrong stage");
    });
    assert.none(problems);
  });

  test("static: tables, examples and figures agree with their own numbers", async () => {
    const problems = [];
    const cyclones = await getDoc("cyclones.html");
    cyclones.querySelectorAll("#township-chart tbody tr").forEach((row) => {
      const dead = Number(row.cells[1].dataset.value);
      const population = Number(row.cells[2].dataset.value);
      if (row.cells[1].textContent !== dead.toLocaleString("en-US")) problems.push(row.cells[0].textContent + ": dead text differs from data-value");
      if (row.cells[2].textContent !== population.toLocaleString("en-US")) problems.push(row.cells[0].textContent + ": population text differs from data-value");
      if (row.cells[3].textContent !== ((dead / population) * 100).toFixed(2) + "%") problems.push(row.cells[0].textContent + ": share should be " + ((dead / population) * 100).toFixed(2) + "%");
    });
    const rows = Array.from(cyclones.querySelectorAll("#category-picker tbody tr"));
    rows.forEach((row, i) => {
      const min = Number(row.dataset.min);
      const max = row.dataset.max ? Number(row.dataset.max) : null;
      const text = max === null ? min + " or more" : min + "–" + max;
      if (row.cells[1].textContent !== text) problems.push("category " + (i + 1) + ': "' + row.cells[1].textContent + '" should be "' + text + '"');
      if (i > 0 && min !== Number(rows[i - 1].dataset.max) + 1) problems.push("category " + (i + 1) + " does not start right after category " + i);
    });
    const nargis = Number(cyclones.getElementById("category-picker").dataset.nargis);
    const nargisRow = rows.find((row) => nargis >= Number(row.dataset.min) && (!row.dataset.max || nargis <= Number(row.dataset.max)));
    if (!nargisRow || cyclones.getElementById("category-range").textContent !== nargisRow.cells[1].textContent) problems.push("the category readout does not start on Nargis's category");

    const calculator = await getDoc("calculator.html");
    calculator.querySelectorAll("[data-example-distance]").forEach((button) => {
      const distance = Number(button.dataset.exampleDistance);
      const speed = Number(button.dataset.exampleSpeed);
      if (button.querySelector("span").textContent !== distance + " ÷ " + speed) problems.push("calculator example label " + button.querySelector("span").textContent);
      if (button.querySelector("small").textContent !== distance / speed + " hours") problems.push("calculator example " + distance + "÷" + speed + " says " + button.querySelector("small").textContent);
    });

    const prepare = await getDoc("prepare.html");
    const items = prepare.querySelectorAll("[data-check-item]").length;
    if (prepare.getElementById("checklist-count").textContent !== "0 of " + items + " done") problems.push("the checklist count does not start at 0 of " + items);
    if (Number(prepare.getElementById("checklist-progress").getAttribute("max")) !== items) problems.push("the checklist progress max is not " + items);
    const keys = Array.from(prepare.querySelectorAll("[data-check-item]")).map((input) => input.dataset.checkItem);
    if (new Set(keys).size !== keys.length) problems.push("checklist items share a data-check-item key");
    const water = ["household-size", "supply-days", "water-per-person"].map((id) => Number(prepare.getElementById(id).value)).reduce((a, b) => a * b, 1);
    if (prepare.getElementById("water-total").textContent !== water + " litres") problems.push("the water total does not start at " + water + " litres");

    const js = await getText("script.js");
    const defaults = Array.from(/DEFAULT_TASKS = \[([\s\S]*?)\];/.exec(js)[1].matchAll(/title: "([^"]+)"/g)).map((m) => m[1]);
    const staticTasks = Array.from(prepare.querySelectorAll("#plan-task-list tr")).map((row) => row.querySelector("input").value);
    if (defaults.join("|") !== staticTasks.join("|")) problems.push("prepare.html's task rows differ from DEFAULT_TASKS");
    const titleLength = /TASK_TITLE_LENGTH = (\d+)/.exec(js)[1];
    const personLength = /TASK_PERSON_LENGTH = (\d+)/.exec(js)[1];
    prepare.querySelectorAll("#plan-task-list tr").forEach((row, i) => {
      const inputs = row.querySelectorAll("input");
      if (inputs[0].getAttribute("maxlength") !== titleLength || inputs[2].getAttribute("maxlength") !== personLength) problems.push("task row " + (i + 1) + " maxlength differs from script.js");
    });

    // "X dead and Y missing" must add up to the headline figure.
    for (const page of ["index.html", "history.html"]) {
      const doc = await getDoc(page);
      const figure = doc.querySelector(".figures > div");
      const total = Number(figure.querySelector("dd").textContent.replace(/,/g, ""));
      const parts = /([\d,]+) dead and ([\d,]+) missing/.exec(figure.querySelector(".figure-note").textContent);
      if (!parts || Number(parts[1].replace(/,/g, "")) + Number(parts[2].replace(/,/g, "")) !== total) problems.push(page + ": dead + missing does not equal " + total);
    }
    assert.none(problems);
  });

  test("static: the History page's note about images describes the photos it shows", async () => {
    const history = await getDoc("history.html");
    const note = history.querySelector(".photo-note").textContent.replace(/\s+/g, " ");
    const groundPhotos = Array.from(history.querySelectorAll("figure.photo img")).filter((img) => !/^Satellite/.test(img.alt));
    if (groundPhotos.length) assert.ok(!/pictures here are satellite images/i.test(note), "the note says every picture is a satellite image, but the page shows " + groundPhotos.length + " photographs taken on the ground");
  });
})();
