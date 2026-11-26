// Holiday touches (Nov 25 2026): the browser script the public holiday-touches function serves to client sites.
// Same code as the preview artifact Justin approves the look on. The function puts window.__HOLIDAY_DECOR__ before it.
// Keep it free of backticks and "${" so it can live in this template string.
export const HOLIDAY_TOUCHES_JS = String.raw`/* Interstellar holiday touches: subtle seasonal decor for a client website.
 * One include, any platform. Draws a light layer of falling particles (snow, leaves, clovers, stars) and an optional
 * trim on the site's header (a garland for Christmas, small pumpkins for Halloween). Never blocks clicks, pauses when
 * the tab is hidden, and shows only the trim (no motion) for visitors who prefer reduced motion.
 * Header: the element with [data-holiday-trim], else the first <header>, else the first <nav>.
 */
(function () {
  var W = window, D = document;
  var state = { raf: 0, canvas: null, trim: null, onResize: null, onVis: null };

  function stop() {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
    if (state.canvas) state.canvas.remove();
    if (state.trim) state.trim.remove();
    if (state.onResize) W.removeEventListener("resize", state.onResize);
    if (state.onVis) D.removeEventListener("visibilitychange", state.onVis);
    if (state.onTrim) W.removeEventListener("resize", state.onTrim);
    state.canvas = state.trim = state.onResize = state.onVis = state.onTrim = null;
  }

  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var pick = function (arr) { return arr[(Math.random() * arr.length) | 0]; };

  var LOOKS = {
    snow: { desktop: 46, mobile: 22, size: [1.6, 3.6], speed: [0.25, 0.7], sway: 0.5, alpha: [0.45, 0.85], spin: 0 },
    leaves: { desktop: 13, mobile: 7, size: [7, 11], speed: [0.35, 0.75], sway: 1.1, alpha: [0.7, 0.9], spin: 0.02,
      colors: ["#c2410c", "#d97706", "#b45309", "#a16207", "#9a3412"] },
    clovers: { desktop: 14, mobile: 7, size: [7, 10], speed: [0.3, 0.6], sway: 0.8, alpha: [0.65, 0.85], spin: 0.015,
      colors: ["#15803d", "#16a34a", "#166534"] },
    stars: { desktop: 18, mobile: 9, size: [3.5, 5.5], speed: [0.2, 0.45], sway: 0.4, alpha: [0.55, 0.85], spin: 0.01,
      colors: ["#b91c1c", "#1d4ed8", "#e5e7eb"] },
  };

  function drawLeaf(c, s, color) {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(0, -s);
    c.bezierCurveTo(s * 0.9, -s * 0.6, s * 0.8, s * 0.5, 0, s);
    c.bezierCurveTo(-s * 0.8, s * 0.5, -s * 0.9, -s * 0.6, 0, -s);
    c.fill();
    c.strokeStyle = "rgba(0,0,0,.18)"; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(0, -s * 0.85); c.lineTo(0, s * 1.15); c.stroke();
  }
  function drawClover(c, s, color) {
    c.fillStyle = color;
    var r = s * 0.42;
    for (var i = 0; i < 4; i++) {
      c.save(); c.rotate((Math.PI / 2) * i);
      c.beginPath();
      c.arc(-r * 0.55, -r * 1.05, r * 0.62, 0, Math.PI * 2);
      c.arc(r * 0.55, -r * 1.05, r * 0.62, 0, Math.PI * 2);
      c.fill();
      c.beginPath(); c.moveTo(-r * 1.1, -r * 0.9); c.lineTo(0, 0); c.lineTo(r * 1.1, -r * 0.9); c.fill();
      c.restore();
    }
    c.strokeStyle = color; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(s * 0.3, s * 0.7, s * 0.15, s * 1.2); c.stroke();
  }
  function drawStar(c, s, color) {
    c.fillStyle = color;
    c.beginPath();
    for (var i = 0; i < 10; i++) {
      var rad = i % 2 ? s * 0.45 : s, a = (Math.PI / 5) * i - Math.PI / 2;
      c[i ? "lineTo" : "moveTo"](Math.cos(a) * rad, Math.sin(a) * rad);
    }
    c.closePath(); c.fill();
  }

  function particles(effect) {
    var look = LOOKS[effect];
    if (!look) return;
    var cv = D.createElement("canvas");
    cv.setAttribute("aria-hidden", "true");
    cv.setAttribute("data-holiday-touches", effect);
    cv.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483000";
    D.body.appendChild(cv);
    state.canvas = cv;
    var c = cv.getContext("2d"), dpr = Math.min(2, W.devicePixelRatio || 1), w = 0, h = 0, list = [];
    function size() {
      w = W.innerWidth; h = W.innerHeight;
      cv.width = w * dpr; cv.height = h * dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = w < 700 ? look.mobile : look.desktop;
      while (list.length < n) list.push(make(true));
      list.length = n;
    }
    function make(anywhere) {
      return {
        x: rnd(0, w), y: anywhere ? rnd(-h, h) : rnd(-40, -10), s: rnd(look.size[0], look.size[1]),
        v: rnd(look.speed[0], look.speed[1]), a: rnd(look.alpha[0], look.alpha[1]), p: rnd(0, Math.PI * 2),
        r: rnd(0, Math.PI * 2), vr: rnd(-look.spin, look.spin), col: look.colors ? pick(look.colors) : "#ffffff",
      };
    }
    var last = performance.now();
    function frame(now) {
      var dt = Math.min(3, (now - last) / 16.67); last = now;
      c.clearRect(0, 0, w, h);
      for (var i = 0; i < list.length; i++) {
        var q = list[i];
        q.p += 0.012 * dt; q.y += q.v * dt; q.x += Math.sin(q.p) * look.sway * 0.35 * dt; q.r += q.vr * dt;
        if (q.y > h + 20) { list[i] = make(false); continue; }
        c.save(); c.globalAlpha = q.a; c.translate(q.x, q.y); c.rotate(q.r);
        if (effect === "snow") {
          c.fillStyle = "#ffffff"; c.shadowColor = "rgba(70,95,130,.55)"; c.shadowBlur = 3;
          c.beginPath(); c.arc(0, 0, q.s, 0, Math.PI * 2); c.fill();
          c.shadowBlur = 0; c.strokeStyle = "rgba(90,115,150,.28)"; c.lineWidth = 0.7; c.stroke();
        } else if (effect === "leaves") drawLeaf(c, q.s, q.col);
        else if (effect === "clovers") drawClover(c, q.s, q.col);
        else if (effect === "stars") drawStar(c, q.s, q.col);
        c.restore();
      }
      state.raf = requestAnimationFrame(frame);
    }
    size();
    state.onResize = size; W.addEventListener("resize", size);
    state.onVis = function () {
      if (D.hidden) { cancelAnimationFrame(state.raf); state.raf = 0; }
      else if (!state.raf) { last = performance.now(); state.raf = requestAnimationFrame(frame); }
    };
    D.addEventListener("visibilitychange", state.onVis);
    state.raf = requestAnimationFrame(frame);
  }

  function garlandSvg(width) {
    var h = 30, out = [], step = 9;
    var swag = Math.max(1, Math.round(width / 180)), seg = width / swag;
    var y = function (x) { var t = (x % seg) / seg; return 6 + Math.sin(t * Math.PI) * 11; };
    for (var x = 0; x <= width; x += step / 3) {
      var yy = y(x) + rnd(-1.2, 1.2);
      out.push('<path d="M' + x.toFixed(1) + " " + yy.toFixed(1) + " l" + rnd(-8, -4).toFixed(1) + " " + rnd(-5, 6).toFixed(1) +
        '" stroke="' + pick(["#14532d", "#166534", "#1f6f43", "#0f3d22"]) + '" stroke-width="1.9" stroke-linecap="round"/>');
      out.push('<path d="M' + x.toFixed(1) + " " + yy.toFixed(1) + " l" + rnd(4, 8).toFixed(1) + " " + rnd(-5, 6).toFixed(1) +
        '" stroke="' + pick(["#14532d", "#166534", "#1f6f43"]) + '" stroke-width="1.6" stroke-linecap="round"/>');
    }
    for (var b = seg / 4; b < width; b += seg / 4) {
      var col = pick(["#b91c1c", "#b91c1c", "#ca8a04"]);
      out.push('<circle cx="' + b.toFixed(1) + '" cy="' + (y(b) + 4.5).toFixed(1) + '" r="3.4" fill="' + col + '"/>' +
        '<circle cx="' + (b - 0.8).toFixed(1) + '" cy="' + (y(b) + 3.4).toFixed(1) + '" r="1" fill="rgba(255,255,255,.7)"/>');
    }
    for (var k = 0; k <= swag; k++) {
      var tx = Math.min(width - 4, Math.max(4, k * seg));
      out.push('<path d="M' + (tx - 6) + " 3 q6 7 12 0 q-6 8 -12 0z" + '" fill="#b91c1c"/><circle cx="' + tx + '" cy="5" r="2.2" fill="#991b1b"/>');
    }
    return '<svg width="' + width + '" height="' + h + '" viewBox="0 0 ' + width + " " + h + '" xmlns="http://www.w3.org/2000/svg">' + out.join("") + "</svg>";
  }
  function pumpkinsSvg() {
    function p(x, s, c) {
      return '<g transform="translate(' + x + ",3) scale(" + s + ')">' +
        '<ellipse cx="9" cy="11" rx="9" ry="7" fill="' + c + '"/>' +
        '<ellipse cx="9" cy="11" rx="4" ry="7" fill="rgba(0,0,0,.12)"/>' +
        '<ellipse cx="9" cy="11" rx="1.4" ry="7" fill="rgba(255,255,255,.12)"/>' +
        '<path d="M9 4.5 q1 -3 3 -3.5" stroke="#3f6212" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
        '<path d="M10 4 q4 -1 5 2 q-3 0 -5 -2z" fill="#4d7c0f"/></g>';
    }
    return '<svg width="96" height="33" viewBox="0 0 64 22" xmlns="http://www.w3.org/2000/svg">' +
      p(0, 0.95, "#ea580c") + p(20, 1.1, "#f97316") + p(43, 0.85, "#c2410c") + "</svg>";
  }
  function trim(kind) {
    var host = D.querySelector("[data-holiday-trim]") || D.querySelector("header") || D.querySelector("nav");
    if (!host) return;
    var cs = W.getComputedStyle(host);
    if (cs.position === "static") host.style.position = "relative";
    var el = D.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.setAttribute("data-holiday-trim-layer", kind);
    if (kind === "garland") {
      el.style.cssText = "position:absolute;left:0;right:0;top:100%;height:30px;margin-top:-10px;pointer-events:none;overflow:hidden;z-index:5";
      var draw = function () { el.innerHTML = garlandSvg(Math.max(320, host.getBoundingClientRect().width)); };
      draw();
      state.onTrim = draw; W.addEventListener("resize", draw);
    } else if (kind === "pumpkins") {
      el.style.cssText = "position:absolute;right:22px;top:100%;margin-top:-20px;pointer-events:none;z-index:5";
      el.innerHTML = pumpkinsSvg();
    }
    host.appendChild(el);
    state.trim = el;
  }

  function start(decor) {
    stop();
    if (!decor) return;
    var calm = W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (decor.trim) trim(decor.trim);
    if (decor.effect && !calm) particles(decor.effect);
  }

  W.__holidayTouches = start;
  var initial = W.__HOLIDAY_DECOR__;
  if (initial) {
    if (D.body) start(initial);
    else D.addEventListener("DOMContentLoaded", function () { start(initial); });
  }
})();
`;
