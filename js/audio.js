/* Retro Racer - chiptune music, engine hum and sound effects, all generated with WebAudio. */
(function (RR) {
  'use strict';

  const A = RR.audio = {};
  let ctx = null, master = null, musicGain = null, sfxGain = null, noiseBuf = null;
  let muted = !!RR.store.get('muted', false);
  let current = null, wanted = null, timer = null, lastBump = 0;
  const engines = [];

  // ---------- Songs: one token per 16th note. "." = rest, "-" = hold previous note. ----------
  const SONGS = {
    menu: {
      bpm: 132,
      lead: 'C5 . E5 . G5 . E5 . C6 . G5 . E5 . G5 .  A5 . G5 . E5 . C5 . D5 . E5 . D5 . . . ' +
            'C5 . E5 . G5 . E5 . C6 . G5 . A5 . C6 .  D6 . C6 . A5 . G5 . C6 - - - . . . .',
      bass: 'C3 . . C3 G2 . . . C3 . . C3 G2 . . .  F2 . . F2 C3 . . . G2 . . G2 D3 . . . ' +
            'C3 . . C3 G2 . . . A2 . . A2 E3 . . .  F2 . . F2 G2 . . G2 C3 . . . C3 . . .',
      drums: 'k . h . s . h . k k h . s . h h'
    },
    meadow: {
      bpm: 150,
      lead: 'G5 . B5 . D6 . B5 . G5 . A5 . B5 . . .  E5 . G5 . B5 . G5 . A5 . F#5 . D5 . . . ' +
            'G5 . B5 . D6 . E6 . D6 . B5 . G5 . A5 .  B5 . A5 . F#5 . D5 . G5 - - - . . . .',
      bass: 'G2 . G3 . G2 . G3 . G2 . G3 . G2 . G3 .  E2 . E3 . E2 . E3 . D2 . D3 . D2 . D3 . ' +
            'C3 . C4 . C3 . C4 . D3 . D4 . D3 . D4 .  D3 . D4 . D3 . F#3 . G2 . G3 . G2 . . .',
      drums: 'k . h . s . h . k . h k s . h .'
    },
    canyon: {
      bpm: 140,
      lead: 'A4 . . C5 E5 . . A5 G5 . E5 . D5 . C5 .  D5 . . E5 F5 . . E5 D5 . C5 . B4 . . . ' +
            'A4 . . C5 E5 . . A5 B5 . A5 . G5 . E5 .  F5 . E5 . D5 . B4 . A4 - - - . . . .',
      bass: 'A2 . E3 . A2 . E3 . A2 . E3 . A2 . E3 .  D3 . A2 . D3 . A2 . G2 . D3 . G2 . D3 . ' +
            'A2 . E3 . A2 . E3 . C3 . G3 . C3 . G3 .  F2 . C3 . G2 . D3 . A2 . E3 . A2 . . .',
      drums: 'k . . h s . h . k . k h s . h .'
    },
    frosty: {
      bpm: 128,
      lead: 'F5 . A5 . C6 . A5 . F6 . C6 . A5 . C6 .  Bb5 . A5 . G5 . F5 . G5 . A5 . G5 . . . ' +
            'F5 . A5 . C6 . D6 . C6 . A5 . F5 . G5 .  A5 . G5 . E5 . C5 . F5 - - - . . . .',
      bass: 'F2 . . . C3 . . . F2 . . . C3 . . .  Bb2 . . . F2 . . . C3 . . . G2 . . . ' +
            'F2 . . . C3 . . . D3 . . . A2 . . .  Bb2 . . . C3 . . . F2 . . . F2 . . .',
      drums: 'k . h . s . h h k . h . s . h .'
    },
    neon: {
      bpm: 136,
      lead: 'E5 . . E5 G5 . . B5 . . A5 . G5 . F#5 .  E5 . . E5 G5 . . B5 . . D6 . B5 . . . ' +
            'C6 . . B5 A5 . . G5 . . A5 . B5 . G5 .  F#5 . . G5 A5 . F#5 . E5 - - - . . . .',
      bass: 'E2 E3 E2 E3 E2 E3 E2 E3 E2 E3 E2 E3 E2 E3 E2 E3  C2 C3 C2 C3 C2 C3 C2 C3 D2 D3 D2 D3 D2 D3 D2 D3 ' +
            'A2 A3 A2 A3 A2 A3 A2 A3 C3 C4 C3 C4 C3 C4 C3 C4  B2 B3 B2 B3 B2 B3 B2 B3 B2 B3 B2 B3 E2 E3 E2 E3',
      drums: 'k . h . s . h . k . h . s . h k'
    }
  };

  const NOTE_IDX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function freqOf(tok) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(tok);
    if (!m) return 0;
    const midi = 12 * (parseInt(m[3], 10) + 1) + NOTE_IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  function parseLine(str) {
    const toks = str.trim().split(/\s+/), out = [];
    for (let i = 0; i < toks.length; i++) {
      const tk = toks[i];
      if (tk === '.' || tk === '-') { out.push(null); continue; }
      let len = 1;
      while (toks[i + len] === '-') len++;
      out.push({ f: freqOf(tk), len: len });
    }
    return out;
  }
  const parsed = {};
  function getSong(name) {
    if (!parsed[name]) {
      const s = SONGS[name];
      parsed[name] = { bpm: s.bpm, lead: parseLine(s.lead), bass: parseLine(s.bass), drums: s.drums.trim().split(/\s+/) };
    }
    return parsed[name];
  }

  // ---------- Low-level voices ----------
  function tone(type, freq, t, dur, vol, dest, slideTo) {
    if (!ctx || !freq) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.linearRampToValueAtTime(vol * 0.7, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t, dur, vol, ftype, freq, dest) {
    if (!ctx) return;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = ftype; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || sfxGain);
    src.start(t); src.stop(t + dur + 0.02);
  }
  const kick = (t) => tone('sine', 150, t, 0.14, 0.5, musicGain, 40);
  const snare = (t) => { noise(t, 0.12, 0.22, 'highpass', 1500, musicGain); tone('triangle', 220, t, 0.06, 0.1, musicGain, 120); };
  const hat = (t) => noise(t, 0.035, 0.1, 'highpass', 7000, musicGain);

  // ---------- Music sequencer ----------
  function schedule() {
    if (!current || !ctx) return;
    const s = current.song, sd = 60 / s.bpm / 4;
    if (current.next < ctx.currentTime - 0.3) current.next = ctx.currentTime + 0.05; // after tab sleep
    while (current.next < ctx.currentTime + 0.15) {
      const st = current.step, t = current.next;
      const L = s.lead[st % s.lead.length];
      if (L) tone('square', L.f, t, L.len * sd * 0.92, 0.065, musicGain);
      const B = s.bass[st % s.bass.length];
      if (B) tone('triangle', B.f, t, B.len * sd * 0.9, 0.2, musicGain);
      const D = s.drums[st % s.drums.length];
      if (D === 'k') kick(t); else if (D === 's') snare(t); else if (D === 'h') hat(t);
      current.step++;
      current.next += sd;
    }
  }
  function stopSong() {
    if (timer) clearInterval(timer);
    timer = null; current = null;
  }
  function startSong(name) {
    stopSong();
    if (!SONGS[name] || !ctx) return;
    current = { name: name, song: getSong(name), step: 0, next: ctx.currentTime + 0.08 };
    timer = setInterval(schedule, 25);
    schedule();
  }

  // ---------- Public API ----------
  A.unlock = function () {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ctx = new AC(); } catch (e) { ctx = null; return; }
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.5; musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.8; sfxGain.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      if (wanted) startSong(wanted);
    }
    if (ctx.state === 'suspended') ctx.resume();
  };
  A.isUnlocked = () => !!ctx;

  A.music = function (name) {
    wanted = name;
    if (!ctx) return;
    if (current && current.name === name) return;
    startSong(name);
  };
  A.stopMusic = function () { wanted = null; stopSong(); };

  A.toggleMute = function () {
    muted = !muted;
    RR.store.set('muted', muted);
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.02);
    return muted;
  };
  A.isMuted = () => muted;

  // Engine hum for player i: pitch follows speed.
  A.engine = function (i, on, speed, throttle) {
    if (!ctx) return;
    let e = engines[i];
    if (!e) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      const o2 = ctx.createOscillator(); o2.type = 'square';
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
      const g = ctx.createGain(); g.gain.value = 0;
      const g2 = ctx.createGain(); g2.gain.value = 0.5;
      o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(sfxGain);
      o.start(); o2.start();
      e = engines[i] = { o: o, o2: o2, f: f, g: g };
    }
    const now = ctx.currentTime, sp = Math.abs(speed || 0), th = Math.max(0, throttle || 0);
    const fr = 42 + sp * 0.75 + i * 7;
    e.o.frequency.setTargetAtTime(fr, now, 0.05);
    e.o2.frequency.setTargetAtTime(fr * 0.5, now, 0.05);
    e.f.frequency.setTargetAtTime(380 + sp * 5 + th * 300, now, 0.05);
    e.g.gain.setTargetAtTime(on ? 0.03 + 0.03 * th : 0, now, 0.06);
  };
  A.enginesOff = function () {
    if (!ctx) return;
    engines.forEach((e) => { if (e) e.g.gain.setTargetAtTime(0, ctx.currentTime, 0.04); });
  };

  A.sfx = function (name) {
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    switch (name) {
      case 'blip': tone('square', 660, t, 0.05, 0.08); break;
      case 'select': tone('square', 880, t, 0.06, 0.09); tone('square', 1320, t + 0.06, 0.08, 0.09); break;
      case 'back': tone('square', 520, t, 0.1, 0.08, null, 260); break;
      case 'type': tone('square', 1200, t, 0.03, 0.05); break;
      case 'count': tone('square', 440, t, 0.22, 0.14); break;
      case 'go': tone('square', 880, t, 0.5, 0.14); tone('square', 1320, t, 0.5, 0.07); break;
      case 'pickup': [660, 880, 1175].forEach((f, i) => tone('square', f, t + i * 0.05, 0.06, 0.09)); break;
      case 'boost': tone('sawtooth', 200, t, 0.4, 0.1, null, 900); noise(t, 0.3, 0.1, 'bandpass', 1200); break;
      case 'bump':
        if (t - lastBump < 0.15) return;
        lastBump = t;
        noise(t, 0.12, 0.3, 'lowpass', 500); tone('sine', 110, t, 0.12, 0.25, null, 50);
        break;
      case 'spin': tone('square', 900, t, 0.7, 0.08, null, 120); tone('square', 600, t + 0.05, 0.6, 0.05, null, 90); break;
      case 'oil': tone('sine', 320, t, 0.18, 0.22, null, 70); break;
      case 'shield': tone('triangle', 523, t, 0.3, 0.2, null, 1046); break;
      case 'block': tone('square', 1400, t, 0.05, 0.09); tone('square', 1000, t + 0.05, 0.12, 0.09); break;
      case 'lap': tone('square', 784, t, 0.1, 0.1); tone('square', 1046, t + 0.1, 0.18, 0.1); break;
      case 'final':
        [523, 659, 784, 1046].forEach((f, i) => tone('square', f, t + i * 0.09, 0.1, 0.1));
        tone('square', 1046, t + 0.36, 0.3, 0.1);
        break;
      case 'finish': [784, 659, 784, 1046].forEach((f, i) => tone('square', f, t + i * 0.12, 0.13, 0.1)); break;
      case 'win':
        [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone('square', f, t + i * 0.1, 0.11, 0.1));
        tone('square', 1318, t + 0.6, 0.7, 0.1); tone('triangle', 659, t + 0.6, 0.7, 0.2);
        break;
      case 'respawn': tone('triangle', 300, t, 0.3, 0.2, null, 900); break;
      default: break;
    }
  };
})(window.RR);
