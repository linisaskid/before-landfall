var Lisse = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key2 of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key2) && key2 !== except)
          __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  var index_exports = {};
  __export(index_exports, {
    APPLE_SMOOTHING: () => APPLE_SMOOTHING,
    CURVE_TYPES: () => CURVE_TYPES,
    DEFAULT_CURVE: () => DEFAULT_CURVE,
    DEFAULT_EXPONENT: () => DEFAULT_EXPONENT,
    DEFAULT_PRESERVE_SMOOTHING: () => DEFAULT_PRESERVE_SMOOTHING,
    DEFAULT_SHADOW: () => DEFAULT_SHADOW,
    DEFAULT_SMOOTHING: () => DEFAULT_SMOOTHING,
    FIGMA_SMOOTHING: () => FIGMA_SMOOTHING,
    SmoothCorners: () => SmoothCorners,
    acquireIsolation: () => acquireIsolation,
    acquirePosition: () => acquirePosition,
    buildArc: () => buildArc,
    buildBoxShadowChain: () => buildBoxShadowChain,
    buildClothoid: () => buildClothoid,
    buildSquircle: () => buildSquircle,
    buildSuperellipse: () => buildSuperellipse,
    clearCurveCache: () => clearCurveCache,
    cornerOptionsToBorderRadius: () => cornerOptionsToBorderRadius,
    createDropShadow: () => createDropShadow,
    createSvgEffects: () => createSvgEffects,
    distributeAndNormalize: () => distributeAndNormalize,
    extractAndStripEffects: () => extractAndStripEffects,
    generateClipPath: () => generateClipPath,
    generatePath: () => generatePath,
    getCurveBuilder: () => getCurveBuilder,
    getLayoutSize: () => getLayoutSize,
    getPathParamsForCorner: () => getPathParamsForCorner,
    hasEffects: () => hasEffects,
    mergeEffects: () => mergeEffects,
    observeAnchor: () => observeAnchor,
    observeResize: () => observeResize,
    parseBorder: () => parseBorder,
    parseBoxShadow: () => parseBoxShadow,
    parseColor: () => parseColor,
    releaseIsolation: () => releaseIsolation,
    releasePosition: () => releasePosition,
    requestMeasure: () => requestMeasure,
    restoreStyles: () => restoreStyles,
    smoothCorners: () => smoothCorners
  });

  function cornerBudget(r2, nHr, nHb, width, nVr, nVb, height) {
    const termH = r2 === 0 && nHr === 0 ? 0 : nHb >= 0 ? width - nHb : r2 / (r2 + nHr) * width;
    const termV = r2 === 0 && nVr === 0 ? 0 : nVb >= 0 ? height - nVb : r2 / (r2 + nVr) * height;
    return Math.min(termH, termV);
  }
  function distributeAndNormalize({ topLeftCornerRadius: OTL, topRightCornerRadius: OTR, bottomRightCornerRadius: OBR, bottomLeftCornerRadius: OBL, width, height }) {
    if (OTL === OTR && OTR === OBR && OBR === OBL && OTL > 0 && width > 0 && height > 0) {
      const budget = Math.min(width, height) / 2;
      const radius = Math.min(OTL, budget);
      const corner = { radius, roundingAndSmoothingBudget: budget };
      return {
        topLeft: corner,
        topRight: corner,
        bottomLeft: corner,
        bottomRight: corner
      };
    }
    const rankTL = (OTR > OTL ? 1 : 0) + (OBL > OTL ? 1 : 0) + (OBR > OTL ? 1 : 0);
    const rankTR = (OTL >= OTR ? 1 : 0) + (OBL > OTR ? 1 : 0) + (OBR > OTR ? 1 : 0);
    const rankBL = (OTL >= OBL ? 1 : 0) + (OTR >= OBL ? 1 : 0) + (OBR > OBL ? 1 : 0);
    const rankBR = (OTL >= OBR ? 1 : 0) + (OTR >= OBR ? 1 : 0) + (OBL >= OBR ? 1 : 0);
    let cTL = OTL;
    let cTR = OTR;
    let cBL = OBL;
    let cBR = OBR;
    let bTL = -1;
    let bTR = -1;
    let bBL = -1;
    let bBR = -1;
    for (let step = 0; step < 4; step++) {
      const c = rankTL === step ? 0 : rankTR === step ? 1 : rankBL === step ? 2 : 3;
      if (c === 0) {
        bTL = cornerBudget(OTL, cTR, bTR, width, cBL, bBL, height);
        cTL = Math.min(OTL, bTL);
      } else if (c === 1) {
        bTR = cornerBudget(OTR, cTL, bTL, width, cBR, bBR, height);
        cTR = Math.min(OTR, bTR);
      } else if (c === 2) {
        bBL = cornerBudget(OBL, cBR, bBR, width, cTL, bTL, height);
        cBL = Math.min(OBL, bBL);
      } else {
        bBR = cornerBudget(OBR, cBL, bBL, width, cTR, bTR, height);
        cBR = Math.min(OBR, bBR);
      }
    }
    return {
      topLeft: { radius: cTL, roundingAndSmoothingBudget: bTL },
      topRight: { radius: cTR, roundingAndSmoothingBudget: bTR },
      bottomLeft: { radius: cBL, roundingAndSmoothingBudget: bBL },
      bottomRight: { radius: cBR, roundingAndSmoothingBudget: bBR }
    };
  }

  function toRadians(degrees) {
    return degrees * Math.PI / 180;
  }
  function fixed4(n) {
    const scaled = n * 1e4;
    const ticks = Math.round(scaled);
    const residual = scaled - ticks;
    if (residual > 0.4999999 || residual < -0.4999999)
      return n.toFixed(4);
    if (!Number.isSafeInteger(ticks))
      return n.toFixed(4);
    const negative = n < 0;
    const abs = negative ? -ticks : ticks;
    const frac = abs % 1e4;
    const whole = (abs - frac) / 1e4;
    const pad = frac < 10 ? "000" : frac < 100 ? "00" : frac < 1e3 ? "0" : "";
    return (negative ? "-" : "") + whole + "." + pad + frac;
  }

  var EMPTY_BUILDER_OUTPUT = {
    p: 0,
    pathSegment: () => ""
  };

  function negated(v, formatted) {
    if (v === 0 || Number.isNaN(v))
      return formatted;
    return formatted.charCodeAt(0) === 45 ? formatted.slice(1) : "-" + formatted;
  }
  function cubicText(x1, y1, x2, y2, x3, y3) {
    const fx1 = fixed4(x1);
    const fy1 = fixed4(y1);
    const fx2 = fixed4(x2);
    const fy2 = fixed4(y2);
    const fx3 = fixed4(x3);
    const fy3 = fixed4(y3);
    return {
      x1: fx1,
      x1n: negated(x1, fx1),
      y1: fy1,
      y1n: negated(y1, fy1),
      x2: fx2,
      x2n: negated(x2, fx2),
      y2: fy2,
      y2n: negated(y2, fy2),
      x3: fx3,
      x3n: negated(x3, fx3),
      y3: fy3,
      y3n: negated(y3, fy3)
    };
  }
  function cubic(t, orient) {
    switch (orient) {
      case "TR":
        return `c ${t.x1} ${t.y1} ${t.x2} ${t.y2} ${t.x3} ${t.y3}`;
      case "BR":
        return `c ${t.y1n} ${t.x1} ${t.y2n} ${t.x2} ${t.y3n} ${t.x3}`;
      case "BL":
        return `c ${t.x1n} ${t.y1n} ${t.x2n} ${t.y2n} ${t.x3n} ${t.y3n}`;
      case "TL":
        return `c ${t.y1} ${t.x1n} ${t.y2} ${t.x2n} ${t.y3} ${t.x3n}`;
    }
  }
  function equalArc(t, orient) {
    switch (orient) {
      case "TR":
        return `a ${t.radius} ${t.radius} 0 0 1 ${t.d} ${t.d}`;
      case "BR":
        return `a ${t.radius} ${t.radius} 0 0 1 ${t.dn} ${t.d}`;
      case "BL":
        return `a ${t.radius} ${t.radius} 0 0 1 ${t.dn} ${t.dn}`;
      case "TL":
        return `a ${t.radius} ${t.radius} 0 0 1 ${t.d} ${t.dn}`;
    }
  }

  var buildArc = ({ cornerRadius, roundingAndSmoothingBudget }) => {
    const p = Math.min(cornerRadius, roundingAndSmoothingBudget);
    if (p <= 0)
      return EMPTY_BUILDER_OUTPUT;
    const radius = fixed4(p);
    const arc = { radius, d: radius, dn: negated(p, radius) };
    return {
      p,
      pathSegment: (orient) => equalArc(arc, orient)
    };
  };

  function getPathParamsForCorner({ cornerRadius, cornerSmoothing, preserveSmoothing, roundingAndSmoothingBudget }) {
    if (cornerRadius <= 0) {
      return { a: 0, b: 0, c: 0, d: 0, p: 0, arcSectionLength: 0, cornerRadius: 0 };
    }
    let p = (1 + cornerSmoothing) * cornerRadius;
    if (!preserveSmoothing) {
      const maxCornerSmoothing = roundingAndSmoothingBudget / cornerRadius - 1;
      cornerSmoothing = Math.min(cornerSmoothing, maxCornerSmoothing);
      p = Math.min(p, roundingAndSmoothingBudget);
    }
    const arcMeasure = 90 * (1 - cornerSmoothing);
    const arcSectionLength = Math.sin(toRadians(arcMeasure / 2)) * cornerRadius * Math.sqrt(2);
    const angleAlpha = (90 - arcMeasure) / 2;
    const p3ToP4Distance = cornerRadius * Math.tan(toRadians(angleAlpha / 2));
    const angleBeta = 45 * cornerSmoothing;
    const c = p3ToP4Distance * Math.cos(toRadians(angleBeta));
    const d = c * Math.tan(toRadians(angleBeta));
    let b = (p - arcSectionLength - c - d) / 3;
    let a = 2 * b;
    if (preserveSmoothing && p > roundingAndSmoothingBudget) {
      const p1ToP3MaxDistance = roundingAndSmoothingBudget - d - arcSectionLength - c;
      const minA = p1ToP3MaxDistance / 6;
      const maxB = p1ToP3MaxDistance - minA;
      b = Math.min(b, maxB);
      a = p1ToP3MaxDistance - b;
      p = Math.min(p, roundingAndSmoothingBudget);
    }
    return { a, b, c, d, p, arcSectionLength, cornerRadius };
  }

  var buildSquircle = ({ cornerRadius, smoothing, preserveSmoothing, roundingAndSmoothingBudget }) => {
    const params = getPathParamsForCorner({
      cornerRadius,
      cornerSmoothing: smoothing,
      preserveSmoothing,
      roundingAndSmoothingBudget
    });
    if (params.cornerRadius <= 0)
      return EMPTY_BUILDER_OUTPUT;
    const t = squircleText(params);
    return {
      p: params.p,
      pathSegment: (orient) => {
        switch (orient) {
          case "TR":
            return `c ${t.a} 0 ${t.ab} 0 ${t.abc} ${t.d} a ${t.r} ${t.r} 0 0 1 ${t.arc} ${t.arc} c ${t.d} ${t.c} ${t.d} ${t.bc} ${t.d} ${t.abc}`;
          case "BR":
            return `c 0 ${t.a} 0 ${t.ab} ${t.dn} ${t.abc} a ${t.r} ${t.r} 0 0 1 ${t.arcn} ${t.arc} c ${t.cn} ${t.d} ${t.bcn} ${t.d} ${t.abcn} ${t.d}`;
          case "BL":
            return `c ${t.an} 0 ${t.abn} 0 ${t.abcn} ${t.dn} a ${t.r} ${t.r} 0 0 1 ${t.arcn} ${t.arcn} c ${t.dn} ${t.cn} ${t.dn} ${t.bcn} ${t.dn} ${t.abcn}`;
          case "TL":
            return `c 0 ${t.an} 0 ${t.abn} ${t.d} ${t.abcn} a ${t.r} ${t.r} 0 0 1 ${t.arc} ${t.arcn} c ${t.c} ${t.dn} ${t.bc} ${t.dn} ${t.abc} ${t.dn}`;
        }
      }
    };
  };
  function squircleText({ cornerRadius, a, b, c, d, arcSectionLength }) {
    const ab = a + b;
    const abc = ab + c;
    const bc = b + c;
    const fa = fixed4(a);
    const fab = fixed4(ab);
    const fabc = fixed4(abc);
    const fc = fixed4(c);
    const fbc = fixed4(bc);
    const fd = fixed4(d);
    const farc = fixed4(arcSectionLength);
    return {
      a: fa,
      an: negated(a, fa),
      ab: fab,
      abn: negated(ab, fab),
      abc: fabc,
      abcn: negated(abc, fabc),
      c: fc,
      cn: negated(c, fc),
      bc: fbc,
      bcn: negated(bc, fbc),
      d: fd,
      dn: negated(d, fd),
      r: fixed4(cornerRadius),
      arc: farc,
      arcn: "-" + farc
    };
  }

  var THETAS = [0, Math.PI / 6, Math.PI / 3, Math.PI / 2];
  var SIN_THETA = THETAS.map((th) => Math.sin(th));
  var COS_THETA = THETAS.map((th) => Math.cos(th));
  var THETA_MID = [
    (THETAS[0] + THETAS[1]) / 2,
    (THETAS[1] + THETAS[2]) / 2,
    (THETAS[2] + THETAS[3]) / 2
  ];
  var SIN_MID = THETA_MID.map((th) => Math.sin(th));
  var COS_MID = THETA_MID.map((th) => Math.cos(th));
  var buildSuperellipse = ({ cornerRadius, exponent, roundingAndSmoothingBudget }) => {
    const p = Math.min(cornerRadius, roundingAndSmoothingBudget);
    if (p <= 0)
      return EMPTY_BUILDER_OUTPUT;
    const n = Number.isFinite(exponent) ? Math.max(2, exponent) : 4;
    const e = 2 / n;
    const powE = n === 2 ? (x) => x : n === 4 ? Math.sqrt : n === 8 ? (x) => Math.sqrt(Math.sqrt(x)) : (x) => Math.pow(x, e);
    const e1 = e - 1;
    const powE1 = n === 2 ? () => 1 : n === 4 ? (x) => 1 / Math.sqrt(x) : (x) => Math.pow(x, e1);
    const points = THETAS.map((_th, i) => {
      if (i === 0)
        return [0, 0];
      if (i === THETAS.length - 1)
        return [p, p];
      return [p * powE(SIN_THETA[i]), p * (1 - powE(COS_THETA[i]))];
    });
    const tangents = THETAS.map((_th, i) => {
      if (i === 0)
        return [1, 0];
      if (i === THETAS.length - 1)
        return [0, 1];
      const dX = e * powE1(SIN_THETA[i]) * COS_THETA[i] * p;
      const dY = e * powE1(COS_THETA[i]) * SIN_THETA[i] * p;
      const m = Math.sqrt(dX * dX + dY * dY) || 1;
      return [dX / m, dY / m];
    });
    const segments = [];
    for (let i = 0; i < THETAS.length - 1; i++) {
      const [X0, Y0] = points[i];
      const [X1, Y1] = points[i + 1];
      const [T0x, T0y] = tangents[i];
      const [T1x, T1y] = tangents[i + 1];
      const Mx = p * powE(SIN_MID[i]);
      const My = p * (1 - powE(COS_MID[i]));
      const RHSx = 8 / 3 * (Mx - (X0 + X1) / 2);
      const RHSy = 8 / 3 * (My - (Y0 + Y1) / 2);
      const det = T1x * T0y - T1y * T0x;
      const h0 = det !== 0 ? (-T1y * RHSx + T1x * RHSy) / det : 0;
      const h1 = det !== 0 ? (T0x * RHSy - T0y * RHSx) / det : 0;
      const B1x = X0 + h0 * T0x;
      const B1y = Y0 + h0 * T0y;
      const B2x = X1 - h1 * T1x;
      const B2y = Y1 - h1 * T1y;
      const dB1x = B1x - X0;
      const dB1y = B1y - Y0;
      const dB2x = B2x - X0;
      const dB2y = B2y - Y0;
      const dB3x = X1 - X0;
      const dB3y = Y1 - Y0;
      segments.push(cubicText(dB1x, dB1y, dB2x, dB2y, dB3x, dB3y));
    }
    return {
      p,
      pathSegment: (orient) => {
        let out = cubic(segments[0], orient);
        for (let i = 1; i < segments.length; i++) {
          out += " " + cubic(segments[i], orient);
        }
        return out;
      }
    };
  };

  function integrateClothoid(theta0, kappa0, A, L) {
    const N = 32;
    if (L <= 0)
      return { x: 0, y: 0, theta: theta0 };
    const step = L / N;
    let xAcc = 0;
    let yAcc = 0;
    for (let i = 1; i <= N; i++) {
      const sA = (i - 1) * step;
      const sB = sA + step;
      const sM = (sA + sB) / 2;
      const thA = theta0 + kappa0 * sA + A / 2 * sA * sA;
      const thB = theta0 + kappa0 * sB + A / 2 * sB * sB;
      const thM = theta0 + kappa0 * sM + A / 2 * sM * sM;
      xAcc += step / 6 * (Math.cos(thA) + 4 * Math.cos(thM) + Math.cos(thB));
      yAcc += step / 6 * (Math.sin(thA) + 4 * Math.sin(thM) + Math.sin(thB));
    }
    const thetaEnd = theta0 + kappa0 * L + A / 2 * L * L;
    return { x: xAcc, y: yAcc, theta: thetaEnd };
  }

  var ANGLE_EPSILON = 1e-6;
  var buildClothoid = ({ cornerRadius, smoothing, roundingAndSmoothingBudget }) => {
    if (cornerRadius <= 0)
      return EMPTY_BUILDER_OUTPUT;
    const s = Math.max(0, Math.min(1, smoothing));
    const R = cornerRadius;
    const dTheta = Math.PI / 4 * s;
    const L = Math.PI / 2 * R * s;
    const A = L > 0 ? 1 / (R * L) : 0;
    const { x: xC, y: yC } = L > 0 ? integrateClothoid(0, 0, A, L) : { x: 0, y: 0 };
    const { x: xMid, y: yMid } = L > 0 ? integrateClothoid(0, 0, A, L / 2) : { x: 0, y: 0 };
    const arcCx = xC - R * Math.sin(dTheta);
    const arcCy = yC + R * Math.cos(dTheta);
    const naturalP = arcCx + arcCy;
    let p = naturalP;
    let effR = R;
    let effX = xC;
    let effY = yC;
    let effMx = xMid;
    let effMy = yMid;
    if (naturalP > roundingAndSmoothingBudget && naturalP > 0) {
      const scale = roundingAndSmoothingBudget / naturalP;
      p = roundingAndSmoothingBudget;
      effR = R * scale;
      effX = xC * scale;
      effY = yC * scale;
      effMx = xMid * scale;
      effMy = yMid * scale;
    }
    if (p <= 0)
      return EMPTY_BUILDER_OUTPUT;
    const cosDt = Math.cos(dTheta);
    const sinDt = Math.sin(dTheta);
    let h0 = 0;
    let h1 = 0;
    if (L > 0) {
      if (sinDt > 1e-12) {
        h1 = 8 / 3 * (effY / 2 - effMy) / sinDt;
      }
      h0 = 8 / 3 * (effMx - effX / 2) + h1 * cosDt;
    }
    const arcSweep = Math.PI / 2 - 2 * dTheta;
    const hasArc = Math.abs(arcSweep) > ANGLE_EPSILON;
    const fillets = L > 0 ? {
      head: cubicText(h0, 0, effX - h1 * cosDt, effY - h1 * sinDt, effX, effY),
      tail: cubicText(h1 * sinDt, h1 * cosDt, effY, effX - h0, effY, effX)
    } : null;
    let arc = null;
    if (hasArc) {
      const delta = p - effX - effY;
      const d = fixed4(delta);
      arc = { radius: fixed4(effR), d, dn: negated(delta, d) };
    }
    return {
      p,
      pathSegment: (orient) => {
        if (fillets === null)
          return arc === null ? "" : equalArc(arc, orient);
        const head = cubic(fillets.head, orient);
        const tail = cubic(fillets.tail, orient);
        if (arc === null)
          return head + " " + tail;
        return head + " " + equalArc(arc, orient) + " " + tail;
      }
    };
  };

  var DEFAULT_EXPONENT = 4;
  var CURVE_BUILDERS = {
    arc: buildArc,
    squircle: buildSquircle,
    superellipse: buildSuperellipse,
    clothoid: buildClothoid
  };
  var CURVE_TYPES = Object.keys(CURVE_BUILDERS);
  function getCurveBuilder(type) {
    return CURVE_BUILDERS[type];
  }

  var CAPACITY = 64;
  var cache = new Map();
  var newestKey = null;
  function key(curve, input) {
    return curve + "|" + input.cornerRadius + "|" + input.smoothing + "|" + input.exponent + "|" + (input.preserveSmoothing ? 1 : 0) + "|" + input.roundingAndSmoothingBudget;
  }
  function hasNonFiniteKeyField(input) {
    return !Number.isFinite(input.cornerRadius) || !Number.isFinite(input.smoothing) || !Number.isFinite(input.exponent) || !Number.isFinite(input.roundingAndSmoothingBudget);
  }
  function wrapWithOrientCache(fresh) {
    const orients = {};
    return {
      p: fresh.p,
      pathSegment: (orient) => {
        const cached = orients[orient];
        if (cached !== void 0)
          return cached;
        const s = fresh.pathSegment(orient);
        orients[orient] = s;
        return s;
      }
    };
  }
  function getCachedBuilderOutput(curve, builder, input) {
    if (hasNonFiniteKeyField(input))
      return builder(input);
    const k = key(curve, input);
    const cached = cache.get(k);
    if (cached) {
      if (k !== newestKey) {
        cache.delete(k);
        cache.set(k, cached);
        newestKey = k;
      }
      return cached;
    }
    const fresh = wrapWithOrientCache(builder(input));
    if (cache.size >= CAPACITY) {
      cache.delete(cache.keys().next().value);
    }
    cache.set(k, fresh);
    newestKey = k;
    return fresh;
  }
  function clearCurveCache() {
    cache.clear();
    newestKey = null;
  }

  function capsuleEndParams(R, smoothing, preserveSmoothing, longHalf) {
    const sEff = Math.min(smoothing, longHalf / R - 1);
    const params = getPathParamsForCorner({
      cornerRadius: R,
      cornerSmoothing: sEff,
      preserveSmoothing,
      roundingAndSmoothingBudget: longHalf
    });
    const e = params.a + params.b + params.c;
    return {
      p: params.p,
      a: params.a,
      b: params.b,
      c: params.c,
      d: params.d,
      e,
      ax: params.p - e,
      ay: R - params.d,
      R
    };
  }
  function capText({ a, b, c, d, e, ax, ay, R }) {
    const ab = a + b;
    const bc = b + c;
    const fa = fixed4(a);
    const fab = fixed4(ab);
    const fe = fixed4(e);
    const fc = fixed4(c);
    const fbc = fixed4(bc);
    const fd = fixed4(d);
    const fax = fixed4(ax);
    const fay = fixed4(ay);
    return {
      a: fa,
      an: negated(a, fa),
      ab: fab,
      abn: negated(ab, fab),
      e: fe,
      en: negated(e, fe),
      c: fc,
      cn: negated(c, fc),
      bc: fbc,
      bcn: negated(bc, fbc),
      d: fd,
      dn: negated(d, fd),
      r: fixed4(R),
      ax: fax,
      axn: negated(ax, fax),
      ay: fay,
      ayn: negated(ay, fay)
    };
  }
  function drawRightCap(params) {
    const t = capText(params);
    return `c ${t.a} 0 ${t.ab} 0 ${t.e} ${t.d} a ${t.r} ${t.r} 0 0 1 ${t.ax} ${t.ay} a ${t.r} ${t.r} 0 0 1 ${t.axn} ${t.ay} c ${t.cn} ${t.d} ${t.bcn} ${t.d} ${t.en} ${t.d}`;
  }
  function drawLeftCap(params) {
    const t = capText(params);
    return `c ${t.an} 0 ${t.abn} 0 ${t.en} ${t.dn} a ${t.r} ${t.r} 0 0 1 ${t.axn} ${t.ayn} a ${t.r} ${t.r} 0 0 1 ${t.ax} ${t.ayn} c ${t.c} ${t.dn} ${t.bc} ${t.dn} ${t.e} ${t.dn}`;
  }
  function drawTopCap(params) {
    const t = capText(params);
    return `c 0 ${t.an} 0 ${t.abn} ${t.d} ${t.en} a ${t.r} ${t.r} 0 0 1 ${t.ay} ${t.axn} a ${t.r} ${t.r} 0 0 1 ${t.ay} ${t.ax} c ${t.d} ${t.c} ${t.d} ${t.bc} ${t.d} ${t.e}`;
  }
  function drawBottomCap(params) {
    const t = capText(params);
    return `c 0 ${t.a} 0 ${t.ab} ${t.dn} ${t.e} a ${t.r} ${t.r} 0 0 1 ${t.ayn} ${t.ax} a ${t.r} ${t.r} 0 0 1 ${t.ayn} ${t.axn} c ${t.dn} ${t.cn} ${t.dn} ${t.bcn} ${t.dn} ${t.en}`;
  }

  function shoulder(R, sEdge, preserveSmoothing, room) {
    const params = getPathParamsForCorner({
      cornerRadius: R,
      cornerSmoothing: sEdge,
      preserveSmoothing,
      roundingAndSmoothingBudget: room
    });
    const beta = toRadians(45 * sEdge);
    return {
      a: params.a,
      b: params.b,
      p: params.p,
      sin: Math.sin(beta),
      cos: Math.cos(beta)
    };
  }
  var clampEdge = (room, R, s) => Math.max(0, Math.min(room / R - 1, s));
  var r4 = (n) => fixed4(Object.is(n, -0) ? 0 : n);
  function drawBlendPath(width, height, R, smoothing, preserveSmoothing) {
    const H = shoulder(R, clampEdge(width / 2, R, smoothing), preserveSmoothing, width / 2);
    const V = shoulder(R, clampEdge(height / 2, R, smoothing), preserveSmoothing, height / 2);
    const seg2 = (cx, cy, ux, uy, vx, vy) => {
      const s1 = uy === 0 ? H : V;
      const s2 = vy === 0 ? H : V;
      const ox = cx + (ux + vx) * R;
      const oy = cy + (uy + vy) * R;
      const j1x = ox - vx * R * s1.cos - ux * R * s1.sin;
      const j1y = oy - vy * R * s1.cos - uy * R * s1.sin;
      const j2x = ox - ux * R * s2.cos - vx * R * s2.sin;
      const j2y = oy - uy * R * s2.cos - vy * R * s2.sin;
      const p0x = cx + ux * s1.p;
      const p0y = cy + uy * s1.p;
      const arced = Math.hypot(j2x - j1x, j2y - j1y) > 1e-6;
      const ex = arced ? j2x : j1x;
      const ey = arced ? j2y : j1y;
      const p3x = cx + vx * s2.p;
      const p3y = cy + vy * s2.p;
      let d = `L ${r4(p0x)} ${r4(p0y)} `;
      d += `c ${r4(-ux * s1.a)} ${r4(-uy * s1.a)} ${r4(-ux * (s1.a + s1.b))} ${r4(-uy * (s1.a + s1.b))} ${r4(j1x - p0x)} ${r4(j1y - p0y)} `;
      if (arced) {
        d += `a ${r4(R)} ${r4(R)} 0 0 1 ${r4(j2x - j1x)} ${r4(j2y - j1y)} `;
      }
      d += `c ${r4(p3x - vx * (s2.a + s2.b) - ex)} ${r4(p3y - vy * (s2.a + s2.b) - ey)} ${r4(p3x - vx * s2.a - ex)} ${r4(p3y - vy * s2.a - ey)} ${r4(p3x - ex)} ${r4(p3y - ey)}`;
      return d;
    };
    const tr = seg2(width, 0, -1, 0, 0, 1);
    const br = seg2(width, height, 0, -1, -1, 0);
    const bl = seg2(0, height, 1, 0, 0, -1);
    const tl = seg2(0, 0, 0, 1, 1, 0);
    return `M ${r4(H.p)} 0 ${tr} ${br} ${bl} ${tl} Z`;
  }

  var APPLE_SMOOTHING = 0.65;
  var FIGMA_SMOOTHING = 0.6;
  var DEFAULT_SMOOTHING = 0.65;
  var DEFAULT_PRESERVE_SMOOTHING = true;
  var DEFAULT_CURVE = "squircle";
  var r = fixed4;
  function withDefaults(c) {
    return {
      radius: c.radius,
      curve: c.curve ?? DEFAULT_CURVE,
      smoothing: c.smoothing ?? DEFAULT_SMOOTHING,
      exponent: c.exponent ?? DEFAULT_EXPONENT,
      preserveSmoothing: c.preserveSmoothing ?? DEFAULT_PRESERVE_SMOOTHING
    };
  }
  function resolve(v) {
    const c = typeof v === "number" ? { radius: v } : v ?? { radius: 0 };
    return withDefaults(c);
  }
  function resolveOptions(options) {
    if ("radius" in options) {
      const c = withDefaults(options);
      return { topLeft: c, topRight: c, bottomRight: c, bottomLeft: c };
    }
    return {
      topLeft: resolve(options.topLeft),
      topRight: resolve(options.topRight),
      bottomRight: resolve(options.bottomRight),
      bottomLeft: resolve(options.bottomLeft)
    };
  }
  function seg(s) {
    return s.length > 0 ? " " + s : "";
  }
  function cornerOutput(corner, normalized) {
    const builder = getCurveBuilder(corner.curve);
    return getCachedBuilderOutput(corner.curve, builder, {
      cornerRadius: normalized.radius,
      smoothing: corner.smoothing,
      exponent: corner.exponent,
      preserveSmoothing: corner.preserveSmoothing,
      roundingAndSmoothingBudget: normalized.roundingAndSmoothingBudget
    });
  }
  var CAP_EPS = 1e-9;
  function isCapEnd(cx, cy, nx, ny, capR) {
    return cx.curve === "squircle" && cy.curve === "squircle" && Math.abs(nx.radius - capR) < CAP_EPS && Math.abs(ny.radius - capR) < CAP_EPS && cx.smoothing === cy.smoothing && cx.preserveSmoothing === cy.preserveSmoothing;
  }
  function sameBuilderInput(a, an, b, bn) {
    return (a === b || a.curve === b.curve && a.smoothing === b.smoothing && a.exponent === b.exponent && a.preserveSmoothing === b.preserveSmoothing) && (an === bn || an.radius === bn.radius && an.roundingAndSmoothingBudget === bn.roundingAndSmoothingBudget);
  }
  function generatePath(width, height, options) {
    if (width <= 0 || height <= 0) {
      return "M 0 0 H 0 V 0 H 0 Z";
    }
    const corners = resolveOptions(options);
    if (corners.topLeft.radius <= 0 && corners.topRight.radius <= 0 && corners.bottomRight.radius <= 0 && corners.bottomLeft.radius <= 0) {
      return `M 0 0 H ${width} V ${height} H 0 Z`;
    }
    const normalized = distributeAndNormalize({
      topLeftCornerRadius: corners.topLeft.radius,
      topRightCornerRadius: corners.topRight.radius,
      bottomRightCornerRadius: corners.bottomRight.radius,
      bottomLeftCornerRadius: corners.bottomLeft.radius,
      width,
      height
    });
    const u = corners.topLeft;
    if (isUniformSquircle(corners)) {
      const blendR = Math.min(u.radius, width / 2, height / 2);
      const shortHalf = Math.min(width, height) / 2;
      const BAND_EPS = 1e-9;
      if (blendR > 0 && shortHalf > blendR + BAND_EPS && shortHalf < (1 + u.smoothing) * blendR - BAND_EPS) {
        return drawBlendPath(width, height, blendR, u.smoothing, u.preserveSmoothing);
      }
    }
    const horizontal = width >= height;
    const capR = horizontal ? height / 2 : width / 2;
    if (horizontal) {
      const rightCap = isCapEnd(corners.topRight, corners.bottomRight, normalized.topRight, normalized.bottomRight, capR);
      const leftCap = isCapEnd(corners.topLeft, corners.bottomLeft, normalized.topLeft, normalized.bottomLeft, capR);
      if (rightCap || leftCap) {
        const longHalf = width / 2;
        const cR = rightCap ? capsuleEndParams(capR, corners.topRight.smoothing, corners.topRight.preserveSmoothing, longHalf) : null;
        const cL = leftCap ? capsuleEndParams(capR, corners.topLeft.smoothing, corners.topLeft.preserveSmoothing, longHalf) : null;
        const oTL2 = cL ? null : cornerOutput(corners.topLeft, normalized.topLeft);
        const oTR2 = cR ? null : cornerOutput(corners.topRight, normalized.topRight);
        const oBR2 = cR ? null : cornerOutput(corners.bottomRight, normalized.bottomRight);
        const oBL2 = cL ? null : cornerOutput(corners.bottomLeft, normalized.bottomLeft);
        let d = "M " + r(cL ? cL.p : oTL2.p) + " 0";
        d += " L " + r(width - (cR ? cR.p : oTR2.p)) + " 0";
        if (cR) {
          d += " " + drawRightCap(cR);
        } else {
          d += seg(oTR2.pathSegment("TR"));
          d += " L " + r(width) + " " + r(oBR2.p);
          d += " L " + r(width) + " " + r(height - oBR2.p);
          d += seg(oBR2.pathSegment("BR"));
        }
        if (cL) {
          d += " L " + r(cL.p) + " " + r(height);
          d += " " + drawLeftCap(cL);
        } else {
          d += " L " + r(width - oBL2.p) + " " + r(height);
          d += " L " + r(oBL2.p) + " " + r(height);
          d += seg(oBL2.pathSegment("BL"));
          d += " L 0 " + r(height - oTL2.p);
          d += " L 0 " + r(oTL2.p);
          d += seg(oTL2.pathSegment("TL"));
        }
        return d + " Z";
      }
    } else {
      const topCap = isCapEnd(corners.topLeft, corners.topRight, normalized.topLeft, normalized.topRight, capR);
      const bottomCap = isCapEnd(corners.bottomLeft, corners.bottomRight, normalized.bottomLeft, normalized.bottomRight, capR);
      if (topCap || bottomCap) {
        const longHalf = height / 2;
        const cT = topCap ? capsuleEndParams(capR, corners.topLeft.smoothing, corners.topLeft.preserveSmoothing, longHalf) : null;
        const cB = bottomCap ? capsuleEndParams(capR, corners.bottomLeft.smoothing, corners.bottomLeft.preserveSmoothing, longHalf) : null;
        const oTL2 = cT ? null : cornerOutput(corners.topLeft, normalized.topLeft);
        const oTR2 = cT ? null : cornerOutput(corners.topRight, normalized.topRight);
        const oBR2 = cB ? null : cornerOutput(corners.bottomRight, normalized.bottomRight);
        const oBL2 = cB ? null : cornerOutput(corners.bottomLeft, normalized.bottomLeft);
        let d;
        if (cT) {
          d = "M 0 " + r(cT.p) + " " + drawTopCap(cT);
        } else {
          d = "M " + r(oTL2.p) + " 0";
          d += " L " + r(width - oTR2.p) + " 0";
          d += seg(oTR2.pathSegment("TR"));
        }
        d += " L " + r(width) + " " + r(height - (cB ? cB.p : oBR2.p));
        if (cB) {
          d += " " + drawBottomCap(cB);
        } else {
          d += seg(oBR2.pathSegment("BR"));
          d += " L " + r(oBL2.p) + " " + r(height);
          d += seg(oBL2.pathSegment("BL"));
        }
        if (cT) {
          d += " L 0 " + r(cT.p);
        } else {
          d += " L 0 " + r(height - oTL2.p);
          d += " L 0 " + r(oTL2.p);
          d += seg(oTL2.pathSegment("TL"));
        }
        return d + " Z";
      }
    }
    const oTL = cornerOutput(corners.topLeft, normalized.topLeft);
    const uniform = sameBuilderInput(corners.topLeft, normalized.topLeft, corners.topRight, normalized.topRight) && sameBuilderInput(corners.topLeft, normalized.topLeft, corners.bottomRight, normalized.bottomRight) && sameBuilderInput(corners.topLeft, normalized.topLeft, corners.bottomLeft, normalized.bottomLeft);
    const oTR = uniform ? oTL : cornerOutput(corners.topRight, normalized.topRight);
    const oBR = uniform ? oTL : cornerOutput(corners.bottomRight, normalized.bottomRight);
    const oBL = uniform ? oTL : cornerOutput(corners.bottomLeft, normalized.bottomLeft);
    return "M " + r(oTL.p) + " 0 L " + r(width - oTR.p) + " 0" + seg(oTR.pathSegment("TR")) + " L " + r(width) + " " + r(oBR.p) + " L " + r(width) + " " + r(height - oBR.p) + seg(oBR.pathSegment("BR")) + " L " + r(width - oBL.p) + " " + r(height) + " L " + r(oBL.p) + " " + r(height) + seg(oBL.pathSegment("BL")) + " L 0 " + r(height - oTL.p) + " L 0 " + r(oTL.p) + seg(oTL.pathSegment("TL")) + " Z";
  }
  function isUniformSquircle(c) {
    const u = c.topLeft;
    const tr = c.topRight;
    const br = c.bottomRight;
    const bl = c.bottomLeft;
    return u.curve === "squircle" && tr.curve === "squircle" && tr.radius === u.radius && tr.smoothing === u.smoothing && tr.preserveSmoothing === u.preserveSmoothing && br.curve === "squircle" && br.radius === u.radius && br.smoothing === u.smoothing && br.preserveSmoothing === u.preserveSmoothing && bl.curve === "squircle" && bl.radius === u.radius && bl.smoothing === u.smoothing && bl.preserveSmoothing === u.preserveSmoothing;
  }
  function generateClipPath(width, height, options) {
    return `path("${generatePath(width, height, options)}")`;
  }

  function getLayoutSize(el, cs = window.getComputedStyle(el)) {
    const px = (v) => v.endsWith("px") ? parseFloat(v) : NaN;
    const w = px(cs.width);
    const h = px(cs.height);
    if (Number.isNaN(w) || Number.isNaN(h)) {
      return { width: el.offsetWidth, height: el.offsetHeight };
    }
    if (cs.boxSizing === "border-box") {
      return { width: w, height: h };
    }
    const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const bdrX = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
    const bdrY = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    return { width: w + padX + bdrX, height: h + padY + bdrY };
  }

  var SVG_NS = "http://www.w3.org/2000/svg";
  var uid = 0;
  function nextUid() {
    return ++uid;
  }
  function measureByRects(anchor, target) {
    const anchorRect = anchor.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const layout = getLayoutSize(anchor);
    const scaleX = layout.width > 0 && anchorRect.width > 0 ? anchorRect.width / layout.width : 1;
    const scaleY = layout.height > 0 && anchorRect.height > 0 ? anchorRect.height / layout.height : 1;
    const style = getComputedStyle(anchor);
    return {
      x: (targetRect.left - anchorRect.left) / scaleX - (parseFloat(style.borderLeftWidth) || 0) + anchor.scrollLeft,
      y: (targetRect.top - anchorRect.top) / scaleY - (parseFloat(style.borderTopWidth) || 0) + anchor.scrollTop
    };
  }
  function createOverlayPlacer(anchor, target) {
    let offsetParentIsAnchor;
    return function place(svg, width, height, offset) {
      svg.setAttribute("width", String(width));
      svg.setAttribute("height", String(height));
      if (target === anchor) {
        svg.style.left = svg.style.top = "0px";
        return;
      }
      offsetParentIsAnchor ??= target.offsetParent === anchor;
      const { x, y } = offsetParentIsAnchor ? offset ?? { x: target.offsetLeft, y: target.offsetTop } : measureByRects(anchor, target);
      svg.style.left = `${x}px`;
      svg.style.top = `${y}px`;
    };
  }
  function expandHex(hex) {
    const h = hex.replace("#", "");
    if (h.length === 3)
      return "#" + h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return "#" + h;
  }
  var HEX = /^#?[0-9a-f]{3}(?:[0-9a-f]{3})?$/i;
  function hexToRgb(hex) {
    if (!HEX.test(hex))
      return hex;
    const h = expandHex(hex).replace("#", "");
    return `rgb(${parseInt(h.substring(0, 2), 16)},${parseInt(h.substring(2, 4), 16)},${parseInt(h.substring(4, 6), 16)})`;
  }
  var DEFAULT_SHADOW = {
    offsetX: 0,
    offsetY: 0,
    blur: 0,
    spread: 0,
    color: "#000",
    opacity: 0
  };
  var PATH_CACHE_CAPACITY = 128;
  function createPathCache(options) {
    const cache2 = new Map();
    let optionsKey;
    const setOptions = (opts) => {
      const key2 = JSON.stringify(opts);
      if (key2 !== optionsKey) {
        optionsKey = key2;
        cache2.clear();
      }
    };
    const getPath = ((w, h, opts, spread) => {
      const key2 = `${w}:${h}:${spread}`;
      const cached = cache2.get(key2);
      if (cached !== void 0) {
        cache2.delete(key2);
        cache2.set(key2, cached);
        return cached;
      }
      const fresh = generatePath(w, h, opts);
      if (cache2.size >= PATH_CACHE_CAPACITY) {
        cache2.delete(cache2.keys().next().value);
      }
      cache2.set(key2, fresh);
      return fresh;
    });
    getPath.setOptions = setOptions;
    getPath._size = () => cache2.size;
    if (options !== void 0)
      setOptions(options);
    return getPath;
  }
  function adjustOptions(options, spread) {
    if (spread === 0)
      return options;
    if ("radius" in options) {
      return { ...options, radius: Math.max(0, options.radius + spread) };
    }
    const adjust = (v) => {
      if (v === void 0)
        return void 0;
      if (typeof v === "number")
        return Math.max(0, v + spread);
      return { ...v, radius: Math.max(0, v.radius + spread) };
    };
    return {
      topLeft: adjust(options.topLeft),
      topRight: adjust(options.topRight),
      bottomRight: adjust(options.bottomRight),
      bottomLeft: adjust(options.bottomLeft)
    };
  }
  function cornerOptionsToBorderRadius(options) {
    if ("radius" in options)
      return `${options.radius}px`;
    const radiusOf = (v) => {
      if (v === void 0)
        return 0;
      if (typeof v === "number")
        return v;
      return v.radius;
    };
    const tl = radiusOf(options.topLeft);
    const tr = radiusOf(options.topRight);
    const br = radiusOf(options.bottomRight);
    const bl = radiusOf(options.bottomLeft);
    return `${tl}px ${tr}px ${br}px ${bl}px`;
  }
  function darkenHex(hex) {
    if (!HEX.test(hex))
      return `color-mix(in oklab, ${hex}, black 33%)`;
    const h = expandHex(hex).replace("#", "");
    const r2 = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    if (r2 === 0 && g === 0 && b === 0)
      return "#4c4c4c";
    const dr = Math.round(r2 * 2 / 3);
    const dg = Math.round(g * 2 / 3);
    const db = Math.round(b * 2 / 3);
    return "#" + (1 << 24 | dr << 16 | dg << 8 | db).toString(16).slice(1);
  }
  function isGradient(color) {
    return typeof color === "object" && color !== null && "type" in color;
  }
  function angleToCoords(angleDeg) {
    const rad = (90 - angleDeg) * Math.PI / 180;
    return {
      x1: 0.5 - 0.5 * Math.cos(rad),
      y1: 0.5 + 0.5 * Math.sin(rad),
      x2: 0.5 + 0.5 * Math.cos(rad),
      y2: 0.5 - 0.5 * Math.sin(rad)
    };
  }
  function applyStops(gradientEl, stops) {
    while (gradientEl.lastChild)
      gradientEl.removeChild(gradientEl.lastChild);
    for (const s of stops) {
      const stop = document.createElementNS(SVG_NS, "stop");
      stop.setAttribute("offset", String(s.offset));
      stop.setAttribute("stop-color", s.color);
      if (s.opacity !== void 0 && s.opacity !== 1) {
        stop.setAttribute("stop-opacity", String(s.opacity));
      }
      gradientEl.appendChild(stop);
    }
  }
  function createGradientDef(defs, config, id) {
    const tag = config.type === "linear" ? "linearGradient" : "radialGradient";
    const el = document.createElementNS(SVG_NS, tag);
    el.setAttribute("id", id);
    setGradientAttrs(el, config);
    applyStops(el, config.stops);
    defs.appendChild(el);
    return el;
  }
  function updateGradientDef(gradientEl, config) {
    setGradientAttrs(gradientEl, config);
    applyStops(gradientEl, config.stops);
  }
  function setGradientAttrs(el, config) {
    if (config.type === "linear") {
      const coords = angleToCoords(config.angle ?? 0);
      el.setAttribute("x1", String(coords.x1));
      el.setAttribute("y1", String(coords.y1));
      el.setAttribute("x2", String(coords.x2));
      el.setAttribute("y2", String(coords.y2));
    } else {
      el.setAttribute("cx", String(config.cx ?? 0.5));
      el.setAttribute("cy", String(config.cy ?? 0.5));
      el.setAttribute("r", String(config.r ?? 0.5));
    }
  }
  function darkenGradient(config) {
    return { ...config, stops: config.stops.map((s) => ({ ...s, color: darkenHex(s.color) })) };
  }

  function padBounds(el, pad, w, h) {
    el.setAttribute("x", String(-pad));
    el.setAttribute("y", String(-pad));
    el.setAttribute("width", String(w + pad * 2));
    el.setAttribute("height", String(h + pad * 2));
  }
  function padMaskAndRect(mask, rect, pad, w, h) {
    padBounds(mask, pad, w, h);
    padBounds(rect, pad, w, h);
  }
  function createKnockoutMask(maskId, defs, userSpaceOnUse) {
    const mask = document.createElementNS(SVG_NS, "mask");
    mask.setAttribute("id", maskId);
    if (userSpaceOnUse)
      mask.setAttribute("maskUnits", "userSpaceOnUse");
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("fill", "white");
    const knockout = document.createElementNS(SVG_NS, "path");
    knockout.setAttribute("fill", "none");
    knockout.setAttribute("stroke", "black");
    mask.appendChild(rect);
    mask.appendChild(knockout);
    defs.appendChild(mask);
    return { mask, rect, knockout };
  }
  function createStrokeGroup(clipOrMask) {
    const group = document.createElementNS(SVG_NS, "g");
    const strokePath = document.createElementNS(SVG_NS, "path");
    strokePath.setAttribute("fill", "none");
    if (clipOrMask)
      strokePath.setAttribute(clipOrMask.attr, clipOrMask.value);
    strokePath.style.display = "none";
    group.appendChild(strokePath);
    const grooveOverlay = document.createElementNS(SVG_NS, "path");
    grooveOverlay.setAttribute("fill", "none");
    if (clipOrMask)
      grooveOverlay.setAttribute(clipOrMask.attr, clipOrMask.value);
    grooveOverlay.style.display = "none";
    group.appendChild(grooveOverlay);
    return { group, strokePath, grooveOverlay };
  }
  function removeGradient(els, which) {
    const key2 = which === "main" ? "gradientEl" : "overlayGradientEl";
    els[key2]?.remove();
    els[key2] = null;
  }
  function resolveStroke(color, els, which) {
    if (!isGradient(color)) {
      removeGradient(els, which);
      return color;
    }
    const elKey = which === "main" ? "gradientEl" : "overlayGradientEl";
    const id = which === "main" ? els.gradientId : els.overlayGradientId;
    if (els[elKey]) {
      updateGradientDef(els[elKey], color);
    } else {
      els[elKey] = createGradientDef(els.defs, color, id);
    }
    return `url(#${id})`;
  }
  function updateBorder(config, d, width, height, els) {
    if (!config || config.width <= 0 || config.opacity <= 0) {
      els.strokePath.style.display = "none";
      els.strokeGroup.removeAttribute("mask");
      els.grooveOverlay.style.display = "none";
      removeGradient(els, "main");
      removeGradient(els, "overlay");
      return;
    }
    const m = els.strokeMultiplier;
    els.strokePath.style.display = "";
    els.strokePath.setAttribute("d", d);
    els.strokePath.setAttribute("stroke", resolveStroke(config.color, els, "main"));
    els.strokePath.setAttribute("stroke-width", String(config.width * m));
    els.strokePath.setAttribute("stroke-opacity", String(config.opacity));
    const style = config.style ?? "solid";
    els.strokeGroup.removeAttribute("mask");
    els.grooveOverlay.style.display = "none";
    els.strokePath.removeAttribute("stroke-dasharray");
    els.strokePath.setAttribute("stroke-linecap", "butt");
    if (style !== "groove" && style !== "ridge") {
      removeGradient(els, "overlay");
    }
    switch (style) {
      case "dashed": {
        const dashLen = Math.max(0, config.dash ?? config.width * 3);
        const gapLen = Math.max(0, config.gap ?? config.width * 2);
        els.strokePath.setAttribute("stroke-dasharray", `${dashLen} ${gapLen}`);
        if (config.lineCap)
          els.strokePath.setAttribute("stroke-linecap", config.lineCap);
        break;
      }
      case "dotted": {
        const dotDash = Math.max(0, config.dash ?? 0);
        const dotGap = Math.max(0, config.gap ?? config.width * 2);
        els.strokePath.setAttribute("stroke-dasharray", `${dotDash} ${dotGap}`);
        els.strokePath.setAttribute("stroke-linecap", config.lineCap ?? "round");
        break;
      }
      case "double":
        if (config.width >= 3) {
          const third = Math.round(config.width / 3);
          els.dblKnockout.setAttribute("d", d);
          els.dblKnockout.setAttribute("stroke-width", String(third * m));
          els.dblRect.setAttribute("width", String(width));
          els.dblRect.setAttribute("height", String(height));
          if (els.padDblMask)
            els.padDblMask(config.width, width, height);
          els.strokeGroup.setAttribute("mask", `url(#${els.dblMaskId})`);
        }
        break;
      case "groove":
      case "ridge": {
        const dark = isGradient(config.color) ? darkenGradient(config.color) : darkenHex(config.color);
        if (style === "groove")
          els.strokePath.setAttribute("stroke", resolveStroke(dark, els, "main"));
        els.grooveOverlay.style.display = "";
        els.grooveOverlay.setAttribute("d", d);
        els.grooveOverlay.setAttribute("stroke", resolveStroke(style === "groove" ? config.color : dark, els, "overlay"));
        els.grooveOverlay.setAttribute("stroke-width", String(config.width * m / 2));
        els.grooveOverlay.setAttribute("stroke-opacity", String(config.opacity));
        break;
      }
    }
  }
  function createInnerShadowEntry(defs, clipGroup) {
    const uid2 = nextUid();
    const maskId = `sc-ishadow-mask-${uid2}`;
    const mask = document.createElementNS(SVG_NS, "mask");
    mask.setAttribute("id", maskId);
    mask.setAttribute("maskUnits", "userSpaceOnUse");
    const maskRect = document.createElementNS(SVG_NS, "rect");
    maskRect.setAttribute("fill", "white");
    const maskCutout = document.createElementNS(SVG_NS, "path");
    maskCutout.setAttribute("fill", "black");
    mask.appendChild(maskRect);
    mask.appendChild(maskCutout);
    defs.appendChild(mask);
    const filterId = `sc-ishadow-blur-${uid2}`;
    const filter = document.createElementNS(SVG_NS, "filter");
    filter.setAttribute("id", filterId);
    filter.setAttribute("x", "-200%");
    filter.setAttribute("y", "-200%");
    filter.setAttribute("width", "500%");
    filter.setAttribute("height", "500%");
    filter.setAttribute("color-interpolation-filters", "sRGB");
    const feBlur = document.createElementNS(SVG_NS, "feGaussianBlur");
    feBlur.setAttribute("stdDeviation", "0");
    filter.appendChild(feBlur);
    defs.appendChild(filter);
    const blurGroup = document.createElementNS(SVG_NS, "g");
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("mask", `url(#${maskId})`);
    rect.style.display = "none";
    blurGroup.appendChild(rect);
    clipGroup.appendChild(blurGroup);
    return { maskId, mask, maskRect, maskCutout, filterId, filter, feBlur, blurGroup, rect };
  }
  function removeInnerShadowEntry(entry) {
    entry.mask.remove();
    entry.filter.remove();
    entry.blurGroup.remove();
  }
  function createSvgEffects(anchor, target = anchor) {
    const id = nextUid();
    const clipId = `sc-clip-${id}`;
    const maskId = `sc-mask-${id}`;
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.style.position = "absolute";
    svg.style.left = "0px";
    svg.style.top = "0px";
    svg.style.pointerEvents = "none";
    svg.style.overflow = "visible";
    svg.style.zIndex = "1";
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    const defs = document.createElementNS(SVG_NS, "defs");
    const clipPathEl = document.createElementNS(SVG_NS, "clipPath");
    clipPathEl.setAttribute("id", clipId);
    const clipShape = document.createElementNS(SVG_NS, "path");
    clipPathEl.appendChild(clipShape);
    defs.appendChild(clipPathEl);
    const maskEl = document.createElementNS(SVG_NS, "mask");
    maskEl.setAttribute("id", maskId);
    maskEl.setAttribute("maskUnits", "userSpaceOnUse");
    const maskRect = document.createElementNS(SVG_NS, "rect");
    maskRect.setAttribute("fill", "white");
    const maskShape = document.createElementNS(SVG_NS, "path");
    maskShape.setAttribute("fill", "black");
    maskEl.appendChild(maskRect);
    maskEl.appendChild(maskShape);
    defs.appendChild(maskEl);
    const innerDblMaskId = `sc-dbl-inner-${id}`;
    const { rect: innerDblRect, knockout: innerDblKnockout } = createKnockoutMask(innerDblMaskId, defs, false);
    const outerDblMaskId = `sc-dbl-outer-${id}`;
    const { mask: outerDblMask, rect: outerDblRect, knockout: outerDblKnockout } = createKnockoutMask(outerDblMaskId, defs, true);
    const middleDblMaskId = `sc-dbl-middle-${id}`;
    const { mask: middleDblMask, rect: middleDblRect, knockout: middleDblKnockout } = createKnockoutMask(middleDblMaskId, defs, true);
    svg.appendChild(defs);
    const isShadowClip = document.createElementNS(SVG_NS, "g");
    isShadowClip.setAttribute("clip-path", `url(#${clipId})`);
    svg.appendChild(isShadowClip);
    const innerShadowPool = [];
    const { group: innerStrokeGroup, strokePath: innerStrokePath, grooveOverlay: innerGrooveOverlay } = createStrokeGroup({ attr: "clip-path", value: `url(#${clipId})` });
    svg.appendChild(innerStrokeGroup);
    const { group: outerStrokeGroup, strokePath: outerStrokePath, grooveOverlay: outerGrooveOverlay } = createStrokeGroup({ attr: "mask", value: `url(#${maskId})` });
    svg.appendChild(outerStrokeGroup);
    const { group: middleStrokeGroup, strokePath: middleStrokePath, grooveOverlay: middleGrooveOverlay } = createStrokeGroup();
    svg.appendChild(middleStrokeGroup);
    anchor.appendChild(svg);
    const innerBorderEls = {
      strokePath: innerStrokePath,
      grooveOverlay: innerGrooveOverlay,
      strokeGroup: innerStrokeGroup,
      dblMaskId: innerDblMaskId,
      dblKnockout: innerDblKnockout,
      dblRect: innerDblRect,
      strokeMultiplier: 2,
      defs,
      gradientEl: null,
      gradientId: `sc-grad-inner-${id}`,
      overlayGradientEl: null,
      overlayGradientId: `sc-grad-inner-ov-${id}`
    };
    const outerBorderEls = {
      strokePath: outerStrokePath,
      grooveOverlay: outerGrooveOverlay,
      strokeGroup: outerStrokeGroup,
      dblMaskId: outerDblMaskId,
      dblKnockout: outerDblKnockout,
      dblRect: outerDblRect,
      strokeMultiplier: 2,
      defs,
      gradientEl: null,
      gradientId: `sc-grad-outer-${id}`,
      overlayGradientEl: null,
      overlayGradientId: `sc-grad-outer-ov-${id}`,
      padDblMask: (pad, w, h) => padMaskAndRect(outerDblMask, outerDblRect, pad, w, h)
    };
    const middleBorderEls = {
      strokePath: middleStrokePath,
      grooveOverlay: middleGrooveOverlay,
      strokeGroup: middleStrokeGroup,
      dblMaskId: middleDblMaskId,
      dblKnockout: middleDblKnockout,
      dblRect: middleDblRect,
      strokeMultiplier: 1,
      defs,
      gradientEl: null,
      gradientId: `sc-grad-middle-${id}`,
      overlayGradientEl: null,
      overlayGradientId: `sc-grad-middle-ov-${id}`,
      padDblMask: (pad, w, h) => padMaskAndRect(middleDblMask, middleDblRect, pad, w, h)
    };
    const getPath = createPathCache();
    const place = createOverlayPlacer(anchor, target);
    return {
      update(options, effects, width, height, offset) {
        if (width <= 0 || height <= 0)
          return;
        place(svg, width, height, offset);
        svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        getPath.setOptions(options);
        const d = getPath(width, height, options, 0);
        clipShape.setAttribute("d", d);
        maskShape.setAttribute("d", d);
        maskRect.setAttribute("width", String(width));
        maskRect.setAttribute("height", String(height));
        updateBorder(effects.innerBorder, d, width, height, innerBorderEls);
        const ob = effects.outerBorder;
        if (ob && ob.width > 0 && ob.opacity > 0) {
          padMaskAndRect(maskEl, maskRect, ob.width, width, height);
        }
        updateBorder(ob, d, width, height, outerBorderEls);
        updateBorder(effects.middleBorder, d, width, height, middleBorderEls);
        const rawIs = effects.innerShadow;
        const isArr = rawIs == null ? [] : Array.isArray(rawIs) ? rawIs : [rawIs];
        while (innerShadowPool.length < isArr.length) {
          innerShadowPool.push(createInnerShadowEntry(defs, isShadowClip));
        }
        while (innerShadowPool.length > isArr.length) {
          removeInnerShadowEntry(innerShadowPool.pop());
        }
        for (let i = 0; i < isArr.length; i++) {
          const is = isArr[i];
          const entry = innerShadowPool[i];
          if (is.opacity <= 0) {
            entry.rect.style.display = "none";
            continue;
          }
          entry.rect.style.display = "";
          const spread = is.spread;
          const pad = Math.max(is.blur * 3, 20) + Math.max(Math.abs(is.offsetX), Math.abs(is.offsetY)) + Math.abs(spread);
          padMaskAndRect(entry.mask, entry.maskRect, pad, width, height);
          const cutW = Math.max(1, width - spread * 2);
          const cutH = Math.max(1, height - spread * 2);
          const cutOpts = spread !== 0 ? adjustOptions(options, -spread) : options;
          entry.maskCutout.setAttribute("d", getPath(cutW, cutH, cutOpts, -spread));
          entry.maskCutout.setAttribute("transform", `translate(${is.offsetX + spread},${is.offsetY + spread})`);
          if (is.blur > 0) {
            entry.feBlur.setAttribute("stdDeviation", String(is.blur));
            entry.blurGroup.setAttribute("filter", `url(#${entry.filterId})`);
          } else {
            entry.blurGroup.removeAttribute("filter");
          }
          padBounds(entry.rect, pad, width, height);
          entry.rect.setAttribute("fill", hexToRgb(is.color));
          entry.rect.setAttribute("fill-opacity", String(is.opacity));
        }
      },
      destroy() {
        svg.remove();
      }
    };
  }

  var refCounts = new WeakMap();
  function acquirePosition(anchor) {
    const count = refCounts.get(anchor) ?? 0;
    if (count > 0) {
      refCounts.set(anchor, count + 1);
      return true;
    }
    const pos = getComputedStyle(anchor).position;
    if (pos !== "static" && pos !== "")
      return false;
    refCounts.set(anchor, 1);
    anchor.style.position = "relative";
    return true;
  }
  function releasePosition(anchor) {
    const count = refCounts.get(anchor);
    if (count === void 0)
      return;
    if (count <= 1) {
      refCounts.delete(anchor);
      anchor.style.position = "";
    } else {
      refCounts.set(anchor, count - 1);
    }
  }
  var isolationCounts = new WeakMap();
  var savedIsolation = new WeakMap();
  function acquireIsolation(anchor) {
    const count = isolationCounts.get(anchor) ?? 0;
    if (count === 0)
      savedIsolation.set(anchor, anchor.style.isolation);
    isolationCounts.set(anchor, count + 1);
    anchor.style.isolation = "isolate";
  }
  function releaseIsolation(anchor) {
    const count = isolationCounts.get(anchor);
    if (count === void 0)
      return;
    if (count <= 1) {
      isolationCounts.delete(anchor);
      anchor.style.isolation = savedIsolation.get(anchor) ?? "";
      savedIsolation.delete(anchor);
    } else {
      isolationCounts.set(anchor, count - 1);
    }
  }

  function computeFilterPad(blur, spread) {
    return Math.ceil(3 * blur + Math.abs(spread) + 1);
  }
  function setFilterRegionUserSpace(filterEl, shadowWidth, shadowHeight, pad) {
    filterEl.setAttribute("x", String(-pad));
    filterEl.setAttribute("y", String(-pad));
    filterEl.setAttribute("width", String(shadowWidth + 2 * pad));
    filterEl.setAttribute("height", String(shadowHeight + 2 * pad));
  }
  function createShadowEntry(defs, svg) {
    const filterId = `sc-shadow-${nextUid()}`;
    const filterEl = document.createElementNS(SVG_NS, "filter");
    filterEl.setAttribute("id", filterId);
    filterEl.setAttribute("filterUnits", "userSpaceOnUse");
    filterEl.setAttribute("color-interpolation-filters", "sRGB");
    const feBlur = document.createElementNS(SVG_NS, "feGaussianBlur");
    feBlur.setAttribute("stdDeviation", "0");
    filterEl.appendChild(feBlur);
    defs.appendChild(filterEl);
    const pathEl = document.createElementNS(SVG_NS, "path");
    svg.appendChild(pathEl);
    return { filterId, filterEl, feBlur, pathEl };
  }
  function removeShadowEntry(entry) {
    entry.filterEl.remove();
    entry.pathEl.remove();
  }
  function createDropShadow(anchor, target = anchor) {
    acquireIsolation(anchor);
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.style.cssText = "position:absolute;left:0;top:0;overflow:visible;pointer-events:none;z-index:-1";
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.setAttribute("aria-hidden", "true");
    const defs = document.createElementNS(SVG_NS, "defs");
    svg.appendChild(defs);
    anchor.appendChild(svg);
    const pool = [];
    const getPath = createPathCache();
    const place = createOverlayPlacer(anchor, target);
    return {
      update(options, shadow, width, height, offset) {
        const arr = Array.isArray(shadow) ? shadow : [shadow];
        const hasVisible = width > 0 && height > 0 && arr.some((s) => s.opacity > 0);
        if (!hasVisible) {
          svg.style.display = "none";
          return;
        }
        place(svg, width, height, offset);
        while (pool.length < arr.length)
          pool.push(createShadowEntry(defs, svg));
        while (pool.length > arr.length)
          removeShadowEntry(pool.pop());
        getPath.setOptions(options);
        let anyVisible = false;
        for (let i = 0; i < arr.length; i++) {
          const s = arr[i];
          const entry = pool[arr.length - 1 - i];
          if (s.opacity <= 0) {
            entry.pathEl.style.display = "none";
            continue;
          }
          const spread = s.spread;
          const shadowWidth = width + spread * 2;
          const shadowHeight = height + spread * 2;
          if (shadowWidth <= 0 || shadowHeight <= 0) {
            entry.pathEl.style.display = "none";
            continue;
          }
          anyVisible = true;
          entry.pathEl.style.display = "";
          const colour = hexToRgb(s.color);
          const adjusted = adjustOptions(options, spread);
          entry.pathEl.setAttribute("d", getPath(shadowWidth, shadowHeight, adjusted, spread));
          entry.pathEl.setAttribute("transform", `translate(${s.offsetX - spread},${s.offsetY - spread})`);
          entry.pathEl.setAttribute("fill", colour);
          entry.pathEl.setAttribute("fill-opacity", String(s.opacity));
          if (s.blur > 0) {
            const pad = computeFilterPad(s.blur, spread);
            setFilterRegionUserSpace(entry.filterEl, shadowWidth, shadowHeight, pad);
            entry.feBlur.setAttribute("stdDeviation", String(s.blur));
            entry.pathEl.setAttribute("filter", `url(#${entry.filterId})`);
          } else {
            entry.pathEl.removeAttribute("filter");
          }
        }
        svg.style.display = anyVisible ? "" : "none";
      },
      destroy() {
        svg.remove();
        releaseIsolation(anchor);
      }
    };
  }

  var observer = null;
  var rafId;
  var callbackMap = new Map();
  var pendingElements = new Set();
  var lastMeasured = new WeakMap();
  function flush() {
    rafId = void 0;
    const elements = [...pendingElements];
    pendingElements.clear();
    const sizes = new Map();
    for (const el of elements) {
      if (!callbackMap.has(el))
        continue;
      const node = el;
      const cs = window.getComputedStyle(node);
      const size = getLayoutSize(node, cs);
      lastMeasured.set(el, {
        width: size.width,
        height: size.height,
        horizontal: cs.writingMode === "horizontal-tb" || cs.writingMode === ""
      });
      sizes.set(el, { ...size, offsetLeft: node.offsetLeft, offsetTop: node.offsetTop });
    }
    for (const el of elements) {
      const cbs = callbackMap.get(el);
      if (cbs) {
        const size = sizes.get(el);
        for (const cb of [...cbs])
          cb(size);
      }
    }
  }
  function getObserver() {
    if (!observer) {
      observer = new ResizeObserver((entries) => {
        let queued = false;
        for (const entry of entries) {
          const last = lastMeasured.get(entry.target);
          const box = entry.borderBoxSize?.[0];
          if (last?.horizontal && box && box.inlineSize === last.width && box.blockSize === last.height) {
            continue;
          }
          pendingElements.add(entry.target);
          queued = true;
        }
        if (queued && rafId === void 0) {
          rafId = requestAnimationFrame(flush);
        }
      });
    }
    return observer;
  }
  function requestMeasure(el) {
    if (!callbackMap.has(el))
      return;
    pendingElements.add(el);
    if (rafId === void 0) {
      rafId = requestAnimationFrame(flush);
    }
  }
  function observeResize(el, callback) {
    if (typeof ResizeObserver === "undefined")
      return () => {
      };
    const obs = getObserver();
    let set = callbackMap.get(el);
    if (!set) {
      set = new Set();
      callbackMap.set(el, set);
      obs.observe(el);
    }
    set.add(callback);
    pendingElements.add(el);
    if (rafId === void 0) {
      rafId = requestAnimationFrame(flush);
    }
    let done = false;
    return () => {
      if (done)
        return;
      done = true;
      set.delete(callback);
      if (set.size === 0) {
        callbackMap.delete(el);
        obs.unobserve(el);
        lastMeasured.delete(el);
      }
      if (callbackMap.size === 0) {
        if (rafId !== void 0) {
          cancelAnimationFrame(rafId);
          rafId = void 0;
        }
        pendingElements.clear();
        observer?.disconnect();
        observer = null;
      }
    };
  }
  function observeAnchor(anchor, target) {
    let first = true;
    return observeResize(anchor, () => {
      if (first) {
        first = false;
        return;
      }
      requestMeasure(target);
    });
  }

  function parseColor(raw) {
    const match = raw.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/);
    if (!match)
      return void 0;
    const r2 = Number(match[1]);
    const g = Number(match[2]);
    const b = Number(match[3]);
    const a = match[4] !== void 0 ? Number(match[4]) : 1;
    const hex = "#" + (1 << 24 | r2 << 16 | g << 8 | b).toString(16).slice(1);
    return { hex, opacity: a };
  }
  var COLOR_FN = /(?:color-mix|light-dark|rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\((?:[^()]|\([^()]*\))+\)/;
  var TRAILING_ALPHA = /\/\s*([\d.]+%?)\s*\)$/;
  function resolvePaint(raw) {
    const parsed = parseColor(raw);
    if (parsed)
      return parsed.opacity > 0 ? { color: parsed.hex, opacity: parsed.opacity } : void 0;
    if (COLOR_FN.exec(raw)?.[0] !== raw)
      return void 0;
    const alpha = raw.match(TRAILING_ALPHA)?.[1];
    return alpha && parseFloat(alpha) === 0 ? void 0 : { color: raw, opacity: 1 };
  }
  function parseBorder(el, cs = getComputedStyle(el)) {
    const style = cs.borderTopStyle;
    if (style === "none" || style === "hidden")
      return void 0;
    const width = parseFloat(cs.borderTopWidth);
    if (width <= 0 || isNaN(width))
      return void 0;
    const color = resolvePaint(cs.borderTopColor);
    if (!color)
      return void 0;
    const nonSolid = {
      dashed: "dashed",
      dotted: "dotted",
      double: "double",
      groove: "groove",
      ridge: "ridge"
    };
    const borderStyle = nonSolid[style];
    return {
      width,
      color: color.color,
      opacity: color.opacity,
      ...borderStyle ? { style: borderStyle } : {}
    };
  }
  function parseBoxShadow(raw) {
    if (!raw || raw === "none")
      return {};
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === "(")
        depth++;
      else if (raw[i] === ")")
        depth--;
      else if (raw[i] === "," && depth === 0) {
        parts.push(raw.slice(start, i).trim());
        start = i + 1;
      }
    }
    parts.push(raw.slice(start).trim());
    const shadows = [];
    const innerShadows = [];
    for (const part of parts) {
      const isInset = part.includes("inset");
      const cleaned = part.replace("inset", "").trim();
      const colorMatch = cleaned.match(COLOR_FN);
      if (!colorMatch)
        continue;
      const paint = resolvePaint(colorMatch[0]);
      if (!paint)
        continue;
      const rest = cleaned.replace(colorMatch[0], "").trim();
      const values = rest.split(/\s+/).map(parseFloat).filter((v) => !isNaN(v));
      if (values.length < 2)
        continue;
      const config = {
        offsetX: values[0],
        offsetY: values[1],
        blur: values[2] ?? 0,
        spread: values[3] ?? 0,
        ...paint
      };
      (isInset ? innerShadows : shadows).push(config);
    }
    return {
      shadow: shadows.length > 0 ? shadows : void 0,
      innerShadow: innerShadows.length > 0 ? innerShadows : void 0
    };
  }
  function extractAndStripEffects(el) {
    const savedStyles = {
      border: el.style.border,
      boxShadow: el.style.boxShadow,
      paddingTop: el.style.paddingTop,
      paddingRight: el.style.paddingRight,
      paddingBottom: el.style.paddingBottom,
      paddingLeft: el.style.paddingLeft
    };
    const cs = getComputedStyle(el);
    const borderStyleSource = {
      borderTopStyle: cs.borderTopStyle,
      borderTopWidth: cs.borderTopWidth,
      borderTopColor: cs.borderTopColor
    };
    const boxShadow = cs.boxShadow;
    const boxSizing = cs.boxSizing;
    const borderTopW = parseFloat(cs.borderTopWidth) || 0;
    const borderRightW = parseFloat(cs.borderRightWidth) || 0;
    const borderBottomW = parseFloat(cs.borderBottomWidth) || 0;
    const borderLeftW = parseFloat(cs.borderLeftWidth) || 0;
    const paddingTop = parseFloat(cs.paddingTop) || 0;
    const paddingRight = parseFloat(cs.paddingRight) || 0;
    const paddingBottom = parseFloat(cs.paddingBottom) || 0;
    const paddingLeft = parseFloat(cs.paddingLeft) || 0;
    const size = getLayoutSize(el, cs);
    const innerBorder = parseBorder(el, borderStyleSource);
    const { shadow, innerShadow } = parseBoxShadow(boxShadow);
    if (innerBorder)
      el.style.border = "0";
    if (shadow || innerShadow)
      el.style.boxShadow = "none";
    if (innerBorder && boxSizing === "content-box" && (borderTopW > 0 || borderRightW > 0 || borderBottomW > 0 || borderLeftW > 0)) {
      el.style.paddingTop = paddingTop + borderTopW + "px";
      el.style.paddingRight = paddingRight + borderRightW + "px";
      el.style.paddingBottom = paddingBottom + borderBottomW + "px";
      el.style.paddingLeft = paddingLeft + borderLeftW + "px";
    }
    const effects = {};
    if (innerBorder)
      effects.innerBorder = innerBorder;
    if (shadow)
      effects.shadow = shadow;
    if (innerShadow)
      effects.innerShadow = innerShadow;
    return { effects, size, savedStyles };
  }
  function hasEffects(config) {
    if (!config)
      return false;
    return !!(config.innerBorder || config.outerBorder || config.middleBorder || config.innerShadow || config.shadow);
  }
  function mergeEffects(extracted, explicit) {
    return { ...extracted?.effects, ...explicit };
  }
  function restoreStyles(el, saved) {
    el.style.border = saved.border;
    el.style.boxShadow = saved.boxShadow;
    el.style.paddingTop = saved.paddingTop;
    el.style.paddingRight = saved.paddingRight;
    el.style.paddingBottom = saved.paddingBottom;
    el.style.paddingLeft = saved.paddingLeft;
  }

  function smoothCorners(node, config = {}) {
    let cfg = normalize(config);
    let syncKey = computeSyncKey(cfg);
    const savedClipPath = node.style.clipPath;
    let extracted;
    let effectsHandle;
    let shadowHandle;
    let anchor = null;
    let didAcquire = false;
    let unobserveAnchor;
    let pendingSize;
    let lastWidth = 0, lastHeight = 0, lastOffsetX = 0, lastOffsetY = 0;
    let lastSyncKey = null;
    let clearedFallback = false;
    node.setAttribute("data-slot", "smooth-corners");
    node.setAttribute("data-state", "pending");
    if (cfg.autoEffects) {
      extracted = extractAndStripEffects(node);
      pendingSize = extracted.size;
    }
    function ensureHandles(merged) {
      if (!anchor) {
        const supplied = cfg.anchor && cfg.anchor !== node ? cfg.anchor : null;
        const a = supplied ?? node.parentElement;
        if (!a) return;
        anchor = a;
        didAcquire = acquirePosition(a);
        unobserveAnchor = observeAnchor(a, node);
      }
      if (!effectsHandle) effectsHandle = createSvgEffects(anchor, node);
      if (!shadowHandle && merged.shadow && !cfg.skipShadowHandle) {
        shadowHandle = createDropShadow(anchor, node);
      }
    }
    function apply(measured) {
      const merged = mergeEffects(extracted, cfg.effects);
      if (hasEffects(merged)) ensureHandles(merged);
      const pending = pendingSize;
      pendingSize = void 0;
      const { width, height } = measured ?? pending ?? getLayoutSize(node);
      if (width <= 0 || height <= 0) return;
      const placed = measured && "offsetLeft" in measured ? measured : void 0;
      const anchored = effectsHandle !== void 0;
      const offsetX = anchored ? placed?.offsetLeft ?? node.offsetLeft : 0;
      const offsetY = anchored ? placed?.offsetTop ?? node.offsetTop : 0;
      if (width === lastWidth && height === lastHeight && syncKey === lastSyncKey && offsetX === lastOffsetX && offsetY === lastOffsetY) return;
      lastWidth = width;
      lastHeight = height;
      lastSyncKey = syncKey;
      lastOffsetX = offsetX;
      lastOffsetY = offsetY;
      node.style.clipPath = generateClipPath(width, height, cfg.corners);
      node.setAttribute("data-state", "ready");
      if (cfg.fallbackBorderRadius !== void 0 && !clearedFallback) {
        node.style.borderRadius = "";
        clearedFallback = true;
      }
      if (effectsHandle) {
        const offset = { x: offsetX, y: offsetY };
        effectsHandle.update(cfg.corners, merged, width, height, offset);
        shadowHandle?.update(cfg.corners, merged.shadow ?? DEFAULT_SHADOW, width, height, offset);
      }
    }
    if (hasEffects(mergeEffects(extracted, cfg.effects))) ensureHandles(mergeEffects(extracted, cfg.effects));
    cfg.onExtractedShadow?.(extracted?.effects.shadow);
    const unobserve = observeResize(node, apply);
    apply();
    return {
      update(next = {}) {
        const prev = cfg;
        cfg = normalize(next);
        syncKey = computeSyncKey(cfg);
        if (cfg.skipShadowHandle !== prev.skipShadowHandle) {
          if (cfg.skipShadowHandle && shadowHandle) {
            shadowHandle.destroy();
            shadowHandle = void 0;
          }
          lastSyncKey = null;
        }
        if (cfg.autoEffects !== prev.autoEffects) {
          if (cfg.autoEffects && !extracted) {
            extracted = extractAndStripEffects(node);
            pendingSize = extracted.size;
          } else if (!cfg.autoEffects && extracted) {
            restoreStyles(node, extracted.savedStyles);
            extracted = void 0;
          }
          cfg.onExtractedShadow?.(extracted?.effects.shadow);
          lastSyncKey = null;
        }
        apply();
      },
      destroy() {
        unobserve();
        unobserveAnchor?.();
        unobserveAnchor = void 0;
        effectsHandle?.destroy();
        effectsHandle = void 0;
        shadowHandle?.destroy();
        shadowHandle = void 0;
        if (extracted) restoreStyles(node, extracted.savedStyles);
        extracted = void 0;
        cfg.onExtractedShadow?.(void 0);
        pendingSize = void 0;
        if (didAcquire && anchor) releasePosition(anchor);
        anchor = null;
        didAcquire = false;
        if (clearedFallback && cfg.fallbackBorderRadius !== void 0) {
          node.style.borderRadius = cfg.fallbackBorderRadius;
        }
        node.style.clipPath = savedClipPath;
        node.removeAttribute("data-slot");
        node.removeAttribute("data-state");
      }
    };
  }
  function normalize(c) {
    return {
      corners: c.corners ?? { radius: 0 },
      effects: c.effects,
      autoEffects: c.autoEffects ?? true,
      anchor: c.anchor,
      skipShadowHandle: c.skipShadowHandle ?? false,
      onExtractedShadow: c.onExtractedShadow,
      fallbackBorderRadius: c.fallbackBorderRadius
    };
  }
  function computeSyncKey(c) {
    return `${JSON.stringify(c.corners)}|${JSON.stringify(c.effects ?? null)}|${c.skipShadowHandle ? 1 : 0}`;
  }
  var HEX2 = /^#?[0-9a-f]{3}(?:[0-9a-f]{3})?$/i;
  function hexToRgbChannels(hex) {
    if (!HEX2.test(hex)) return null;
    const h = hex.replace("#", "");
    const e = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
    return { r: parseInt(e.substring(0, 2), 16), g: parseInt(e.substring(2, 4), 16), b: parseInt(e.substring(4, 6), 16) };
  }
  function buildBoxShadowChain(shadows) {
    const arr = Array.isArray(shadows) ? shadows : [shadows];
    const parts = [];
    for (const s of arr) {
      if (s.opacity <= 0) continue;
      const { offsetX, offsetY, blur, spread, color, opacity } = s;
      const rgb = hexToRgbChannels(color);
      const paint = rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},${opacity})` : opacity < 1 ? `color-mix(in srgb, ${color} ${opacity * 100}%, transparent)` : color;
      parts.push(`${offsetX}px ${offsetY}px ${blur}px ${spread}px ${paint}`);
    }
    return parts.join(", ");
  }
  function elementHasRadius(el) {
    for (let i = 0; i < el.style.length; i++) if (/radius/i.test(el.style[i])) return true;
    return false;
  }
  function SmoothCorners(props = {}) {
    const adopted = props.element;
    const el = adopted ?? document.createElement(props.as ?? "div");
    const parentAtMount = adopted?.parentNode ?? null;
    const nextAtMount = adopted?.nextSibling ?? null;
    if (!adopted) {
      if (props.className) el.className = props.className;
      for (const [k, v] of Object.entries(props.attrs ?? {})) el.setAttribute(k, v);
      if (typeof props.style === "string") el.style.cssText = props.style;
      else Object.assign(el.style, props.style ?? {});
      for (const ch of [].concat(props.children ?? [])) el.append(ch);
    }
    const userSuppliedRadius = elementHasRadius(el);
    const fallback = cornerOptionsToBorderRadius(props.corners ?? { radius: 0 });
    if (!userSuppliedRadius) el.style.borderRadius = fallback;
    let p = props;
    let wrapper = null;
    let sibling = null;
    let isolated = false;
    let extractedShadow;
    let binding;
    let started = false;
    let destroyed = false;
    function derive() {
      const options = p.corners ?? { radius: 0 };
      const useBoxShadow = p.shadowStrategy === "box-shadow";
      const explicit = {
        innerBorder: p.innerBorder,
        outerBorder: p.outerBorder,
        middleBorder: p.middleBorder,
        innerShadow: p.innerShadow,
        shadow: useBoxShadow ? void 0 : p.shadow
      };
      const hasExplicit = hasEffects(explicit);
      const siblingShadow = useBoxShadow ? p.shadow ?? extractedShadow : void 0;
      const chain = siblingShadow === void 0 ? "" : buildBoxShadowChain(siblingShadow);
      return {
        options,
        useBoxShadow,
        explicit,
        hasExplicit,
        chain,
        needsWrapper: (p.autoEffects ?? true) || hasExplicit || siblingShadow !== void 0
      };
    }
    function ensureWrapper() {
      if (wrapper) return;
      wrapper = document.createElement("div");
      wrapper.style.position = "relative";
      if (el.parentNode) el.parentNode.insertBefore(wrapper, el);
      wrapper.appendChild(el);
    }
    function syncSibling(d) {
      if (d.chain === "") {
        sibling?.remove();
        sibling = null;
        if (isolated) {
          releaseIsolation(wrapper);
          isolated = false;
        }
        return;
      }
      ensureWrapper();
      if (!sibling) {
        sibling = document.createElement("div");
        sibling.setAttribute("aria-hidden", "true");
        sibling.setAttribute("data-slot", "smooth-corners-box-shadow");
        Object.assign(sibling.style, { position: "absolute", inset: "0", pointerEvents: "none", zIndex: "-1" });
        wrapper.insertBefore(sibling, el);
      }
      sibling.style.borderRadius = cornerOptionsToBorderRadius(d.options);
      sibling.style.boxShadow = d.chain;
      if (!isolated) {
        acquireIsolation(wrapper);
        isolated = true;
      }
    }
    function bindingConfig(d) {
      return {
        corners: d.options,
        effects: d.hasExplicit ? d.explicit : void 0,
        autoEffects: p.autoEffects,
        anchor: d.needsWrapper ? wrapper : void 0,
        skipShadowHandle: d.useBoxShadow,
        onExtractedShadow: d.useBoxShadow ? onExtractedShadow : void 0,
        fallbackBorderRadius: userSuppliedRadius ? void 0 : fallback
      };
    }
    function onExtractedShadow(next) {
      if (next === extractedShadow) return;
      extractedShadow = next;
      if (binding) queueMicrotask(() => {
        if (binding && !destroyed) render();
      });
    }
    function render() {
      const d = derive();
      if (d.needsWrapper) ensureWrapper();
      syncSibling(d);
      binding.update(bindingConfig(d));
    }
    function start() {
      if (started || destroyed) return;
      started = true;
      let d = derive();
      if (d.needsWrapper) ensureWrapper();
      binding = smoothCorners(el, bindingConfig(d));
      syncSibling(derive());
    }
    const handle = {
      el,
      get root() {
        return wrapper ?? el;
      },
      get wrapper() {
        return wrapper;
      },
      mount(parent, before = null) {
        parent.insertBefore(handle.root, before);
        start();
      },
      update(next = {}) {
        p = { ...p, ...next };
        if (started) render();
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        binding?.destroy();
        binding = void 0;
        sibling?.remove();
        sibling = null;
        if (isolated) {
          releaseIsolation(wrapper);
          isolated = false;
        }
        if (wrapper) {
          if (adopted && parentAtMount) {
            const ref = nextAtMount && nextAtMount.parentNode === parentAtMount ? nextAtMount : null;
            parentAtMount.insertBefore(el, ref);
          } else if (el.parentNode === wrapper && wrapper.parentNode) {
            wrapper.parentNode.insertBefore(el, wrapper);
          }
          wrapper.remove();
          wrapper = null;
        }
        if (adopted) {
          if (!userSuppliedRadius) el.style.borderRadius = "";
        } else el.remove();
      }
    };
    if (!adopted && props.parent) props.parent.appendChild(el);
    if (el.isConnected) start();
    return handle;
  }
  return __toCommonJS(index_exports);
})();
