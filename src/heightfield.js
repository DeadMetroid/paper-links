// The lattice. Heights live on CORNERS and are shared between neighbouring cells; the
// mask, the surface and the belt flow live on CELLS.
//
// LAW 5.3 — the mask says where the ground is; the height field never does. The grid
// holds a height for void cells because the array is rectangular.
// LAW 6.4 — bounds-check on each AXIS, never on the flat index. `j*nx + i` with `i` past
// the right-hand edge is a valid offset — it is the next row.

function makeGrid(nx, ny, ox, oy) {
  return {
    nx: nx, ny: ny, ox: ox, oy: oy,
    h: new Float64Array((nx + 1) * (ny + 1)),   // corner heights
    hp: new Uint8Array((nx + 1) * (ny + 1)),    // corner painted? (drives the dilation)
    solid: new Uint8Array(nx * ny),
    surf: new Uint8Array(nx * ny),
    fx: new Float64Array(nx * ny),              // belt flow
    fy: new Float64Array(nx * ny),
  };
}

// A per-run copy: the mask and the surfaces are the run's (LAW 10.6, fragile paper is
// restored on respawn), the heights and the flow are fixed for the life of the level and
// are shared by reference. The compiled course grid is NEVER written to.
function forkGrid(g) {
  return {
    nx: g.nx, ny: g.ny, ox: g.ox, oy: g.oy,
    h: g.h, hp: g.hp, fx: g.fx, fy: g.fy,
    solid: g.solid.slice(),
    surf: g.surf.slice(),
  };
}

function cellIndex(g, wx, wy) {
  var i = Math.floor(wx - g.ox), j = Math.floor(wy - g.oy);
  if (i < 0 || i >= g.nx) return -1;            // per AXIS
  if (j < 0 || j >= g.ny) return -1;
  return j * g.nx + i;
}

function solidAt(g, wx, wy) {
  var k = cellIndex(g, wx, wy);
  return k < 0 ? 0 : g.solid[k];
}

function surfAt(g, wx, wy) {
  var k = cellIndex(g, wx, wy);
  return k < 0 ? SURF.FAIRWAY : g.surf[k];
}

function surfDragAt(g, wx, wy) {
  return SURF_DRAG[surfAt(g, wx, wy)];
}

function flowAt(g, wx, wy, out) {
  var k = cellIndex(g, wx, wy);
  out[0] = k < 0 ? 0 : g.fx[k];
  out[1] = k < 0 ? 0 : g.fy[k];
  return out;
}

// GROUND, for the checkpoint measurements. Water is not ground: contact with it is a
// loss, so a ball can no more stand on it than on the void. That is what lets a dry SLOT
// through a band of water be a neck (LAW 10.1).
function groundAt(g, wx, wy) {
  var k = cellIndex(g, wx, wy);
  if (k < 0) return 0;
  if (!g.solid[k]) return 0;
  return g.surf[k] === SURF.WATER ? 0 : 1;
}

function cornerAt(g, i, j) {
  var ii = i < 0 ? 0 : (i > g.nx ? g.nx : i);
  var jj = j < 0 ? 0 : (j > g.ny ? g.ny : j);
  return g.h[jj * (g.nx + 1) + ii];
}

function heightAt(g, wx, wy) {
  var fx = wx - g.ox, fy = wy - g.oy;
  var i = Math.floor(fx), j = Math.floor(fy);
  var tx = fx - i, ty = fy - j;
  var h00 = cornerAt(g, i, j),     h10 = cornerAt(g, i + 1, j);
  var h01 = cornerAt(g, i, j + 1), h11 = cornerAt(g, i + 1, j + 1);
  return (h00 * (1 - tx) + h10 * tx) * (1 - ty) + (h01 * (1 - tx) + h11 * tx) * ty;
}

// Central difference half a tile either side — separation is one full tile, so the
// divisor is 1. On the last solid cell of a lip this samples the DILATION, which is why
// the compiler runs it two rings past the paper: without it this reads void filler 40
// units down, reports a slope of -18, and the launch test converts that into 300 units/s
// straight down. The ball vanishes at the edge instead of flying off it.
function gradAt(g, wx, wy, out) {
  out[0] = heightAt(g, wx + 0.5, wy) - heightAt(g, wx - 0.5, wy);
  out[1] = heightAt(g, wx, wy + 0.5) - heightAt(g, wx, wy - 0.5);
  return out;
}

// Paper standing more than WALL_STEP above the ball is a cliff beside it, not ground it
// is about to land on (LAW 5.4). This is the one test that stops a falling ball climbing
// the tier it just fell off.
function wallAt(g, wx, wy, z) {
  return solidAt(g, wx, wy) === 1 && heightAt(g, wx, wy) > z + WALL_STEP;
}

// The isometric projection, exactly. Not to be rewritten once it works (LAW 4.x).
function projX(cam, wx, wy) {
  return (wx - wy - (cam.x - cam.y)) * (TILE / 2) + W / 2;
}
function projY(cam, wx, wy, wz) {
  return (wx + wy - (cam.x + cam.y)) * (TILE / 4)
       - (wz - cam.z) * Z_SCALE + H * BALL_Y;
}
