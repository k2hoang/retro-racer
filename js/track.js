/* Retro Racer - builds a track from data: smooth spline, per-pixel surface map,
 * prerendered artwork, checkpoints (gates), item box spots, boost pads and scenery. */
(function (RR) {
  'use strict';

  const STEP = 4;   // spacing of resampled centerline points (px)
  const CURB = 4;   // curb width (px)

  const SURF = RR.SURF = { GRASS: 0, ROAD: 1, CURB: 2, SAND: 3, ICE: 4 };
  RR.SURF_PROPS = [
    { name: 'GRASS', grip: 5, speed: 0.55, accel: 0.7 },
    { name: 'ROAD', grip: 11, speed: 1.0, accel: 1.0 },
    { name: 'CURB', grip: 10, speed: 0.93, accel: 1.0 },
    { name: 'SAND', grip: 5, speed: 0.62, accel: 0.75 },
    { name: 'ICE', grip: 1.2, speed: 1.0, accel: 0.55 }
  ];

  function catmull(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
    return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
  }

  // Closed Catmull-Rom spline, resampled to evenly spaced points.
  function buildPath(points) {
    const n = points.length, dense = [];
    for (let i = 0; i < n; i++) {
      const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n], p3 = points[(i + 2) % n];
      for (let s = 0; s < 24; s++) dense.push(catmull(p0, p1, p2, p3, s / 24));
    }
    const cum = [0];
    for (let i = 1; i < dense.length; i++) {
      cum[i] = cum[i - 1] + RR.dist(dense[i - 1][0], dense[i - 1][1], dense[i][0], dense[i][1]);
    }
    const last = dense[dense.length - 1];
    const total = cum[cum.length - 1] + RR.dist(last[0], last[1], dense[0][0], dense[0][1]);
    const count = Math.round(total / STEP), step = total / count, pts = [];
    let j = 0;
    for (let k = 0; k < count; k++) {
      const target = k * step;
      while (j < dense.length - 1 && cum[j + 1] < target) j++;
      const a = dense[j], b = j + 1 < dense.length ? dense[j + 1] : dense[0];
      const segEnd = j + 1 < dense.length ? cum[j + 1] : total;
      const segLen = segEnd - cum[j];
      const u = segLen > 0 ? (target - cum[j]) / segLen : 0;
      pts.push({ x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, a: 0 });
    }
    for (let k = 0; k < count; k++) {
      const p = pts[(k - 1 + count) % count], q = pts[(k + 1) % count];
      pts[k].a = Math.atan2(q.y - p.y, q.x - p.x);
    }
    return { pts: pts, length: total, step: step };
  }

  function inRange(t, from, to) { return from <= to ? (t >= from && t < to) : (t >= from || t < to); }
  function noisy(c, h, amt) { const d = (h - 0.5) * 2 * amt; return [c[0] + d, c[1] + d, c[2] + d]; }

  function Track(def) {
    const W = RR.W, H = RR.H, theme = RR.THEMES[def.theme];
    this.def = def;
    this.theme = theme;
    this.hw = def.hw;

    const path = buildPath(def.points);
    const pts = this.pts = path.pts;
    const n = this.n = pts.length;
    this.length = path.length;
    this.step = path.step;
    const hw = def.hw;

    // Spatial grid of centerline segments, so each pixel only checks nearby segments.
    const R = hw + CURB + 3, CS = 20, GW = Math.ceil(W / CS), GH = Math.ceil(H / CS);
    const grid = new Array(GW * GH);
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const x0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - R) / CS));
      const x1 = Math.min(GW - 1, Math.floor((Math.max(a.x, b.x) + R) / CS));
      const y0 = Math.max(0, Math.floor((Math.min(a.y, b.y) - R) / CS));
      const y1 = Math.min(GH - 1, Math.floor((Math.max(a.y, b.y) + R) / CS));
      for (let gy = y0; gy <= y1; gy++) {
        for (let gx = x0; gx <= x1; gx++) {
          const idx = gy * GW + gx;
          (grid[idx] || (grid[idx] = [])).push(i);
        }
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    const img = g.createImageData(W, H), data = img.data;
    const surf = this.surf = new Uint8Array(W * H);
    const distF = new Float32Array(W * H);
    const patches = def.patches || [];
    const WHITE = [250, 250, 250], BLACK = [20, 20, 20];

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = y * W + x, px = x + 0.5, py = y + 0.5;
        const cell = grid[((y / CS) | 0) * GW + ((x / CS) | 0)];
        let best = Infinity, bi = -1, bu = 0, bs = 0;
        if (cell) {
          for (let c = 0; c < cell.length; c++) {
            const i = cell[c], a = pts[i], b = pts[(i + 1) % n];
            const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
            let u = l2 > 0 ? ((px - a.x) * dx + (py - a.y) * dy) / l2 : 0;
            if (u < 0) u = 0; else if (u > 1) u = 1;
            const qx = a.x + dx * u - px, qy = a.y + dy * u - py, d2 = qx * qx + qy * qy;
            if (d2 < best) { best = d2; bi = i; bu = u; bs = dx * (py - a.y) - dy * (px - a.x); }
          }
        }
        const d = bi >= 0 ? Math.sqrt(best) : 9999;
        distF[p] = d;
        const h = RR.hash2(x, y);
        let s, col;
        if (d <= hw) {
          const along = (bi + bu) * path.step, tt = along / path.length;
          s = SURF.ROAD;
          for (let k = 0; k < patches.length; k++) {
            if (inRange(tt, patches[k].from, patches[k].to)) s = patches[k].type === 'ice' ? SURF.ICE : SURF.SAND;
          }
          if (s === SURF.SAND) col = noisy(theme.sand, h, 12);
          else if (s === SURF.ICE) col = h > 0.93 ? [236, 250, 255] : noisy(theme.ice, h, 5);
          else col = noisy(theme.road, h, theme.roadNoise || 7);
          if (s === SURF.ROAD && d < 1.1 && Math.floor(along / 10) % 2 === 0) col = theme.line;
          // checkered start/finish line just before the first point
          const rel = along > path.length / 2 ? along - path.length : along;
          if (rel >= -12 && rel < 0) {
            const lat = bs > 0 ? d : -d;
            const ca = Math.floor((rel + 12) / 4), cb = Math.floor((lat + hw) / 4);
            col = (ca + cb) % 2 === 0 ? WHITE : BLACK;
          }
        } else if (d <= hw + CURB) {
          s = SURF.CURB;
          col = Math.floor(((bi + bu) * path.step) / 8) % 2 === 0 ? theme.curbA : theme.curbB;
        } else {
          s = SURF.GRASS;
          col = theme.ground(x, y, h);
          if (d < hw + CURB + 1.5) col = [col[0] * 0.65, col[1] * 0.65, col[2] * 0.65];
        }
        surf[p] = s;
        const o = p * 4;
        data[o] = col[0]; data[o + 1] = col[1]; data[o + 2] = col[2]; data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    this.canvas = canvas;

    const spotAt = (t, off) => {
      const q = pts[Math.round(t * n) % n], o = off * hw;
      return { x: q.x - Math.sin(q.a) * o, y: q.y + Math.cos(q.a) * o, a: q.a };
    };

    // Boost pads (baked into the artwork).
    this.pads = (def.pads || []).map((pd) => spotAt(pd[0], pd[1] || 0));
    for (const pad of this.pads) {
      g.save();
      g.translate(Math.round(pad.x), Math.round(pad.y));
      g.rotate(pad.a);
      g.fillStyle = '#ff8a1a'; g.fillRect(-11, -8, 22, 16);
      g.fillStyle = '#1b1b24'; g.fillRect(-10, -7, 20, 14);
      g.fillStyle = '#ffd23a';
      for (const ox of [-6, 1]) {
        for (let j = 0; j < 5; j++) { g.fillRect(ox + j, -5 + j, 2, 1); g.fillRect(ox + j, 4 - j, 2, 1); }
      }
      g.restore();
    }

    // Item box spots: rows of three across the road.
    this.boxSpots = [];
    for (const t of def.boxes || []) {
      for (const f of [-0.5, 0, 0.5]) this.boxSpots.push(spotAt(t, f));
    }

    // Checkpoint gates, evenly spaced. Gate 0 is the finish line.
    const every = Math.max(6, Math.round(90 / path.step));
    this.gates = [];
    for (let k = 0; k <= n - every * 0.6; k += every) this.gates.push({ i: k, x: pts[k].x, y: pts[k].y, a: pts[k].a });
    this.gateRadius = hw + 30;
    this.gateSpacing = every * path.step;

    // Scenery, scattered deterministically away from the road.
    const rnd = RR.rng(RR.hashStr(def.id));
    const decor = [], sc = def.scatter || { count: 0, types: [] };
    let tries = 0;
    while (decor.length < sc.count && tries < sc.count * 80) {
      tries++;
      const type = sc.types[Math.floor(rnd() * sc.types.length)];
      const info = RR.sprites.DECOR[type];
      const x = Math.round(10 + rnd() * (W - 20)), y = Math.round(30 + rnd() * (H - 38));
      const seed = rnd();
      if (distF[y * W + x] < hw + CURB + 10 + Math.max(3, info.r)) continue;
      let ok = true;
      for (const o of decor) if (RR.dist2(o.x, o.y, x, y) < 16 * 16) { ok = false; break; }
      if (!ok) continue;
      decor.push({ type: type, x: x, y: y, r: info.r, seed: seed });
    }
    decor.sort((a, b) => a.y - b.y);
    for (const d of decor) RR.sprites.DECOR[d.type].draw(g, d.x, d.y, d.seed);
    this.decor = decor;
    this.solids = decor.filter((d) => d.r > 0);
  }

  Track.prototype.surfaceAt = function (x, y) {
    const xi = x | 0, yi = y | 0;
    if (xi < 0 || yi < 0 || xi >= RR.W || yi >= RR.H) return SURF.GRASS;
    return this.surf[yi * RR.W + xi];
  };

  // Nearest centerline index; searches only near `guess` when given.
  Track.prototype.nearestIndex = function (x, y, guess, win) {
    const n = this.n, pts = this.pts;
    let best = Infinity, bi = 0;
    if (guess == null || guess < 0) {
      for (let i = 0; i < n; i++) {
        const d = RR.dist2(x, y, pts[i].x, pts[i].y);
        if (d < best) { best = d; bi = i; }
      }
      return bi;
    }
    for (let k = -win; k <= win; k++) {
      const i = (((guess + k) % n) + n) % n;
      const d = RR.dist2(x, y, pts[i].x, pts[i].y);
      if (d < best) { best = d; bi = i; }
    }
    return bi;
  };

  Track.prototype.thumb = function (w, h) {
    if (!this._thumb) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.drawImage(this.canvas, 0, 0, w, h);
      this._thumb = c;
    }
    return this._thumb;
  };

  const cache = {};
  RR.getTrack = function (index) {
    const def = RR.TRACKS[index] || RR.TRACKS[0];
    if (!cache[def.id]) cache[def.id] = new Track(def);
    return cache[def.id];
  };
})(window.RR);
