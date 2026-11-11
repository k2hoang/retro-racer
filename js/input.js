/* Retro Racer - keyboard input: held keys, per-tick "just pressed" keys, and name typing. */
(function (RR) {
  'use strict';

  const down = Object.create(null);
  let pressed = Object.create(null);
  let typed = [];

  // Keys whose browser default (scrolling, find-next, etc.) we block.
  const BLOCK = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'NumpadEnter',
    'Slash', 'Backspace', 'Tab', 'F3', 'Quote'
  ]);

  // Player key bindings. (No Shift keys: pressing Shift 5 times opens Windows Sticky Keys.)
  const BIND = [
    { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], item: ['Space', 'KeyQ', 'KeyE'] },
    { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
      item: ['Enter', 'NumpadEnter', 'Slash', 'Numpad0', 'ControlRight'] }
  ];

  const I = RR.input = { textMode: false };

  window.addEventListener('keydown', (e) => {
    if (BLOCK.has(e.code)) e.preventDefault();
    if (RR.audio) RR.audio.unlock();
    if (!e.repeat) pressed[e.code] = true;
    down[e.code] = true;
    if (I.textMode && !e.repeat && !e.ctrlKey && !e.altKey && !e.metaKey &&
        e.key && e.key.length === 1 && /[a-z0-9 ]/i.test(e.key)) {
      typed.push(e.key.toUpperCase());
    }
  });
  window.addEventListener('keyup', (e) => { down[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in down) down[k] = false; });
  window.addEventListener('mousedown', () => { if (RR.audio) RR.audio.unlock(); });

  const any = (map, codes) => codes.some((c) => map[c]);

  I.isDown = (code) => !!down[code];
  I.pressed = (code) => !!pressed[code];
  I.anyPressed = (codes) => any(pressed, codes);
  I.endTick = () => { pressed = Object.create(null); };
  I.takeTyped = () => { const t = typed; typed = []; return t; };

  // Driving controls for player idx. merged = single player may use either key set.
  I.controls = (idx, merged) => {
    const sets = merged ? BIND : [BIND[idx] || BIND[0]];
    const r = { up: false, down: false, left: false, right: false, item: false };
    for (const b of sets) {
      r.up = r.up || any(down, b.up);
      r.down = r.down || any(down, b.down);
      r.left = r.left || any(down, b.left);
      r.right = r.right || any(down, b.right);
      r.item = r.item || any(pressed, b.item);
    }
    return r;
  };

  // Menu navigation (WASD disabled while typing a name).
  I.nav = () => {
    const wasd = !I.textMode;
    return {
      up: I.anyPressed(wasd ? ['ArrowUp', 'KeyW'] : ['ArrowUp']),
      down: I.anyPressed(wasd ? ['ArrowDown', 'KeyS'] : ['ArrowDown']),
      left: I.anyPressed(wasd ? ['ArrowLeft', 'KeyA'] : ['ArrowLeft']),
      right: I.anyPressed(wasd ? ['ArrowRight', 'KeyD'] : ['ArrowRight']),
      confirm: I.anyPressed(['Enter', 'NumpadEnter', 'Space']),
      back: I.anyPressed(['Escape'])
    };
  };
})(window.RR);
