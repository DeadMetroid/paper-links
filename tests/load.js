// Loads src/*.js into a fresh V8 context, in build order, with no DOM and no clock.
//
// This is the whole reason the simulation is kept pure and separable: the SAME source
// text the browser runs is what the suite drives. `var` declared at the top level of a
// vm context becomes a property of that context, so the tests read the engine's own
// symbols directly rather than through an export surface that could drift from it.

'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var MODULES = require('../build.js').MODULES;

var SRC = path.join(__dirname, '..', 'src');

// A test a mutation cannot turn red is not a test. PL_MUTATE carries a JSON list of
// { file, from, to } edits applied to the source text before it is loaded, so
// tests/mutate.js can break the code on purpose and watch exactly one test go red.
function mutations() {
  if (!process.env.PL_MUTATE) return [];
  return JSON.parse(process.env.PL_MUTATE);
}

function applyMutations(file, src) {
  mutations().forEach(function (m) {
    if (m.file !== file) return;
    if (src.indexOf(m.from) === -1)
      throw new Error('mutation target not found in src/' + file + ': ' + m.from);
    src = src.split(m.from).join(m.to);
  });
  return src;
}

// localStorage works on file:// and survives a full browser restart; this is the same
// contract in memory, so test 23 exercises the real save code rather than a parallel one.
function makeWindow() {
  var store = {};
  return {
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; },
      clear: function () { store = {}; },
      _raw: function () { return store; },
      _poison: function (k, v) { store[k] = v; },
    },
    addEventListener: function () {},
    requestAnimationFrame: function () {},
    performance: { now: function () { return 0; } },
  };
}

function loadEngine() {
  var ctx = vm.createContext({
    Math: Math, JSON: JSON, Object: Object, Array: Array, Number: Number,
    String: String, Boolean: Boolean, Date: Date, Error: Error, RangeError: RangeError,
    isNaN: isNaN, isFinite: isFinite, parseInt: parseInt, parseFloat: parseFloat,
    Float64Array: Float64Array, Float32Array: Float32Array,
    Uint8Array: Uint8Array, Int32Array: Int32Array, Uint32Array: Uint32Array,
    console: console,
    // A `window` with a working localStorage, and NO `document` — so main.js's boot guard
    // is false and nothing in the suite ever starts a frame loop. Everything above main.js
    // runs headlessly, which is the whole point of keeping the simulation separable.
    window: makeWindow(),
  });
  ctx.globalThis = ctx;
  MODULES.forEach(function (f) {
    var src = applyMutations(f, fs.readFileSync(path.join(SRC, f), 'utf8'));
    vm.runInContext(src, ctx, { filename: 'src/' + f });
  });
  return ctx;
}

// The SHIPPED ARTIFACT, read the way tests 20 and 21 read it — and through the same
// mutation hook, so `game.html` can be broken on purpose too. Those two tests are the only
// ones that read a built file rather than the sources, and without this they would be the
// only two nothing could falsify.
function readArtifact() {
  return applyMutations('game.html',
    fs.readFileSync(path.join(__dirname, '..', 'game.html'), 'utf8'));
}

// Reads the source text exactly as build.js concatenates it, for hashing (test 20).
function engineSource() {
  return MODULES.map(function (f) {
    return fs.readFileSync(path.join(SRC, f), 'utf8');
  }).join('\n');
}

// The sources as TEXT, through the mutation hook — for test 14, which READS the code
// rather than running it. Without the hook it reads files the mutation harness never
// touched, and nothing can falsify it.
function sourceText() {
  return MODULES.map(function (f) {
    return applyMutations(f, fs.readFileSync(path.join(SRC, f), 'utf8'));
  }).join('\n');
}

module.exports = { loadEngine: loadEngine, engineSource: engineSource,
                   readArtifact: readArtifact, sourceText: sourceText, MODULES: MODULES };
