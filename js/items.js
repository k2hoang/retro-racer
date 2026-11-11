/* Retro Racer - item boxes, boost pads, and the three items: turbo, oil slick, shield. */
(function (RR) {
  'use strict';

  function Items(race) {
    this.race = race;
    this.boxes = race.track.boxSpots.map((b) => ({ x: b.x, y: b.y, active: true, timer: 0 }));
    this.oils = [];
  }

  Items.prototype.update = function (dt) {
    const race = this.race, cars = race.cars, tr = race.track;

    for (const b of this.boxes) {
      if (!b.active) { b.timer -= dt; if (b.timer <= 0) b.active = true; continue; }
      for (const car of cars) {
        if (car.ghost > 0) continue;
        if (RR.dist2(car.x, car.y, b.x, b.y) < 11 * 11) {
          b.active = false; b.timer = 3;
          race.sparkle(b.x, b.y, '#ffffff', 10);
          if (!car.item && car.itemRoll <= 0) {
            this.give(car);
            race.stats.pickups++;
            if (car.human) race.sfx('pickup');
          }
          break;
        }
      }
    }

    for (const pad of tr.pads) {
      for (const car of cars) {
        if (car.padCool > 0) continue;
        if (RR.dist2(car.x, car.y, pad.x, pad.y) < 10 * 10) {
          car.turbo = Math.max(car.turbo, 0.8);
          car.padCool = 0.5;
          if (car.human) race.sfx('boost');
        }
      }
    }

    for (let i = this.oils.length - 1; i >= 0; i--) {
      const o = this.oils[i];
      o.life -= dt; o.arm -= dt;
      if (o.life <= 0) { this.oils.splice(i, 1); continue; }
      for (const car of cars) {
        if (car.ghost > 0 || (car === o.owner && o.arm > 0)) continue;
        if (RR.dist2(car.x, car.y, o.x, o.y) < 10 * 10) {
          this.hitOil(car);
          this.oils.splice(i, 1);
          break;
        }
      }
    }
  };

  // Cars further back get better odds of a turbo.
  Items.prototype.give = function (car) {
    const n = this.race.cars.length, frac = n > 1 ? (car.rank - 1) / (n - 1) : 0;
    const pT = 0.25 + 0.4 * frac, pS = 0.3 - 0.1 * frac, r = Math.random();
    car.item = r < pT ? 'turbo' : (r < pT + pS ? 'shield' : 'oil');
    car.itemRoll = car.human ? 0.7 : 0.05;
    car.aiItemTimer = 0.6 + Math.random() * 2.2;
  };

  Items.prototype.use = function (car) {
    if (!car.item || car.itemRoll > 0 || car.spin > 0) return;
    const race = this.race, item = car.item;
    car.item = null;
    race.stats.used++;
    if (item === 'turbo') {
      car.turbo = 1.6;
      if (car.human) race.sfx('boost');
    } else if (item === 'shield') {
      car.shield = 10;
      if (car.human) race.sfx('shield');
    } else {
      const c = Math.cos(car.a), s = Math.sin(car.a);
      this.oils.push({ x: car.x - c * 14, y: car.y - s * 14, life: 25, arm: 0.6, owner: car });
      if (this.oils.length > 8) this.oils.shift();
      if (car.human) race.sfx('oil');
    }
  };

  Items.prototype.hitOil = function (car) {
    const race = this.race;
    if (car.shield > 0) {
      car.shield = 0;
      race.stats.blocks++;
      race.sparkle(car.x, car.y, '#8fd4ff', 14);
      if (car.human) race.sfx('block');
      return;
    }
    race.stats.spins++;
    car.spin = 1.0;
    car.spinDir = Math.random() < 0.5 ? -1 : 1;
    car.vx *= 0.6; car.vy *= 0.6;
    if (car.human) race.sfx('spin');
  };

  Items.prototype.draw = function (ctx, t) {
    for (const o of this.oils) {
      if (o.life < 2 && Math.floor(t * 8) % 2 === 0) continue;
      RR.sprites.icon(ctx, 'oil', o.x, o.y, 2);
    }
    for (const b of this.boxes) {
      if (b.active) RR.sprites.itemBox(ctx, b.x, b.y, t);
      else if (b.timer < 0.6 && Math.floor(t * 12) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(Math.round(b.x) - 4, Math.round(b.y) - 4, 8, 8);
      }
    }
  };

  RR.Items = Items;
})(window.RR);
