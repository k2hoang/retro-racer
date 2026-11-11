/* Retro Racer - shared UI drawing: panels, menus, HUD, countdown and banners. */
(function (RR) {
  'use strict';

  const ui = RR.ui = {};
  const F = RR.font;
  const RANK_COLORS = ['#ffd23a', '#d8dce8', '#e09a5a', '#a0a6c8'];

  ui.rankColor = (r) => RANK_COLORS[r - 1] || '#a0a6c8';

  ui.panel = function (ctx, x, y, w, h, border) {
    ctx.fillStyle = 'rgba(8,8,26,0.9)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = border || '#6ad1ff';
    ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y + h - 2, w, 2);
    ctx.fillRect(x, y, 2, h); ctx.fillRect(x + w - 2, y, 2, h);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + 2, y + 2, w - 4, 1);
  };

  ui.dim = function (ctx, alpha) {
    ctx.fillStyle = 'rgba(0,0,20,' + (alpha == null ? 0.45 : alpha) + ')';
    ctx.fillRect(0, 0, RR.W, RR.H);
  };

  // Vertical menu with a bouncing > cursor < on the selected line.
  ui.menu = function (ctx, items, sel, cx, y, t, scale, gap) {
    scale = scale || 2; gap = gap || 20;
    items.forEach((label, i) => {
      const on = i === sel, yy = y + i * gap;
      F.draw(ctx, label, cx, yy, { align: 'center', scale: scale, color: on ? '#ffe95a' : '#a0a6c8' });
      if (on) {
        const w = F.measure(label, scale), bob = Math.floor(t * 4) % 2 * scale;
        F.draw(ctx, '>', cx - w / 2 - 8 * scale - bob, yy, { scale: scale, color: '#ffe95a' });
        F.draw(ctx, '<', cx + w / 2 + 3 * scale + bob, yy, { scale: scale, color: '#ffe95a' });
      }
    });
  };

  ui.itemSlot = function (ctx, x, y, car, t) {
    ctx.fillStyle = '#c8c8e0'; ctx.fillRect(x, y, 18, 18);
    ctx.fillStyle = '#000000'; ctx.fillRect(x + 1, y + 1, 16, 16);
    let item = car.item;
    if (car.itemRoll > 0) item = RR.sprites.ITEM_NAMES[Math.floor(t * 14) % 3];
    if (item) RR.sprites.icon(ctx, item, x + 9, y + 9, 1);
  };

  ui.hud = function (ctx, race, t) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, RR.W, RR.HUD_H);
    const humans = race.cars.filter((c) => c.human);
    humans.forEach((car, k) => {
      const lapTxt = car.finished ? 'DONE!' : 'LAP ' + Math.min(car.lapsDone + 1, race.laps) + '/' + race.laps;
      const pos = RR.ordinal(car.rank);
      if (k === 0) {
        ui.itemSlot(ctx, 1, 1, car, t);
        F.draw(ctx, car.name, 23, 2, { color: car.colorHex });
        F.draw(ctx, lapTxt, 23, 11);
        F.draw(ctx, pos, 76, 3, { scale: 2, color: ui.rankColor(car.rank) });
      } else {
        ui.itemSlot(ctx, RR.W - 19, 1, car, t);
        F.draw(ctx, car.name, RR.W - 23, 2, { color: car.colorHex, align: 'right' });
        F.draw(ctx, lapTxt, RR.W - 23, 11, { align: 'right' });
        F.draw(ctx, pos, RR.W - 76, 3, { scale: 2, color: ui.rankColor(car.rank), align: 'right' });
      }
    });
    F.draw(ctx, RR.fmtTime(race.raceTime), RR.W / 2, 3, { align: 'center', scale: 2 });
    if (humans.length < 2) {
      F.draw(ctx, 'RECORD', RR.W - 4, 2, { align: 'right', color: '#a0a6c8' });
      F.draw(ctx, race.record ? RR.fmtTime(race.record.time) : '-:--.--', RR.W - 4, 11, { align: 'right', color: '#ffe95a' });
    }
  };

  ui.raceOverlay = function (ctx, race) {
    const cx = RR.W / 2;
    if (race.state === 'countdown') {
      const c = Math.ceil(race.countdown);
      if (c >= 4) {
        F.draw(ctx, 'GET READY!', cx, 160, { align: 'center', scale: 4 });
      } else if (c > 0) {
        const colors = { 3: '#ff5a5a', 2: '#ffb43a', 1: '#ffe95a' };
        const frac = race.countdown - Math.floor(race.countdown);
        const sc = 8 + Math.round(frac * 4);
        F.draw(ctx, String(c), cx, 180 - sc * 3.5, { align: 'center', scale: sc, color: colors[c], shadow: '#000000' });
      }
    } else if (race.goFlash > 0) {
      F.draw(ctx, 'GO!', cx, 145, { align: 'center', scale: 10, color: '#5aff7a' });
    }
    const sc = race.humanCount > 1 ? 3 : 4;
    race.banners.forEach((b, i) => {
      if (b.t < 0.15 && Math.floor(b.t * 30) % 2 === 0) return;
      F.draw(ctx, b.text, cx, 110 + i * 34, { align: 'center', scale: sc, color: b.color });
    });
  };
})(window.RR);
