/* Retro Racer - one race: grid, countdown, laps via checkpoint gates, positions,
 * collisions, respawns, particles and finishing order. */
(function (RR) {
  'use strict';

  function Race(opts) {
    this.opts = opts;
    this.trackIndex = opts.trackIndex;
    this.track = RR.getTrack(opts.trackIndex);
    this.laps = opts.laps || 3;
    this.difficulty = opts.difficulty || 'easy';
    this.demo = !!opts.demo;       // title-screen attract mode: endless, silent
    this.silent = !!opts.silent || this.demo;

    this.state = this.demo ? 'racing' : 'countdown';  // countdown -> racing -> ending -> done
    this.countdown = 4.0;
    this.lastCount = 4;
    this.goFlash = 0;
    this.raceTime = 0;
    this.t = 0;
    this.finishCount = 0;
    this.endTimer = 0;
    this.waitTimer = 0;
    this.autopilot = false;
    this.standings = null;
    this.particles = [];
    this.banners = [];
    this.stats = { pickups: 0, used: 0, spins: 0, blocks: 0 };

    this.marks = document.createElement('canvas');
    this.marks.width = RR.W; this.marks.height = RR.H;
    this.mctx = this.marks.getContext('2d');

    const tr = this.track, n = tr.n;
    this.cars = [];
    this.humanCount = 0;
    opts.racers.forEach((r, i) => {
      const car = new RR.Car({ name: r.name, color: r.color, human: r.human, playerIndex: r.playerIndex, index: i });
      const row = Math.floor(i / 2), side = i % 2 === 0 ? -1 : 1;
      const k = (((n - 6 - row * 7) % n) + n) % n, p = tr.pts[k], off = side * tr.hw * 0.45;
      car.x = p.x - Math.sin(p.a) * off;
      car.y = p.y + Math.cos(p.a) * off;
      car.a = p.a;
      car.aiIdx = k;
      if (car.human) { this.humanCount++; car.easy = this.difficulty === 'easy'; }
      const base = this.difficulty === 'easy' ? 0.8 : 0.92;
      car.skill = car.human ? 1 : base + Math.random() * 0.04 - i * 0.006;
      car.laneOffset = (Math.random() - 0.5) * 0.7;
      car.lanePhase = Math.random() * 6;
      this.cars.push(car);
    });
    this.items = new RR.Items(this);
    this.record = this.demo ? null : (RR.store.get('best', {})[tr.def.id] || null);
    this.updateRanks();
  }

  Race.prototype.sfx = function (name) { if (!this.silent && RR.audio) RR.audio.sfx(name); };

  Race.prototype.banner = function (text, color, dur) {
    this.banners.push({ text: text, color: color || '#ffffff', t: 0, dur: dur || 2 });
    if (this.banners.length > 3) this.banners.shift();
  };

  Race.prototype.humanControls = function (car) {
    const k = RR.input.controls(car.playerIndex, this.humanCount === 1);
    return { throttle: k.up ? 1 : (k.down ? -1 : 0), steer: (k.right ? 1 : 0) - (k.left ? 1 : 0), item: k.item };
  };

  Race.prototype.update = function (dt) {
    this.t += dt;
    this.updateParticles(dt);
    this.banners = this.banners.filter((b) => (b.t += dt) < b.dur);
    if (this.goFlash > 0) this.goFlash -= dt;

    if (this.state === 'countdown') {
      this.countdown -= dt;
      const c = Math.ceil(this.countdown);
      if (c !== this.lastCount) {
        this.lastCount = c;
        if (c > 0) this.sfx('count');
        else { this.state = 'racing'; this.goFlash = 0.8; this.sfx('go'); }
      }
      return;
    }
    if (this.state === 'racing' || this.state === 'ending') this.raceTime += dt;

    const tr = this.track, N = tr.gates.length;
    let humanBest = -Infinity;
    for (const c of this.cars) if (c.human) humanBest = Math.max(humanBest, c.progress);

    for (const car of this.cars) {
      // Computer cars ease off a little when far ahead of the humans, and push a bit when far behind.
      if (!car.human) {
        const diffL = this.humanCount ? (car.progress - humanBest) / N : 0;
        const target = diffL > 0.3 ? 0.9 : (diffL < -0.35 ? 1.06 : 1);
        car.rubber += (target - car.rubber) * Math.min(1, dt * 0.5);
        car.maxMul = car.skill * car.rubber;
      } else {
        car.maxMul = (car.finished || this.autopilot) ? 0.9 : 1;
      }

      const ctrl = (car.human && !car.finished && !this.autopilot) ? this.humanControls(car) : RR.ai.control(car, this, dt);
      if (ctrl.item) this.items.use(car);

      if (car.itemRoll > 0) car.itemRoll -= dt;
      if (car.shield > 0) car.shield -= dt;
      if (car.ghost > 0) car.ghost -= dt;
      if (car.padCool > 0) car.padCool -= dt;

      const hit = car.physics(ctrl, tr, dt);
      if (car.bumped) { car.bumped = false; if (car.human) this.sfx('bump'); }
      this.checkGates(car);
      this.checkStuck(car, dt, hit);
      this.effects(car);
    }
    this.collide();
    this.items.update(dt);
    this.updateRanks();

    if (!this.demo && this.state === 'racing') {
      const humans = this.cars.filter((c) => c.human);
      const pool = humans.length ? humans : this.cars;
      if (pool.every((c) => c.finished)) { this.state = 'ending'; this.endTimer = 3; }
      else if (humans.some((c) => c.finished)) {
        this.waitTimer += dt;   // 2 players: wait up to 30s for the second one
        if (this.waitTimer > 30) { this.state = 'ending'; this.endTimer = 1.5; }
      }
    }
    if (this.state === 'ending') {
      this.endTimer -= dt;
      if (this.endTimer <= 0) {
        this.state = 'done';
        this.autopilot = true;
        this.standings = this.computeStandings();
      }
    }
  };

  // A lap only counts when every gate is driven through in order (one missed gate is forgiven).
  Race.prototype.checkGates = function (car) {
    const tr = this.track, g = tr.gates, N = g.length, R2 = tr.gateRadius * tr.gateRadius;
    for (let tries = 0; tries < 2; tries++) {
      const gi = (car.nextCp + tries) % N;
      if (RR.dist2(car.x, car.y, g[gi].x, g[gi].y) < R2) {
        for (let k = 0; k <= tries; k++) this.passGate(car, car.nextCp);
        break;
      }
    }
    const ng = g[car.nextCp];
    car.lost = RR.dist(car.x, car.y, ng.x, ng.y) > tr.gateSpacing + tr.gateRadius + 40;
  };

  Race.prototype.passGate = function (car, idx) {
    const N = this.track.gates.length;
    car.nextCp = (idx + 1) % N;
    if (idx !== 0) return;

    car.lapsDone++;
    const lt = this.raceTime - car.lapStart;
    car.lapStart = this.raceTime;
    car.lapTimes.push(lt);
    if (car.bestLap == null || lt < car.bestLap) car.bestLap = lt;
    if (car.human && !this.silent && this.state !== 'done' && !this.autopilot &&
        (this.record == null || lt < this.record.time)) {
      this.record = { time: lt, name: car.name };
      car.newRecord = true;
      const all = RR.store.get('best', {});
      all[this.track.def.id] = this.record;
      RR.store.set('best', all);
    }
    if (car.finished || this.demo || this.state === 'done') return;
    if (car.lapsDone >= this.laps) this.finish(car);
    else if (car.human && this.state === 'racing') {
      const who = this.humanCount > 1 ? car.name + ': ' : '';
      if (car.lapsDone === this.laps - 1) { this.banner(who + 'FINAL LAP!', '#ff5a5a'); this.sfx('final'); }
      else { this.banner(who + 'LAP ' + (car.lapsDone + 1), '#ffffff', 1.4); this.sfx('lap'); }
    }
  };

  Race.prototype.finish = function (car) {
    car.finished = true;
    car.finishTime = this.raceTime;
    car.place = ++this.finishCount;
    if (car.human) {
      const who = this.humanCount > 1 ? car.name + ' ' : '';
      this.banner(who + RR.ordinal(car.place) + ' PLACE!', car.place === 1 ? '#ffd23a' : '#7ee0ff', 3);
      this.sfx(car.place === 1 ? 'win' : 'finish');
      this.confetti(car.x, car.y, car.place === 1 ? 80 : 30);
    }
  };

  Race.prototype.checkStuck = function (car, dt, hit) {
    if (car.spin > 0 || car.ghost > 0) { car.stuck = 0; return; }
    const off = car.surface === RR.SURF.GRASS;
    const slow = Math.abs(car.speed) < 15;
    if (slow && (off || hit)) car.stuck += dt;
    else car.stuck = Math.max(0, car.stuck - dt * 2);
    car.offroad = off ? car.offroad + dt : 0;
    if (car.stuck > 2 || car.offroad > 7) this.respawn(car);
  };

  // Put the car back on the road at the last gate it passed.
  Race.prototype.respawn = function (car) {
    const tr = this.track, g = tr.gates, N = g.length, gate = g[(car.nextCp - 1 + N) % N];
    const off = ((car.index % 3) - 1) * tr.hw * 0.4;
    car.x = gate.x - Math.sin(gate.a) * off;
    car.y = gate.y + Math.cos(gate.a) * off;
    car.a = gate.a;
    car.vx = 0; car.vy = 0; car.speed = 0; car.lat = 0;
    car.spin = 0; car.stuck = 0; car.offroad = 0; car.ghost = 1.5;
    car.aiIdx = gate.i;
    car.respawns++;
    this.sparkle(car.x, car.y, '#ffffff', 14);
    if (car.human) this.sfx('respawn');
  };

  Race.prototype.collide = function () {
    const cars = this.cars, D = RR.CAR_PHYS.radius * 2, D2 = D * D;
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i], b = cars[j];
        if (a.ghost > 0 || b.ghost > 0) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 >= D2 || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, push = (D - d) / 2;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel < 0) {
          const imp = -rel * 0.75;
          a.vx -= imp * nx; a.vy -= imp * ny;
          b.vx += imp * nx; b.vy += imp * ny;
          if (-rel > 50 && (a.human || b.human)) this.sfx('bump');
        }
      }
    }
  };

  Race.prototype.effects = function (car) {
    const c = Math.cos(car.a), s = Math.sin(car.a), theme = this.track.theme;
    if (Math.abs(car.lat) > 32 && car.surface !== RR.SURF.GRASS) {
      this.mctx.fillStyle = theme.skid;
      for (const side of [-4, 4]) {
        const wx = car.x - c * 6 - s * side, wy = car.y - s * 6 + c * side;
        this.mctx.fillRect(Math.round(wx) - 1, Math.round(wy) - 1, 2, 2);
      }
    }
    const sp = Math.abs(car.speed);
    if ((car.surface === RR.SURF.GRASS || car.surface === RR.SURF.SAND) && sp > 40 && Math.random() < 0.5) {
      this.particle(car.x - c * 8, car.y - s * 8, -c * 20 + (Math.random() - 0.5) * 30, -s * 20 + (Math.random() - 0.5) * 30, 0.45, theme.dust, 2);
    }
    if (car.turbo > 0 && Math.random() < 0.6) {
      this.particle(car.x - c * 11, car.y - s * 11, -c * 40, -s * 40, 0.25, Math.random() < 0.5 ? '#ffb43a' : '#ffe95a', 2);
    }
  };

  Race.prototype.computeStandings = function () {
    return this.cars.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.place - b.place;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
  };

  Race.prototype.updateRanks = function () {
    const g = this.track.gates, N = g.length;
    for (const car of this.cars) {
      const prevIdx = (car.nextCp - 1 + N) % N, prev = g[prevIdx], next = g[car.nextCp];
      const seg = RR.dist(prev.x, prev.y, next.x, next.y) || 1;
      const frac = RR.clamp(1 - RR.dist(car.x, car.y, next.x, next.y) / seg, -1, 0.999);
      car.progress = car.lapsDone * N + prevIdx + frac;
    }
    this.computeStandings().forEach((c, i) => { c.rank = i + 1; });
  };

  // ---------- particles ----------
  Race.prototype.particle = function (x, y, vx, vy, life, color, size) {
    if (this.particles.length > 500) return;
    this.particles.push({ x: x, y: y, vx: vx, vy: vy, life: life, max: life, color: color, size: size || 2, g: 0 });
  };
  Race.prototype.sparkle = function (x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 60;
      this.particle(x, y, Math.cos(a) * v, Math.sin(a) * v, 0.4 + Math.random() * 0.3, color, 2);
    }
  };
  Race.prototype.confetti = function (x, y, count) {
    const cols = ['#ff4a4a', '#ffd23a', '#4ae06a', '#4aa8ff', '#ff6ad8', '#ffffff'];
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 60 + Math.random() * 120;
      this.particle(x, y, Math.cos(a) * v, Math.sin(a) * v, 1.2 + Math.random() * 1.2, cols[i % cols.length], 2);
      this.particles[this.particles.length - 1].g = 120;
    }
  };
  Race.prototype.updateParticles = function (dt) {
    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { ps.splice(i, 1); continue; }
      p.vy += p.g * dt;
      const f = p.g ? 0.995 : (1 - 2.5 * dt);
      p.vx *= f; p.vy *= f;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  };
  Race.prototype.drawParticles = function (ctx) {
    for (const p of this.particles) {
      ctx.globalAlpha = RR.clamp(p.life / p.max * 1.5, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  };

  // ---------- drawing ----------
  Race.prototype.draw = function (ctx) {
    const t = this.t, tr = this.track;
    ctx.drawImage(tr.canvas, 0, 0);
    ctx.drawImage(this.marks, 0, 0);
    this.items.draw(ctx, t);
    const order = this.cars.slice().sort((a, b) => a.y - b.y);
    for (const c of order) c.draw(ctx, t);
    this.drawParticles(ctx);

    if (!this.demo) {
      for (const car of this.cars) {
        if (!car.human) continue;
        const mx = Math.round(car.x), my = Math.round(car.y) - 13;
        ctx.fillStyle = '#000000';
        for (let j = 0; j < 5; j++) ctx.fillRect(mx - 4 + j, my - 1 + j, 9 - 2 * j, 1);
        ctx.fillStyle = car.colorHex;
        for (let j = 0; j < 4; j++) ctx.fillRect(mx - 3 + j, my - 1 + j, 7 - 2 * j, 1);
        RR.font.draw(ctx, 'P' + (car.playerIndex + 1), mx, my - 9, { align: 'center', color: car.colorHex });

        // "This way!" arrow when a gate was missed.
        if (car.lost && !car.finished && this.state !== 'countdown' && Math.floor(t * 4) % 2 === 0) {
          const ng = tr.gates[car.nextCp], ang = Math.atan2(ng.y - car.y, ng.x - car.x);
          ctx.save();
          ctx.translate(Math.round(car.x + Math.cos(ang) * 22), Math.round(car.y + Math.sin(ang) * 22));
          ctx.rotate(ang);
          ctx.fillStyle = '#000000'; ctx.fillRect(-7, -2, 10, 5);
          ctx.fillStyle = '#ffe95a'; ctx.fillRect(-6, -1, 8, 3);
          for (let j = 0; j < 5; j++) ctx.fillRect(2 + j, -4 + j, 1, 9 - 2 * j);
          ctx.restore();
        }
      }
    }
    if (RR.game && RR.game.debug) this.drawDebug(ctx);
  };

  Race.prototype.drawDebug = function (ctx) {
    const tr = this.track;
    ctx.strokeStyle = 'rgba(255,255,0,0.5)';
    ctx.lineWidth = 1;
    tr.gates.forEach((g, i) => {
      ctx.beginPath(); ctx.arc(g.x, g.y, tr.gateRadius, 0, Math.PI * 2); ctx.stroke();
      RR.font.draw(ctx, String(i), g.x, g.y - 3, { align: 'center', color: '#ffff00' });
    });
    for (const c of this.cars) {
      if (c.aiTarget) { ctx.fillStyle = '#ff00ff'; ctx.fillRect(Math.round(c.aiTarget.x) - 1, Math.round(c.aiTarget.y) - 1, 3, 3); }
      RR.font.draw(ctx, RR.SURF_PROPS[c.surface].name + ' ' + Math.round(c.speed) + ' G' + c.nextCp, c.x, c.y + 10, { align: 'center', color: '#00ffff' });
    }
  };

  RR.Race = Race;
})(window.RR);
