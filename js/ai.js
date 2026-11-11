/* Retro Racer - computer drivers: follow the centerline with a lane offset,
 * slow down for corners, and use items after a short delay. */
(function (RR) {
  'use strict';

  RR.ai = {
    control(car, race, dt) {
      const tr = race.track, n = tr.n, pts = tr.pts;
      car.aiIdx = tr.nearestIndex(car.x, car.y, car.aiIdx, 14);

      const spd = Math.max(0, car.speed);
      const look = 9 + Math.round(spd / 16);
      const tp = pts[(car.aiIdx + look) % n];
      car.lanePhase += dt * 0.5;
      const lane = RR.clamp(car.laneOffset + Math.sin(car.lanePhase) * 0.18, -0.6, 0.6) * tr.hw;
      const tx = tp.x - Math.sin(tp.a) * lane, ty = tp.y + Math.cos(tp.a) * lane;
      car.aiTarget = { x: tx, y: ty };

      const want = Math.atan2(ty - car.y, tx - car.x);
      const diff = RR.wrapAngle(want - car.a);
      const steer = RR.clamp(diff * 2.6, -1, 1);

      // How much the road bends just ahead.
      const a0 = pts[car.aiIdx].a, a1 = pts[(car.aiIdx + 18) % n].a, a2 = pts[(car.aiIdx + 32) % n].a;
      const curv = Math.max(Math.abs(RR.wrapAngle(a1 - a0)), Math.abs(RR.wrapAngle(a2 - a0)) * 0.8);

      const maxSp = RR.CAR_PHYS.maxSpeed * car.maxMul;
      let target = maxSp * (1 - RR.clamp(curv - 0.35, 0, 1.3) * 0.4);
      if (car.surface === RR.SURF.ICE) target *= 0.85;

      let throttle = car.speed < target ? 1 : (car.speed > target + 20 ? -0.5 : 0);
      if (Math.abs(diff) > 1.3) throttle = Math.min(throttle, 0.5);   // facing the wrong way: turn around gently

      let item = false;
      if (car.item && car.itemRoll <= 0) {
        car.aiItemTimer -= dt;
        if (car.aiItemTimer <= 0 && (car.item !== 'turbo' || curv < 0.4)) item = true;
      }
      return { throttle: throttle, steer: steer, item: item };
    }
  };
})(window.RR);
