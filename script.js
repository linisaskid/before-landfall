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

  // Where an answer sits on the Under 6 h | 6–24 h | Over 24 h bar (the calculator's
  // gauge, and its demo on the home page). Like the home page slider, the bar runs from
  // close (left) to far away (right), so fewer hours sit further left. Its three bands
  // are 1 : 1.2 : 1 wide, and 6 h and 24 h fall exactly on the edges between them.
  function gaugePosition(hours) {
    const evacuateEnd = 100 / 3.2;
    const prepareEnd = (100 * 2.2) / 3.2;
    let position;
    if (hours < EVACUATE_BELOW) position = (Math.max(hours, 0) / EVACUATE_BELOW) * evacuateEnd;
    else if (hours <= ALERT_ABOVE) position = evacuateEnd + ((hours - EVACUATE_BELOW) / (ALERT_ABOVE - EVACUATE_BELOW)) * (prepareEnd - evacuateEnd);
    else position = prepareEnd + Math.min((hours - ALERT_ABOVE) / 48, 1) * (100 - prepareEnd);
    return Math.min(Math.max(position, 3), 97);
  }

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

  // The tool cards under "What you can do here" each play a small, silent version of
  // their tool. A demo moves on to its next example every few seconds, but only while
  // it is on screen and the tab is visible. With reduced motion (or no script) each
  // card keeps the one still example written in the HTML.
  const DEMO_STEP_MS = 2800;

  // Calculator: distance ÷ speed = hours, and the stage those hours fall in.
  // Every example divides exactly, and between them they reach all three stages.
  function calculatorDemo(demo) {
    const distance = demo.querySelector("[data-demo-distance]");
    const speed = demo.querySelector("[data-demo-speed]");
    const hours = demo.querySelector("[data-demo-hours]");
    const stageName = demo.querySelector("[data-demo-stage]");
    const chip = demo.querySelector(".demo-stage");
    const marker = demo.querySelector(".result-gauge-marker");
    if (!distance || !speed || !hours || !stageName || !chip || !marker) return null;

    const examples = [[540, 30], [900, 25], [120, 24], [300, 25]];
    [distance, speed, hours, stageName].forEach((element) => setRollTransition(element));
    let index = 0;
    let answerTimer = 0;

    return function next() {
      index = (index + 1) % examples.length;
      const [km, kmh] = examples[index];
      const stage = stageForHours(km / kmh);
      setRoll(distance, String(km));
      setRoll(speed, String(kmh));
      // The answer follows a moment after the numbers that make it.
      clearTimeout(answerTimer);
      answerTimer = setTimeout(() => {
        setRoll(hours, String(km / kmh));
        setRoll(stageName, stage.name);
        chip.dataset.stage = stage.id;
        marker.style.setProperty("--gauge-position", gaugePosition(km / kmh) + "%");
      }, 280);
    };
  }

  // Warnings: the stages in the order a storm brings them, then back to the start.
  function warningsDemo(demo) {
    const control = demo.querySelector(".demo-seg");
    const band = demo.querySelector("[data-demo-band]");
    const action = demo.querySelector("[data-demo-action]");
    if (!control || !band || !action) return null;

    const order = ["alert", "prepare", "evacuate"];
    const bands = {
      alert: "Over " + ALERT_ABOVE + " hours",
      prepare: EVACUATE_BELOW + " to " + ALERT_ABOVE + " hours",
      evacuate: "Under " + EVACUATE_BELOW + " hours",
    };
    const actions = {
      alert: "Listen for official updates and check on neighbours.",
      prepare: "Pack, charge phones and agree your route.",
      evacuate: "Go to your shelter now.",
    };
    setRollTransition(band);
    let index = Number(control.dataset.active) || 0;
    let actionTimer = 0;

    return function next() {
      index = (index + 1) % order.length;
      const id = order[index];
      control.dataset.active = String(index);
      setRoll(band, bands[id]);
      clearTimeout(actionTimer);
      action.classList.add("is-changing");
      actionTimer = setTimeout(() => {
        action.textContent = actions[id];
        action.classList.remove("is-changing");
      }, 200);
    };
  }

  // Prepare: the checklist ticks itself off one task at a time, rests when it is
  // complete, then starts again.
  function prepareDemo(demo) {
    const checks = Array.from(demo.querySelectorAll(".demo-check"));
    const progress = demo.querySelector(".demo-progress");
    const count = demo.querySelector("[data-demo-done]");
    if (!checks.length || !progress || !count) return null;

    const sequence = [3, 3, 0, 1, 2];
    setRollTransition(count);
    let index = sequence.length - 1; // the HTML shows 2 of 3 done

    return function next() {
      index = (index + 1) % sequence.length;
      const done = sequence[index];
      checks.forEach((check, i) => check.classList.toggle("is-done", i < done));
      progress.style.setProperty("--done", String(done));
      setRoll(count, String(done));
    };
  }

  function setUpToolDemos() {
    const demos = Array.from(document.querySelectorAll("[data-demo]"));
    if (!demos.length || prefersReducedMotion() || typeof window.IntersectionObserver !== "function") return;

    const builders = { calculator: calculatorDemo, warnings: warningsDemo, prepare: prepareDemo };
    const players = [];
    demos.forEach((demo, order) => {
      const build = builders[demo.dataset.demo];
      const next = build ? build(demo) : null;
      // Staggered, so the three cards never all change in the same moment.
      if (next) players.push({ demo, next, delay: DEMO_STEP_MS / 2 + order * 700, timer: 0, onScreen: false });
    });

    function start(player) {
      if (player.timer) return;
      const tick = () => {
        player.next();
        player.timer = setTimeout(tick, DEMO_STEP_MS);
      };
      player.timer = setTimeout(tick, player.delay);
    }

    function stop(player) {
      clearTimeout(player.timer);
      player.timer = 0;
    }

    function refresh(player) {
      if (player.onScreen && !document.hidden) start(player);
      else stop(player);
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const player = players.find((item) => item.demo === entry.target);
        if (!player) return;
        player.onScreen = entry.isIntersecting;
        refresh(player);
      });
    }, { threshold: 0.35 });

    players.forEach((player) => observer.observe(player.demo));
    document.addEventListener("visibilitychange", () => players.forEach(refresh));
    onReducedMotionEnabled(() => {
      observer.disconnect();
      players.forEach(stop);
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
    // The limits come from the inputs' min and max attributes, so the HTML is the one place to change
    // them, and the script never accepts a number the browser would call out of range (or the reverse).
    const MIN_DISTANCE = Number(distanceInput.min) || 0.1;
    const MAX_DISTANCE = Number(distanceInput.max) || 5000;
    // Cyclones do stall, so the slowest speed is a crawl of 1 km/h (the live storm check
    // hands over nothing slower).
    const MIN_SPEED = Number(speedInput.min) || 1;
    const MAX_SPEED = Number(speedInput.max) || 100;
    // One message for every wrong or missing number in a box: it names the box and the numbers it takes.
    const DISTANCE_MESSAGE = "Enter a storm centre to coast distance from " + MIN_DISTANCE.toLocaleString("en-US") +
                             " to " + MAX_DISTANCE.toLocaleString("en-US") + " km.";
    const SPEED_MESSAGE = "Enter a forward speed from " + MIN_SPEED.toLocaleString("en-US") +
                          " to " + MAX_SPEED.toLocaleString("en-US") + " km/h.";
    const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
    const exampleButtons = Array.from(document.querySelectorAll("[data-example-distance][data-example-speed]"));
    const touched = new Set();
    let estimates = [];
    let storageAvailable = true;
    let announceTimer = 0;

    setRollTransition(resultHours);

    const isValidDistance = (value) => Number.isFinite(value) && value >= MIN_DISTANCE && value <= MAX_DISTANCE;
    const isValidSpeed = (value) => Number.isFinite(value) && value >= MIN_SPEED && value <= MAX_SPEED;
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
    // An empty box gets the same message as a wrong number in it; incomplete only means the
    // message can wait while the visitor is still typing.
    function findProblem(values) {
      if (!values.hasDistance || !isValidDistance(values.distance)) {
        return { message: DISTANCE_MESSAGE, field: distanceInput, incomplete: !values.hasDistance };
      }
      if (!values.hasSpeed || !isValidSpeed(values.speed)) {
        return { message: SPEED_MESSAGE, field: speedInput, incomplete: !values.hasSpeed };
      }
      return null;
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
    // replayFrom is only given by the Nargis replay: the moment in 2008 the numbers belong to,
    // so the arrival time is counted from then and not from today.
    function showResult(distance, speed, replayFrom) {
      const exactHours = distance / speed;
      // Round once and use the rounded figure everywhere, so the number on screen and its stage
      // always agree (5.999 h shows as "6 hours", so it must not be labelled "under 6 h").
      const hours = Math.max(Math.round(exactHours * 100) / 100, 0.01);
      const arrival = new Date((replayFrom || Date.now()) + exactHours * 60 * 60 * 1000);
      if (!Number.isFinite(arrival.getTime())) return null;

      const stage = stageForHours(hours);
      const wasHidden = result.hidden;
      const hoursText = formatHours(hours);

      result.dataset.stage = stage.id;
      if (resultMarker) resultMarker.style.setProperty("--gauge-position", gaugePosition(hours) + "%");
      resultArrival.textContent = replayFrom
        ? "In the replay, if the speed had stayed the same: " + formatUtc(arrival) + "."
        : "If the speed stays the same: " + timeFormat.format(arrival) + " (your device’s local time).";
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
    function update(explicit, replayFrom) {
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

      const outcome = showResult(values.distance, values.speed, replayFrom);
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
        // A replay is a history lesson, not one of the visitor's own estimates, so it is not saved.
        if (!replayFrom) saveEstimate(values.distance, values.speed, outcome);
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

    // The live storm panel (setUpLiveStorm) hands over its two numbers with this event.
    form.addEventListener("landfall:fill", (event) => {
      fillInputs(event.detail.distance, event.detail.speed);
      update(true, event.detail.replayFrom);
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

  // Live storm panel: finds the two calculator numbers from real storm positions.
  //
  // This is the one place on the site that talks to another computer, and only when the
  // visitor presses "Check now". It asks GDACS (the UN and EU disaster alert system) for
  // the tropical cyclones it is tracking, keeps any that are in the Bay of Bengal or the
  // Andaman Sea, and reads their last two reported positions. From those it works out:
  //
  //   distance = straight line from the storm centre to one point on the delta coast
  //   speed    = how much closer the storm got between the two reports, per hour
  //
  // "Closer per hour" is used instead of the storm's own speed on purpose: a storm racing
  // north past the delta is fast but is not arriving, and the calculator would be wrong.
  //
  // The Nargis replay runs the same sums on recorded positions, so the panel can be shown
  // on a day with no storm and with no internet.
  const GDACS_API = "https://www.gdacs.org/gdacsapi/api/";
  // The south-west delta coast near the mouths of the Ayeyarwady, where Nargis came ashore.
  const DELTA_COAST = { lat: 15.9, lon: 94.6 };
  const BAY_OF_BENGAL = { south: 3, north: 24, west: 78, east: 100 };
  const HOUR_MS = 60 * 60 * 1000;
  const STALE_AFTER_HOURS = 36;
  // Storm times are written the way forecasters write them, "12:00 UTC on 1 May 2008", and in
  // British English like the Community page's dates, whatever language the device is set to.
  const UTC_CLOCK = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
  const UTC_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const formatUtc = (time) => UTC_CLOCK.format(time) + " UTC on " + UTC_DATE.format(time);

  // Cyclone Nargis every six hours (UTC), from NOAA's IBTrACS best-track archive, v04r01.
  const NARGIS_TRACK = [
    ["2008-04-30T12:00Z", 14.8, 87.3],
    ["2008-04-30T18:00Z", 15.2, 87.9],
    ["2008-05-01T00:00Z", 15.6, 88.5],
    ["2008-05-01T06:00Z", 16.0, 89.7],
    ["2008-05-01T12:00Z", 16.0, 90.6],
    ["2008-05-01T18:00Z", 15.9, 91.6],
    ["2008-05-02T00:00Z", 15.9, 92.6],
    ["2008-05-02T06:00Z", 16.0, 93.6],
  ].map(([time, lat, lon]) => ({ time: Date.parse(time), lat, lon }));
  const NARGIS_LANDFALL = Date.parse("2008-05-02T12:00Z");
  const NARGIS_REPLAY_START = 4; // 12:00 UTC on 1 May, a day before landfall

  // Great-circle distance between two { lat, lon } points, in km (the haversine formula).
  function distanceKm(from, to) {
    const radians = (degrees) => (degrees * Math.PI) / 180;
    const dLat = radians(to.lat - from.lat);
    const dLon = radians(to.lon - from.lon);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(a));
  }

  // points: reported positions, oldest first. Returns where the storm is and how fast it is closing.
  // closing is null with only one report, and zero or negative when the storm is not getting nearer.
  function readStormTrack(points) {
    const latest = points[points.length - 1];
    const previous = points[points.length - 2];
    const distance = distanceKm(latest, DELTA_COAST);
    let closing = null;
    if (previous && latest.time > previous.time) {
      closing = (distanceKm(previous, DELTA_COAST) - distance) / ((latest.time - previous.time) / HOUR_MS);
    }
    return { time: latest.time, distance, closing };
  }

  // GDACS writes report times as "03 Nov 2026 06:00", in UTC.
  function parseGdacsTime(text) {
    const match = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4}) (\d{2}):(\d{2})/.exec(String(text || "").trim());
    if (!match) return NaN;
    const month = MONTH_NAMES.findIndex((name) => name.slice(0, 3).toLowerCase() === match[2].toLowerCase());
    if (month < 0) return NaN;
    return Date.UTC(Number(match[3]), month, Number(match[1]), Number(match[4]), Number(match[5]));
  }

  // Every request goes through here. It refuses any address that is not the GDACS API (some
  // addresses come from inside GDACS's own answers), sends no cookies, and gives up after 15 s.
  async function getGdacs(url) {
    if (!String(url).startsWith(GDACS_API)) throw new Error("Not a GDACS address");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer" });
      if (!response.ok) throw new Error("GDACS answered " + response.status);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // Returns the active storm nearest the delta as { name, time, distance, closing }, or null if there is none.
  async function findLiveStorm() {
    const list = await getGdacs(GDACS_API + "events/geteventlist/SEARCH?eventlist=TC");
    const inBay = (Array.isArray(list && list.features) ? list.features : []).filter((feature) => {
      const properties = feature.properties || {};
      const [lon, lat] = (feature.geometry && feature.geometry.coordinates) || [];
      return String(properties.iscurrent) === "true" &&
             lat >= BAY_OF_BENGAL.south && lat <= BAY_OF_BENGAL.north &&
             lon >= BAY_OF_BENGAL.west && lon <= BAY_OF_BENGAL.east;
    }).slice(0, 3);

    const storms = [];
    for (const feature of inBay) {
      const properties = feature.properties;
      const detail = await getGdacs(GDACS_API + "events/geteventdata?eventtype=TC&eventid=" + encodeURIComponent(properties.eventid));
      const impacts = (detail.properties && detail.properties.impacts) || [];
      const timelineUrl = impacts[0] && impacts[0].resource && impacts[0].resource.timeline;
      if (!timelineUrl) continue;
      const timeline = await getGdacs(timelineUrl);
      const items = (timeline.channel && timeline.channel.item) || [];
      // "actual" reports are where the storm was seen; the others are the forecast.
      const points = items
        .filter((item) => String(item.actual).toLowerCase() === "true")
        .map((item) => ({ time: parseGdacsTime(item.advisory_datetime), lat: Number(item.latitude), lon: Number(item.longitude) }))
        .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.lat) && Number.isFinite(point.lon))
        .sort((a, b) => a.time - b.time);
      if (!points.length) continue;
      const reading = readStormTrack(points);
      if (Date.now() - reading.time > STALE_AFTER_HOURS * HOUR_MS) continue;
      const name = String(properties.eventname || properties.name || "A storm").replace(/-\d+$/, "");
      storms.push(Object.assign({ name: name.charAt(0) + name.slice(1).toLowerCase() }, reading));
    }
    storms.sort((a, b) => a.distance - b.distance);
    return storms[0] || null;
  }

  function setUpLiveStorm() {
    const panel = document.getElementById("live-storm");
    const form = document.getElementById("landfall-form");
    const kicker = document.getElementById("live-storm-kicker");
    const status = document.getElementById("live-storm-status");
    const detail = document.getElementById("live-storm-detail");
    const checkButton = document.getElementById("live-storm-check");
    const useButton = document.getElementById("live-storm-use");
    const replayButton = document.getElementById("live-storm-replay");
    const steps = document.getElementById("live-storm-steps");
    const earlier = document.getElementById("live-storm-earlier");
    const later = document.getElementById("live-storm-later");
    if (!panel || !form || !kicker || !status || !detail || !checkButton || !useButton || !replayButton || !steps || !earlier || !later) return;

    const MAX_DISTANCE = Number(document.getElementById("storm-distance").max) || 5000;
    const MAX_SPEED = Number(document.getElementById("storm-speed").max) || 100;
    const clockFormat = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });
    let numbers = null;     // the { distance, speed } the "Use these numbers" button will hand over
    let replayIndex = -1;   // which Nargis report is showing; -1 when not replaying
    let checking = false;

    function show(state, kickerText, statusText, detailText) {
      panel.dataset.storm = state;
      kicker.textContent = kickerText;
      status.textContent = statusText;
      detail.textContent = detailText || "";
      detail.hidden = !detailText;
      useButton.hidden = !numbers;
    }

    // Turns a storm reading into the sentence on screen, and into calculator numbers when there are any.
    function describe(storm, replaying) {
      // Positions are given to 0.1 of a degree (about 11 km), so finer numbers would be false precision.
      const distance = Math.min(Math.max(Math.round(storm.distance / 10) * 10, 10), MAX_DISTANCE);
      const speed = storm.closing === null ? null : Math.round(storm.closing);
      const where = storm.name + " was about " + distance.toLocaleString() + " km from the delta coast at " + formatUtc(storm.time);
      const kickerText = replaying ? "Replay, not a live storm" : "Live storm";
      numbers = null;

      if (speed === null) {
        show("watch", kickerText, where + ".", "This is its first report, so there is no speed yet. Check again after the next report, or take the forward speed from an official forecast.");
      } else if (speed < 1) {
        show("watch", kickerText, where + ", and it is not moving toward the delta at the moment.", "There is no landfall time to estimate. Storms change direction, so keep following official forecasts.");
      } else {
        numbers = { distance, speed: Math.min(speed, MAX_SPEED), replayFrom: replaying ? storm.time : undefined };
        const hours = Math.round(numbers.distance / numbers.speed);
        let ending = "That is about " + hours.toLocaleString() + " hours away if nothing changes.";
        if (replaying) {
          const actual = Math.round((NARGIS_LANDFALL - storm.time) / HOUR_MS);
          ending += " Nargis really came ashore about " + actual + " hours later" +
                    (Math.abs(actual - hours) <= 1 ? ", so this estimate was close." : ": storms speed up and slow down.");
        }
        show("storm", kickerText, where + ", getting closer by about " + numbers.speed + " km every hour.", ending);
      }
    }

    function showReplay() {
      describe(Object.assign({ name: "Cyclone Nargis" }, readStormTrack(NARGIS_TRACK.slice(0, replayIndex + 1))), true);
      earlier.disabled = replayIndex <= 1;
      later.disabled = replayIndex >= NARGIS_TRACK.length - 1;
    }

    function setReplaying(on) {
      replayIndex = on ? NARGIS_REPLAY_START : -1;
      steps.hidden = !on;
      replayButton.textContent = on ? "Leave the replay" : "Replay Cyclone Nargis, 2008";
    }

    checkButton.addEventListener("click", async () => {
      if (checking) return;
      checking = true;
      checkButton.disabled = true;
      setReplaying(false);
      numbers = null;
      show("checking", "Live check", "Asking GDACS for the latest storm positions…");
      try {
        const storm = await findLiveStorm();
        if (replayIndex >= 0) return; // the visitor started the replay while waiting
        if (storm) {
          describe(Object.assign({}, storm, { name: "Cyclone " + storm.name }), false);
        } else {
          show("clear", "Live check", "GDACS is not tracking any cyclone in the Bay of Bengal or Andaman Sea right now.", "Checked at " + clockFormat.format(new Date()) + ". A storm can form within a few days, so check again and listen for official announcements in the cyclone seasons.");
        }
      } catch (error) {
        if (replayIndex < 0) show("problem", "Live check", "The storm data could not be reached.", "You may be offline, or GDACS may be busy. Try again in a moment, or type the numbers from an official forecast below.");
      } finally {
        checking = false;
        checkButton.disabled = false;
        checkButton.textContent = "Check again";
      }
    });

    replayButton.addEventListener("click", () => {
      if (replayIndex >= 0) {
        setReplaying(false);
        numbers = null;
        show("idle", "Live check", "Look up the latest storm positions and this page works out the two numbers for you.");
        return;
      }
      setReplaying(true);
      showReplay();
    });

    earlier.addEventListener("click", () => {
      if (replayIndex > 1) replayIndex -= 1;
      showReplay();
    });
    later.addEventListener("click", () => {
      if (replayIndex < NARGIS_TRACK.length - 1) replayIndex += 1;
      showReplay();
    });

    useButton.addEventListener("click", () => {
      if (numbers) form.dispatchEvent(new CustomEvent("landfall:fill", { detail: numbers }));
    });

    panel.hidden = false;
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
    const formula = document.getElementById("water-formula");
    if (!inputs.every(Boolean) || !waterTotal || !formula) return;
    const FORMULA_TEXT = formula.textContent;

    // What a box accepts, worded from its own label and limits, e.g.
    // "Days in your plan: enter a whole number from 1 to 14."
    function messageFor(input) {
      const label = input.labels && input.labels[0] ? input.labels[0].textContent.trim() : "This box";
      const step = Number(input.step) || 1;
      const accepts = step === 1
        ? "a whole number from " + input.min + " to " + input.max
        : "a number from " + input.min + " to " + input.max + ", in steps of " + input.step;
      return label + ": enter " + accepts + ".";
    }

    // Like the calculator, only the first wrong box is named, so there is one message to read.
    function findProblem() {
      return inputs.find((input) => !input.value.trim() || !input.checkValidity()) || null;
    }

    function updateTotal(animate) {
      const problem = findProblem();
      inputs.forEach((input) => {
        if (input === problem) {
          input.setAttribute("aria-invalid", "true");
          input.setAttribute("aria-describedby", formula.id);
        } else {
          input.removeAttribute("aria-invalid");
          input.removeAttribute("aria-describedby");
        }
      });
      if (problem) {
        setRoll(waterTotal, "Check the values", animate);
        formula.textContent = messageFor(problem);
        return;
      }
      formula.textContent = FORMULA_TEXT;
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

    // Task dates are stored as "2026-11-13" but printed as "13 November 2026", like the rest of
    // the site. The date is built from its parts and formatted in UTC, because new Date("2026-11-13")
    // is UTC midnight and would print as 12 November in time zones behind UTC.
    const PLAN_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    function readableDate(isoDate) {
      const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || "");
      if (!parts) return "";
      const [year, month, day] = parts.slice(1).map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      // Date.UTC quietly rolls 31 February over into March, so check the day survived.
      if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
      return PLAN_DATE_FORMAT.format(date);
    }

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
        const detailsText = [readableDate(task.when), task.person].filter(Boolean);
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
          (index + 1) + ". " + (task.title || "Task not named") + " | When: " + (readableDate(task.when) || "Not set") + " | Responsible: " + (task.person || "Not set")),
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
      evacuate: "Under " + EVACUATE_BELOW + " hours in this example",
      prepare: EVACUATE_BELOW + " to " + ALERT_ABOVE + " hours in this example",
      alert: "Over " + ALERT_ABOVE + " hours in this example",
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

  // The short "Author (year)" name that the citation markers on the other pages use, worked
  // out from the APA reference: "Fritz, H. M., Blount, C. D., … (2009)" gives "Fritz et al. (2009)".
  // A data-cite-note adds the word or two that tells same-author sources apart ("hazards").
  function shortCitation(reference, citation) {
    const match = citation.textContent.trim().match(/^(.+?)\.? \(([^)]+)\)/);
    if (!match) return "";
    const year = match[2].split(",")[0]; // "2011, October" → "2011"
    const parts = match[1].split(/,\s*(?:&\s*)?/);
    let author = parts[0];
    if (parts.length > 1 && /^(?:[A-Z]\.\s?)*[A-Z]\.?$/.test(parts[1])) {
      // People: "Surname, Initials" pairs. One is named, two are joined, three or more are "et al."
      const surnames = parts.filter((part, i) => i % 2 === 0);
      if (surnames.length === 2) author = surnames.join(" & ");
      if (surnames.length > 2) author += " et al.";
    } else if (match[1].includes("&")) {
      author += " et al."; // a list of organisations
    }
    const note = reference.dataset.citeNote;
    return author + " (" + year + ")" + (note ? ", " + note : "");
  }

  function setUpCopyButtons() {
    const copyStatus = document.getElementById("copy-status");

    document.querySelectorAll("[data-copy-citation]").forEach((button) => {
      const reference = button.closest(".reference-item");
      const citation = reference && reference.querySelector(".reference-citation");
      if (!citation) return;

      const label = button.textContent;
      let resetTimer = 0;
      // Every button would otherwise just be "Copy citation", so its name also says which
      // source it copies, the same way the citation markers do. The name starts with the
      // visible words so voice control users can say what they see.
      const number = Number(reference.dataset.num);
      const short = shortCitation(reference, citation);
      const source = " for source " + number + (short ? ": " + short : "");
      const showLabel = (words) => {
        button.textContent = words;
        button.setAttribute("aria-label", words + source);
      };
      showLabel(label);

      button.addEventListener("click", async () => {
        const copied = await copyText(citation.textContent.trim());
        if (document.activeElement !== button) button.focus(); // the fallback's hidden text box takes focus
        if (copyStatus) copyStatus.textContent = copied ? "Citation copied." : "Copy is unavailable in this browser. Select the citation text to copy it.";
        sound(copied ? "success" : "nudge");
        if (!copied) return;
        showLabel("Copied");
        clearTimeout(resetTimer);
        resetTimer = window.setTimeout(() => showLabel(label), 1800);
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
  setUpToolDemos();
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
  setUpLiveStorm();
  // Prepare
  setUpChecklist();
  setUpWaterPlanner();
  setUpFamilyPlan();
  // Warnings
  setUpWarningExplorer();
  // Sources
  setUpSourceTools();
})();
