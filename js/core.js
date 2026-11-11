/* Retro Racer - shared namespace, constants and small helpers. */
window.RR = window.RR || {};
(function (RR) {
  'use strict';

  RR.W = 640;          // internal resolution (scaled up to fit the window)
  RR.H = 360;
  RR.DT = 1 / 60;      // fixed physics step
  RR.HUD_H = 20;

  RR.clamp = (v, a, b) => (v < a ? a : (v > b ? b : v));
  RR.lerp = (a, b, t) => a + (b - a) * t;
  RR.wrapAngle = (a) => {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };
  RR.dist = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); };
  RR.dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };

  // Small deterministic random generator (xorshift32).
  RR.rng = (seed) => {
    let s = (seed >>> 0) || 0x9e3779b9;
    return () => {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  };
  RR.hashStr = (str) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  // Stable per-pixel noise in [0,1).
  RR.hash2 = (x, y) => {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  RR.shuffle = (arr, rnd) => {
    rnd = rnd || Math.random;
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };

  // Colors
  RR.hexToRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  RR.rgbToHex = (r, g, b) => '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  RR.mix = (hexA, hexB, t) => {
    const a = RR.hexToRgb(hexA), b = RR.hexToRgb(hexB);
    return RR.rgbToHex(
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t));
  };

  RR.CAR_COLORS = [
    { name: 'RED', hex: '#e8403a' },
    { name: 'BLUE', hex: '#3a7ce8' },
    { name: 'GREEN', hex: '#38c24a' },
    { name: 'YELLOW', hex: '#f2d03a' },
    { name: 'PURPLE', hex: '#9a4ae0' },
    { name: 'ORANGE', hex: '#f2882a' },
    { name: 'PINK', hex: '#f26ab4' },
    { name: 'WHITE', hex: '#e8e8f0' }
  ];

  RR.AI_NAMES = ['ZOOMER', 'TURBO TACO', 'BEEP BEEP', 'DASHER', 'NITRO NED', 'SPEEDY', 'ROCKET', 'VROOMBA'];

  RR.ordinal = (n) => ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH'][n - 1] || (n + 'TH');

  RR.fmtTime = (t) => {
    if (t == null || !isFinite(t)) return '-:--.--';
    const cs = Math.max(0, Math.round(t * 100));
    const m = Math.floor(cs / 6000), s = Math.floor(cs / 100) % 60, c = cs % 100;
    return m + ':' + (s < 10 ? '0' : '') + s + '.' + (c < 10 ? '0' : '') + c;
  };
})(window.RR);
