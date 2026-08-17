// A RECORDING CANVAS. No DOM, no clock, no rasteriser — it records what the renderer
// hands the 2-D context and nothing else.
//
// This is what makes tests 22, 34, 45 and 46 exist at all: LAW 12.2 says a frame costs
// what it hands the canvas, so the number that matters is PATHS PER FRAME, and asserting
// milliseconds is worthless — two headless configurations of one machine disagreed 2.5x
// on the same build.

'use strict';

function recordingCanvas() {
  var ops = [];       // { op, style, pts:[x,y,...] }
  var path = [];
  var st = { fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1 };
  var stack = [];
  var tx = 0, ty = 0;

  function push(x, y) { path.push(x + tx, y + ty); }

  var ctx = {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1,
    font: '10px monospace', textAlign: 'left', textBaseline: 'alphabetic',
    lineCap: 'butt', lineJoin: 'miter',

    beginPath: function () { path = []; },
    closePath: function () {},
    moveTo: push, lineTo: push,
    quadraticCurveTo: function (a, b, c, d) { push(a, b); push(c, d); },
    bezierCurveTo: function (a, b, c, d, e, f) { push(a, b); push(c, d); push(e, f); },
    rect: function (x, y, w, h) { push(x, y); push(x + w, y); push(x + w, y + h); push(x, y + h); },
    arc: function (x, y, r) { push(x - r, y - r); push(x + r, y + r); },
    ellipse: function (x, y, rx, ry) { push(x - rx, y - ry); push(x + rx, y + ry); },
    setLineDash: function () {}, getLineDash: function () { return []; },
    clip: function () { ops.push({ op: 'clip', pts: path.slice(), style: null }); },

    fill: function () {
      ops.push({ op: 'fill', style: String(ctx.fillStyle), pts: path.slice(),
                 alpha: ctx.globalAlpha });
    },
    stroke: function () {
      ops.push({ op: 'stroke', style: String(ctx.strokeStyle), pts: path.slice(),
                 alpha: ctx.globalAlpha, width: ctx.lineWidth });
    },
    fillRect: function (x, y, w, h) {
      ops.push({ op: 'fill', style: String(ctx.fillStyle),
                 pts: [x + tx, y + ty, x + w + tx, y + h + ty], alpha: ctx.globalAlpha });
    },
    strokeRect: function (x, y, w, h) {
      ops.push({ op: 'stroke', style: String(ctx.strokeStyle),
                 pts: [x + tx, y + ty, x + w + tx, y + h + ty], alpha: ctx.globalAlpha });
    },
    fillText: function (s, x, y) {
      ops.push({ op: 'text', style: String(ctx.fillStyle), text: String(s),
                 pts: [x + tx, y + ty], alpha: ctx.globalAlpha });
    },
    measureText: function (s) { return { width: String(s).length * 8 }; },

    createLinearGradient: function () {
      var stops = [];
      return { addColorStop: function (o, c) { stops.push([o, c]); },
               stops: stops, toString: function () { return 'gradient(' + stops.map(function (s) { return s[1]; }).join('|') + ')'; } };
    },
    createRadialGradient: function () {
      var stops = [];
      return { addColorStop: function (o, c) { stops.push([o, c]); },
               stops: stops, toString: function () { return 'radial(' + stops.length + ')'; } };
    },

    save: function () { stack.push({ fillStyle: ctx.fillStyle, strokeStyle: ctx.strokeStyle,
                                     lineWidth: ctx.lineWidth, globalAlpha: ctx.globalAlpha,
                                     tx: tx, ty: ty }); },
    restore: function () {
      var s = stack.pop(); if (!s) return;
      ctx.fillStyle = s.fillStyle; ctx.strokeStyle = s.strokeStyle;
      ctx.lineWidth = s.lineWidth; ctx.globalAlpha = s.globalAlpha;
      tx = s.tx; ty = s.ty;
    },
    translate: function (x, y) { tx += x; ty += y; },
    rotate: function () {},   // only the mallet's lean, and its anchor is what matters
    scale: function () {},
    clearRect: function () {},

    ops: ops,
    counts: function () {
      var c = { fill: 0, stroke: 0, text: 0, clip: 0 };
      ops.forEach(function (o) { c[o.op]++; });
      return c;
    },
    reset: function () { ops.length = 0; },
    // Screen bounds of every op, so "did it paint anything the frame could see" is
    // answerable without a rasteriser.
    bbox: function (o) {
      var p = o.pts;
      if (!p || !p.length) return null;
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (var i = 0; i < p.length; i += 2) {
        if (p[i] < x0) x0 = p[i];
        if (p[i] > x1) x1 = p[i];
        if (p[i + 1] < y0) y0 = p[i + 1];
        if (p[i + 1] > y1) y1 = p[i + 1];
      }
      return { x0: x0, y0: y0, x1: x1, y1: y1 };
    },
  };
  void st;
  return ctx;
}

module.exports = { recordingCanvas: recordingCanvas };
