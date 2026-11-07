/* Before Landfall: page behaviour shared by every page.
 *
 * Each set-up function first checks that its part of the page exists and
 * returns quietly if not, so this one file can be loaded everywhere. The HTML
 * always holds readable content; the code only adds interaction on top.
 *
 * Contents
 *   1. Shared data and helpers
 *   2. Site-wide: theme switch, sticky header, smooth corners, reveals
 *   3. Home page: landfall slider and season message
 *   4. Cyclones page: basin picker, formation stepper, category picker, township chart
 *   5. History page: storm timeline
 *   6. Calculator page
 *   7. Prepare page
 *   8. Warnings page
 *   9. Sources page
 *  10. Start
 */
(function () {
  "use strict";

  // ==========================================================================
  // 1. Shared data and helpers
  // ==========================================================================

  // The example time bands used by the home slider, the calculator and the Warnings page.
  const EVACUATE_BELOW = 6;
  const ALERT_ABOVE = 24;

  const STAGES = [
    {
      id: "evacuate",
      name: "Evacuate now",
      advice: "Go to your shelter now. Take your bag, documents and medicine. Do not wait to see if the storm gets worse.",
      test: (hours) => hours < EVACUATE_BELOW,
    },
    {
      id: "prepare",
      name: "Prepare to leave",
      advice: "Pack your emergency bag, charge phones and radios, and agree your route and shelter with your family. If your shelter is far away, start leaving now.",
      test: (hours) => hours <= ALERT_ABOVE,
    },
    {
      id: "alert",
      name: "Stay alert",
      advice: "Listen for official announcements on radio, TV or phone. Check on neighbours, especially older people and families with small children.",
      test: () => true,
    },
  ];

  const stageForHours = (hours) => STAGES.find((stage) => stage.test(hours));

  // Main cyclone periods for the Bay of Bengal, as month indexes (0 = January).
  const SEASONS = [
    { from: 3, to: 4 },
    { from: 9, to: 10 },
  ];
  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
                       "July", "August", "September", "October", "November", "December"];

  const THEME_KEY = "theme";
  // Same curve and duration as --ease-out and --d4 in styles.css, so rolling numbers
  // move like everything else on the page.
  const ROLL_TRANSITION = { duration: 460, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };

  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const prefersReducedMotion = () => motionPreference.matches;

  function onReducedMotionEnabled(listener) {
    motionPreference.addEventListener("change", (event) => {
      if (event.matches) listener();
    });
  }

  // Interface sound lives in sound.js. This does nothing if that file is missing or sound is off.
  const sound = (name, arg) => { if (window.Sound) window.Sound.play(name, arg); };

  // Roll a <roll-text> number or word to a new value. Falls back to plain text
  // if the RollText library did not load.
  function setRoll(element, text, animate) {
    if (typeof element.update === "function") element.update(text, animate);
    else element.textContent = text;
  }

  function setRollTransition(element, transition) {
    if (typeof element.setOptions === "function") {
      element.setOptions({ transition: transition || ROLL_TRANSITION, respectMotionPreference: true });
    }
  }

  // ==========================================================================
  // 2. Site-wide
  // ==========================================================================

  function setUpStickyHeader() {
    const header = document.querySelector(".site-header");
    if (!header) return;

    const root = document.documentElement;
    // The wordmark's middle part ("efore Landfa") folds away to zero width. Its open
    // width has to be the real width of the text, so measure it once the font has
    // loaded. It is stored in em, so it still follows browser zoom and font-size changes.
    function measureWordmark() {
      const fold = document.querySelector(".site-header .brand-wordmark-fold");
      const text = fold && fold.firstElementChild;
      if (!fold || !text) return;
      const fontSize = parseFloat(window.getComputedStyle(fold).fontSize);
      const widthInEm = text.getBoundingClientRect().width / fontSize;
      const current = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--wordmark-fold-width")) || 6.27;
      if (Math.abs(widthInEm - current) > 0.02) {
        document.documentElement.style.setProperty("--wordmark-fold-width", widthInEm.toFixed(3) + "em");
      }
    }

    measureWordmark();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureWordmark);

    // Two thresholds instead of one, so a small wobble in the scroll position
    // (a trackpad bounce, for example) cannot flip the header back and forth.
    // Between 8 and 24 px the header keeps whatever state it already has.
    const collapseAfter = 24;
    const expandBelow = 8;
    const compactAtWidth = 870; // keep in sync with the inline script in index.html
    let animationFrame = 0;

    // Starts from the state the inline script in <head> already chose before first paint.
    let scrolledDown = window.scrollY > 15;

    function isCompact() {
      const viewportWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
      if (window.scrollY > collapseAfter) scrolledDown = true;
      else if (window.scrollY < expandBelow) scrolledDown = false;
      return scrolledDown || viewportWidth <= compactAtWidth;
    }

    function update() {
      animationFrame = 0;
      const compact = isCompact();
      header.classList.toggle("is-compact", compact);
      root.classList.toggle("header-is-compact", compact);
    }

    function scheduleUpdate() {
      if (animationFrame) return;
      animationFrame = requestAnimationFrame(update);
    }

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });
    if (window.visualViewport) window.visualViewport.addEventListener("resize", scheduleUpdate, { passive: true });

    update();

    function finishInitialization() {
      update();
      root.classList.remove("header-motion-initializing");
    }

    if (document.readyState === "complete") finishInitialization();
    else window.addEventListener("pageshow", finishInitialization, { once: true });
  }

  function setUpThemeSwitch() {
    const form = document.getElementById("theme-switch");
    if (!form) return;

    const root = document.documentElement;
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    metas.forEach((meta) => {
      meta.dataset.original = meta.content;
    });

    function apply(choice) {
      const forced = choice === "light" || choice === "dark";
      if (forced) root.dataset.theme = choice;
      else delete root.dataset.theme;

      const color = forced ? getComputedStyle(document.body).backgroundColor : "";
      metas.forEach((meta) => {
        meta.content = forced ? color : meta.dataset.original;
      });
    }

    let saved = "system";
    try {
      saved = localStorage.getItem(THEME_KEY) || "system";
    } catch (error) {}
    const choice = saved === "light" || saved === "dark" ? saved : "system";

    form.querySelector('input[value="' + choice + '"]').checked = true;
    apply(choice);
    form.hidden = false;

    form.addEventListener("change", (event) => {
      const value = event.target.value;
      apply(value);
      sound("toggle", value === "dark" ? "down" : value === "light" ? "up" : "mid");
      try {
        if (value === "system") localStorage.removeItem(THEME_KEY);
        else localStorage.setItem(THEME_KEY, value);
      } catch (error) {}
    });
  }

  function applySmoothCorners() {
    if (typeof Lisse === "undefined") return;

    document.querySelectorAll("[data-smooth]").forEach((element) => {
      const radius = parseFloat(getComputedStyle(element).getPropertyValue("--smooth-radius")) || 24;
      Lisse.smoothCorners(element, { corners: { radius, smoothing: 0.65 }, autoEffects: false });
    });
  }

  function setUpRevealAnimations() {
    const elements = document.querySelectorAll("[data-reveal]");
    if (!elements.length || prefersReducedMotion() || typeof window.IntersectionObserver !== "function") return;

    document.body.classList.add("has-reveal");

    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -36px 0px", threshold: 0.12 });

    elements.forEach((element) => observer.observe(element));
  }

  // ==========================================================================
  // 3. Home page (index.html)
  // ==========================================================================

  // The native range input stays in charge of the value and keyboard access;
  // this draws a custom thumb that follows it on a spring.
  const SLIDER_SPRING = { stiffness: 320, damping: 34, positionEpsilon: 0.08, velocityEpsilon: 0.4 };

  function setUpSmoothSlider(slider) {
    const control = document.getElementById("slider-control");
    const visual = control && control.querySelector(".slider-visual");
    const min = Number(slider.min);
    const max = Number(slider.max);
    if (!visual || max <= min) return;

    const positionFor = (value) => ((Number(value) - min) / (max - min)) * 100;
    let position = positionFor(slider.value);
    let target = position;
    let velocity = 0;
    let animationFrame = 0;
    let previousTime = 0;

    function paintThumb() {
      visual.style.setProperty("--slider-progress", position + "%");
    }

    function snapThumbToTarget() {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      previousTime = 0;
      position = target;
      velocity = 0;
      paintThumb();
    }

    function animateThumb(time) {
      if (!previousTime) previousTime = time;
      const seconds = Math.min((time - previousTime) / 1000, 0.032);
      previousTime = time;

      const displacement = target - position;
      const acceleration = displacement * SLIDER_SPRING.stiffness - velocity * SLIDER_SPRING.damping;
      velocity += acceleration * seconds;
      position += velocity * seconds;

      const settled = Math.abs(displacement) < SLIDER_SPRING.positionEpsilon &&
                      Math.abs(velocity) < SLIDER_SPRING.velocityEpsilon;
      if (settled) {
        snapThumbToTarget();
        return;
      }

      paintThumb();
      animationFrame = requestAnimationFrame(animateThumb);
    }

    function updateThumb() {
      target = positionFor(slider.value);

      if (prefersReducedMotion()) {
        snapThumbToTarget();
      } else if (!animationFrame) {
        animationFrame = requestAnimationFrame(animateThumb);
      }
    }

    paintThumb();
    control.dataset.enhanced = "true";
    slider.addEventListener("input", updateThumb);
    onReducedMotionEnabled(() => {
      target = positionFor(slider.value);
      snapThumbToTarget();
    });
  }

  function setUpLandfallSlider() {
    const slider = document.getElementById("hours");
    const panel = document.getElementById("panel");
    const number = document.getElementById("hours-number");
    const unit = document.getElementById("hours-unit");
    const stageName = document.getElementById("stage-name");
    const stageAdvice = document.getElementById("stage-advice");
    if (!slider || !panel || !number || !unit || !stageName || !stageAdvice) return;

    const min = Number(slider.min);
    const max = Number(slider.max);
    const legendButtons = Array.from(document.querySelectorAll("[data-jump-hours]"));

    setRollTransition(number);
    setRollTransition(stageName);

    let currentStageId = panel.dataset.stage;
    let adviceTimer = 0;
    let adviceFrame = 0;

    function cancelAdviceChange() {
      clearTimeout(adviceTimer);
      cancelAnimationFrame(adviceFrame);
      adviceTimer = 0;
      adviceFrame = 0;
    }

    function showAdviceImmediately(stage) {
      cancelAdviceChange();
      stageAdvice.textContent = stage.advice;
      stageAdvice.classList.remove("is-changing");
    }

    function swapAdvice(stage) {
      cancelAdviceChange();
      stageAdvice.classList.add("is-changing");
      adviceTimer = setTimeout(() => {
        adviceTimer = 0;
        stageAdvice.textContent = stage.advice;
        adviceFrame = requestAnimationFrame(() => {
          adviceFrame = 0;
          if (currentStageId === stage.id) stageAdvice.classList.remove("is-changing");
        });
      }, 120);
    }

    const percentAlongTrack = (hours) => ((hours - min) / (max - min)) * 100;

    panel.style.setProperty("--s1", percentAlongTrack(EVACUATE_BELOW) + "%");
    panel.style.setProperty("--s2", percentAlongTrack(ALERT_ABOVE) + "%");

    const legendText = {
      evacuate: String(EVACUATE_BELOW),
      prepare: EVACUATE_BELOW + "–" + ALERT_ABOVE,
      alert: String(ALERT_ABOVE),
    };
    document.querySelectorAll("[data-threshold]").forEach((span) => {
      span.textContent = legendText[span.dataset.threshold];
    });

    function update() {
      const hours = Number(slider.value);
      const stage = stageForHours(hours);
      const hourWord = hours === 1 ? "hour" : "hours";

      setRoll(number, String(hours));
      unit.textContent = hourWord + " until landfall";

      if (stage.id !== currentStageId) {
        panel.dataset.stage = stage.id;
        setRoll(stageName, stage.name);

        if (prefersReducedMotion()) showAdviceImmediately(stage);
        else swapAdvice(stage);
        currentStageId = stage.id;
      }

      legendButtons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.stage === currentStageId);
      });
      slider.setAttribute("aria-valuetext", hours + " " + hourWord + " until landfall. " + stage.name + ".");
    }

    // The legend is a set of shortcuts: choose a stage to see the slider move to it.
    legendButtons.forEach((button) => {
      const hours = Number(button.dataset.jumpHours);
      const stageId = stageForHours(hours).id;
      button.dataset.stage = stageId;
      button.addEventListener("click", () => {
        slider.value = String(hours);
        slider.dispatchEvent(new Event("input", { bubbles: true }));
        sound("stage", stageId);
      });
    });

    setUpSmoothSlider(slider);
    update();

    // Each hour is a tick that rises in pitch with more time left. Crossing 24 h or 6 h plays
    // that stage's tone instead. Only real drags and key presses count: the legend buttons
    // dispatch a synthetic "input" event and play their own sound.
    let soundHours = Number(slider.value);
    let soundStage = currentStageId;
    slider.addEventListener("input", (event) => {
      update();
      const hours = Number(slider.value);
      if (event.isTrusted) {
        if (currentStageId !== soundStage) sound("stage", currentStageId);
        else if (hours !== soundHours) sound("tick", 0.85 + ((hours - min) / (max - min)) * 0.35);
      }
      soundHours = hours;
      soundStage = currentStageId;
    });

    onReducedMotionEnabled(() => {
      const stage = STAGES.find((item) => item.id === currentStageId);
      if (stage) showAdviceImmediately(stage);
    });
  }

  // Whole days from today to the 1st of a month. Both dates are taken as UTC midnights,
  // so a daylight-saving change in between cannot make the count off by one.
  function daysUntil(today, year, month) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const start = Date.UTC(year, month, 1);
    const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.round((start - now) / msPerDay);
  }

  // A note under the hero: are we in a main cyclone period, and if not, when does the next one start?
  function showSeasonMessage() {
    const season = document.getElementById("season");
    const text = document.getElementById("season-text");
    if (!season || !text) return;

    const today = new Date();
    const month = today.getMonth();
    const year = today.getFullYear();

    if (SEASONS.some((s) => month >= s.from && month <= s.to)) {
      const periods = SEASONS
        .map((s) => MONTH_NAMES[s.from] + "–\u2060" + MONTH_NAMES[s.to])
        .join(" and ");
      season.dataset.state = "in";
      text.textContent = "Today falls in a main cyclone period (" + periods + ").";
    } else {
      const starts = [year, year + 1].flatMap((y) => SEASONS.map((s) => ({ year: y, month: s.from })));
      const next = starts.find((d) => daysUntil(today, d.year, d.month) > 0);
      const days = daysUntil(today, next.year, next.month);

      season.dataset.state = "out";
      text.textContent =
        "The next main cyclone period begins in " + days + (days === 1 ? " day" : " days") +
        ", on 1 " + MONTH_NAMES[next.month] + ".";
    }

    season.hidden = false;
  }

  // ==========================================================================
  // 4. Cyclones page (cyclones.html)
  // The tables in the HTML hold the data; the code builds the interactive
  // version from them, so the page still reads properly without JavaScript.
  // ==========================================================================

  // "Same storm, different names": pick an ocean, see what the storm is called there
  function setUpBasinPicker() {
    const options = document.querySelectorAll("#basin-options input[name='basin']");
    const word = document.getElementById("names-word");
    const caption = document.getElementById("names-caption");
    if (!options.length || !word || !caption) return;

    function show(option, animate) {
      setRoll(word, option.value, animate);
      caption.textContent = option.dataset.caption;
    }

    options.forEach((option) => option.addEventListener("change", () => {
      show(option, true);
      sound("select");
    }));
    show(Array.from(options).find((option) => option.checked) || options[0], false);
  }

  // "How a cyclone forms": four steps, each showing one more layer of the diagram
  function setUpFormationStepper() {
    const stepper = document.getElementById("stepper");
    const diagram = document.getElementById("formation-svg");
    if (!stepper || !diagram) return;

    const steps = Array.from(stepper.querySelectorAll(".step"));
    const tabs = Array.from(stepper.querySelectorAll(".step-tab"));
    const controls = stepper.querySelector(".step-controls");
    const nav = stepper.querySelector(".step-nav");
    const back = document.getElementById("step-back");
    const next = document.getElementById("step-next");
    if (!steps.length || tabs.length !== steps.length || !controls || !nav || !back || !next) return;

    let current = 0;

    function go(index) {
      current = Math.max(0, Math.min(steps.length - 1, index));

      steps.forEach((step, i) => { step.hidden = i !== current; });
      tabs.forEach((tab, i) => {
        if (i === current) tab.setAttribute("aria-current", "step");
        else tab.removeAttribute("aria-current");
      });

      diagram.dataset.step = String(current + 1); // the CSS shows the layers for this step
      back.disabled = current === 0;
      next.disabled = current === steps.length - 1;
    }

    tabs.forEach((tab, i) => tab.addEventListener("click", () => {
      if (i !== current) sound("select", 0.9 + (i / Math.max(1, tabs.length - 1)) * 0.3);
      go(i);
    }));
    back.addEventListener("click", () => { sound("pop"); go(current - 1); });
    next.addEventListener("click", () => { sound("push"); go(current + 1); });

    controls.hidden = false;
    nav.hidden = false;
    go(0);
  }

  // Wind categories: build the 1 to 5 picker from the table, and mark where Nargis falls
  function setUpCategoryPicker() {
    const card = document.getElementById("category-picker");
    if (!card) return;

    const rows = Array.from(card.querySelectorAll("tbody tr"));
    const live = card.querySelector(".category-live");
    const table = card.querySelector(".data-table");
    const range = document.getElementById("category-range");
    const damage = document.getElementById("category-damage");
    if (!rows.length || !live || !table || !range || !damage) return;

    // One object per table row
    const categories = rows.map((row, i) => {
      const min = Number(row.dataset.min);
      const max = row.dataset.max ? Number(row.dataset.max) : Infinity;
      return {
        number: i + 1,
        min: min,
        max: max,
        label: max === Infinity ? min + "+" : min + "–" + max,
        damage: row.cells[2].textContent.trim(),
      };
    });

    // Which category does Nargis's wind speed fall in?
    const nargisSpeed = Number(card.dataset.nargis);
    const nargis = categories.find((category) => nargisSpeed <= category.max) || categories[0];

    const group = document.createElement("fieldset");
    group.className = "seg";
    const legend = document.createElement("legend");
    legend.className = "visually-hidden";
    legend.textContent = "Wind category";
    group.append(legend);

    const inputs = categories.map((category) => {
      const option = document.createElement("span");
      option.className = "seg-option";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "category";
      input.id = "category-" + category.number;
      input.value = String(category.number);

      const label = document.createElement("label");
      label.htmlFor = input.id;
      label.textContent = String(category.number);

      option.append(input, label);
      if (category === nargis) {
        const tag = document.createElement("span");
        tag.className = "seg-tag";
        tag.textContent = "Nargis";
        option.append(tag);
      }

      group.append(option);
      input.addEventListener("change", () => {
        show(category, true);
        sound("category", category.number);
      });
      return input;
    });

    function show(category, animate) {
      setRoll(range, category.label, animate);
      damage.textContent = category.damage;
    }

    live.prepend(group);
    live.hidden = false;
    table.removeAttribute("open"); // the table stays available, just folded away

    inputs[nargis.number - 1].checked = true;
    show(nargis, false);
  }

  // Township chart: bars built from the table, with a switch between people and share
  function setUpTownshipChart() {
    const card = document.getElementById("township-chart");
    if (!card) return;

    const rows = Array.from(card.querySelectorAll("tbody tr"));
    const live = card.querySelector(".chart-live");
    const list = document.getElementById("bars");
    const table = card.querySelector(".data-table");
    const radios = card.querySelectorAll("input[name='metric']");
    if (!rows.length || !live || !list || !table || !radios.length) return;

    // Read the numbers from the table cells
    const townships = rows.map((row) => {
      const dead = Number(row.cells[1].dataset.value);
      const population = Number(row.cells[2].dataset.value);
      return { name: row.cells[0].textContent.trim(), dead: dead, share: (dead / population) * 100 };
    });

    const METRICS = {
      people: { value: (t) => t.dead, text: (t) => t.dead.toLocaleString("en-US") },
      share: { value: (t) => t.share, text: (t) => t.share.toFixed(2) + "%" },
    };

    // One row per township: name, bar, number
    const items = townships.map((township) => {
      const item = document.createElement("li");
      item.className = "bar";

      const name = document.createElement("span");
      name.className = "bar-name";
      name.textContent = township.name;

      const track = document.createElement("span");
      track.className = "bar-track";
      track.setAttribute("aria-hidden", "true");
      const fill = document.createElement("span");
      fill.className = "bar-fill";
      track.append(fill);

      const value = document.createElement("roll-text");
      value.className = "bar-value";

      item.append(name, track, value);
      list.append(item);
      return { township: township, fill: fill, value: value };
    });

    let metric = "people";

    function render(animate) {
      const current = METRICS[metric];
      const largest = Math.max(...townships.map(current.value));
      items.forEach((item) => {
        item.fill.style.setProperty("--w", (current.value(item.township) / largest) * 100 + "%");
        setRoll(item.value, current.text(item.township), animate);
      });
    }

    // Start with empty bars, then fill them when the chart scrolls into view
    items.forEach((item) => {
      item.fill.style.setProperty("--w", "0%");
      setRoll(item.value, METRICS.people.text(item.township), false);
    });
    live.hidden = false;
    table.removeAttribute("open");

    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      render(false);
    } else {
      const observer = new IntersectionObserver((entries, watcher) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        watcher.disconnect();
        render(false);
      }, { threshold: 0.3 });
      observer.observe(list);
    }

    radios.forEach((radio) => {
      radio.addEventListener("change", () => {
        metric = radio.value;
        render(true);
        sound("select");
      });
    });
  }

  // Numbers marked data-count-from start there and roll up to their real value
  // the first time they scroll into view.
  function setUpCountOnReveal() {
    const elements = document.querySelectorAll("[data-count-from]");
    if (!elements.length || prefersReducedMotion() || !("IntersectionObserver" in window)) return;

    elements.forEach((element) => {
      const finalText = element.textContent.trim();
      setRoll(element, element.dataset.countFrom, false);

      const observer = new IntersectionObserver((entries, watcher) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        watcher.disconnect();
        setRoll(element, finalText, true);
      }, { threshold: 0.6 });
      observer.observe(element);
    });
  }

  // ==========================================================================
  // 5. History page (history.html)
  // ==========================================================================

  // Storm timeline: build a horizontal track of storms from the panels, and show one panel at a time.
  // Without this script every panel stays visible as a plain list.
  function setUpStormTimeline() {
    const timeline = document.getElementById("storm-timeline");
    if (!timeline) return;
    const panelList = timeline.querySelector(".tl-panels");
    const panels = Array.from(timeline.querySelectorAll(".tl-panel"));
    if (!panelList || panels.length < 2) return;

    const track = document.createElement("div");
    track.className = "tl-track";
    track.setAttribute("role", "group");
    track.setAttribute("aria-label", "Choose a storm");
    track.style.setProperty("--tl-count", String(panels.length));
    // Later storms sound slightly higher, so the pitch follows your place on the timeline.
    const pitchFor = (i) => 0.85 + (i / (panels.length - 1)) * 0.4;

    const stops = panels.map((panel, i) => {
      const stop = document.createElement("button");
      stop.type = "button";
      stop.className = "tl-stop";
      if (panel.classList.contains("tl-major")) stop.classList.add("tl-stop--major");
      stop.setAttribute("aria-controls", panel.id);

      const year = document.createElement("span");
      year.className = "tl-stop-year";
      year.textContent = panel.dataset.year || "";
      const name = document.createElement("span");
      name.className = "tl-stop-name";
      name.textContent = panel.dataset.name || "";
      stop.append(year, name);

      stop.addEventListener("click", () => {
        if (!stop.hasAttribute("aria-current")) sound("select", pitchFor(i)); // silent if already chosen
        show(i);
      });
      stop.addEventListener("keydown", (event) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        let target = step === undefined ? null : (i + step + panels.length) % panels.length;
        if (event.key === "Home") target = 0;
        if (event.key === "End") target = panels.length - 1;
        if (target === null) return;
        event.preventDefault();
        sound("select", pitchFor(target));
        show(target);
        stops[target].focus();
      });
      track.append(stop);
      return stop;
    });

    function show(index) {
      // Panels share one grid cell (CSS), so the section keeps the tallest panel's height and nothing below jumps
      panels.forEach((panel, i) => panel.classList.toggle("is-active", i === index));
      stops.forEach((stop, i) => {
        if (i === index) stop.setAttribute("aria-current", "true");
        else stop.removeAttribute("aria-current");
        stop.tabIndex = i === index ? 0 : -1;
      });
      // On narrow screens the track scrolls sideways: keep the chosen stop in view (track only, never the page)
      const stop = stops[index];
      if (track.scrollWidth > track.clientWidth) {
        track.scrollTo({ left: stop.offsetLeft - (track.clientWidth - stop.offsetWidth) / 2, behavior: prefersReducedMotion() ? "auto" : "smooth" });
      }
    }

    panelList.before(track);
    timeline.classList.add("is-interactive");
    show(0);
  }

  // ==========================================================================
  // 6. Calculator page (calculator.html)
  // ==========================================================================

  // Landfall calculator: distance divided by the cyclone's forward speed.
  //
  // How it behaves:
  //  - The answer is live. Once both boxes hold valid numbers it appears and updates as you type.
  //  - It is only saved to "Recent estimates" when you commit it: press the button, leave the box,
  //    pick an example or reuse an old estimate. Typing 6, 60, 600 saves one estimate, not three.
  //  - Errors wait until you have actually left a box or pressed the button, so you are not told off
  //    halfway through typing a number.
  function setUpLandfallCalculator() {
    const form = document.getElementById("landfall-form");
    const distanceInput = document.getElementById("storm-distance");
    const speedInput = document.getElementById("storm-speed");
    const error = document.getElementById("calculator-error");
    const result = document.getElementById("calculator-result");
    const estimatePrompt = document.getElementById("estimate-prompt");
    const resultHours = document.getElementById("result-hours");
    const resultArrival = document.getElementById("result-arrival");
    const resultStage = document.getElementById("result-stage");
    const resultAdvice = document.getElementById("result-advice");
    const resultMarker = document.getElementById("result-marker");
    const announcer = document.getElementById("result-announcer");
    const estimateList = document.getElementById("calculation-history");
    const estimatesEmpty = document.getElementById("history-empty");
    const clearEstimates = document.getElementById("clear-history");
    const storageStatus = document.getElementById("history-storage-status");
    if (!form || !distanceInput || !speedInput || !result || !resultHours || !resultArrival || !resultStage || !resultAdvice || !estimateList || !estimatesEmpty || !clearEstimates) return;

    const STORAGE_KEY = "beforeLandfall.calculatorHistory.v1";
    const MAX_SAVED = 5;
    // The upper limits come from the inputs' max attributes, so the HTML is the one place to change them.
    const MAX_DISTANCE = Number(distanceInput.max) || 5000;
    const MAX_SPEED = Number(speedInput.max) || 100;
    const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
    const exampleButtons = Array.from(document.querySelectorAll("[data-example-distance][data-example-speed]"));
    const touched = new Set();
    let estimates = [];
    let storageAvailable = true;
    let announceTimer = 0;

    setRollTransition(resultHours);

    const isValidDistance = (value) => Number.isFinite(value) && value > 0 && value <= MAX_DISTANCE;
    const isValidSpeed = (value) => Number.isFinite(value) && value > 0 && value <= MAX_SPEED;
    const formatHours = (hours) => hours.toLocaleString(undefined, { maximumFractionDigits: 2 });

    let savedText = null;
    try {
      savedText = localStorage.getItem(STORAGE_KEY);
    } catch (storageError) {
      storageAvailable = false;
    }
    // A damaged save is not a storage problem: it is skipped, and the next estimate replaces it.
    try {
      const saved = JSON.parse(savedText || "[]");
      if (Array.isArray(saved)) {
        estimates = saved.filter((item) =>
          item &&
          isValidDistance(item.distance) &&
          isValidSpeed(item.speed) &&
          Number.isFinite(item.hours) &&
          Number.isFinite(item.arrival) &&
          Number.isFinite(new Date(item.arrival).getTime())
        ).slice(0, MAX_SAVED);
      }
    } catch (parseError) {}

    function renderEstimates() {
      estimateList.replaceChildren();
      estimatesEmpty.hidden = estimates.length > 0;
      clearEstimates.hidden = estimates.length === 0;
      if (storageStatus) {
        storageStatus.textContent = storageAvailable
          ? "Estimates are stored only in this browser."
          : "Browser storage is unavailable; estimates will not be saved after you leave this page.";
      }

      estimates.forEach((item) => {
        const row = document.createElement("li");
        const summary = document.createElement("strong");
        summary.textContent = item.distance.toLocaleString() + " km ÷ " + item.speed.toLocaleString() + " km/h = " + formatHours(item.hours) + " hours";
        const arrival = document.createElement("span");
        arrival.textContent = "Estimated arrival: " + timeFormat.format(new Date(item.arrival));
        // Old estimates are not just a record: one press puts the numbers back in the boxes.
        const reuse = document.createElement("button");
        reuse.type = "button";
        reuse.className = "text-button history-reuse";
        reuse.textContent = "Use these numbers again";
        reuse.addEventListener("click", () => {
          fillInputs(item.distance, item.speed);
          update(true);
        });
        row.append(summary, arrival, reuse);
        estimateList.append(row);
      });
    }

    function readInputs() {
      return {
        distance: distanceInput.valueAsNumber,
        speed: speedInput.valueAsNumber,
        hasDistance: distanceInput.value.trim() !== "" && Number.isFinite(distanceInput.valueAsNumber),
        hasSpeed: speedInput.value.trim() !== "" && Number.isFinite(speedInput.valueAsNumber),
      };
    }

    // Returns null when the numbers are fine, otherwise what is wrong and which box to point at.
    function findProblem(values) {
      if (!values.hasDistance || !values.hasSpeed) {
        return { message: "Enter both the distance and forward speed.", field: values.hasDistance ? speedInput : distanceInput, incomplete: true };
      }
      if (!isValidDistance(values.distance)) {
        return { message: "Enter a distance greater than 0 and no more than " + MAX_DISTANCE.toLocaleString("en-US") + " km.", field: distanceInput };
      }
      if (!isValidSpeed(values.speed)) {
        return { message: "Enter a forward speed greater than 0 and no more than " + MAX_SPEED.toLocaleString("en-US") + " km/h.", field: speedInput };
      }
      return null;
    }

    // Where the answer sits on the Over 24 h | 6–24 h | Under 6 h bar. The bar runs from far
    // away (left) to close (right), and its three bands are 1 : 1.2 : 1 wide.
    function gaugePosition(hours) {
      const alertEnd = 100 / 3.2;
      const prepareEnd = (100 * 2.2) / 3.2;
      let position;
      if (hours > ALERT_ABOVE) position = alertEnd * (1 - Math.min((hours - ALERT_ABOVE) / 48, 1));
      else if (hours >= EVACUATE_BELOW) position = alertEnd + ((ALERT_ABOVE - hours) / (ALERT_ABOVE - EVACUATE_BELOW)) * (prepareEnd - alertEnd);
      else position = prepareEnd + ((EVACUATE_BELOW - hours) / EVACUATE_BELOW) * (100 - prepareEnd);
      return Math.min(Math.max(position, 3), 97);
    }

    function showPrompt() {
      result.hidden = true;
      if (estimatePrompt) estimatePrompt.hidden = false;
    }

    function showError(message) {
      if (!error) return;
      error.textContent = message;
      error.hidden = false;
    }

    function hideError() {
      if (error) error.hidden = true;
    }

    // Screen readers get one calm announcement after you stop typing, not one per keystroke.
    function announce(text) {
      if (!announcer) return;
      clearTimeout(announceTimer);
      announceTimer = setTimeout(() => { announcer.textContent = text; }, 700);
    }

    // Shows the answer and returns { hours, arrival } for saving, or null if it cannot be shown.
    function showResult(distance, speed) {
      const exactHours = distance / speed;
      // Round once and use the rounded figure everywhere, so the number on screen and its stage
      // always agree (5.999 h shows as "6 hours", so it must not be labelled "under 6 h").
      const hours = Math.max(Math.round(exactHours * 100) / 100, 0.01);
      const arrival = new Date(Date.now() + exactHours * 60 * 60 * 1000);
      if (!Number.isFinite(arrival.getTime())) return null;

      const stage = stageForHours(hours);
      const wasHidden = result.hidden;
      const hoursText = formatHours(hours);

      result.dataset.stage = stage.id;
      if (resultMarker) resultMarker.style.setProperty("--gauge-position", gaugePosition(hours) + "%");
      resultArrival.textContent = "If the speed stays the same: " + timeFormat.format(arrival) + " (your device’s local time).";
      resultStage.textContent = stage.name;
      resultAdvice.textContent = stage.advice;

      result.hidden = false;
      if (estimatePrompt) estimatePrompt.hidden = true;
      // The first time it appears the number is simply there; after that it rolls to the new value.
      setRoll(resultHours, hoursText, !wasHidden);

      if (wasHidden && !prefersReducedMotion()) {
        result.classList.remove("is-entering");
        void result.offsetWidth; // restart the entrance if it is already running
        result.classList.add("is-entering");
        result.addEventListener("animationend", () => result.classList.remove("is-entering"), { once: true });
      }

      announce(distance.toLocaleString() + " kilometres divided by " + speed.toLocaleString() + " kilometres per hour is " + hoursText + " hours. " + stage.name + ".");
      return { hours, arrival: arrival.getTime() };
    }

    // Light up the worked example that matches what is in the boxes, whether it was clicked or typed.
    function syncExamples() {
      exampleButtons.forEach((button) => {
        const matches = distanceInput.value !== "" && speedInput.value !== "" &&
                        Number(distanceInput.value) === Number(button.dataset.exampleDistance) &&
                        Number(speedInput.value) === Number(button.dataset.exampleSpeed);
        button.setAttribute("aria-pressed", String(matches));
      });
    }

    function saveEstimate(distance, speed, outcome) {
      estimates = [
        { distance, speed, hours: outcome.hours, arrival: outcome.arrival },
        ...estimates.filter((item) => !(item.distance === distance && item.speed === speed)),
      ].slice(0, MAX_SAVED);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(estimates));
        storageAvailable = true;
      } catch (storageError) {
        storageAvailable = false;
      }
      renderEstimates();
    }

    // Sound for the result. A deliberate estimate always plays its stage tone. While typing,
    // the tone plays only when the gauge moves to a different stage, and only once typing
    // pauses, so half-typed numbers ("4" on the way to "45") do not each make a sound.
    let soundedStage = "";
    let stageSoundTimer = 0;
    function soundForResult(explicit) {
      clearTimeout(stageSoundTimer);
      if (explicit) {
        soundedStage = result.dataset.stage;
        sound("stage", soundedStage);
        return;
      }
      if (result.dataset.stage === soundedStage) return;
      stageSoundTimer = setTimeout(() => {
        if (result.hidden || result.dataset.stage === soundedStage) return;
        soundedStage = result.dataset.stage;
        sound("stage", soundedStage);
      }, 400);
    }

    function resetResultSound() {
      clearTimeout(stageSoundTimer);
      soundedStage = ""; // the result is hidden, so its next appearance plays a tone again
    }

    // explicit = the person pressed the button, picked an example or reused an estimate.
    // Returns true when a valid answer is showing.
    function update(explicit) {
      const values = readInputs();
      const problem = findProblem(values);
      syncExamples();

      if (problem) {
        resetResultSound();
        showPrompt();
        const waitingForMore = problem.incomplete && !explicit;
        const fieldLeft = touched.has(problem.field);
        if (explicit || (!waitingForMore && fieldLeft)) showError(problem.message);
        else hideError();
        if (explicit) {
          problem.field.focus();
          sound("nudge");
        }
        return false;
      }

      const outcome = showResult(values.distance, values.speed);
      if (!outcome) {
        resetResultSound();
        showPrompt();
        showError("Those values are too large to estimate. Check the numbers and try again.");
        if (explicit) sound("nudge");
        return false;
      }
      hideError();
      soundForResult(explicit);

      if (explicit) {
        saveEstimate(values.distance, values.speed, outcome);
        // On a phone the answer sits below the form. Bring it into view, but only if it is off screen.
        result.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
      }
      return true;
    }

    // Put numbers in the boxes with a brief flash, so it is clear where they went.
    function fillInputs(distance, speed) {
      distanceInput.value = distance;
      speedInput.value = speed;
      [distanceInput, speedInput].forEach((input) => {
        const box = input.closest(".input-with-unit");
        if (!box) return;
        box.classList.remove("just-filled");
        void box.offsetWidth; // restart the flash if it is already running
        box.classList.add("just-filled");
        box.addEventListener("animationend", () => box.classList.remove("just-filled"), { once: true });
      });
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      update(true);
    });

    [distanceInput, speedInput].forEach((input) => {
      input.addEventListener("input", () => update(false));
      // "change" fires when you finish with a box. If the numbers are valid, keep them in history.
      input.addEventListener("change", () => {
        const values = readInputs();
        if (findProblem(values)) return;
        const outcome = showResult(values.distance, values.speed);
        if (outcome) saveEstimate(values.distance, values.speed, outcome);
      });
      input.addEventListener("blur", () => {
        if (input.value.trim() !== "") touched.add(input);
        update(false);
      });
    });

    exampleButtons.forEach((button) => {
      button.addEventListener("click", () => {
        fillInputs(button.dataset.exampleDistance, button.dataset.exampleSpeed);
        update(true);
      });
    });

    clearEstimates.addEventListener("click", () => {
      sound("sweep");
      estimates = [];
      try {
        localStorage.removeItem(STORAGE_KEY);
        storageAvailable = true;
      } catch (storageError) {
        storageAvailable = false;
      }
      renderEstimates();
    });

    renderEstimates();
  }

  // ==========================================================================
  // 7. Prepare page (prepare.html)
  // Everything here is stored only in this browser (localStorage). Nothing is sent anywhere.
  // ==========================================================================

  // Household readiness checklist with a progress bar.
  function setUpChecklist() {
    const checklist = document.getElementById("household-checklist");
    const progress = document.getElementById("checklist-progress");
    const count = document.getElementById("checklist-count");
    const status = document.getElementById("checklist-status");
    const resetButton = document.getElementById("reset-checklist");
    const checks = checklist ? Array.from(checklist.querySelectorAll("[data-check-item]")) : [];
    if (!checks.length || !progress || !count) return;

    const STORAGE_KEY = "beforeLandfall.preparationChecklist.v1";
    const panel = checklist.closest(".checklist-panel");
    const setStatus = (text) => { if (status) status.textContent = text; };

    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(saved)) checks.forEach((input) => { input.checked = saved.includes(input.dataset.checkItem); });
    } catch (storageError) {}

    function updateChecklist(save) {
      const completed = checks.filter((input) => input.checked).length;
      const complete = completed === checks.length;
      progress.max = checks.length;
      progress.value = completed;
      progress.setAttribute("aria-valuetext", completed + " of " + checks.length + " tasks complete");
      count.textContent = complete ? "All " + checks.length + " done" : completed + " of " + checks.length + " done";
      if (panel) panel.classList.toggle("is-complete", complete);
      if (!save) return;

      try {
        const ticked = checks.filter((input) => input.checked).map((input) => input.dataset.checkItem);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ticked));
        setStatus(complete ? "Every step is ticked. Look again if your route or safe place changes." : "Progress saved on this device.");
      } catch (storageError) {
        setStatus("Browser storage is unavailable; progress will not be saved.");
      }
    }

    checks.forEach((input) => input.addEventListener("change", () => {
      updateChecklist(true);
      if (checks.every((item) => item.checked)) sound("complete");
      else sound("check", input.checked);
    }));

    if (resetButton) {
      resetButton.addEventListener("click", () => {
        if (checks.some((input) => input.checked)) sound("sweep");
        checks.forEach((input) => { input.checked = false; });
        try { localStorage.removeItem(STORAGE_KEY); } catch (storageError) {}
        setStatus("Checklist reset.");
        updateChecklist(false);
      });
    }

    updateChecklist(false);
  }

  // Water estimate: people × days × litres per person per day.
  function setUpWaterPlanner() {
    const inputs = ["household-size", "supply-days", "water-per-person"].map((id) => document.getElementById(id));
    const waterTotal = document.getElementById("water-total");
    if (!inputs.every(Boolean) || !waterTotal) return;

    function updateTotal(animate) {
      if (inputs.some((input) => !input.value.trim() || !input.checkValidity())) {
        setRoll(waterTotal, "Check the values", animate);
        return;
      }
      const total = inputs.reduce((product, input) => product * Number(input.value), 1);
      setRoll(waterTotal, total.toLocaleString(undefined, { maximumFractionDigits: 1 }) + (total === 1 ? " litre" : " litres"), animate);
      if (animate) sound("tick");
    }

    setRollTransition(waterTotal);
    inputs.forEach((input) => input.addEventListener("input", () => updateTotal(true)));
    updateTotal(false);
  }

  // Household plan editor with a printable summary, a text download and autosave.
  function setUpFamilyPlan() {
    const form = document.getElementById("family-plan-form");
    const taskList = document.getElementById("plan-task-list");
    const taskCount = document.getElementById("plan-task-count");
    const summary = document.getElementById("plan-summary");
    const summaryEmpty = document.getElementById("plan-empty");
    const savedTasks = document.getElementById("saved-plan-tasks");
    const planStatus = document.getElementById("plan-status");
    const addTaskButton = document.getElementById("add-plan-task");
    const downloadButton = document.getElementById("download-plan");
    const printButton = document.getElementById("print-plan");
    const clearPlanButton = document.getElementById("clear-plan");
    if (!form || !taskList || !taskCount || !summary || !summaryEmpty || !savedTasks || !planStatus || !addTaskButton || !downloadButton || !printButton || !clearPlanButton) return;

    const STORAGE_KEY = "beforeLandfall.familyPlan.v1";
    const MAX_TASKS = 30;
    const TASK_TITLE_LENGTH = 160;
    const TASK_PERSON_LENGTH = 64;
    // The plan's text fields, by input name. Their length limits come from each input's maxlength.
    const PLAN_FIELDS = ["planName", "household", "shelter", "meeting", "routeOne", "routeTwo", "contact"];
    const SUMMARY_FIELDS = ["shelter", "meeting", "routeOne", "routeTwo", "contact"];
    const DEFAULT_TASKS = [
      { title: "Pack an emergency kit", when: "", person: "" },
      { title: "Confirm a safe place and two routes", when: "", person: "" },
      { title: "Save official warning channels", when: "", person: "" },
    ];
    const savedTitle = document.getElementById("saved-plan-title");
    let saveTimer = 0;

    const field = (name) => form.elements.namedItem(name);
    const limitFor = (name) => (field(name) && field(name).maxLength > 0 ? field(name).maxLength : 160);
    const safeText = (value, maxLength) => (typeof value === "string" ? value.slice(0, maxLength) : "");

    // Accepts tasks from storage or the editor and returns clean copies. Older saves used
    // "task" and "who" for what is now "title" and "person".
    function normalizedTasks(tasks) {
      if (!Array.isArray(tasks)) return DEFAULT_TASKS.map((task) => ({ ...task }));
      return tasks.slice(0, MAX_TASKS).map((task) => {
        const item = task && typeof task === "object" ? task : {};
        return {
          title: safeText(item.title ?? item.task, TASK_TITLE_LENGTH),
          when: typeof item.when === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.when) ? item.when : "",
          person: safeText(item.person ?? item.who, TASK_PERSON_LENGTH),
        };
      });
    }

    function createTaskInput(type, value, label, maxLength, placeholder) {
      const input = document.createElement("input");
      input.type = type;
      input.value = value;
      input.setAttribute("aria-label", label);
      if (maxLength) input.maxLength = maxLength;
      if (placeholder) input.placeholder = placeholder;
      return input;
    }

    function createTaskRow(task, index) {
      const number = index + 1;
      const row = document.createElement("tr");
      row.dataset.taskRow = "";

      const cells = [
        ["Task", createTaskInput("text", task.title, "Task " + number, TASK_TITLE_LENGTH, "Add task")],
        ["When", createTaskInput("date", task.when, "Target date for task " + number)],
        ["Who leads", createTaskInput("text", task.person, "Responsible person for task " + number, TASK_PERSON_LENGTH, "Add a name")],
      ].map(([label, input]) => {
        const cell = document.createElement("td");
        cell.dataset.label = label;
        cell.append(input);
        return cell;
      });

      const actionCell = document.createElement("td");
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "task-remove";
      remove.textContent = "×";
      remove.setAttribute("aria-label", "Remove task " + number);
      actionCell.append(remove);

      row.append(...cells, actionCell);
      return row;
    }

    const taskRows = () => Array.from(taskList.querySelectorAll("[data-task-row]"));

    function readTasks() {
      return taskRows().map((row) => {
        const [title, when, person] = row.querySelectorAll("input");
        return normalizedTasks([{
          title: title ? title.value.trim() : "",
          when: when ? when.value : "",
          person: person ? person.value.trim() : "",
        }])[0];
      });
    }

    function renderTaskRows(tasks) {
      const cleanTasks = normalizedTasks(tasks);
      taskList.replaceChildren(...cleanTasks.map(createTaskRow));
      taskCount.textContent = cleanTasks.length + (cleanTasks.length === 1 ? " task" : " tasks");
      return cleanTasks;
    }

    function readPlan() {
      const plan = {};
      PLAN_FIELDS.forEach((name) => {
        plan[name] = safeText(field(name) ? field(name).value : "", limitFor(name)).trim();
      });
      plan.tasks = readTasks();
      return plan;
    }

    function setActionsEnabled(enabled) {
      downloadButton.disabled = !enabled;
      printButton.disabled = !enabled;
    }

    // Fill the printable copy beside the editor.
    function showPlan(plan) {
      if (savedTitle) savedTitle.textContent = plan.planName || "Our cyclone plan";
      const householdValue = summary.querySelector('[data-plan-value="household"]');
      if (householdValue) householdValue.textContent = plan.household || "Household not named";

      SUMMARY_FIELDS.forEach((key) => {
        const value = summary.querySelector('[data-plan-value="' + key + '"]');
        if (value) value.textContent = plan[key] || "Not set";
      });

      savedTasks.replaceChildren(...plan.tasks.map((task) => {
        const item = document.createElement("li");
        const title = document.createElement("strong");
        title.textContent = task.title || "Task not named";
        const details = document.createElement("span");
        const detailsText = [task.when, task.person].filter(Boolean);
        details.textContent = detailsText.length ? detailsText.join(" · ") : "Date and lead not set";
        item.append(title, details);
        return item;
      }));

      summaryEmpty.hidden = true;
      summary.hidden = false;
      setActionsEnabled(true);
    }

    function hidePlan() {
      summary.hidden = true;
      summaryEmpty.hidden = false;
      setActionsEnabled(false);
    }

    function savePlan(announce) {
      const plan = readPlan();
      showPlan(plan);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
        if (announce) planStatus.textContent = "Plan saved in this browser on this device. It is not sent to the site.";
      } catch (storageError) {
        planStatus.textContent = "The plan preview is ready, but browser storage is unavailable.";
      }
    }

    // Typing saves quietly a moment after the last key press.
    function scheduleSave() {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => savePlan(false), 280);
    }

    function loadSavedPlan() {
      let saved = null;
      try {
        saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      } catch (storageError) {
        planStatus.textContent = "A saved plan could not be read. Your current edits will stay in this browser.";
        return;
      }
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) return;

      // Older saves used "householdName" and "meetingPlace".
      const values = { ...saved, household: saved.household ?? saved.householdName, meeting: saved.meeting ?? saved.meetingPlace };
      PLAN_FIELDS.forEach((name) => {
        if (field(name)) field(name).value = safeText(values[name] || "", limitFor(name));
      });
      renderTaskRows(saved.tasks);
      showPlan(readPlan());
      planStatus.textContent = "Plan loaded from this browser on this device.";
    }

    function planAsText(plan) {
      const lines = [
        plan.planName || "Cyclone safety plan",
        plan.household ? "Household or group: " + plan.household : "",
        "",
        "Safe place: " + (plan.shelter || "Not set"),
        "Main route: " + (plan.routeOne || "Not set"),
        "Alternative route: " + (plan.routeTwo || "Not set"),
        "Meeting place: " + (plan.meeting || "Not set"),
        "Trusted contact: " + (plan.contact || "Not set"),
        "",
        "Preparation tasks:",
        ...plan.tasks.map((task, index) =>
          (index + 1) + ". " + (task.title || "Task not named") + " | When: " + (task.when || "Not set") + " | Responsible: " + (task.person || "Not set")),
      ];
      return lines.join("\n") + "\n";
    }

    function downloadText(text, fileName) {
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      window.clearTimeout(saveTimer);
      savePlan(true);
      sound("success");
    });

    form.addEventListener("input", scheduleSave);
    form.addEventListener("change", scheduleSave);

    addTaskButton.addEventListener("click", () => {
      const tasks = readTasks();
      if (tasks.length >= MAX_TASKS) {
        planStatus.textContent = "A plan can have up to " + MAX_TASKS + " tasks.";
        sound("nudge");
        return;
      }
      sound("add");
      tasks.push({ title: "", when: "", person: "" });
      renderTaskRows(tasks);
      scheduleSave();
      const newTitle = taskList.querySelector("tr:last-child input");
      if (newTitle) newTitle.focus();
      planStatus.textContent = "A task row was added.";
    });

    taskList.addEventListener("click", (event) => {
      const removeButton = event.target.closest(".task-remove");
      if (!removeButton) return;
      const index = taskRows().indexOf(removeButton.closest("[data-task-row]"));
      if (index < 0) return;
      const tasks = readTasks();
      tasks.splice(index, 1);
      sound("remove");
      renderTaskRows(tasks);
      scheduleSave();
      planStatus.textContent = "Task removed.";
      // The pressed button is gone, so keep keyboard focus nearby: the next row's remove
      // button, the new last row's, or the add button when no tasks are left.
      const remaining = taskList.querySelectorAll(".task-remove");
      (remaining[Math.min(index, remaining.length - 1)] || addTaskButton).focus();
    });

    clearPlanButton.addEventListener("click", () => {
      if (!window.confirm("Clear the plan saved on this device and restore the example tasks?")) return;
      sound("sweep");
      window.clearTimeout(saveTimer);
      form.reset();
      renderTaskRows(DEFAULT_TASKS);
      try {
        localStorage.removeItem(STORAGE_KEY);
        planStatus.textContent = "Saved plan cleared. The example tasks are back in the editor.";
      } catch (storageError) {
        planStatus.textContent = "The example tasks are back in the editor, but browser storage could not be cleared.";
      }
      hidePlan();
    });

    downloadButton.addEventListener("click", () => {
      const plan = readPlan();
      const fileName = (plan.planName || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "cyclone-safety-plan";
      downloadText(planAsText(plan), fileName + ".txt");
      sound("success");
      planStatus.textContent = "A text copy of your plan was prepared for download.";
    });

    printButton.addEventListener("click", () => window.print());

    renderTaskRows(DEFAULT_TASKS);
    loadSavedPlan();
  }

  // ==========================================================================
  // 8. Warnings page (warnings.html)
  // ==========================================================================

  // Keep the Warnings page in step with the same example stages as the home
  // slider and calculator, and add a "jump to stage" timeline above them.
  // The static details remain readable without JavaScript.
  function setUpWarningExplorer() {
    const timeline = document.getElementById("warning-timeline");
    const list = document.getElementById("warning-timeline-list");
    const panels = Array.from(document.querySelectorAll("[data-warning-stage]"));
    if (!timeline || !list || !panels.length) return;

    const ranges = {
      evacuate: "Less than " + EVACUATE_BELOW + " hours in this example",
      prepare: EVACUATE_BELOW + " to " + ALERT_ABOVE + " hours in this example",
      alert: "More than " + ALERT_ABOVE + " hours in this example",
    };

    const explorerStages = STAGES.slice().reverse().map((stage, index) => ({
      id: stage.id,
      name: stage.name,
      advice: stage.advice,
      range: ranges[stage.id],
      number: index + 1,
    }));

    explorerStages.forEach((stage) => {
      const panel = panels.find((item) => item.dataset.warningStage === stage.id);
      if (!panel) return;

      const name = panel.querySelector("[data-stage-name]");
      const time = panel.querySelector("[data-stage-time]");
      const advice = panel.querySelector("[data-stage-advice]");
      if (name) name.textContent = stage.name;
      if (time) time.textContent = stage.range;
      if (advice) advice.textContent = stage.advice;

      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "timeline-button";
      button.setAttribute("aria-controls", panel.id);
      button.setAttribute("aria-label", stage.name + ", " + stage.range);

      const number = document.createElement("span");
      number.className = "timeline-number";
      if (stage.id === "prepare") number.classList.add("timeline-number--prepare");
      if (stage.id === "evacuate") number.classList.add("timeline-number--evacuate");
      number.setAttribute("aria-hidden", "true");
      number.textContent = String(stage.number);
      const label = document.createElement("span");
      label.className = "timeline-label";
      label.textContent = stage.name;
      const range = document.createElement("small");
      range.textContent = stage.range;
      label.append(range);
      button.append(number, label);
      button.addEventListener("click", () => {
        const summary = panel.querySelector("summary");
        if (!summary) return;
        sound("stage", stage.id);
        panel.open = true;
        panel.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
        summary.focus({ preventScroll: true });
      });
      item.append(button);
      list.append(item);
    });

    timeline.hidden = list.children.length === 0;
  }

  // ==========================================================================
  // 9. Sources page (sources.html)
  // ==========================================================================

  // The page names used in each reference's data-pages attribute, in site order.
  const PAGE_LABELS = { home: "Home", cyclones: "Cyclones", history: "History", calculator: "Calculator", warnings: "Warnings", prepare: "Prepare" };

  const pagesUsing = (reference) => (reference.dataset.pages || "").split(/\s+/);

  // Under each reference, list the pages that cite it.
  function addPageTags(references) {
    references.forEach((reference) => {
      const copyButton = reference.querySelector("[data-copy-citation]");
      if (!copyButton || reference.querySelector(".reference-pages")) return;
      const usedOn = pagesUsing(reference);
      if (!Object.keys(PAGE_LABELS).some((page) => usedOn.includes(page))) return; // background reading: no empty list
      const tags = document.createElement("ul");
      tags.className = "reference-pages";
      tags.setAttribute("aria-label", "Pages using this source");
      Object.keys(PAGE_LABELS).filter((page) => usedOn.includes(page)).forEach((page) => {
        const tag = document.createElement("li");
        tag.textContent = PAGE_LABELS[page];
        tags.append(tag);
      });
      reference.insertBefore(tags, copyButton);
    });
  }

  // "Show references used on [page]".
  function setUpReferenceFilter(filter, references) {
    const empty = document.getElementById("references-empty");
    const referenceCount = document.getElementById("reference-count");
    if (!filter || !references.length || !empty) return;

    function applyFilter() {
      const selected = filter.value;
      let visible = 0;
      references.forEach((reference) => {
        const matches = selected === "all" || pagesUsing(reference).includes(selected);
        reference.hidden = !matches;
        if (matches) visible += 1;
      });
      empty.hidden = visible > 0;
      if (referenceCount) referenceCount.textContent = visible + (visible === 1 ? " reference shown." : " references shown.");
    }

    filter.addEventListener("change", (event) => {
      applyFilter();
      // Arriving from a citation link resets the filter with a synthetic event: keep that silent.
      if (event.isTrusted) sound("select");
    });
    applyFilter();
  }

  // Arriving from a numbered marker on another page: make sure the entry is
  // visible and offer a way back to the exact spot the reader came from.
  function setUpLinkedReference(filter) {
    function showLinkedReference() {
      const match = /^#ref-\d+$/.test(window.location.hash) && document.getElementById(window.location.hash.slice(1));
      if (!match) return;
      if (match.hidden && filter) {
        filter.value = "all";
        filter.dispatchEvent(new Event("change"));
      }

      let fromPage = null;
      try {
        const referrer = new URL(document.referrer);
        if (referrer.origin === window.location.origin && !/sources\.html$/.test(referrer.pathname)) fromPage = referrer;
      } catch (referrerError) {}

      document.querySelectorAll(".cite-back").forEach((link) => link.remove());
      if (!fromPage) return;

      const fileName = (fromPage.pathname.split("/").pop() || "index.html").replace(".html", "");
      const pageKey = fileName === "index" ? "home" : fileName;
      const back = document.createElement("a");
      back.className = "cite-back";
      back.href = fromPage.href;
      back.textContent = "← Back to " + (PAGE_LABELS[pageKey] || "the page");
      back.addEventListener("click", (event) => {
        if (window.history.length > 1) {
          event.preventDefault();
          window.history.back();
        }
      });
      (match.querySelector(".reference-body") || match.lastElementChild || match).append(back);
    }

    showLinkedReference();
    window.addEventListener("hashchange", showLinkedReference);
  }

  // Copies text to the clipboard. Resolves to true if it worked.
  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (clipboardError) {}
    }
    // Older fallback for pages that are not served over HTTPS (or localhost).
    if (typeof document.execCommand !== "function") return false;
    const temporary = document.createElement("textarea");
    temporary.value = text;
    temporary.setAttribute("readonly", "");
    temporary.style.position = "fixed";
    temporary.style.opacity = "0";
    document.body.append(temporary);
    try {
      temporary.select();
      return document.execCommand("copy");
    } catch (copyError) {
      return false;
    } finally {
      temporary.remove();
    }
  }

  function setUpCopyButtons() {
    const copyStatus = document.getElementById("copy-status");

    document.querySelectorAll("[data-copy-citation]").forEach((button) => {
      const reference = button.closest(".reference-item");
      const citation = reference && reference.querySelector(".reference-citation");
      if (!citation) return;

      const label = button.textContent;
      let resetTimer = 0;
      // Several sources share an author (three from the National Hurricane Center), so the
      // reference number keeps each button's name distinct for screen reader users.
      const number = Number(reference.dataset.num);
      button.setAttribute("aria-label", label + " " + number + ": " + citation.textContent.trim().split(".")[0]);

      button.addEventListener("click", async () => {
        const copied = await copyText(citation.textContent.trim());
        if (document.activeElement !== button) button.focus(); // the fallback's hidden text box takes focus
        if (copyStatus) copyStatus.textContent = copied ? "Citation copied." : "Copy is unavailable in this browser. Select the citation text to copy it.";
        sound(copied ? "success" : "nudge");
        if (!copied) return;
        button.textContent = "Copied";
        clearTimeout(resetTimer);
        resetTimer = window.setTimeout(() => { button.textContent = label; }, 1800);
      });
    });
  }

  function setUpSourceTools() {
    if (!document.getElementById("reference-list")) return;
    const filter = document.getElementById("reference-filter");
    const references = Array.from(document.querySelectorAll("[data-reference]"));
    addPageTags(references);
    setUpReferenceFilter(filter, references);
    setUpLinkedReference(filter);
    setUpCopyButtons();
  }

  // ==========================================================================
  // 10. Start
  // ==========================================================================

  // Site-wide
  setUpThemeSwitch();
  setUpStickyHeader();
  applySmoothCorners();
  setUpRevealAnimations();
  // Home
  setUpLandfallSlider();
  showSeasonMessage();
  // Cyclones
  setUpBasinPicker();
  setUpFormationStepper();
  setUpCategoryPicker();
  setUpTownshipChart();
  setUpCountOnReveal();
  // History
  setUpStormTimeline();
  // Calculator
  setUpLandfallCalculator();
  // Prepare
  setUpChecklist();
  setUpWaterPlanner();
  setUpFamilyPlan();
  // Warnings
  setUpWarningExplorer();
  // Sources
  setUpSourceTools();
})();
