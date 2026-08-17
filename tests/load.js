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

function loadEngine() {
  var ctx = vm.createContext({
    Math: Math, JSON: JSON, Object: Object, Array: Array, Number: Number,
    String: String, Boolean: Boolean, Date: Date, Error: Error, RangeError: RangeError,
    isNaN: isNaN, isFinite: isFinite, parseInt: parseInt, parseFloat: parseFloat,
    Float64Array: Float64Array, Float32Array: Float32Array,
    Uint8Array: Uint8Array, Int32Array: Int32Array, Uint32Array: Uint32Array,
    console: console,
  });
  ctx.globalThis = ctx;
  MODULES.forEach(function (f) {
    var src = fs.readFileSync(path.join(SRC, f), 'utf8');
    vm.runInContext(src, ctx, { filename: 'src/' + f });
  });
  return ctx;
}

// Reads the source text exactly as build.js concatenates it, for hashing (test 20).
function engineSource() {
  return MODULES.map(function (f) {
    return fs.readFileSync(path.join(SRC, f), 'utf8');
  }).join('\n');
}

module.exports = { loadEngine: loadEngine, engineSource: engineSource, MODULES: MODULES };
