/* Retro Racer - arcade car physics and drawing. */
(function (RR) {
  'use strict';

  const P = RR.CAR_PHYS = {
    accel: 230,        // px/s^2
    brake: 380,
    reverseAccel: 150,
    maxSpeed: 175,     // px/s
    reverseMax: 55,
    turnRate: 3.4,     // rad/s at full steering
    coast: 0.9,        // rolling friction when no pedal is pressed
    radius: 6.5        // collision radius
  };

  function Car(o) {
    this.name = o.name;
    this.colorHex = o.color;
    this.human = !!o.human;
    this.playerIndex = o.playerIndex == null ? -1 : o.playerIndex;
    this.index = o.index || 0;
    this.sprite = RR.sprites.car(o.color);

    this.x = 0; this.y = 0; this.a = 0;
    this.vx = 0; this.vy = 0;
    this.speed = 0; this.lat = 0; this.throttle = 0;
    this.surface = RR.SURF.ROAD;
    this.bumped = false;

    this.item = null; this.itemRoll = 0; this.aiItemTimer = 0;
    this.turbo = 0; this.spin = 0; this.spinDir = 1; this.shield = 0; this.ghost = 0; this.padCool = 0;

    this.lapsDone = 0; this.nextCp = 1; this.progress = 0; this.rank = 1;
    this.finished = false; this.finishTime = null; this.place = 0;
    this.lapStart = 0; this.lapTimes = []; this.bestLap = null; this.newRecord = false;
    this.stuck = 0; this.offroad = 0; this.respawns = 0; this.lost = false;

    this.aiIdx = 0; this.skill = 1; this.maxMul = 1; this.rubber = 1;
    this.laneOffset = 0; this.lanePhase = 0;
    this.easy = false;
  }

  // ctrl: { throttle: -1..1, steer: -1..1 }. Returns true if the car hit a wall or obstacle.
  Car.prototype.physics = function (ctrl, track, dt) {
    const surf = track.surfaceAt(this.x, this.y);
    this.surface = surf;
    const sp = RR.SURF_PROPS[surf];
    let grip = sp.grip, spMul = sp.speed, acMul = sp.accel;
    if (this.easy) {               // Easy mode: grass/sand/ice are much less punishing
      spMul = 1 - (1 - spMul) * 0.55;
      acMul = 1 - (1 - acMul) * 0.5;
      grip = Math.max(grip, 2.6);
    }

    let throttle = ctrl.throttle, steer = ctrl.steer;
    if (this.spin > 0) { this.spin -= dt; this.a += 12 * this.spinDir * dt; throttle = 0; steer = 0; }
    if (this.turbo > 0) { this.turbo -= dt; throttle = 1; }
    this.throttle = throttle;

    let c = Math.cos(this.a), s = Math.sin(this.a);
    let fwd = this.vx * c + this.vy * s;
    const max = P.maxSpeed * this.maxMul * spMul * (this.turbo > 0 ? 1.45 : 1);

    // Steering works best at medium speed and flips when reversing.
    const sf = RR.clamp(fwd / 55, -1, 1) * (1 - 0.22 * RR.clamp(fwd / P.maxSpeed, 0, 1));
    this.a += steer * P.turnRate * sf * dt;

    c = Math.cos(this.a); s = Math.sin(this.a);
    fwd = this.vx * c + this.vy * s;
    let lat = -this.vx * s + this.vy * c;

    if (throttle > 0) {
      if (fwd < -1) fwd += P.brake * throttle * dt;
      else if (fwd < max) fwd = Math.min(max, fwd + P.accel * acMul * (this.turbo > 0 ? 1.8 : 1) * throttle * dt);
    }
    else if (throttle < 0) fwd -= (fwd > 1 ? P.brake : P.reverseAccel) * -throttle * dt;
    else { fwd -= fwd * P.coast * dt; if (Math.abs(fwd) < 1.5) fwd = 0; }

    if (fwd > max) fwd -= (fwd - max) * Math.min(1, 3 * dt);
    if (fwd < -P.reverseMax) fwd = -P.reverseMax;
    if (this.spin > 0) fwd -= fwd * 2 * dt;

    lat -= lat * Math.min(1, grip * dt);   // grip pulls the slide back in line

    this.vx = c * fwd - s * lat;
    this.vy = s * fwd + c * lat;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.speed = fwd;
    this.lat = lat;

    // Screen edges: soft bounce.
    let hit = false;
    const m = 6, W = RR.W, H = RR.H;
    if (this.x < m) { this.x = m; if (this.vx < 0) this.vx *= -0.4; hit = true; }
    if (this.x > W - m) { this.x = W - m; if (this.vx > 0) this.vx *= -0.4; hit = true; }
    if (this.y < m) { this.y = m; if (this.vy < 0) this.vy *= -0.4; hit = true; }
    if (this.y > H - m) { this.y = H - m; if (this.vy > 0) this.vy *= -0.4; hit = true; }

    // Trees, rocks, rooftops...: gentle bounce.
    const solids = track.solids;
    for (let i = 0; i < solids.length; i++) {
      const o = solids[i], dx = this.x - o.x, dy = this.y - o.y, minD = o.r + P.radius;
      if (dx > minD || dx < -minD || dy > minD || dy < -minD) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 >= minD * minD) continue;
      const d = Math.sqrt(d2) || 0.01, nx = dx / d, ny = dy / d;
      this.x = o.x + nx * minD; this.y = o.y + ny * minD;
      const vn = this.vx * nx + this.vy * ny;
      if (vn < 0) {
        this.vx -= 1.5 * vn * nx; this.vy -= 1.5 * vn * ny;
        this.vx *= 0.85; this.vy *= 0.85;
        if (vn < -40) this.bumped = true;
      }
      hit = true;
    }
    return hit;
  };

  Car.prototype.draw = function (ctx, t) {
    if (this.ghost > 0 && Math.floor(t * 16) % 2 === 0) return;   // blink after respawn
    const x = this.x, y = this.y;

    ctx.save();
    ctx.translate(x + 2, y + 3); ctx.rotate(this.a);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-8, -4, 16, 9);
    ctx.restore();

    ctx.save();
    ctx.translate(x, y); ctx.rotate(this.a);
    if (this.turbo > 0) {
      const f = Math.floor(t * 30) % 2;
      ctx.fillStyle = f ? '#ffd23a' : '#ff7a1a';
      ctx.fillRect(-12 - f * 2, -3, 4 + f * 2, 2);
      ctx.fillRect(-12 - (1 - f) * 2, 1, 4 + (1 - f) * 2, 2);
      ctx.fillStyle = '#fff6c0';
      ctx.fillRect(-10, -3, 2, 1); ctx.fillRect(-10, 2, 2, 1);
    }
    ctx.drawImage(this.sprite, -8, -5);
    ctx.restore();

    if (this.shield > 0 && !(this.shield < 2 && Math.floor(t * 10) % 2 === 0)) {
      ctx.strokeStyle = 'rgba(140,210,255,0.95)';
      ctx.fillStyle = 'rgba(140,210,255,0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 12 + Math.sin(t * 8) * 0.8, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    if (this.spin > 0) {
      ctx.fillStyle = '#ffe95a';
      for (let k = 0; k < 3; k++) {
        const ang = t * 10 + k * 2.09;
        ctx.fillRect(Math.round(x + Math.cos(ang) * 9) - 1, Math.round(y - 10 + Math.sin(ang) * 3) - 1, 2, 2);
      }
    }
  };

  RR.Car = Car;
})(window.RR);
