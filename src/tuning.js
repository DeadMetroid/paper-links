// EVERY NUMBER IN THE GAME LIVES HERE AND NOWHERE ELSE.
//
// These are measured facts, not preferences. Changing one requires re-measuring it.
// Where a value is DERIVED it is computed here, never typed — typing a derived number
// is how it drifts away from the thing it was derived from.

// ---- physics ----------------------------------------------------------------
var G          = 30;        // gravity, world units/s^2
var ROLL       = 5 / 7;     // solid-sphere rolling factor, 1/(1 + I/mR^2), I = (2/5)mR^2
var K          = 9.0;       // player input acceleration, units/s^2      (LAW 5.1: LOW)
var MU         = 0.32;      // base linear rolling drag, per second      (LAW 5.1: LOW)
var E          = 0.35;      // restitution — papercraft is dead, not bouncy
var MAX_SPEED  = 26;        // hard horizontal speed clamp, applied EVERY tick
var BALL_R     = 0.32;      // ball radius in tiles
var DT         = 1 / 120;   // fixed simulation timestep
var AIR_INPUT  = 0.25;      // fraction of K available while airborne
var EPS        = 1e-4;      // launch-test epsilon
var CONTACT    = 0.02;      // separation below which the ball still feels the ground
var WALL_STEP  = 0.8;       // units a falling ball may rise onto on landing
var FALL_TIME  = 0.9;       // seconds of visible fall before the respawn resolves
var FALL_DRIFT = 0.35;      // fraction of horizontal speed kept once falling
var RESPAWN_HOLD = 2.0;     // seconds after a respawn before input is answered
var SINK_RATE  = 1.6;       // units/s the ball settles once in water
var SINK_TIME  = 1.0;       // seconds from touching water to the respawn
var FLAT_DRAG  = 3.4;       // drag multiplier while flattened
var BREAK_TIME = 0.55;      // seconds a fragile tile holds after first touch
var BELT_SPEED = 11;        // units/s a belt will carry a ball along itself
var BELT_ACC   = 14;        // units/s^2 it closes the gap at
var RIVAL_DRAG = 1.2, RIVAL_KNOCK = 0.7, RIVAL_DOWN = 2.6;
var SEEK_LOOK  = 1.3,  SEEK_CLEAR = 0.45;
var CAM_LEAD   = 0.35, CAM_SMOOTH = 6.0;
var SQUASH_DECAY = 0.12, IMPACT_MIN = 1.5, IMPACT_REF = 12;
var VTERM_MAX  = 2.0;       // max terminal speed permitted at a flag or a tee (test 5)

// DERIVED, never typed. The steepness above which input cannot arrest the ball.
var SLOPE_CRIT = K / (ROLL * G);                                   // = 0.42

// ---- the level compiler -----------------------------------------------------
var VOID_DEPTH = 40;        // how far below the lowest surface the void floor sits
var DEATH_DROP = 4;         // course.deathZ = lowestSurface - this
var SEAM_TOL   = 0.02;      // corner disagreement over this is a reported seam

// ---- checkpoints (section 10) ----------------------------------------------
var GATE_R_MIN = 1.1;       // no trigger is ever smaller than this
var GATE_MARGIN = 0.2;      // slack past the furthest a ball's centre can be
var NECK_MAX   = 4.2;       // paper across the run at a flag may not exceed this
var CUP_CLEAR  = 14;        // tiles of route a flag must leave still to drive
var FLAG_RAISE = 0.8;       // seconds a claimed flag takes to raise

// ---- the clock (section 11) -------------------------------------------------
var CREDIT_DRAIN = 9;       // s/s the HUD drains a checkpoint's credit at
var RECEIPT_TIME = 1.6;     // seconds the "-3.0s" receipt stays beside the clock
var BANNER_TIME  = 1.6;     // seconds the BALL LOST banner holds

// ---- the view — DERIVED, never chosen (section 5) ---------------------------
// The camera must see at least MAX_SPEED*1.2 world units ahead of the ball on flat
// ground or the reaction-time budget is unsatisfiable. Screen-vertical advances
// sqrt(2)/4 * TILE px per world unit of descent. Pick TILE first and you have chosen
// the difficulty by accident.
var W = 1280, H = 900, BALL_Y = 0.38;
var AHEAD_PX = H * (1 - BALL_Y);                                   // = 558
var TILE     = Math.floor(AHEAD_PX / ((Math.SQRT2 / 4) * MAX_SPEED * 1.2));   // = 50
var Z_SCALE  = Math.round(TILE * 0.36);                            // = 18
var Z_BAND   = (TILE / 2) / Z_SCALE;                               // = 1.389 bands/unit

// ---- rendering (section 12) -------------------------------------------------
var SHADES     = 12;
var SHADE_LO   = 0.34, SHADE_HI = 0.92;   // LAW 12.1: the lambda band the game occupies
var PROP_BIAS  = 1.5;                     // bands a ground-standing prop sorts behind by
var BALL_REACH = 3;                       // tiles the ball's depth ray walks
var BALL_STEP  = 0.1;                     // and the stride it walks them in
var CUP_DEPTH  = 1.6;                     // world units the cup shaft drops
var HOLE_TIME  = 0.7, HOLE_SETTLE = 0.3;  // seconds; the settle is inside the drop
var IRIS_TIME  = 0.55;
var WALL_BOTTOM = H + 40;                 // ABSOLUTE screen px, not an offset
var WALL_CREASE = 13;                     // world units a vertical crease runs down

// Cull margins. Settled by hashing posed frames, not by arithmetic — that bound was got
// wrong twice by reasoning about it. Do not re-derive these.
var CELL_SPREAD = 3;                                   // measured worst across six: 1.23
var CELL_UP     = CELL_SPREAD * Z_SCALE + TILE;        // = 104 px
var CELL_DOWN   = TILE / 2 + CELL_SPREAD * Z_SCALE + TILE;  // = 129 px
var CELL_SIDE   = 200;    // a no-op; every value tried below it moved pixels. Leave it.
var PROP_PAD_X = 300, PROP_PAD_TOP = 400, PROP_PAD_BOTTOM = 260;

// ---- audio (section 13) -----------------------------------------------------
var ROLL_LO = 420, ROLL_HI = 2700;        // Hz the bandpass centre runs between
var NOISE_SECONDS = 2;                    // seeded loop length

// ---- surfaces ---------------------------------------------------------------
var SURF = {
  FAIRWAY: 0, GREEN: 1, ROUGH: 2, SAND: 3,
  WATER: 4, BELT: 5, FRAGILE: 6, CRACKED: 7,
};
// The first five differ only by drag. The last three carry RULES, which is what a drag
// coefficient cannot buy.
var SURF_DRAG = [1.0, 0.55, 2.6, 6.0, 1.4, 1.0, 1.0, 1.0];
var SURF_NAME = ['FAIRWAY', 'GREEN', 'ROUGH', 'SAND', 'WATER', 'BELT', 'FRAGILE', 'CRACKED'];

// Colour is identity. Two accent colours carrying sixteen objects is what this replaced.
var SURF_RGB = [
  [168, 213, 162],  // FAIRWAY
  [198, 232, 178],  // GREEN
  [124, 165, 122],  // ROUGH
  [239, 219, 172],  // SAND
  [96, 168, 214],   // WATER
  [201, 178, 142],  // BELT
  [226, 228, 208],  // FRAGILE
  [184, 158, 138],  // CRACKED
];
var COL_EDGE = '#f6f1e2';   // fold lines
var COL_FLAG = '#ff5d5d';
var COL_WARN = '#ffa63a';   // painted ON THE GROUND, and ONLY under something that moves

// The light direction, shared by the terrain, the ball and every prop.
var LIGHT = (function () {
  var l = [-0.5, -0.8, 1.0], m = Math.hypot(l[0], l[1], l[2]);
  return [l[0] / m, l[1] / m, l[2] / m];
})();

// ---- ball states ------------------------------------------------------------
var ST = { ROLL: 0, FALL: 1, SINK: 2, HOLED: 3 };
