// AUDIO — all synthesized, no assets.
//
// LAW 13.1 — the rolling sound is NOISE, not a tone. A pitched fundamental that tracks
// speed IS the engine cue, whatever you filter it through, and a hard sphere on a hard
// surface has no fundamental at all. Timbre is not the problem; the oscillator is.
//
// The layer reads the simulation's own EVENT LIST and never inspects the world, which is
// also what lets a headless test assert on the graph.

var AUD = null;
var _audioFactory = null;

// The four parts. Per-surface filter shapes are what makes the channel say what you are
// ON as well as how fast: the green darker and softer, sand a bright damped hiss with no
// body, fragile paper ringing, a belt's ticks low and blunt like slats.
var SURF_VOICE = [
  { hp: 260, q: 0.9, gain: 1.00, tilt: 1.00 },   // FAIRWAY
  { hp: 190, q: 0.7, gain: 0.72, tilt: 0.80 },   // GREEN   — darker and softer
  { hp: 300, q: 0.8, gain: 1.15, tilt: 1.05 },   // ROUGH
  { hp: 900, q: 0.5, gain: 0.85, tilt: 1.45 },   // SAND    — bright hiss, no body
  { hp: 200, q: 1.0, gain: 0.60, tilt: 0.70 },   // WATER
  { hp: 150, q: 1.6, gain: 0.95, tilt: 0.62 },   // BELT    — low and blunt, like slats
  { hp: 420, q: 4.5, gain: 1.05, tilt: 1.20 },   // FRAGILE — ringing paper
  { hp: 380, q: 3.0, gain: 1.00, tilt: 1.10 },   // CRACKED
];

// A seeded noise loop. Deterministic: no Math.random anywhere, in any path.
function fillNoise(buf, len) {
  var s = 0x2f6e2b1 >>> 0;
  for (var i = 0; i < len; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    buf[i] = ((s >>> 8) / 8388608) - 1;
  }
}

// The one seam in this file the game itself does not use. LAW 13.1 is a claim about the
// SHAPE OF THE GRAPH — that nothing in the rolling bed is an oscillator — and the only way
// to assert that is to build the graph against a context that records it. One line, and it
// is what makes the law checkable instead of merely stated.
function setAudioFactory(f) { _audioFactory = f; }

function ensureAudio() {
  if (AUD) return AUD;
  var ctx;
  try {
    ctx = _audioFactory ? _audioFactory()
        : new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { return null; }
  if (!ctx) return null;

  var master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);

  var len = Math.floor(ctx.sampleRate * NOISE_SECONDS);
  var buf = ctx.createBuffer(1, len, ctx.sampleRate);
  fillNoise(buf.getChannelData(0), len);

  // THE BED: noise -> highpass -> bandpass -> gain. Nothing is pitched, so nothing can
  // read as a throttle.
  var src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 260;
  var bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
  bp.frequency.value = ROLL_LO; bp.Q.value = 1.0;
  var rollGain = ctx.createGain(); rollGain.gain.value = 0;
  src.connect(hp); hp.connect(bp); bp.connect(rollGain); rollGain.connect(master);
  try { src.start(0); } catch (e) { /* a fake context need not start */ }

  // AIR: a breath while the ball is lifted.
  var asrc = ctx.createBufferSource();
  asrc.buffer = buf; asrc.loop = true;
  var alp = ctx.createBiquadFilter(); alp.type = 'lowpass'; alp.frequency.value = 900;
  var airGain = ctx.createGain(); airGain.gain.value = 0;
  asrc.connect(alp); alp.connect(airGain); airGain.connect(master);
  try { asrc.start(0); } catch (e) { /* as above */ }

  AUD = { ctx: ctx, master: master, buf: buf, src: src, hp: hp, bp: bp,
          rollGain: rollGain, airGain: airGain, alp: alp,
          muted: false, cell: -1, lastSurf: -1 };
  return AUD;
}

function setMuted(m) {
  var a = ensureAudio();
  if (!a) return;
  a.muted = m;
  a.master.gain.value = m ? 0 : 0.55;
}

// A short filtered noise burst. Everything in this game that is not the rolling bed is
// one of these, shaped differently.
function burst(a, freq, q, gain, dur, type) {
  var s = a.ctx.createBufferSource();
  s.buffer = a.buf; s.loop = true;
  var f = a.ctx.createBiquadFilter();
  f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  var g = a.ctx.createGain();
  var t = a.ctx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(a.master);
  try { s.start(t); s.stop(t + dur + 0.02); } catch (e) { /* fake context */ }
}

// The flag and the cup are UI chimes, not the rolling channel: LAW 13.1 is about the bed.
function chime(a, f0, f1, dur, gain) {
  var o = a.ctx.createOscillator();
  o.type = 'triangle';
  var g = a.ctx.createGain();
  var t = a.ctx.currentTime;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.linearRampToValueAtTime(f1, t + dur * 0.8);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.master);
  try { o.start(t); o.stop(t + dur + 0.02); } catch (e) { /* fake context */ }
}

// The rolling channel. Speed opens and brightens the band; the SURFACE is its voice; and
// ball.bank lifts and tightens it, so riding a tube's rim is audible before it is visible.
function audioRoll(a, run) {
  var b = run.ball, g = run.grid;
  var lifted = b.lift >= BALL_R * 0.8 || b.state === ST.FALL;
  var sp = Math.hypot(b.vx, b.vy);
  var surf = solidAt(g, b.x, b.y) === 1 ? surfAt(g, b.x, b.y) : SURF.FAIRWAY;
  var v = SURF_VOICE[surf];

  if (lifted || b.state !== ST.ROLL) {
    a.rollGain.gain.value = 0;
    // The channel switches on lift, not on ball.air: the launch test makes `air` flicker
    // on undulating ground and the rolling sound would stutter with it.
    a.airGain.gain.value = lifted && b.state !== ST.SINK ? 0.09 : 0;
    return;
  }
  a.airGain.gain.value = 0;

  var f = Math.min(1, sp / MAX_SPEED);
  var centre = (ROLL_LO + (ROLL_HI - ROLL_LO) * f) * v.tilt;
  // The bank lifts and tightens the band.
  a.bp.frequency.value = centre * (1 + b.bank * 0.55);
  a.bp.Q.value = v.q * (1 + b.bank * 2.6);
  a.hp.frequency.value = v.hp;
  a.rollGain.gain.value = Math.pow(f, 1.5) * 0.5 * v.gain;
}

// CREASES carry the speed: one click per lattice line crossed, taken from the ball's CELL
// rather than from a timer, so the rate IS the speed. Discrete taps on the folds slowly,
// a rustle at pace. This is the papercraft in the sound.
function audioCreases(a, run) {
  var b = run.ball;
  if (b.state !== ST.ROLL || b.lift >= BALL_R * 0.8) { a.cell = -1; return; }
  var k = cellIndex(run.grid, b.x, b.y);
  if (k === a.cell || k < 0) return;
  var first = a.cell < 0;
  a.cell = k;
  if (first) return;
  var sp = Math.hypot(b.vx, b.vy);
  var v = SURF_VOICE[surfAt(run.grid, b.x, b.y)];
  burst(a, 1500 * v.tilt, 2.5, Math.min(0.16, 0.03 + sp * 0.008), 0.045);
}

var ONESHOT = {
  flag:      function (a) { chime(a, 660, 990, 0.28, 0.16); },
  cup:       function (a) { chime(a, 520, 1240, 0.55, 0.20); },
  crack:     function (a) { burst(a, 2400, 6, 0.13, 0.11); },
  collapse:  function (a) { burst(a, 380, 1.2, 0.22, 0.42, 'lowpass'); },
  splash:    function (a) { burst(a, 700, 0.8, 0.22, 0.5, 'lowpass'); },
  eaten:     function (a) { burst(a, 240, 0.7, 0.26, 0.6, 'lowpass'); },
  lost:      function (a) { burst(a, 300, 1.0, 0.10, 0.35, 'lowpass'); },
  respawn:   function (a) { chime(a, 400, 620, 0.20, 0.10); },
  flatten:   function (a) { burst(a, 190, 1.0, 0.26, 0.20, 'lowpass'); },
  rivaldown: function (a) { burst(a, 520, 1.4, 0.14, 0.30, 'lowpass'); },
  land:      function (a, e) { burst(a, 240 + Math.min(600, e.a * 40), 1.1,
                                    Math.min(0.24, 0.05 + e.a * 0.016), 0.14, 'lowpass'); },
  knock:     function (a, e) { burst(a, 900, 2.2, Math.min(0.22, 0.03 + e.a * 0.02), 0.10); },
};

function playEvents(run) {
  var a = ensureAudio();
  if (!a) { run.events.length = 0; return; }
  if (!a.muted) {
    for (var i = 0; i < run.events.length; i++) {
      var e = run.events[i], fn = ONESHOT[e.kind];
      if (fn) fn(a, e);
    }
    audioRoll(a, run);
    audioCreases(a, run);
  } else {
    a.rollGain.gain.value = 0;
    a.airGain.gain.value = 0;
  }
  run.events.length = 0;
}
