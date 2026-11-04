/* Motion layer: scroll progress, split headlines, parallax and a WebGL
 * cyclone behind the hero. It is additive: script.js does not depend on it,
 * and every part fails quietly if a library or WebGL is missing.
 *
 * Contents
 *   1. Scroll progress bar
 *   2. Headline line reveals (SplitText)
 *   3. Parallax on illustrations
 *   4. WebGL cyclone behind the hero panel
 *   5. Start
 */
(function () {
  "use strict";

  const html = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const darkScheme = window.matchMedia("(prefers-color-scheme: dark)");
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const hasGsap = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";

  // Run one part of the motion layer; if it throws, log it and carry on with the rest.
  function safely(name, fn) {
    try { fn(); } catch (error) { console.warn("[motion] " + name + " skipped:", error); }
  }

  // ==========================================================================
  // 1. Scroll progress bar
  // ==========================================================================

  function initProgress() {
    if (reduceMotion || !hasGsap) return;
    const bar = document.createElement("div");
    bar.className = "motion-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);
    gsap.to(bar, {
      scaleX: 1,
      ease: "none",
      scrollTrigger: { start: 0, end: "max", scrub: 0.25 },
    });
  }

  // ==========================================================================
  // 2. Headline line reveals (SplitText)
  // Keep this list in sync with the html.motion-pending selector in motion.css,
  // which hides these headings until they are split.
  // ==========================================================================

  const HEADINGS = ".hero-text h1, .support-hero-copy h1, .section-heading h2, .why-intro h2, .history-heading h2, .reference-toolbar h2, .next-step h2, .official-copy h2, #tools-title";

  function initHeadings() {
    const SplitText = window.SplitText;
    if (reduceMotion || !hasGsap || typeof SplitText === "undefined") return;
    gsap.registerPlugin(SplitText);

    document.querySelectorAll(HEADINGS).forEach((heading) => {
      let played = false;
      SplitText.create(heading, {
        type: "lines",
        mask: "lines",
        linesClass: "motion-line",
        autoSplit: true,
        onSplit(self) {
          heading.querySelectorAll("[class*='mask']").forEach((node) => node.classList.add("motion-line-mask"));
          if (played) return undefined; // after a resize, show the lines as they are
          return gsap.from(self.lines, {
            yPercent: 115,
            duration: 1,
            ease: "power4.out",
            stagger: 0.09,
            scrollTrigger: { trigger: heading, start: "top 90%", once: true },
            onComplete() { played = true; },
          });
        },
      });
    });
  }

  // ==========================================================================
  // 3. Parallax on illustrations
  // ==========================================================================

  function initParallax() {
    if (reduceMotion || !hasGsap) return;
    const targets = document.querySelectorAll(".support-art svg, .support-art img, .formation-svg, .track-diagram, .plan-diagram");
    targets.forEach((element) => {
      gsap.fromTo(element, { yPercent: -3 }, {
        yPercent: 3,
        ease: "none",
        scrollTrigger: { trigger: element, start: "top bottom", end: "bottom top", scrub: true },
      });
    });
  }

  // ==========================================================================
  // 4. WebGL cyclone behind the hero panel
  // A full-screen quad; the fragment shader draws a spiral of noisy cloud
  // around an "eye" that sits behind the hero's .panel.
  // ==========================================================================

  const VERTEX_SHADER = "attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }";
  const FRAGMENT_SHADER = [
    "precision highp float;",
    "uniform vec2 uRes; uniform vec2 uEye; uniform float uEyeR; uniform float uTime;",
    "uniform vec3 uColorA; uniform vec3 uColorB; uniform float uIntensity; uniform float uAlpha;",
    "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
    "float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }",
    "float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + vec2(17.3, 9.1); a *= 0.5; } return v; }",
    "void main(){",
    "  vec2 d = gl_FragCoord.xy - uEye;",
    "  float r = length(d) / uRes.y;",
    "  float eye = uEyeR / uRes.y;",
    "  float rr = max(r - eye * 0.9, 0.0) + 0.012;",
    "  float ang = atan(d.y, d.x);",
    "  float twist = log(rr * 9.0 + 1.0) * 2.6 - uTime;",
    "  float c = cos(twist); float s = sin(twist);",
    "  vec2 q = mat2(c, -s, s, c) * (d / uRes.y);",
    "  float cloud = fbm(q * 5.5 + vec2(0.0, uTime * 0.15));",
    "  float arms = 0.5 + 0.5 * cos(ang * 3.0 + log(rr * 9.0 + 1.0) * 5.2 - uTime * 1.3);",
    "  float density = smoothstep(0.32, 0.9, cloud) * mix(0.35, 1.0, arms);",
    "  float falloff = exp(-rr * 2.6) * smoothstep(eye * 0.85, eye * 1.12, r);",
    "  float ring = exp(-pow((r - eye * 1.1) / (eye * 0.12 + 0.004), 2.0)) * 0.55;",
    "  vec2 uv = gl_FragCoord.xy / uRes;",
    "  float edge = smoothstep(0.0, 0.1, uv.x) * smoothstep(1.0, 0.9, uv.x) * smoothstep(0.0, 0.16, uv.y) * smoothstep(1.0, 0.84, uv.y);",
    "  float a = clamp((density * falloff * 1.5 + ring) * uIntensity, 0.0, 1.0) * uAlpha * edge;",
    "  vec3 col = mix(uColorB, uColorA, clamp(density * 1.2 + ring, 0.0, 1.0));",
    "  gl_FragColor = vec4(col * a, a);",
    "}",
  ].join("\n");

  // How the storm looks at each warning stage (ids match STAGES in script.js).
  // Colours come from the CSS custom properties, so they follow the theme.
  const STAGE_LOOKS = {
    alert:    { colorVar: "--c-alert",    speed: 0.10, intensity: 0.85 },
    prepare:  { colorVar: "--c-prepare",  speed: 0.17, intensity: 1.00 },
    evacuate: { colorVar: "--c-evacuate", speed: 0.30, intensity: 1.20 },
  };
  const COLOR_TWEEN = { duration: 1.4, ease: "power2.inOut", overwrite: "auto" };
  const POINTER_EASE = 0.06; // how quickly the eye drifts toward the pointer each frame

  // "#2596a8" -> [r, g, b] in 0–1. The site's colour tokens are all hex.
  function hexToRgb(value, fallback) {
    let hex = String(value).trim().replace("#", "");
    if (hex.length === 3) hex = hex.split("").map((ch) => ch + ch).join("");
    const n = parseInt(hex, 16);
    if (hex.length !== 6 || Number.isNaN(n)) return fallback;
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function isDarkTheme() {
    const forced = html.getAttribute("data-theme");
    if (forced === "dark") return true;
    if (forced === "light") return false;
    return darkScheme.matches;
  }

  function compileProgram(gl) {
    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    }
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    return program;
  }

  function initCyclone() {
    const hero = document.querySelector(".hero");
    const panel = hero && hero.querySelector(".panel");
    if (!hero || !panel) return;

    const canvas = document.createElement("canvas");
    canvas.className = "hero-cyclone";
    canvas.setAttribute("aria-hidden", "true");
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return;

    const program = compileProgram(gl); // throws (and the canvas is never added) if the shaders fail
    gl.useProgram(program);
    hero.insertBefore(canvas, hero.firstChild);

    // One quad that covers the whole canvas.
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const uniforms = {};
    ["uRes", "uEye", "uEyeR", "uTime", "uColorA", "uColorB", "uIntensity", "uAlpha"].forEach((name) => {
      uniforms[name] = gl.getUniformLocation(program, name);
    });

    // Everything the shader draws from. Positions are in canvas pixels.
    const storm = {
      time: 3.2,
      speed: 0.17,
      intensity: 1,
      alpha: 0.5,
      colorA: [0.9, 0.6, 0.1], // the stage colour
      colorB: [0.1, 0.4, 0.5], // the deep sea colour
      eyeX: 0,
      eyeY: 0,
      eyeRadius: 200,
    };
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    let heroOnScreen = true;

    // Fainter in light mode and on small screens, where the storm sits behind text.
    function updateAlpha() {
      storm.alpha = (isDarkTheme() ? 0.6 : 0.42) * (window.innerWidth < 700 ? 0.6 : 1);
    }

    function lookFor(stage) {
      const look = STAGE_LOOKS[stage] || STAGE_LOOKS.alert;
      const tokens = getComputedStyle(html);
      return {
        speed: look.speed,
        intensity: look.intensity,
        colorA: hexToRgb(tokens.getPropertyValue(look.colorVar), [0.15, 0.59, 0.66]),
        colorB: hexToRgb(tokens.getPropertyValue("--sea"), [0.09, 0.41, 0.48]),
      };
    }

    // Match the canvas to its CSS size and put the eye behind the centre of the panel.
    function layout() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);

      const panelRect = panel.getBoundingClientRect();
      storm.eyeX = (panelRect.left + panelRect.width / 2 - rect.left) * dpr;
      storm.eyeY = height - (panelRect.top + panelRect.height / 2 - rect.top) * dpr; // WebGL's y runs upward
      storm.eyeRadius = (Math.hypot(panelRect.width, panelRect.height) / 2) * dpr * 0.92;
    }

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uniforms.uRes, canvas.width, canvas.height);
      gl.uniform2f(uniforms.uEye, storm.eyeX + pointer.x * 14 * dpr, storm.eyeY - pointer.y * 10 * dpr);
      gl.uniform1f(uniforms.uEyeR, storm.eyeRadius);
      gl.uniform1f(uniforms.uTime, storm.time);
      gl.uniform3fv(uniforms.uColorA, storm.colorA);
      gl.uniform3fv(uniforms.uColorB, storm.colorB);
      gl.uniform1f(uniforms.uIntensity, storm.intensity);
      gl.uniform1f(uniforms.uAlpha, storm.alpha);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // Advance the animation by `seconds` and redraw. Paused while the hero is off screen.
    function tick(seconds) {
      if (!heroOnScreen || document.hidden) return;
      storm.time += Math.min(seconds, 0.1) * storm.speed * 3;
      pointer.x += (pointer.targetX - pointer.x) * POINTER_EASE;
      pointer.y += (pointer.targetY - pointer.y) * POINTER_EASE;
      draw();
    }

    // Move to the look of a warning stage: eased when animating, instant otherwise.
    function setStage(stage, immediate) {
      const look = lookFor(stage);
      if (immediate || reduceMotion || !hasGsap) {
        Object.assign(storm, look);
        draw();
        return;
      }
      gsap.to(storm, { speed: look.speed, intensity: look.intensity, ...COLOR_TWEEN });
      gsap.to(storm.colorA, { 0: look.colorA[0], 1: look.colorA[1], 2: look.colorA[2], ...COLOR_TWEEN });
      gsap.to(storm.colorB, { 0: look.colorB[0], 1: look.colorB[1], 2: look.colorB[2], ...COLOR_TWEEN });
    }

    const currentStage = () => panel.getAttribute("data-stage") || "alert";

    function onThemeChange() {
      updateAlpha();
      setStage(currentStage(), true);
    }

    function relayout() {
      updateAlpha();
      layout();
      draw();
    }

    updateAlpha();
    layout();
    setStage(currentStage(), true);
    canvas.classList.add("is-live");

    // The home slider changes data-stage on the panel; the theme switch changes data-theme.
    new MutationObserver(() => setStage(currentStage(), false))
      .observe(panel, { attributes: true, attributeFilter: ["data-stage"] });
    new MutationObserver(onThemeChange)
      .observe(html, { attributes: true, attributeFilter: ["data-theme"] });
    darkScheme.addEventListener("change", onThemeChange);

    window.addEventListener("resize", relayout);
    if (typeof ResizeObserver === "function") new ResizeObserver(relayout).observe(hero);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
    window.addEventListener("load", relayout);

    if (reduceMotion) return; // one still frame, redrawn only when something changes

    new IntersectionObserver((entries) => { heroOnScreen = entries[0].isIntersecting; }, { rootMargin: "120px" }).observe(hero);
    window.addEventListener("pointermove", (event) => {
      pointer.targetX = (event.clientX / window.innerWidth - 0.5) * 2;
      pointer.targetY = (event.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    if (hasGsap) {
      // GSAP's ticker passes the time since the last frame in milliseconds.
      gsap.ticker.add((time, deltaMs) => tick(deltaMs / 1000));
      gsap.to(canvas, { yPercent: 6, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
    } else {
      let last = performance.now();
      const loop = (now) => {
        tick((now - last) / 1000);
        last = now;
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  }

  // ==========================================================================
  // 5. Start
  // ==========================================================================

  safely("gsap plugins", () => { if (hasGsap) gsap.registerPlugin(ScrollTrigger); });
  safely("progress", initProgress);
  safely("cyclone", initCyclone);
  safely("parallax", initParallax);

  // Headings are split once the web fonts are in, so the line breaks are final.
  function finish() {
    safely("headings", initHeadings);
    html.classList.remove("motion-pending");
    if (hasGsap) ScrollTrigger.refresh();
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(finish);
  else finish();
})();
