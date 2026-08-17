// RENDERING — banded isometric drawing straight off the lattice (LAW 4.5).
// The projection is not to be rewritten once it works.
//
// Nothing here is ever proof of anything. It runs against a recording canvas stub with
// no DOM in the suite, which is how tests 22, 34, 45 and 46 exist at all.

var RSTAT = { fills: 0, strokes: 0, cells: 0, props: 0 };

function rFill(ctx) { ctx.fill(); RSTAT.fills++; }
function rStroke(ctx) { ctx.stroke(); RSTAT.strokes++; }

// ---- shading ----------------------------------------------------------------
// LAW 12.1 — a slope you cannot see is unfair, not hard. Flat paper's Lambert lambda is
// 0.727 and the steepest thing anyone rolls on moves it a TENTH; quantised into twelve
// buckets that is one bucket, and a camber comes out the same colour as the flat lane
// beside it. So stretch the band the game actually occupies across the buckets BEFORE
// quantising. Flat ground still lands on bucket 7 of 12; what changes is that a 0.175
// cross-slope now moves it two buckets rather than none.
function shadeBucket(nx, ny, nz) {
  var lam = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
  var k = Math.floor(((lam - SHADE_LO) / (SHADE_HI - SHADE_LO)) * (SHADES - 1));
  return k < 0 ? 0 : (k > SHADES - 1 ? SHADES - 1 : k);
}

function clamp255(v) { return v < 0 ? 0 : (v > 255 ? 255 : v | 0); }

// surface x shade -> one css colour, computed once.
var SHADE_TABLE = (function () {
  var t = [];
  for (var s = 0; s < SURF_RGB.length; s++) {
    t[s] = [];
    for (var k = 0; k < SHADES; k++) {
      var l = 0.42 + 0.66 * (k / (SHADES - 1));
      t[s][k] = 'rgb(' + clamp255(SURF_RGB[s][0] * l) + ',' +
                         clamp255(SURF_RGB[s][1] * l) + ',' +
                         clamp255(SURF_RGB[s][2] * l) + ')';
    }
  }
  return t;
})();

// The backdrop wash, sampled. Slab side faces shade against this same ramp, so the
// further down the screen a wall runs the more it dissolves into the drop.
var SKY_STOPS = [[0.00, 244, 234, 212], [0.30, 196, 170, 172],
                 [0.58, 108, 92, 122], [0.80, 42, 36, 58], [1.00, 11, 10, 18]];
function skyAt(q) {
  if (q < 0) q = 0; else if (q > 1) q = 1;
  for (var i = 1; i < SKY_STOPS.length; i++) {
    if (q > SKY_STOPS[i][0]) continue;
    var a = SKY_STOPS[i - 1], b = SKY_STOPS[i];
    var f = (q - a[0]) / (b[0] - a[0]);
    return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f];
  }
  return [11, 10, 18];
}

var WALL_ROWS = 20;
var WALL_TABLE = (function () {
  var t = [];
  for (var s = 0; s < SURF_RGB.length; s++) {
    t[s] = [];
    for (var r = 0; r < WALL_ROWS; r++) {
      var q = r / (WALL_ROWS - 1);
      var sky = skyAt(0.25 + q * 0.75);
      // The cut edge of folded paper: the surface's own colour, darkened, dissolving
      // into the drop as it runs down the screen.
      var m = 0.62 - 0.42 * q;
      t[s][r] = 'rgb(' + clamp255(SURF_RGB[s][0] * m + sky[0] * q * 0.55) + ',' +
                         clamp255(SURF_RGB[s][1] * m + sky[1] * q * 0.55) + ',' +
                         clamp255(SURF_RGB[s][2] * m + sky[2] * q * 0.55) + ')';
    }
  }
  return t;
})();
var ABYSS = 'rgb(9,8,14)';
function wallRow(sy) {
  var r = Math.floor((sy / H) * WALL_ROWS);
  return r < 0 ? 0 : (r > WALL_ROWS - 1 ? WALL_ROWS - 1 : r);
}

// ---- the wind ---------------------------------------------------------------
// One global oscillator, and everything alive reads from it with a per-object phase.
// This is the whole of "the world must not feel static" and it costs one function.
// A flag that raises on a checkpoint and then stands rigid is a flag that only moved once.
function wind(t, phase) {
  return Math.sin(1.1 * (t + phase)) + 0.4 * Math.sin(2.53 * (t + phase));
}

// ---- the camera --------------------------------------------------------------
function newCam(ball) { return { x: ball.x, y: ball.y, z: ball.z }; }
function updateCamera(cam, ball, dt) {
  var k = 1 - Math.exp(-CAM_SMOOTH * dt);
  cam.x += (ball.x + ball.vx * CAM_LEAD - cam.x) * k;
  cam.y += (ball.y + ball.vy * CAM_LEAD - cam.y) * k;
  cam.z += (ball.z - cam.z) * k;
}

// ---- the backdrop -------------------------------------------------------------
// A void that is one colour is not a void, it is an absence of information. With nothing
// static anywhere in frame the eye locks onto the course's own boundary, and a boundary
// that holds still while everything else is featureless reads as THE BACKGROUND SLIDING.
var RIDGE = (function () {
  // Deterministic silhouettes — no RNG in any path the game takes. Three layers of folded
  // paper hills, each at its own parallax rate.
  var L = [];
  for (var i = 0; i < 3; i++) {
    var pts = [], n = 13;
    for (var k = 0; k <= n; k++) {
      var a = k * (1.7 + i * 0.9) + i * 2.1;
      pts.push(0.5 + 0.5 * Math.sin(a) + 0.28 * Math.sin(a * 2.3 + i));
    }
    L.push(pts);
  }
  return L;
})();

function drawBackdrop(ctx, cam, t) {
  var gr = ctx.createLinearGradient(0, 0, 0, H);
  for (var i = 0; i < SKY_STOPS.length; i++) {
    var s = SKY_STOPS[i];
    gr.addColorStop(s[0], 'rgb(' + s[1] + ',' + s[2] + ',' + s[3] + ')');
  }
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, W, H);
  RSTAT.fills++;

  // The camera moves against the wash at its own rate, on both axes, so there is
  // something fixed in frame for the eye to measure the course's motion against.
  var horizon = H * 0.30;
  for (var L = 0; L < 3; L++) {
    var rate = 0.06 + L * 0.055;
    var ox = -(cam.x - cam.y) * TILE * 0.5 * rate * 0.35;
    var oy = -(cam.x + cam.y) * TILE * 0.25 * rate * 0.5 + (cam.z * Z_SCALE) * rate * 0.5;
    var top = horizon - 118 + L * 46 + oy;
    var pts = RIDGE[L], n = pts.length - 1;
    var span = W * 1.9, step = span / n;
    var amp = 96 - L * 26;
    ctx.beginPath();
    ctx.moveTo(-W * 0.45 + ox, H);
    for (var k = 0; k <= n; k++)
      ctx.lineTo(-W * 0.45 + ox + k * step, top - pts[k] * amp);
    ctx.lineTo(-W * 0.45 + ox + span, H);
    ctx.closePath();
    var sky = skyAt(0.30 + L * 0.10);
    ctx.fillStyle = 'rgb(' + clamp255(sky[0] * 0.80) + ',' + clamp255(sky[1] * 0.78) + ',' +
                    clamp255(sky[2] * 0.88) + ')';
    rFill(ctx);
  }

  // Cloud shadows drift on the same oscillator everything alive reads from.
  for (var c = 0; c < 3; c++) {
    var w2 = wind(t, c * 3.1);
    var cx = ((c * 0.37 + t * 0.006 + w2 * 0.004) % 1) * (W + 500) - 250
           - (cam.x - cam.y) * TILE * 0.5 * 0.04;
    var cy = horizon - 70 + c * 34 + w2 * 5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 150 - c * 26, 17 - c * 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,248,232,' + (0.13 - c * 0.03).toFixed(3) + ')';
    rFill(ctx);
  }
}

// ---- prop volumes -------------------------------------------------------------
// Four primitives, in two or three flat tones each. No gradients, no outlines, lit from
// the terrain's own direction. Screen-axis-aligned polygon stacks are what this replaced
// and they read as flat: "the windmill and every item you made is just blocks put
// together". Every length here is a multiple of TILE or Z_SCALE.

function tone(rgb, m) {
  return 'rgb(' + clamp255(rgb[0] * m) + ',' + clamp255(rgb[1] * m) + ',' + clamp255(rgb[2] * m) + ')';
}
var LIT = 1.16, MID = 0.92, DARK = 0.66;

function orb(ctx, sx, sy, r, rgb) {
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.fillStyle = tone(rgb, MID); rFill(ctx);
  ctx.beginPath();
  ctx.ellipse(sx - r * 0.30, sy - r * 0.34, r * 0.62, r * 0.52, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = tone(rgb, LIT); rFill(ctx);
}

// A vertical cylinder: an elliptical cap, a lit half-body and a shaded half-body.
function tubeP(ctx, sx, sy, r, hgt, rgb) {
  var ry = r * 0.45;
  ctx.beginPath();
  ctx.moveTo(sx - r, sy);
  ctx.lineTo(sx - r, sy - hgt);
  ctx.lineTo(sx, sy - hgt);
  ctx.lineTo(sx, sy);
  ctx.closePath();
  ctx.fillStyle = tone(rgb, LIT); rFill(ctx);
  ctx.beginPath();
  ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - hgt);
  ctx.lineTo(sx + r, sy - hgt); ctx.lineTo(sx + r, sy);
  ctx.closePath();
  ctx.fillStyle = tone(rgb, DARK); rFill(ctx);
  ctx.beginPath();
  ctx.ellipse(sx, sy - hgt, r, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = tone(rgb, LIT * 1.06); rFill(ctx);
}

function coneP(ctx, sx, sy, r, hgt, rgb) {
  ctx.beginPath();
  ctx.moveTo(sx, sy - hgt);
  ctx.lineTo(sx - r, sy);
  ctx.lineTo(sx, sy + r * 0.42);
  ctx.closePath();
  ctx.fillStyle = tone(rgb, LIT); rFill(ctx);
  ctx.beginPath();
  ctx.moveTo(sx, sy - hgt);
  ctx.lineTo(sx, sy + r * 0.42);
  ctx.lineTo(sx + r, sy);
  ctx.closePath();
  ctx.fillStyle = tone(rgb, DARK); rFill(ctx);
}

// An isometric box: a top rhombus and the two camera-facing side faces, in three tones.
function boxIso(ctx, sx, sy, wx, wy, hgt, rgb) {
  var ax = wx * TILE / 2, ay = wx * TILE / 4;
  var bx = -wy * TILE / 2, by = wy * TILE / 4;
  var tx = sx, ty = sy - hgt;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx + ax, ty + ay);
  ctx.lineTo(tx + ax + bx, ty + ay + by);
  ctx.lineTo(tx + bx, ty + by);
  ctx.closePath();
  ctx.fillStyle = tone(rgb, LIT); rFill(ctx);
  ctx.beginPath();
  ctx.moveTo(tx + ax, ty + ay);
  ctx.lineTo(tx + ax + bx, ty + ay + by);
  ctx.lineTo(sx + ax + bx, sy + ay + by);
  ctx.lineTo(sx + ax, sy + ay);
  ctx.closePath();
  ctx.fillStyle = tone(rgb, MID); rFill(ctx);
  ctx.beginPath();
  ctx.moveTo(tx + bx, ty + by);
  ctx.lineTo(tx + ax + bx, ty + ay + by);
  ctx.lineTo(sx + ax + bx, sy + ay + by);
  ctx.lineTo(sx + bx, sy + by);
  ctx.closePath();
  ctx.fillStyle = tone(rgb, DARK); rFill(ctx);
}

// ---- the art roster ----------------------------------------------------------
// Every length below is authored against TILE, never against pixels. MAX_SPEED once moved
// 14 -> 26, TILE fell 96 -> 50 with it, and every prop in the game stayed the size it had
// been drawn for at 96. They were not merely weak, they were half-size.
var U = TILE / 50;                 // one "authored unit": TILE-relative, so nothing drifts

var ART = {
  tree: function (ctx, x, y, t, b) {
    var sway = wind(t, b.phase) * 3.5 * U;
    tubeP(ctx, x, y, 4 * U, 22 * U, [150, 116, 84]);
    coneP(ctx, x + sway * 0.5, y - 20 * U, 21 * U, 34 * U, [92, 158, 96]);
    coneP(ctx, x + sway, y - 38 * U, 15 * U, 26 * U, [112, 178, 108]);
  },
  tee: function (ctx, x, y) {
    tubeP(ctx, x, y, 2.6 * U, 11 * U, [236, 228, 206]);
    ctx.beginPath();
    ctx.ellipse(x, y - 11 * U, 5.2 * U, 2.4 * U, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgb(250,244,224)'; rFill(ctx);
  },
  bench: function (ctx, x, y) {
    boxIso(ctx, x, y, 1.5, 0.5, 9 * U, [198, 156, 112]);
    boxIso(ctx, x, y - 9 * U, 1.5, 0.5, 4 * U, [176, 134, 96]);
  },
  post: function (ctx, x, y) {
    tubeP(ctx, x, y, 3 * U, 26 * U, [232, 226, 210]);
    tubeP(ctx, x, y - 26 * U, 4.4 * U, 5 * U, [232, 96, 96]);
  },
  windmill: function (ctx, x, y, t, b) {
    // A rotor with a HUB. The first build drew three blades orbiting nothing.
    // The tower tapers into the cap rather than being a cube with a hat balanced on it.
    tubeP(ctx, x, y, 13 * U, 22 * U, [238, 232, 214]);
    tubeP(ctx, x, y - 22 * U, 9 * U, 8 * U, [226, 219, 198]);
    coneP(ctx, x, y - 30 * U, 12 * U, 16 * U, [216, 108, 96]);
    var a = t * 1.6 + b.phase, hy = y - 34 * U;
    for (var i = 0; i < 4; i++) {
      var an = a + i * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(x, hy);
      ctx.lineTo(x + Math.cos(an) * 25 * U, hy + Math.sin(an) * 12 * U);
      ctx.lineTo(x + Math.cos(an + 0.34) * 22 * U, hy + Math.sin(an + 0.34) * 11 * U);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? 'rgb(226,220,200)' : 'rgb(250,246,232)';
      rFill(ctx);
    }
    orb(ctx, x, hy, 4.5 * U, [120, 104, 96]);
  },
  washer: function (ctx, x, y) {
    tubeP(ctx, x, y, 3 * U, 13 * U, [190, 186, 176]);
    orb(ctx, x, y - 13 * U, 7 * U, [156, 190, 210]);    // seated ON the post, not floating
  },
  mallet: function (ctx, x, y, t, b) {
    var lean = Math.sin(b.def.omega * t + b.phase) * 0.5;
    ctx.save(); ctx.translate(x, y - 30 * U); ctx.rotate(lean); ctx.translate(-x, -(y - 30 * U));
    tubeP(ctx, x, y, 2.4 * U, 30 * U, [176, 140, 100]);
    boxIso(ctx, x, y - 30 * U, 1.0, 0.6, 12 * U, [214, 92, 84]);
    ctx.restore();
  },
  cart: function (ctx, x, y) {
    // Wheels at the BOTTOM CORNERS of the box's two camera-facing faces. Centred on the
    // anchor they read as two dots painted on its lid; tucked wholly behind it they read
    // as nothing at all. The prop sheet showed both in a second.
    boxIso(ctx, x, y, 1.6, 1.0, 11 * U, [212, 206, 188]);
    orb(ctx, x + 32 * U, y + 20 * U, 7 * U, [78, 72, 68]);
    orb(ctx, x - 2 * U, y + 30 * U, 7 * U, [78, 72, 68]);
  },
  gate: function (ctx, x, y) {
    tubeP(ctx, x, y, 2.4 * U, 24 * U, [230, 224, 208]);
    boxIso(ctx, x, y - 24 * U, 1.3, 0.25, 8 * U, [240, 176, 90]);
  },
  golfer: function (ctx, x, y, t, b) {
    tubeP(ctx, x, y, 5 * U, 18 * U, [92, 122, 182]);
    orb(ctx, x, y - 24 * U, 6.5 * U, [232, 200, 168]);
    coneP(ctx, x, y - 28 * U, 8 * U, 7 * U, [232, 96, 96]);
    var f = b.face || 0;
    ctx.beginPath();
    ctx.moveTo(x, y - 16 * U);
    ctx.lineTo(x + Math.cos(f) * 18 * U, y - 4 * U + Math.sin(f) * 9 * U);
    ctx.strokeStyle = 'rgb(228,224,208)'; ctx.lineWidth = 2.4 * U; rStroke(ctx);
  },
  dog: function (ctx, x, y, t, b) {
    var f = b.face || 0, d = Math.cos(f) >= 0 ? 1 : -1;
    boxIso(ctx, x, y, 0.9, 0.5, 8 * U, [204, 154, 96]);
    orb(ctx, x + 9 * U * d, y - 10 * U, 5 * U, [216, 168, 108]);
    coneP(ctx, x + 13 * U * d, y - 11 * U, 3.4 * U, 5 * U, [180, 130, 80]);
  },
  goose: function (ctx, x, y, t, b) {
    var f = b.face || 0, d = Math.cos(f) >= 0 ? 1 : -1;
    orb(ctx, x, y - 7 * U, 8 * U, [246, 244, 236]);
    tubeP(ctx, x + 5 * U * d, y - 10 * U, 2.2 * U, 13 * U, [238, 236, 226]);
    orb(ctx, x + 5 * U * d, y - 24 * U, 3.4 * U, [238, 236, 226]);
    ctx.beginPath();
    ctx.moveTo(x + 5 * U * d, y - 25 * U);
    ctx.lineTo(x + 12 * U * d, y - 23 * U);
    ctx.lineTo(x + 5 * U * d, y - 21 * U);
    ctx.closePath();
    ctx.fillStyle = 'rgb(240,160,64)'; rFill(ctx);
  },
  rival: function (ctx, x, y, t, b) {
    // The one threat you beat rather than avoid, so it reads as a marble, not a machine.
    var r = b.r * TILE / Math.SQRT2 * 0.9;
    orb(ctx, x, y - r * 0.5, r, [196, 108, 168]);
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y - r * 0.75, r * 0.30, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; rFill(ctx);
  },
  sprinkler: function (ctx, x, y, t, b) {
    tubeP(ctx, x, y, 2.6 * U, 9 * U, [150, 168, 148]);
    if (!b.on) return;
    var a = b.def.omega * t + b.phase;
    for (var i = 0; i < 6; i++) {
      var an = a * 2 + i * Math.PI / 3;
      ctx.beginPath();
      ctx.moveTo(x, y - 9 * U);
      ctx.lineTo(x + Math.cos(an) * b.def.r * TILE * 0.5,
                 y - 9 * U + Math.sin(an) * b.def.r * TILE * 0.25);
      ctx.strokeStyle = 'rgba(150,205,235,0.6)'; ctx.lineWidth = 2 * U; rStroke(ctx);
    }
  },
  muncher: function (ctx, x, y, t, b) {
    // A RIM around the mouth, not a body over it. Drawn the other way round the housing
    // covered the very thing that takes the ball.
    var mouth = b.def.r * 0.28 * TILE / Math.SQRT2;
    ctx.beginPath();
    ctx.ellipse(x, y - 4 * U, mouth * 1.34, mouth * 0.72, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgb(138,132,150)'; rFill(ctx);
    ctx.beginPath();
    ctx.moveTo(x - mouth * 1.34, y - 4 * U);
    ctx.lineTo(x - mouth * 1.34, y + 3 * U);
    ctx.lineTo(x + mouth * 1.34, y + 3 * U);
    ctx.lineTo(x + mouth * 1.34, y - 4 * U);
    ctx.closePath();
    ctx.fillStyle = 'rgb(96,90,108)'; rFill(ctx);
    ctx.beginPath();
    ctx.ellipse(x, y - 4 * U, mouth, mouth * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgb(18,15,24)'; rFill(ctx);
    // THE POINT OF NO RETURN, drawn. Inside r*(1 - K/pull) no amount of input climbs back
    // out, and a point of no return you cannot see is just an unfair death.
    var hold = muncherHold(b.def);
    ctx.beginPath();
    ctx.ellipse(x, y, hold * TILE / Math.SQRT2, hold * TILE / (2 * Math.SQRT2), 0, 0, Math.PI * 2);
    ctx.strokeStyle = COL_WARN; ctx.lineWidth = 2 * U;
    ctx.setLineDash([7 * U, 6 * U]);
    rStroke(ctx);
    ctx.setLineDash([]);
  },
};

// ---- the ball -----------------------------------------------------------------
// Five things make it read as a three-dimensional golf ball, and they are cheap: a
// contact shadow, dimples that actually rotate, radial shading from the terrain's own
// light, squash on impact, and the flattened state — which is a different SHAPE, not a
// different colour. It is the thing on screen the whole time.
var VIEW = (function () {
  var v = [-1, -1, 1.6], m = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / m, v[1] / m, v[2] / m];
})();

var DIMPLES = (function () {
  // A deterministic Fibonacci sphere. No RNG anywhere in a path the game takes.
  var n = 34, out = [], ga = Math.PI * (3 - Math.sqrt(5));
  for (var i = 0; i < n; i++) {
    var zz = 1 - (2 * i + 1) / n;
    var r = Math.sqrt(Math.max(0, 1 - zz * zz));
    var th = ga * i;
    out.push([Math.cos(th) * r, Math.sin(th) * r, zz]);
  }
  return out;
})();

function drawBall(ctx, run, cam) {
  var b = run.ball, g = run.grid;
  if (b.state === ST.HOLED && run.holeT > HOLE_TIME + 1.2) return;

  var sx = projX(cam, b.x, b.y);
  var sy = projY(cam, b.x, b.y, b.z);
  var r = BALL_R * TILE / Math.SQRT2;

  // The contact shadow reads the SOLID MASK, exactly as physics does — not heightAt,
  // which over the void answers with the two-ring dilation and sails the shadow out over
  // nothing.
  if (solidAt(g, b.x, b.y) === 1 && b.state !== ST.SINK) {
    var gz = heightAt(g, b.x, b.y);
    var drop = Math.max(0, b.z - gz);
    var f = 1 / (1 + drop * 0.55);
    ctx.beginPath();
    ctx.ellipse(projX(cam, b.x, b.y), projY(cam, b.x, b.y, gz),
                r * 0.95 * f, r * 0.48 * f, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(18,26,20,' + (0.34 * f).toFixed(3) + ')';
    rFill(ctx);
  }

  var sq = b.squash, flat = b.flat > 0;
  var rx = r * (flat ? 1.5 : 1 + sq * 0.30);
  var ry = r * (flat ? 0.22 : 1 - sq * 0.32);

  ctx.save();
  if (b.state === ST.HOLED) {
    // Clipped TO the opening, so the near lip cuts the ball off. A flat dark ellipse
    // sorted in front of the ball is the single most-reported defect this game has had.
    var c = run.course.cup;
    var cx = projX(cam, c.x, c.y), cy = projY(cam, c.x, c.y, c.z);
    var crx = c.r * TILE / Math.SQRT2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, crx, crx / 2, 0, 0, Math.PI * 2);
    ctx.clip();
  }

  ctx.beginPath();
  ctx.ellipse(sx, sy - ry, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgb(238,240,232)'; rFill(ctx);
  ctx.beginPath();
  ctx.ellipse(sx + rx * 0.34, sy - ry + ry * 0.30, rx * 0.72, ry * 0.72, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgb(178,186,178)'; rFill(ctx);
  ctx.beginPath();
  ctx.ellipse(sx - rx * 0.30, sy - ry - ry * 0.32, rx * 0.50, ry * 0.44, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgb(252,253,248)'; rFill(ctx);

  // Dimples that ACTUALLY ROTATE: ball.spin is accumulated rolling-without-slipping about
  // ball.spinAxis, so they turn at the speed the ball is travelling and stop when it stops.
  if (!flat) {
    var ax = -b.spinAxis[1], ay = b.spinAxis[0], az = 0;   // the rolling axis, horizontal
    var ca = Math.cos(b.spin), sa = Math.sin(b.spin);
    ctx.beginPath();
    for (var i = 0; i < DIMPLES.length; i++) {
      var d = DIMPLES[i];
      // Rodrigues about (ax, ay, 0), which is a unit vector by construction.
      var dot = d[0] * ax + d[1] * ay;
      var vx = d[0] * ca + (ay * d[2] - az * d[1]) * sa + ax * dot * (1 - ca);
      var vy = d[1] * ca + (az * d[0] - ax * d[2]) * sa + ay * dot * (1 - ca);
      var vz = d[2] * ca + (ax * d[1] - ay * d[0]) * sa;
      if (vx * VIEW[0] + vy * VIEW[1] + vz * VIEW[2] < 0.12) continue;
      var px = (vx - vy) * 0.7071, py = -(vz * 0.86 + (vx + vy) * 0.26);
      var dr = rx * 0.11 * (0.55 + 0.45 * (vx * VIEW[0] + vy * VIEW[1] + vz * VIEW[2]));
      ctx.moveTo(sx + px * rx * 0.92 + dr, sy - ry + py * ry * 0.92);
      ctx.arc(sx + px * rx * 0.92, sy - ry + py * ry * 0.92, dr, 0, Math.PI * 2);
    }
    ctx.fillStyle = 'rgba(150,160,152,0.55)'; rFill(ctx);
  }
  ctx.restore();
}

// LAW 4.5 — the ball is the exception to sorting on wx+wy. The moment it is off the paper
// and below the paper beside it, height is the whole of the difference, and at 1.4 bands
// per unit a drop of ONE unit outweighs any fixed sprite bias.
function ballDepth(run) {
  var b = run.ball, g = run.grid;
  var flat = b.x + b.y + PROP_BIAS;
  if (b.state === ST.SINK) return flat;      // composed at the water's own depth
  var best = flat;
  for (var t = BALL_STEP; t <= BALL_REACH; t += BALL_STEP) {
    var x = b.x + t, y = b.y + t;
    if (solidAt(g, x, y) !== 1) continue;
    if (b.z + Z_BAND * t > heightAt(g, x, y)) continue;
    // The CELL's band, not the distance walked. A quarter-tile stride steps straight over
    // lips the ball clears by a hand's width, which is the whole question.
    var k = Math.floor(x) + Math.floor(y) - 0.5;
    if (k < best) best = k;
    break;
  }
  return best;
}

// ---- the cup ------------------------------------------------------------------
// A 3-D shaft, sorted BEHIND the ball: opening, lit far wall, floor.
function drawCup(ctx, run, cam) {
  var c = run.course.cup;
  var cx = projX(cam, c.x, c.y), cy = projY(cam, c.x, c.y, c.z);
  var rx = c.r * TILE / Math.SQRT2, ry = rx / 2;
  var dz = CUP_DEPTH * Z_SCALE;

  ctx.beginPath();                                   // the shaft's far wall
  ctx.moveTo(cx - rx, cy);
  ctx.lineTo(cx - rx, cy + dz);
  ctx.lineTo(cx + rx, cy + dz);
  ctx.lineTo(cx + rx, cy);
  ctx.closePath();
  ctx.fillStyle = 'rgb(52,46,42)'; rFill(ctx);
  ctx.beginPath();                                   // the floor, lit
  ctx.ellipse(cx, cy + dz, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgb(96,84,70)'; rFill(ctx);
  ctx.beginPath();                                   // the opening
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgb(28,24,26)'; rFill(ctx);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.strokeStyle = 'rgba(246,241,226,0.6)'; ctx.lineWidth = 2 * U; rStroke(ctx);
}

// ---- flags --------------------------------------------------------------------
function drawFlag(ctx, run, cam, i) {
  var f = run.course.flags[i], g = run.grid;
  var z = heightAt(g, f.x, f.y);
  var raise = run.flagRaise[i];
  var sx = projX(cam, f.x, f.y), sy = projY(cam, f.x, f.y, z);
  var poleH = (14 + 20 * raise) * U;

  ctx.beginPath();                                   // the trigger, drawn on the ground
  ctx.ellipse(sx, sy, f.r * TILE / Math.SQRT2, f.r * TILE / (2 * Math.SQRT2), 0, 0, Math.PI * 2);
  ctx.strokeStyle = raise > 0 ? 'rgba(255,93,93,0.30)' : 'rgba(246,241,226,0.30)';
  ctx.lineWidth = 2 * U; rStroke(ctx);

  tubeP(ctx, sx, sy, 1.6 * U, poleH, [236, 232, 216]);
  if (raise <= 0) return;
  // The cloth BENDS in the wind. A flag that raises on a checkpoint and then stands rigid
  // is a flag that only moved once.
  var w = wind(run.t, i * 1.7) * 5 * U;
  var top = sy - poleH;
  ctx.beginPath();
  ctx.moveTo(sx, top);
  ctx.quadraticCurveTo(sx + 14 * U + w, top + 2 * U, sx + 24 * U + w * 1.6, top + 8 * U);
  ctx.quadraticCurveTo(sx + 13 * U + w, top + 10 * U, sx, top + 13 * U);
  ctx.closePath();
  ctx.fillStyle = COL_FLAG; rFill(ctx);
}

// ---- the sweep -----------------------------------------------------------------
// Terrain one ascending diagonal band at a time, each cell emitting its own two
// camera-facing side faces. That is an exact painter's algorithm here, and
// all-walls-then-all-ground is not. Props and the ball are MERGED into the same sweep —
// painting them over the finished world puts a ball that fell off the BACK of a slab in
// front of it.

function bandIndex(course) {
  if (course.bands) return course.bands;
  var g = course.grid, m = {};
  // Bands are keyed in WORLD units — wx + wy — not grid indices. Sprite depth keys are
  // world-space too (ballDepth is), and a grid-index band is that minus (ox + oy): the
  // two disagreeing by the origin offset puts the ball behind the ground it stands on.
  for (var j = 0; j < g.ny; j++) for (var i = 0; i < g.nx; i++) {
    if (!g.solid[j * g.nx + i]) continue;
    var b = (g.ox + i) + (g.oy + j);
    (m[b] || (m[b] = [])).push(i, j);
  }
  var lo = Infinity, hi = -Infinity;
  Object.keys(m).forEach(function (k) {
    var n = +k; if (n < lo) lo = n; if (n > hi) hi = n;
  });
  course.bands = { map: m, lo: lo, hi: hi };
  return course.bands;
}

function collectSprites(run, cam) {
  var out = [];
  var c = run.course, g = run.grid;
  for (var i = 0; i < run.bodies.length; i++) {
    var b = run.bodies[i];
    if (!b.active) continue;
    out.push({ k: b.x + b.y + PROP_BIAS, kind: 'body', b: b });
  }
  for (var f = 0; f < c.flags.length; f++)
    out.push({ k: c.flags[f].x + c.flags[f].y + PROP_BIAS, kind: 'flag', i: f });
  out.push({ k: c.cup.x + c.cup.y, kind: 'cup' });
  out.push({ k: ballDepth(run), kind: 'ball' });
  out.sort(function (a, b2) { return a.k - b2.k; });
  return out;
}

function drawSprite(ctx, run, cam, s) {
  if (s.kind === 'ball') { drawBall(ctx, run, cam); return; }
  if (s.kind === 'cup') { drawCup(ctx, run, cam); return; }
  if (s.kind === 'flag') { drawFlag(ctx, run, cam, s.i); return; }
  var b = s.b;
  var sx = projX(cam, b.x, b.y), sy = projY(cam, b.x, b.y, b.z);
  // A prop draws OUTWARD from its anchor, so the pad is the furthest anything reaches.
  // Never cull the ball or the cup: the camera is on one and aimed at the other.
  if (sx < -PROP_PAD_X || sx > W + PROP_PAD_X) return;
  if (sy < -PROP_PAD_TOP || sy > H + PROP_PAD_BOTTOM) return;
  RSTAT.props++;

  // Every mover paints its own footprint at its true r + BALL_R, and smears a trail along
  // its own velocity. A hazard with no motion tell is a hazard the player learns by dying.
  if (b.prim !== 'STATIC') {
    var fr = (b.r + BALL_R) * TILE / Math.SQRT2;
    ctx.beginPath();
    ctx.ellipse(sx, sy, fr, fr / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,166,58,0.22)'; rFill(ctx);
    var sp = Math.hypot(b.vx, b.vy);
    if (sp > 0.6) {
      var tx = projX(cam, b.x - b.vx * 0.18, b.y - b.vy * 0.18);
      var ty = projY(cam, b.x - b.vx * 0.18, b.y - b.vy * 0.18, b.z);
      ctx.beginPath();
      ctx.moveTo(sx, sy); ctx.lineTo(tx, ty);
      ctx.strokeStyle = 'rgba(255,166,58,0.30)'; ctx.lineWidth = fr * 0.8; rStroke(ctx);
    }
  }
  var art = ART[b.art];
  if (art) art(ctx, sx, sy, run.t, b);
}

function sweep(ctx, run, cam) {
  var c = run.course, g = run.grid, W1 = g.nx + 1;
  var bi = bandIndex(c);
  var camS = cam.x + cam.y;
  var sprites = collectSprites(run, cam);
  var si = 0;

  // The band range, bounded by the course's own height spread rather than guessed.
  var zSlack = ((c.grid._zSpread === undefined)
    ? (c.grid._zSpread = zSpread(c.grid)) : c.grid._zSpread);
  var slack = (zSlack * Z_SCALE + CELL_UP + CELL_DOWN) / (TILE / 4) + 2;
  var b0 = Math.max(bi.lo, Math.floor(camS - (H * BALL_Y + CELL_UP) / (TILE / 4) - slack));
  var b1 = Math.min(bi.hi, Math.ceil(camS + (H * (1 - BALL_Y) + CELL_DOWN) / (TILE / 4) + slack));

  var tops = {}, walls = {}, folds = [], creases = [];

  for (var band = b0; band <= b1; band++) {
    while (si < sprites.length && sprites[si].k < band) drawSprite(ctx, run, cam, sprites[si++]);
    var list = bi.map[band];
    if (!list) continue;

    for (var q = 0; q < list.length; q += 2) {
      var i = list[q], j = list[q + 1];
      var ck = j * g.nx + i;
      if (!g.solid[ck]) continue;                       // a fragile tile that has gone
      var x0 = g.ox + i, y0 = g.oy + j;

      var hA = g.h[j * W1 + i], hB = g.h[j * W1 + i + 1];
      var hD = g.h[(j + 1) * W1 + i], hC = g.h[(j + 1) * W1 + i + 1];
      var hc = (hA + hB + hC + hD) * 0.25;

      var ax = projX(cam, x0 + 0.5, y0 + 0.5), ay = projY(cam, x0 + 0.5, y0 + 0.5, hc);
      if (ax < -CELL_SIDE || ax > W + CELL_SIDE) continue;
      if (ay < -CELL_UP || ay > H + CELL_DOWN) continue;
      RSTAT.cells++;

      var pAx = projX(cam, x0, y0),         pAy = projY(cam, x0, y0, hA);
      var pBx = projX(cam, x0 + 1, y0),     pBy = projY(cam, x0 + 1, y0, hB);
      var pCx = projX(cam, x0 + 1, y0 + 1), pCy = projY(cam, x0 + 1, y0 + 1, hC);
      var pDx = projX(cam, x0, y0 + 1),     pDy = projY(cam, x0, y0 + 1, hD);

      var surf = g.surf[ck];
      var gx = ((hB - hA) + (hC - hD)) * 0.5;
      var gy = ((hD - hA) + (hC - hB)) * 0.5;
      var nl = Math.hypot(gx, gy, 1);
      var sk = shadeBucket(-gx / nl, -gy / nl, 1 / nl);
      var key = surf * SHADES + sk;
      (tops[key] || (tops[key] = [])).push(pAx, pAy, pBx, pBy, pCx, pCy, pDx, pDy);

      // Terrain is continuous across any connected run of paper — neighbouring cells
      // share corners — so the only true steps in this world are the cliffs across a
      // void. A wall goes exactly where the neighbour is not there.
      var eastVoid = (i + 1 >= g.nx) || !g.solid[ck + 1];
      var southVoid = (j + 1 >= g.ny) || !g.solid[ck + g.nx];
      if (eastVoid) {
        (walls[surf] || (walls[surf] = [])).push(pBx, pBy, pCx, pCy);
        if (pBy < H && pBy > -TILE) creases.push(pBx, pBy, pCx, pCy);
      }
      if (southVoid) {
        (walls[surf] || (walls[surf] = [])).push(pDx, pDy, pCx, pCy);
        if (pDy < H && pDy > -TILE) creases.push(pDx, pDy, pCx, pCy);
      }
      // Fold lines: the papercraft. Only where there IS a neighbour — an edge over the
      // void is a cut, not a fold, and the wall below it already reads as one.
      if (!eastVoid && ay > -TILE && ay < H) folds.push(pBx, pBy, pCx, pCy);
      if (!southVoid && ay > -TILE && ay < H) folds.push(pDx, pDy, pCx, pCy);
    }

    flushWalls(ctx, walls);
    flushTops(ctx, tops);
    flushLines(ctx, folds, 'rgba(246,241,226,0.30)', 1);
    flushCreases(ctx, creases);
  }
  while (si < sprites.length) drawSprite(ctx, run, cam, sprites[si++]);
}

function zSpread(g) {
  var lo = Infinity, hi = -Infinity;
  for (var k = 0; k < g.h.length; k++) {
    if (!g.hp[k]) continue;
    if (g.h[k] < lo) lo = g.h[k];
    if (g.h[k] > hi) hi = g.h[k];
  }
  return hi - lo;
}

// Bucketed by surface AND shade, so the visible course is a few dozen fills per band
// rather than a few thousand cells. Within one band nothing overlaps anything else in it,
// which is what makes the bucketing safe: the painter's order is BETWEEN bands.
function flushTops(ctx, tops) {
  for (var key in tops) {
    var q = tops[key];
    ctx.beginPath();
    for (var i = 0; i < q.length; i += 8) {
      ctx.moveTo(q[i], q[i + 1]);
      ctx.lineTo(q[i + 2], q[i + 3]);
      ctx.lineTo(q[i + 4], q[i + 5]);
      ctx.lineTo(q[i + 6], q[i + 7]);
      ctx.closePath();
    }
    ctx.fillStyle = SHADE_TABLE[(key / SHADES) | 0][key % SHADES];
    rFill(ctx);
    delete tops[key];
  }
}

// Wall bottoms are ABSOLUTE screen coordinates, not an offset below the wall's own edge:
// anchored to its own edge, a slab you have already passed stops reaching the frame and
// the band sweep then culls it outright — the ground behind you despawns as you descend.
//
// One fill per surface per band, down a vertical gradient. A flat colour keyed to the
// wall's own top is what this replaced: a wall that starts near the horizon then stayed
// bright the whole way to the bottom of the frame, and the abyss stopped reading as depth.
// Every wall in a band starts at nearly the same screen y, so one gradient serves them all.
function flushWalls(ctx, walls) {
  for (var key in walls) {
    var q = walls[key];
    var top = Infinity;
    ctx.beginPath();
    for (var i = 0; i < q.length; i += 4) {
      if (q[i + 1] < top) top = q[i + 1];
      if (q[i + 3] < top) top = q[i + 3];
      ctx.moveTo(q[i], q[i + 1]);
      ctx.lineTo(q[i + 2], q[i + 3]);
      ctx.lineTo(q[i + 2], WALL_BOTTOM);
      ctx.lineTo(q[i], WALL_BOTTOM);
      ctx.closePath();
    }
    var gr = ctx.createLinearGradient(0, top, 0, WALL_BOTTOM);
    gr.addColorStop(0, WALL_TABLE[key][wallRow(top)]);
    gr.addColorStop(0.42, WALL_TABLE[key][Math.min(WALL_ROWS - 1, wallRow(top) + 7)]);
    gr.addColorStop(1, ABYSS);
    ctx.fillStyle = gr;
    rFill(ctx);
    delete walls[key];
  }
}

function flushLines(ctx, pts, style, width) {
  if (!pts.length) return;
  ctx.beginPath();
  for (var i = 0; i < pts.length; i += 4) {
    ctx.moveTo(pts[i], pts[i + 1]);
    ctx.lineTo(pts[i + 2], pts[i + 3]);
  }
  ctx.strokeStyle = style; ctx.lineWidth = width;
  rStroke(ctx);
  pts.length = 0;
}

// Vertical creases run WALL_CREASE world units down a wall and stop. Culled against the
// frame, because a crease hundreds of pixels off screen still costs a stroke.
function flushCreases(ctx, pts) {
  if (!pts.length) return;
  var drop = WALL_CREASE * Z_SCALE;
  ctx.beginPath();
  var any = false;
  for (var i = 0; i < pts.length; i += 4) {
    for (var e = 0; e < 2; e++) {
      var x = pts[i + e * 2], y = pts[i + e * 2 + 1];
      if (x < -8 || x > W + 8) continue;
      if (y > H) continue;
      var y1 = Math.min(y + drop, H);
      if (y1 <= 0) continue;
      ctx.moveTo(x, Math.max(y, 0)); ctx.lineTo(x, y1);
      any = true;
    }
  }
  pts.length = 0;
  if (!any) return;
  ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 1;
  rStroke(ctx);
}

function drawWorld(ctx, run, cam) {
  RSTAT.fills = 0; RSTAT.strokes = 0; RSTAT.cells = 0; RSTAT.props = 0;
  drawBackdrop(ctx, cam, run.t);
  sweep(ctx, run, cam);
}
