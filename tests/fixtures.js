// Synthetic grids and courses for the physics tests. These are NOT levels — they are the
// smallest piece of world that can ask one question of the tick, built directly on the
// lattice so a physics test never depends on a course being authored correctly.

'use strict';

// A rectangle of paper `nx` x `ny` at the grid origin, on a plain of void.
// `hf(i, j)` returns the CORNER height at lattice corner (i, j).
function slab(PL, nx, ny, hf, surf) {
  var pad = 6;
  var g = PL.makeGrid(nx + pad * 2, ny + pad * 2, -pad, -pad);
  var lowest = Infinity;
  for (var j = 0; j <= ny; j++) for (var i = 0; i <= nx; i++) {
    var z = hf(i, j);
    if (z < lowest) lowest = z;
  }
  for (var jj = 0; jj <= g.ny; jj++) for (var ii = 0; ii <= g.nx; ii++)
    g.h[jj * (g.nx + 1) + ii] = lowest - 40;

  // Corners of the slab: lattice corner (i,j) is world (i,j), grid corner (i+pad, j+pad).
  for (var j2 = 0; j2 <= ny; j2++) for (var i2 = 0; i2 <= nx; i2++) {
    var k = (j2 + pad) * (g.nx + 1) + (i2 + pad);
    g.h[k] = hf(i2, j2);
    g.hp[k] = 1;
  }
  for (var j3 = 0; j3 < ny; j3++) for (var i3 = 0; i3 < nx; i3++) {
    var c = (j3 + pad) * g.nx + (i3 + pad);
    g.solid[c] = 1;
    g.surf[c] = surf === undefined ? PL.SURF.FAIRWAY : surf;
  }
  dilate2(PL, g);
  g._lowest = lowest;
  return g;
}

// The compiler's two-ring dilation (LAW 5.3), reproduced here so a fixture edge behaves
// exactly like a course edge. level.js runs the same pass.
function dilate2(PL, g) {
  var W = g.nx + 1;
  for (var pass = 0; pass < 2; pass++) {
    var addI = [], addV = [];
    for (var j = 0; j <= g.ny; j++) for (var i = 0; i <= g.nx; i++) {
      var k = j * W + i;
      if (g.hp[k]) continue;
      var sum = 0, n = 0;
      if (i > 0 && g.hp[k - 1]) { sum += g.h[k - 1]; n++; }
      if (i < g.nx && g.hp[k + 1]) { sum += g.h[k + 1]; n++; }
      if (j > 0 && g.hp[k - W]) { sum += g.h[k - W]; n++; }
      if (j < g.ny && g.hp[k + W]) { sum += g.h[k + W]; n++; }
      if (n) { addI.push(k); addV.push(sum / n); }
    }
    for (var q = 0; q < addI.length; q++) { g.h[addI[q]] = addV[q]; g.hp[addI[q]] = 1; }
  }
}

// A course shell around a grid. No pieces, no routes — just what the tick reads.
function shell(PL, g, start, cup, flags) {
  return {
    name: 'FIXTURE',
    grid: g,
    start: start,
    cup: cup || { x: -999, y: -999, r: 0.9 },
    flags: flags || [],
    hazards: [],
    routes: [],
    parTime: 20, bonus: 3,
    deathZ: g._lowest - PL.DEATH_DROP,
  };
}

module.exports = { slab: slab, shell: shell, dilate2: dilate2 };
