// A FAKE WEBAUDIO CONTEXT that records the graph.
//
// LAW 13.1 — the rolling sound is NOISE, not a tone. A pitched fundamental that tracks
// speed IS the engine cue, whatever you filter it through. Timbre is not the problem; the
// oscillator is. The only way to assert that from a test is to look at the graph, which is
// why the audio layer reads the simulation's event list and never inspects the world.

'use strict';

function fakeAudio() {
  var nodes = [];
  var ctx = {
    sampleRate: 44100,
    currentTime: 0,
    destination: { _kind: 'destination', inputs: [] },
    _nodes: nodes,
  };

  function param(v) {
    var p = { value: v, _events: [] };
    p.setValueAtTime = function (x, t) { p.value = x; p._events.push(['set', x, t]); return p; };
    p.linearRampToValueAtTime = function (x, t) { p.value = x; p._events.push(['lin', x, t]); return p; };
    p.exponentialRampToValueAtTime = function (x, t) { p._events.push(['exp', x, t]); return p; };
    p.setTargetAtTime = function (x, t, k) { p._events.push(['tgt', x, t, k]); return p; };
    p.cancelScheduledValues = function () { return p; };
    return p;
  }
  function node(kind, extra) {
    var n = { _kind: kind, inputs: [], outputs: [] };
    n.connect = function (d) { n.outputs.push(d); if (d.inputs) d.inputs.push(n); return d; };
    n.disconnect = function () { n.outputs.length = 0; };
    Object.keys(extra || {}).forEach(function (k) { n[k] = extra[k]; });
    nodes.push(n);
    return n;
  }

  ctx.createGain = function () { return node('gain', { gain: param(1) }); };
  ctx.createBiquadFilter = function () {
    return node('biquad', { type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0) });
  };
  ctx.createBufferSource = function () {
    return node('bufferSource', {
      buffer: null, loop: false, playbackRate: param(1),
      start: function () { this._started = true; }, stop: function () { this._stopped = true; },
    });
  };
  ctx.createOscillator = function () {
    return node('oscillator', {
      type: 'sine', frequency: param(440), detune: param(0),
      start: function () { this._started = true; }, stop: function () { this._stopped = true; },
    });
  };
  ctx.createBuffer = function (ch, len, rate) {
    var data = new Float32Array(len);
    return { numberOfChannels: ch, length: len, sampleRate: rate,
             getChannelData: function () { return data; } };
  };
  ctx.decodeAudioData = function () { throw new Error('decodeAudioData: this game ships no samples'); };

  // Everything that can be reached from a node, following connect().
  ctx.reachableFrom = function (n, seen) {
    seen = seen || [];
    if (seen.indexOf(n) !== -1) return seen;
    seen.push(n);
    (n.outputs || []).forEach(function (o) { ctx.reachableFrom(o, seen); });
    return seen;
  };
  // Everything that FEEDS a node, walking inputs backwards.
  ctx.feeding = function (n, seen) {
    seen = seen || [];
    if (seen.indexOf(n) !== -1) return seen;
    seen.push(n);
    (n.inputs || []).forEach(function (i) { ctx.feeding(i, seen); });
    return seen;
  };
  return ctx;
}

module.exports = { fakeAudio: fakeAudio };
