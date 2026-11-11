/* Retro Racer - pixel-art sprites drawn in code: cars, item icons, item boxes and scenery. */
(function (RR) {
  'use strict';

  // Car faces right (+x). 16 x 10 pixels.
  const CAR_MAP = [
    '..kkk.....kkk...',
    '.oooooooooooooo.',
    'orbbbbbbbwwbbbyo',
    'obbwbbbbbwwbbbbo',
    'obbwlllllwwllllo',
    'obbwlllllwwllllo',
    'obbwbbbbbwwbbbbo',
    'orbbbbbbbwwbbbyo',
    '.oooooooooooooo.',
    '..kkk.....kkk...'
  ];

  const ICONS = {
    turbo: {
      map: ['...yyyy', '..yyyy.', '.yyyy..', 'yyyyyyy', '...yyy.', '..yyy..', '.yyy...', 'yy.....'],
      pal: { y: '#ffd23a' }
    },
    oil: {
      map: ['..kkkk..', '.kkpkkk.', 'kkpkkkkk', 'kkkkkkpk', '.kkkkkk.', '..kk.k..'],
      pal: { k: '#0c0a10', p: '#9a7ad0' }
    },
    shield: {
      map: ['..bbbb..', '.bwcccb.', 'bwcccccb', 'bccccccb', 'bccccccb', 'bccccccb', '.bccccb.', '..bbbb..'],
      pal: { b: '#2a5cff', c: '#7ec8ff', w: '#ffffff' }
    }
  };

  const mapCache = new Map();
  function mapCanvas(key, map, pal) {
    let c = mapCache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = map[0].length; c.height = map.length;
    const g = c.getContext('2d');
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const col = pal[map[y][x]];
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }
    mapCache.set(key, c);
    return c;
  }

  function car(hex) {
    return mapCanvas('car' + hex, CAR_MAP, {
      k: '#141418',
      o: RR.mix(hex, '#000000', 0.55),
      b: hex,
      l: RR.mix(hex, '#ffffff', 0.45),
      w: '#a8e4ff',
      y: '#fff6a0',
      r: '#ff2a2a'
    });
  }

  function icon(ctx, name, cx, cy, scale) {
    const def = ICONS[name];
    if (!def) return;
    scale = scale || 1;
    const c = mapCanvas('icon' + name, def.map, def.pal);
    const w = c.width * scale, h = c.height * scale;
    ctx.drawImage(c, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
  }

  // Crisp filled circle made of horizontal pixel rows.
  function circ(g, cx, cy, r, color) {
    if (color) g.fillStyle = color;
    cx = Math.round(cx); cy = Math.round(cy);
    for (let dy = -r; dy <= r; dy++) {
      const w = Math.round(Math.sqrt(r * r - dy * dy));
      g.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
    }
  }
  function px(g, x, y, color) { g.fillStyle = color; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
  function shadow(g, x, y, r) { circ(g, x + 2, y + 3, r, 'rgba(0,0,0,0.22)'); }

  function itemBox(ctx, x, y, t) {
    const bob = Math.round(Math.sin(t * 4 + x * 0.1) * 1);
    const hue = Math.floor((t * 140 + x * 2) % 360);
    x = Math.round(x); y = Math.round(y) + bob;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 4, y - 3, 12, 11);
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(x - 6, y - 6, 12, 12);
    ctx.fillStyle = 'hsl(' + hue + ',90%,58%)'; ctx.fillRect(x - 5, y - 5, 10, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x - 5, y - 5, 10, 2);
    RR.font.draw(ctx, '?', x - 2, y - 3, { color: '#ffffff', shadow: '#1a1a22' });
  }

  // Scenery. r = solid radius for collisions (0 = drive-through).
  const DECOR = {
    tree: { r: 5, draw(g, x, y) { shadow(g, x, y, 7); circ(g, x, y, 7, '#1c5a26'); circ(g, x - 1, y - 1, 5, '#2e8a3a'); circ(g, x - 2, y - 2, 2, '#63c55b'); } },
    bush: { r: 0, draw(g, x, y) { shadow(g, x, y, 4); circ(g, x, y, 4, '#2a7631'); circ(g, x - 1, y - 1, 2, '#4fae4a'); } },
    flower: {
      r: 0,
      draw(g, x, y, s) {
        const cols = ['#ffe14d', '#ffffff', '#ff7ab8', '#9ad0ff'];
        [[0, 0], [3, 1], [1, 3], [-2, 2], [2, -2]].forEach((o, i) => px(g, x + o[0], y + o[1], cols[(Math.floor(s * 4) + i) % 4]));
      }
    },
    rock: { r: 4, draw(g, x, y) { shadow(g, x, y, 4); circ(g, x, y, 4, '#6d6d77'); circ(g, x - 1, y - 1, 2, '#a3a3ae'); } },
    cactus: {
      r: 3,
      draw(g, x, y) {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - 3, y + 4, 9, 2);
        g.fillStyle = '#2b8a43';
        g.fillRect(x - 1, y - 7, 3, 12);
        g.fillRect(x - 4, y - 4, 2, 4); g.fillRect(x - 3, y - 1, 2, 2);
        g.fillRect(x + 3, y - 6, 2, 4); g.fillRect(x + 2, y - 3, 2, 2);
        g.fillStyle = '#5cc46a'; g.fillRect(x, y - 6, 1, 9);
      }
    },
    redrock: {
      r: 5,
      draw(g, x, y) {
        shadow(g, x, y, 5); circ(g, x, y, 5, '#9c4b32'); circ(g, x - 1, y - 1, 3, '#c7774f');
        px(g, x + 2, y + 1, '#6e3020'); px(g, x + 3, y + 2, '#6e3020');
      }
    },
    deadbush: {
      r: 0,
      draw(g, x, y) {
        [[0, 0], [1, -1], [2, -2], [-1, -1], [-2, -2], [1, 1], [-1, 1], [0, -2], [3, 0], [-3, 0]]
          .forEach((o) => px(g, x + o[0], y + o[1], '#8b6a3c'));
      }
    },
    pine: {
      r: 5,
      draw(g, x, y) {
        shadow(g, x, y, 7); circ(g, x, y, 7, '#1d4a37'); circ(g, x, y, 5, '#2a684c'); circ(g, x, y, 2, '#3e8c63');
        g.fillStyle = '#ffffff';
        [[-4, -2], [2, -5], [-1, 4], [4, 1], [0, 0]].forEach((o) => g.fillRect(x + o[0], y + o[1], 2, 1));
      }
    },
    snowman: {
      r: 4,
      draw(g, x, y) {
        shadow(g, x, y, 5); circ(g, x, y, 5, '#d8e2f2'); circ(g, x - 1, y - 1, 3, '#ffffff');
        px(g, x - 2, y - 2, '#111111'); px(g, x + 1, y - 2, '#111111');
        g.fillStyle = '#ff8a2a'; g.fillRect(x - 1, y, 3, 1);
      }
    },
    snowrock: { r: 4, draw(g, x, y) { shadow(g, x, y, 4); circ(g, x, y, 4, '#7a8192'); circ(g, x - 1, y - 2, 3, '#f4f8ff'); } },
    roof: {
      r: 8,
      draw(g, x, y, s) {
        const neon = ['#00e5ff', '#ff3cc8', '#ffe23a', '#7a5aff'][Math.floor(s * 4) % 4];
        g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x - 5, y - 5, 14, 14);
        g.fillStyle = neon; g.fillRect(x - 8, y - 8, 15, 15);
        g.fillStyle = '#231a40'; g.fillRect(x - 7, y - 7, 13, 13);
        g.fillStyle = '#4a4268'; g.fillRect(x - 3, y - 3, 5, 4);
        g.fillStyle = neon; g.fillRect(x + 3, y - 6, 2, 2);
      }
    },
    lamp: {
      r: 2,
      draw(g, x, y) {
        circ(g, x, y, 6, 'rgba(255,60,220,0.18)'); circ(g, x, y, 3, 'rgba(255,140,240,0.45)'); circ(g, x, y, 1, '#ffffff');
      }
    },
    cone: { r: 0, draw(g, x, y) { circ(g, x, y, 2, '#ff7a1a'); px(g, x, y, '#ffffff'); } }
  };

  RR.sprites = { car: car, icon: icon, itemBox: itemBox, circ: circ, DECOR: DECOR, ITEM_NAMES: Object.keys(ICONS) };
})(window.RR);
