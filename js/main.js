/* Retro Racer - game loop and screens:
 * title -> setup (each player) -> track -> options -> race -> results */
(function (RR) {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const F = RR.font, I = RR.input, ui = RR.ui;
  const sfx = (n) => RR.audio.sfx(n);

  function fit() {
    const s = Math.min(window.innerWidth / RR.W, window.innerHeight / RR.H);
    canvas.style.width = Math.floor(RR.W * s) + 'px';
    canvas.style.height = Math.floor(RR.H * s) + 'px';
  }
  window.addEventListener('resize', fit);
  fit();

  // ---------- saved profiles & settings ----------
  function loadProfiles() {
    const def = [{ name: 'RACER 1', color: 0, custom: false }, { name: 'RACER 2', color: 1, custom: false }];
    const s = RR.store.get('profiles', null);
    if (!Array.isArray(s) || s.length !== 2) return def;
    return s.map((p, i) => {
      p = p || {};
      const name = typeof p.name === 'string' ? p.name.toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().slice(0, 8) : '';
      const color = Number.isInteger(p.color) && p.color >= 0 && p.color < RR.CAR_COLORS.length ? p.color : def[i].color;
      return { name: name || def[i].name, color: color, custom: !!p.custom && !!name };
    });
  }
  function loadSettings() {
    const s = Object.assign({ trackIndex: 0, difficulty: 'easy', laps: 3 }, RR.store.get('settings', {}) || {});
    if (!(s.trackIndex >= 0 && s.trackIndex < RR.TRACKS.length)) s.trackIndex = 0;
    if (s.difficulty !== 'easy' && s.difficulty !== 'normal') s.difficulty = 'easy';
    if ([2, 3, 5].indexOf(s.laps) < 0) s.laps = 3;
    return s;
  }

  const game = RR.game = {
    t: 0, mode: 1, setupIndex: 0, debug: false, fps: 0,
    players: loadProfiles(),
    settings: loadSettings(),
    race: null, demo: null, screen: null, screenName: ''
  };
  const saveProfiles = () => RR.store.set('profiles', game.players);
  const saveSettings = () => RR.store.set('settings', game.settings);

  function makeAIRacers(count, usedColorIdx) {
    const names = RR.shuffle(RR.AI_NAMES.slice());
    const colors = RR.shuffle(RR.CAR_COLORS.map((c, i) => i).filter((i) => usedColorIdx.indexOf(i) < 0));
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push({ name: names[i % names.length], color: RR.CAR_COLORS[colors[i % colors.length]].hex, human: false });
    }
    return out;
  }
  RR.makeAIRacers = makeAIRacers;

  // ---------- screens ----------
  const screens = {};
  function go(name) {
    if (game.screen && game.screen.exit) game.screen.exit();
    game.screen = screens[name];
    game.screenName = name;
    if (game.screen.enter) game.screen.enter();
  }

  // Menus share an endless computer-only race in the background.
  function demo() {
    if (!game.demo) {
      game.demo = new RR.Race({ trackIndex: 0, laps: 999, difficulty: 'normal', demo: true, racers: makeAIRacers(4, []) });
    }
    return game.demo;
  }
  const menuBg = (dt) => demo().update(dt);
  function drawMenuBg(alpha) { demo().draw(ctx); ui.dim(ctx, alpha); }

  function drawLogo(t) {
    const words = ['RETRO', 'RACER'], cols = ['#ff4a4a', '#ff9a2a', '#ffe23a', '#4ae06a', '#4aa8ff'];
    const sc = 8, cw = 6 * sc;
    words.forEach((w, row) => {
      const total = w.length * cw - sc, x0 = RR.W / 2 - total / 2;
      for (let i = 0; i < w.length; i++) {
        const bob = Math.round(Math.sin(t * 3 + i * 0.6 + row * 1.5) * 3);
        const x = x0 + i * cw, y = 34 + row * 64 + bob;
        const col = cols[(i + row * 2) % 5];
        F.draw(ctx, w[i], x + 5, y + 5, { scale: sc, color: '#000000', shadow: false });
        F.draw(ctx, w[i], x + 2, y + 2, { scale: sc, color: RR.mix(col, '#000000', 0.45), shadow: false });
        F.draw(ctx, w[i], x, y, { scale: sc, color: col, shadow: false });
      }
    });
    // speed stripes
    for (let k = 0; k < 3; k++) {
      const off = (t * 220 + k * 60) % 140;
      ctx.fillStyle = ['#ff4a4a', '#ffe23a', '#4aa8ff'][k];
      ctx.fillRect(Math.round(130 - off), 70 + k * 12, 40, 4);
      ctx.fillRect(Math.round(470 + off), 134 + k * 12, 40, 4);
    }
  }

  screens.title = {
    enter() { this.sel = game.mode - 1; RR.audio.music('menu'); },
    update(dt) {
      menuBg(dt);
      const n = I.nav();
      if (n.up || n.down) { this.sel = 1 - this.sel; sfx('blip'); }
      if (n.confirm) { game.mode = this.sel + 1; game.setupIndex = 0; sfx('select'); go('setup'); }
    },
    draw() {
      const t = game.t;
      drawMenuBg(0.35);
      drawLogo(t);
      ui.menu(ctx, ['1 PLAYER', '2 PLAYERS'], this.sel, RR.W / 2, 196, t, 3, 32);
      ctx.fillStyle = 'rgba(0,0,20,0.7)';
      ctx.fillRect(RR.W / 2 - 150, 283, 300, 36);
      F.draw(ctx, 'ARROWS OR W S TO CHOOSE  -  ENTER TO START', RR.W / 2, 290, { align: 'center', color: '#c8d0ff' });
      if (!RR.audio.isUnlocked() && Math.floor(t * 2) % 2 === 0) {
        F.draw(ctx, 'PRESS ANY KEY FOR SOUND', RR.W / 2, 308, { align: 'center', color: '#ffe95a' });
      }
      F.draw(ctx, RR.audio.isMuted() ? 'M: SOUND OFF' : 'M: SOUND ON', RR.W - 6, 346, { align: 'right', color: '#a0a6c8' });
      F.draw(ctx, 'ESC: PAUSE IN RACE', 6, 346, { color: '#a0a6c8' });
    }
  };

  screens.setup = {
    enter() {
      I.textMode = true;
      I.takeTyped();
      const p = game.players[game.setupIndex];
      this.fresh = !p.custom;
      if (game.mode === 2 && game.setupIndex === 1 && p.color === game.players[0].color) {
        p.color = (p.color + 1) % RR.CAR_COLORS.length;
      }
    },
    exit() { I.textMode = false; },
    blocked(i) { return game.mode === 2 && game.setupIndex === 1 && i === game.players[0].color; },
    update(dt) {
      menuBg(dt);
      const p = game.players[game.setupIndex], NC = RR.CAR_COLORS.length;
      for (const ch of I.takeTyped()) {
        if (this.fresh) { p.name = ''; this.fresh = false; }
        if (ch === ' ' && (p.name.length === 0 || p.name.endsWith(' '))) continue;
        if (p.name.length < 8) { p.name += ch; sfx('type'); }
      }
      if (I.pressed('Backspace')) {
        if (this.fresh) { p.name = ''; this.fresh = false; } else p.name = p.name.slice(0, -1);
        sfx('type');
      }
      const dir = ((I.pressed('ArrowRight') || I.pressed('ArrowDown')) ? 1 : 0) - ((I.pressed('ArrowLeft') || I.pressed('ArrowUp')) ? 1 : 0);
      if (dir) {
        do { p.color = (p.color + dir + NC) % NC; } while (this.blocked(p.color));
        sfx('blip');
      }
      if (I.pressed('Enter') || I.pressed('NumpadEnter')) {
        p.name = p.name.trim();
        if (!p.name) { p.name = 'RACER ' + (game.setupIndex + 1); p.custom = false; }
        else if (!this.fresh) p.custom = true;
        saveProfiles();
        sfx('select');
        if (game.mode === 2 && game.setupIndex === 0) { game.setupIndex = 1; this.enter(); }
        else go('track');
        return;
      }
      if (I.pressed('Escape')) {
        sfx('back');
        if (game.setupIndex === 1) { game.setupIndex = 0; this.enter(); } else go('title');
      }
    },
    draw() {
      const t = game.t, idx = game.setupIndex, p = game.players[idx], col = RR.CAR_COLORS[p.color];
      drawMenuBg(0.5);
      ui.panel(ctx, 60, 26, 520, 308, idx === 0 ? '#ff6a6a' : '#6ab4ff');
      F.draw(ctx, 'PLAYER ' + (idx + 1) + ' - MAKE YOUR CAR', RR.W / 2, 40, { align: 'center', scale: 2, color: '#ffe95a' });

      F.draw(ctx, 'TYPE YOUR NAME:', 100, 76, { color: '#c8d0ff' });
      ctx.fillStyle = '#c8d0ff'; ctx.fillRect(100, 88, 200, 30);
      ctx.fillStyle = '#000000'; ctx.fillRect(102, 90, 196, 26);
      const cursor = Math.floor(t * 2.5) % 2 === 0 && p.name.length < 8 ? '_' : '';
      F.draw(ctx, p.name + cursor, 110, 96, { scale: 2, color: this.fresh ? '#8890b0' : '#ffffff' });

      // spinning car preview
      ctx.save();
      ctx.translate(470, 104);
      ctx.rotate(t * 1.2);
      ctx.scale(4, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-7, -3, 16, 9);
      ctx.drawImage(RR.sprites.car(col.hex), -8, -5);
      ctx.restore();

      F.draw(ctx, 'PICK YOUR COLOR WITH THE ARROW KEYS:', 100, 150, { color: '#c8d0ff' });
      for (let i = 0; i < RR.CAR_COLORS.length; i++) {
        const x = 100 + i * 56, y = 164;
        if (i === p.color) {
          ctx.fillStyle = Math.floor(t * 6) % 2 ? '#ffffff' : '#ffe95a';
          ctx.fillRect(x - 3, y - 3, 46, 30);
        }
        ctx.fillStyle = '#000000'; ctx.fillRect(x - 1, y - 1, 42, 26);
        ctx.fillStyle = RR.CAR_COLORS[i].hex; ctx.fillRect(x, y, 40, 24);
        if (this.blocked(i)) {
          ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, y, 40, 24);
          F.draw(ctx, 'P1', x + 20, y + 9, { align: 'center' });
        }
      }
      F.draw(ctx, col.name, 100, 198, { scale: 2, color: col.hex });

      F.draw(ctx, 'YOUR KEYS:', 100, 230, { color: '#c8d0ff' });
      let keys;
      if (game.mode === 1) keys = ['DRIVE: ARROWS OR W A S D', 'ITEM: SPACE OR ENTER'];
      else if (idx === 0) keys = ['DRIVE: W A S D', 'ITEM: SPACE (OR Q)'];
      else keys = ['DRIVE: ARROW KEYS', 'ITEM: ENTER (OR /)'];
      F.draw(ctx, keys[0], 100, 244, { scale: 2 });
      F.draw(ctx, keys[1], 100, 264, { scale: 2 });

      F.draw(ctx, 'ENTER = DONE      ESC = BACK', RR.W / 2, 310, { align: 'center', color: '#ffe95a' });
    }
  };

  screens.track = {
    enter() {
      this.sel = game.settings.trackIndex;
      this.thumbs = RR.TRACKS.map((d, i) => RR.getTrack(i).thumb(192, 108));
      this.best = RR.store.get('best', {}) || {};
    },
    update(dt) {
      menuBg(dt);
      const n = I.nav();
      let s = this.sel;
      if (n.left && s % 2 === 1) s--;
      if (n.right && s % 2 === 0 && s + 1 < RR.TRACKS.length) s++;
      if (n.up && s >= 2) s -= 2;
      if (n.down && s + 2 < RR.TRACKS.length) s += 2;
      if (s !== this.sel) { this.sel = s; sfx('blip'); }
      if (n.confirm) { game.settings.trackIndex = this.sel; saveSettings(); sfx('select'); go('options'); }
      else if (n.back) { sfx('back'); game.setupIndex = game.mode - 1; go('setup'); }
    },
    draw() {
      const t = game.t;
      drawMenuBg(0.6);
      F.draw(ctx, 'PICK A TRACK', RR.W / 2, 12, { align: 'center', scale: 3, color: '#ffe95a' });
      RR.TRACKS.forEach((def, i) => {
        const x = 112 + (i % 2) * 224, y = 46 + Math.floor(i / 2) * 150, on = i === this.sel;
        ctx.fillStyle = on ? (Math.floor(t * 5) % 2 ? '#ffe95a' : '#ffffff') : '#4a5070';
        const b = on ? 3 : 1;
        ctx.fillRect(x - b, y - b, 192 + b * 2, 108 + b * 2);
        ctx.drawImage(this.thumbs[i], x, y);
        let stars = '';
        for (let k = 0; k < def.stars; k++) stars += '*';
        F.draw(ctx, stars, x + 188, y + 4, { align: 'right', scale: 2, color: '#ffe95a' });
        F.draw(ctx, def.name, x + 96, y + 114, { align: 'center', scale: 2, color: on ? '#ffe95a' : '#ffffff' });
        const rec = this.best[def.id];
        F.draw(ctx, rec ? 'BEST LAP ' + RR.fmtTime(rec.time) + ' ' + rec.name : 'NO RECORD YET', x + 96, y + 132,
          { align: 'center', color: '#a0a6c8' });
      });
      F.draw(ctx, '* = HOW HARD     ENTER = PICK     ESC = BACK', RR.W / 2, 348, { align: 'center', color: '#c8d0ff' });
    }
  };

  screens.options = {
    enter() { this.row = 2; },
    update(dt) {
      menuBg(dt);
      const n = I.nav(), s = game.settings;
      if (n.up) { this.row = (this.row + 2) % 3; sfx('blip'); }
      if (n.down) { this.row = (this.row + 1) % 3; sfx('blip'); }
      if (n.left || n.right) {
        const d = n.right ? 1 : -1;
        if (this.row === 0) { s.difficulty = s.difficulty === 'easy' ? 'normal' : 'easy'; sfx('blip'); }
        else if (this.row === 1) {
          const L = [2, 3, 5];
          s.laps = L[(L.indexOf(s.laps) + d + L.length) % L.length];
          sfx('blip');
        }
      }
      if (n.confirm) { saveSettings(); sfx('select'); go('race'); }
      else if (n.back) { sfx('back'); go('track'); }
    },
    draw() {
      const t = game.t, s = game.settings, cx = RR.W / 2;
      drawMenuBg(0.55);
      ui.panel(ctx, 110, 50, 420, 260);
      F.draw(ctx, 'RACE SETTINGS', cx, 66, { align: 'center', scale: 3, color: '#ffe95a' });
      F.draw(ctx, 'TRACK: ' + RR.TRACKS[s.trackIndex].name, cx, 96, { align: 'center', color: '#c8d0ff' });
      const rows = [
        'DIFFICULTY: ' + (s.difficulty === 'easy' ? 'EASY' : 'NORMAL'),
        'LAPS: ' + s.laps,
        'START RACE!'
      ];
      ui.menu(ctx, rows, this.row, cx, 126, t, 2, 46);
      F.draw(ctx, s.difficulty === 'easy' ? 'SLOWER COMPUTER CARS. GRASS AND ICE ARE GENTLE.' : 'FASTER COMPUTER CARS. A REAL RACE!',
        cx, 146, { align: 'center', color: '#a0a6c8' });
      F.draw(ctx, 'LEFT / RIGHT TO CHANGE', cx, 192, { align: 'center', color: '#a0a6c8' });
      F.draw(ctx, 'ENTER = GO!      ESC = BACK', cx, 288, { align: 'center', color: '#ffe95a' });
    }
  };

  screens.race = {
    enter() {
      const s = game.settings, racers = [], used = [];
      for (let i = 0; i < game.mode; i++) {
        const p = game.players[i];
        racers.push({ name: p.name, color: RR.CAR_COLORS[p.color].hex, human: true, playerIndex: i });
        used.push(p.color);
      }
      makeAIRacers(4 - game.mode, used).forEach((r) => racers.push(r));
      game.race = new RR.Race({ trackIndex: s.trackIndex, laps: s.laps, difficulty: s.difficulty, racers: racers });
      this.paused = false;
      this.psel = 0;
      RR.audio.music(RR.TRACKS[s.trackIndex].music);
    },
    exit() { RR.audio.enginesOff(); },
    update(dt) {
      const race = game.race;
      if (this.paused) {
        const n = I.nav();
        if (n.up) { this.psel = (this.psel + 2) % 3; sfx('blip'); }
        if (n.down) { this.psel = (this.psel + 1) % 3; sfx('blip'); }
        if (I.pressed('Escape') || I.pressed('KeyP')) { this.paused = false; sfx('blip'); return; }
        if (n.confirm) {
          sfx('select');
          if (this.psel === 0) this.paused = false;
          else if (this.psel === 1) { RR.audio.enginesOff(); this.enter(); }
          else go('title');
        }
        return;
      }
      if ((I.pressed('Escape') || I.pressed('KeyP')) && race.state !== 'done') {
        this.paused = true; this.psel = 0;
        RR.audio.enginesOff(); sfx('blip');
        return;
      }
      race.update(dt);
      for (const c of race.cars) if (c.human) RR.audio.engine(c.playerIndex, true, c.speed, c.throttle);
      if (race.state === 'done') go('results');
    },
    draw() {
      const race = game.race;
      race.draw(ctx);
      ui.hud(ctx, race, game.t);
      ui.raceOverlay(ctx, race);
      if (this.paused) {
        ui.dim(ctx, 0.5);
        ui.panel(ctx, 210, 110, 220, 140);
        F.draw(ctx, 'PAUSED', RR.W / 2, 124, { align: 'center', scale: 3, color: '#ffe95a' });
        ui.menu(ctx, ['RESUME', 'RESTART', 'QUIT'], this.psel, RR.W / 2, 160, game.t, 2, 24);
      }
    }
  };

  screens.results = {
    enter() {
      const race = game.race;
      this.sel = 0;
      this.list = race.standings || race.computeStandings();
      this.humanWon = this.list[0].human;
      RR.audio.enginesOff();
      RR.audio.music('menu');
      if (this.humanWon) race.confetti(RR.W / 2, 30, 120);
    },
    update(dt) {
      const race = game.race;
      race.update(dt);
      if (this.humanWon && Math.random() < 0.2) race.confetti(Math.random() * RR.W, 0, 3);
      const n = I.nav();
      if (n.up) { this.sel = (this.sel + 2) % 3; sfx('blip'); }
      if (n.down) { this.sel = (this.sel + 1) % 3; sfx('blip'); }
      if (n.confirm) {
        sfx('select');
        go(['race', 'track', 'title'][this.sel]);
      }
    },
    draw() {
      const race = game.race, t = game.t, cx = RR.W / 2;
      race.draw(ctx);
      ui.dim(ctx, 0.35);
      ui.panel(ctx, 100, 18, 440, 326, '#ffd23a');
      F.draw(ctx, 'RESULTS', cx, 30, { align: 'center', scale: 3, color: '#ffe95a' });
      F.draw(ctx, race.track.def.name + ' - ' + race.laps + ' LAPS - ' + race.difficulty.toUpperCase(), cx, 56,
        { align: 'center', color: '#a0a6c8' });

      this.list.forEach((car, i) => {
        const y = 72 + i * 28;
        if (car.human) { ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(110, y - 4, 420, 24); }
        F.draw(ctx, RR.ordinal(i + 1), 120, y + 1, { scale: 2, color: ui.rankColor(i + 1) });
        ctx.drawImage(car.sprite, 172, y - 2, 32, 20);
        F.draw(ctx, car.name, 214, y + 1, { scale: 2, color: car.human ? car.colorHex : '#ffffff' });
        F.draw(ctx, car.finished ? RR.fmtTime(car.finishTime) : '--', 520, y + 1, { align: 'right', scale: 2, color: '#c8d0ff' });
      });

      let y = 190;
      for (const car of race.cars) {
        if (!car.human) continue;
        F.draw(ctx, car.name + ' BEST LAP: ' + RR.fmtTime(car.bestLap), cx, y, { align: 'center', color: car.colorHex });
        if (car.newRecord && Math.floor(t * 3) % 2 === 0) {
          F.draw(ctx, 'NEW TRACK RECORD!', cx, y + 10, { align: 'center', color: '#ffe95a' });
        }
        y += 22;
      }
      if (race.record) {
        F.draw(ctx, 'TRACK RECORD: ' + RR.fmtTime(race.record.time) + ' BY ' + race.record.name, cx, 238,
          { align: 'center', color: '#a0a6c8' });
      }
      ui.menu(ctx, ['RACE AGAIN', 'CHANGE TRACK', 'MAIN MENU'], this.sel, cx, 260, t, 2, 24);
      race.drawParticles(ctx);
    }
  };

  // ---------- main loop ----------
  function tick(dt) {
    game.t += dt;
    if (!I.textMode && I.pressed('KeyM')) RR.audio.toggleMute();
    if (I.pressed('F3')) game.debug = !game.debug;
    game.screen.update(dt);
    I.endTick();
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    game.screen.draw();
    if (game.debug) F.draw(ctx, game.fps + ' FPS', 4, RR.H - 10, { color: '#00ff00' });
  }

  let last = performance.now(), acc = 0, frames = 0, fpsT = 0;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    let steps = 0;
    while (acc >= RR.DT && steps < 8) { tick(RR.DT); acc -= RR.DT; steps++; }
    if (steps >= 8) acc = 0;
    render();
    frames++; fpsT += dt;
    if (fpsT >= 1) { game.fps = frames; frames = 0; fpsT = 0; }
    requestAnimationFrame(frame);
  }

  // ---------- self test (open index.html?selftest) ----------
  function runSelfTest() {
    const out = [];
    RR.TRACKS.forEach((def, i) => {
      const t0 = performance.now();
      const tr = RR.getTrack(i);
      const buildMs = performance.now() - t0;
      const race = new RR.Race({ trackIndex: i, laps: 2, difficulty: 'normal', silent: true, racers: makeAIRacers(4, []) });
      let steps = 0;
      while (race.state !== 'done' && steps < 60 * 240) { race.update(RR.DT); steps++; }
      const nan = race.cars.some((c) => !isFinite(c.x) || !isFinite(c.y));
      out.push(def.name + ': build=' + buildMs.toFixed(0) + 'ms pts=' + tr.n + ' gates=' + tr.gates.length +
        ' solids=' + tr.solids.length + ' decor=' + tr.decor.length + ' state=' + race.state +
        ' time=' + race.raceTime.toFixed(1) + 's nan=' + nan + ' items=' + JSON.stringify(race.stats));
      race.cars.forEach((c) => out.push('    ' + c.name + ': laps=' + c.lapsDone + ' place=' + c.place +
        ' finish=' + (c.finishTime ? c.finishTime.toFixed(1) : '-') + ' best=' + (c.bestLap ? c.bestLap.toFixed(2) : '-') +
        ' respawns=' + c.respawns));
    });
    // Rule checks with a human car that nobody is steering.
    const human = [{ name: 'TEST', color: '#e8403a', human: true, playerIndex: 0 }];
    let r = new RR.Race({ trackIndex: 0, laps: 3, difficulty: 'easy', silent: true, racers: human.concat(makeAIRacers(3, [0])) });
    while (r.state === 'countdown') r.update(RR.DT);
    const me = r.cars[0];
    me.x = 320; me.y = 180; me.vx = me.vy = 0;              // middle of the infield, parked
    for (let i = 0; i < 60 * 3; i++) r.update(RR.DT);
    out.push('CHECK stuck-on-grass respawn: ' + (me.respawns === 1 && r.track.surfaceAt(me.x, me.y) !== RR.SURF.GRASS ? 'PASS' : 'FAIL respawns=' + me.respawns));

    r = new RR.Race({ trackIndex: 0, laps: 3, difficulty: 'easy', silent: true, racers: human });
    while (r.state === 'countdown') r.update(RR.DT);
    const c0 = r.cars[0], G = r.track.gates;
    const half = G[Math.floor(G.length / 2)];
    c0.x = half.x; c0.y = half.y; c0.ghost = 1;            // teleport = a huge shortcut
    r.update(RR.DT);
    out.push('CHECK shortcut ignored: ' + (c0.nextCp === 1 && c0.lost ? 'PASS' : 'FAIL nextCp=' + c0.nextCp + ' lost=' + c0.lost));
    for (let k = 1; k <= G.length; k++) { const g = G[k % G.length]; c0.x = g.x; c0.y = g.y; c0.vx = c0.vy = 0; r.update(RR.DT); }
    out.push('CHECK full lap counts: ' + (c0.lapsDone === 1 ? 'PASS' : 'FAIL lapsDone=' + c0.lapsDone));

    // Hold W like a kid would and check the top speed is respected.
    r = new RR.Race({ trackIndex: 0, laps: 3, difficulty: 'easy', silent: true, racers: human });
    while (r.state === 'countdown') r.update(RR.DT);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' }));
    let top = 0;
    for (let i = 0; i < 60 * 2; i++) { r.update(RR.DT); if (r.cars[0].turbo <= 0) top = Math.max(top, r.cars[0].speed); }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w' }));
    out.push('CHECK held throttle top speed ' + top.toFixed(1) + ' <= ' + RR.CAR_PHYS.maxSpeed + ': ' + (top > 100 && top <= RR.CAR_PHYS.maxSpeed + 0.5 ? 'PASS' : 'FAIL'));

    // Two autopilot "humans" on easy (same setup as ?view=results).
    r = new RR.Race({ trackIndex: 0, laps: 3, difficulty: 'easy', silent: true,
      racers: [{ name: 'P1', color: '#e8403a', human: true, playerIndex: 0 }, { name: 'P2', color: '#3a7ce8', human: true, playerIndex: 1 }].concat(makeAIRacers(2, [0, 1])) });
    r.autopilot = true;
    let guard = 0;
    while (r.state !== 'done' && guard++ < 60 * 200) r.update(RR.DT);
    r.cars.forEach((c) => out.push('AUTOPILOT ' + c.name + ' laps=' + c.lapTimes.map((x) => x.toFixed(2)).join(',') + ' respawns=' + c.respawns));

    const pre = document.createElement('pre');
    pre.id = 'selftest';
    pre.textContent = 'SELFTEST\n' + out.join('\n');
    document.body.appendChild(pre);
  }

  if (/[?&]selftest/.test(location.search)) runSelfTest();
  go('title');

  // Dev preview: index.html?view=race&track=2&secs=5 jumps into a race on autopilot, or
  // ?view=setup|track|options|results shows that screen (used for screenshots).
  const params = new URLSearchParams(location.search);
  const view = params.get('view');
  if (view && screens[view]) {
    game.mode = 2;
    game.settings.trackIndex = RR.clamp(parseInt(params.get('track') || '0', 10) || 0, 0, RR.TRACKS.length - 1);
    if (view === 'race' || view === 'results') {
      go('race');
      game.race.autopilot = true;
      const secs = parseFloat(params.get('secs') || '5');
      for (let i = 0; i < secs * 60; i++) game.race.update(RR.DT);
      if (view === 'results') {
        while (game.race.state !== 'done' && game.race.t < 200) game.race.update(RR.DT);
        go('results');
      }
    } else {
      go(view);
    }
  }
  requestAnimationFrame(frame);
})(window.RR);
