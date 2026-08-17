// GAME — the state machine, the input mapping, the clock's arithmetic, and the frame
// accumulator. Everything here is above the simulation and below the renderer.

var APP = {
  state: 'LOADING', loadIdx: 0,
  run: null, cam: null, course: 0,
  save: null, menuIdx: 0, selIdx: 0,
  iris: null, keys: {}, acc: 0, last: -1,
  muted: false, perf: false,
  perfNow: 0, perfFrame: 0, perfWorst: 0,
  toast: 0, toastText: '',
};

// ---- input --------------------------------------------------------------------
// Screen-relative, always. W fights the descent; W+A fights a descent that also banks
// right, and that balancing act IS the game. The mapping is forced by the projection: get
// a sign wrong and every course is unplayable in a way no test will name.
function inputVector(keys) {
  var wx = 0, wy = 0;
  if (keys.up)    { wx -= 1; wy -= 1; }      // up-screen:   -(wx+wy)
  if (keys.down)  { wx += 1; wy += 1; }
  if (keys.left)  { wx -= 1; wy += 1; }      // left-screen: -(wx-wy)
  if (keys.right) { wx += 1; wy -= 1; }
  var m = Math.hypot(wx, wy);
  return m < 1e-9 ? [0, 0] : [wx / m, wy / m];
}

var KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};

// ---- the clock, read as golf ----------------------------------------------------
// LAW 11.1 — the clock counts UP, checkpoints pay it down, and it can never end a course.
// Bands are a quarter of par wide with a 3-second floor: a fixed band would be the whole
// practice green and a rounding error on the long sixth.
function bandStep(parTime) { return Math.max(3, parTime / 4); }

function timeShots(net, parTime) {
  var s = Math.round((net - parTime) / bandStep(parTime));
  return s < -4 ? -4 : (s > 12 ? 12 : s);
}

var SHOT_NAME = { '-4': 'ALBATROSS', '-3': 'ALBATROSS', '-2': 'EAGLE', '-1': 'BIRDIE',
                  '0': 'PAR', '1': 'BOGEY', '2': 'DOUBLE BOGEY', '3': 'TRIPLE BOGEY' };
function shotName(s) { return SHOT_NAME[String(s)] || ('+' + s); }

function roundTitle(shots) {
  if (shots <= -4) return 'CLUB CHAMPION';
  if (shots <= -1) return 'UNDER PAR';
  if (shots === 0) return 'PAR';
  if (shots <= 5) return 'BOGEY GOLFER';
  return 'WEEKEND HACKER';
}

function roundTotals(save) {
  var secs = 0, shots = 0, played = 0;
  for (var i = 0; i < save.cards.length; i++) {
    var c = save.cards[i];
    if (!c) continue;
    played++; secs += c.net; shots += c.shots;
  }
  return { secs: secs, shots: shots, played: played, complete: played === save.cards.length };
}

// ---- states ---------------------------------------------------------------------
function startCourse(i) {
  APP.course = i;
  APP.run = newRun(getCourse(i), 0);
  APP.cam = newCam(APP.run.ball);
  APP.acc = 0;
  APP.state = 'PLAY';
}

// Quitting mid-course loses that course and restarts it from the first flag, and must not
// rewind the round pointer past a course already cleared.
function quitToMenu() {
  APP.iris = null;                  // quitting DURING the iris must cancel it, or the
  APP.run = null;                   // callback fires against a run that no longer exists
  APP.state = 'MENU';
  APP.menuIdx = hasProgress(APP.save) ? 0 : 1;
}

function bankCourse() {
  var run = APP.run, c = run.course;
  // The card banks the EXACT credit, not the drained one: hole out half a second after
  // the last flag and the two disagree, and the card is the one that has to be right.
  var net = netTime(run);
  var shots = timeShots(net, c.parTime);
  var prev = APP.save.cards[APP.course];
  if (!prev || net < prev.net) APP.save.cards[APP.course] = { net: net, shots: shots };
  if (APP.course + 1 < courseCount())
    APP.save.unlocked = Math.max(APP.save.unlocked, APP.course + 2);
  APP.save.pointer = Math.max(APP.save.pointer, Math.min(courseCount() - 1, APP.course + 1));
  writeSave(APP.save);
  APP.lastCard = { name: c.name, clock: run.clock, credit: run.credit, net: net,
                   shots: shots, par: c.parTime, flags: run.flagsHit.slice() };
  APP.state = 'CARD';
}

function irisOut(cx, cy, cb) { APP.iris = { mode: 'out', t: 0, cx: cx, cy: cy, cb: cb }; }
function irisIn(cx, cy) { APP.iris = { mode: 'in', t: 0, cx: cx, cy: cy, cb: null }; }

function advanceFromCard() {
  var next = APP.course + 1;
  if (next >= courseCount()) { APP.state = 'ROUND'; return; }
  startCourse(next);
  irisIn(W / 2, H / 2);
}

// ---- the frame ------------------------------------------------------------------
function stepApp(dt) {
  if (APP.toast > 0) APP.toast -= dt;

  if (APP.state === 'LOADING') {
    // One course per frame, so the first paint is immediate and the page never looks hung.
    getCourse(APP.loadIdx++);
    if (APP.loadIdx >= courseCount()) {
      APP.state = 'MENU';
      APP.menuIdx = hasProgress(APP.save) ? 0 : 1;
    }
    return;
  }

  if (APP.iris) {
    APP.iris.t += dt;
    if (APP.iris.t >= IRIS_TIME) {
      var cb = APP.iris.cb;
      APP.iris = null;
      if (cb) cb();
    }
  }

  // Any state that needs a run and has none falls back to MENU rather than throwing
  // inside the frame loop.
  if ((APP.state === 'PLAY' || APP.state === 'PAUSE') && !APP.run) { quitToMenu(); return; }
  if (APP.state !== 'PLAY') return;

  var run = APP.run;
  var inp = (run.holdT > 0 || run.ball.state !== ST.ROLL) ? [0, 0] : inputVector(APP.keys);

  APP.acc += dt;
  var steps = 0;
  while (APP.acc >= DT && steps < 8) { tick(run, inp[0], inp[1]); APP.acc -= DT; steps++; }
  // A tab that was backgrounded must not try to catch up on four thousand ticks.
  if (APP.acc > DT * 8) APP.acc = 0;

  playEvents(run);
  updateCamera(APP.cam, run.ball, dt);

  if (run.ball.state === ST.HOLED && run.holeT >= 1.0 && !APP.iris && APP.state === 'PLAY') {
    var c = run.course.cup;
    irisOut(projX(APP.cam, c.x, c.y), projY(APP.cam, c.x, c.y, c.z), function () {
      if (APP.state === 'PLAY') bankCourse();
    });
  }
}

// ---- keys -------------------------------------------------------------------------
// The state decides what a key means BEFORE the movement map does. Claiming arrows for
// steering first is what made every menu cursor immovable: ArrowDown set `keys.down` and
// returned, and the menu never saw it.
function onKeyDown(code, shift, ctrl) {
  if (code === 'KeyM') { APP.muted = !APP.muted; setMuted(APP.muted); toast(APP.muted ? 'MUTED' : 'SOUND ON'); return true; }
  if (code === 'F3') { APP.perf = !APP.perf; APP.perfWorst = 0; return true; }

  if (APP.state === 'PLAY') {
    if (KEYMAP[code]) { APP.keys[KEYMAP[code]] = true; return true; }
    if (code === 'Escape') { APP.state = 'PAUSE'; APP.menuIdx = 0; APP.keys = {}; return true; }
    return false;
  }
  APP.keys = {};              // no other screen holds movement state

  if (APP.state === 'MENU') return menuKey(code, shift, ctrl) || !!KEYMAP[code];
  if (APP.state === 'SELECT') return selectKey(code) || !!KEYMAP[code];
  if (APP.state === 'VIEWCARD' || APP.state === 'ROUND') {
    if (code === 'Escape' || code === 'Enter' || code === 'Space') {
      if (APP.state === 'ROUND') { APP.save.pointer = 0; writeSave(APP.save); }
      APP.state = 'MENU'; return true;
    }
    return false;
  }
  if (APP.state === 'CARD') {
    if (code === 'Enter' || code === 'Space') { advanceFromCard(); return true; }
    if (code === 'Escape') { quitToMenu(); return true; }
    return false;
  }
  if (APP.state === 'PAUSE') return pauseKey(code) || !!KEYMAP[code];
  return !!KEYMAP[code];      // swallow arrows on any screen, so the page never scrolls
}

function onKeyUp(code) {
  if (KEYMAP[code]) { APP.keys[KEYMAP[code]] = false; return true; }
  return false;
}

function toast(s) { APP.toastText = s; APP.toast = 1.4; }

var MENU_ITEMS = ['CONTINUE', 'NEW ROUND', 'COURSE SELECT', 'SCORECARD', 'ERASE SAVE'];

function menuKey(code, shift, ctrl) {
  if (ctrl && shift && code === 'KeyU') {
    // The only fast path to the win state, and the recording needs one. It seeds each
    // untouched card with its own par, so the round scorecard is one course away.
    APP.save.unlocked = courseCount();
    for (var i = 0; i < courseCount(); i++)
      if (!APP.save.cards[i]) APP.save.cards[i] = { net: getCourse(i).parTime, shots: 0 };
    APP.save.pointer = courseCount() - 1;
    writeSave(APP.save);
    toast('ALL COURSES UNLOCKED');
    return true;
  }
  if (code === 'ArrowUp' || code === 'KeyW') { APP.menuIdx = (APP.menuIdx + 4) % 5; return true; }
  if (code === 'ArrowDown' || code === 'KeyS') { APP.menuIdx = (APP.menuIdx + 1) % 5; return true; }
  if (code !== 'Enter' && code !== 'Space') return false;
  var pick = MENU_ITEMS[APP.menuIdx];
  if (pick === 'CONTINUE') {
    if (!hasProgress(APP.save)) return true;
    startCourse(Math.min(APP.save.pointer, APP.save.unlocked - 1));
    irisIn(W / 2, H / 2);
  } else if (pick === 'NEW ROUND') {
    APP.save = blankSave(courseCount());
    writeSave(APP.save);
    startCourse(0);
    irisIn(W / 2, H / 2);
  } else if (pick === 'COURSE SELECT') {
    APP.state = 'SELECT'; APP.selIdx = 0;
  } else if (pick === 'SCORECARD') {
    APP.state = 'VIEWCARD';
  } else {
    APP.save = blankSave(courseCount());
    eraseSave();
    APP.menuIdx = 1;
    toast('SAVE ERASED');
  }
  return true;
}

function selectKey(code) {
  if (code === 'ArrowUp' || code === 'KeyW') { APP.selIdx = (APP.selIdx + courseCount() - 1) % courseCount(); return true; }
  if (code === 'ArrowDown' || code === 'KeyS') { APP.selIdx = (APP.selIdx + 1) % courseCount(); return true; }
  if (code === 'Escape') { APP.state = 'MENU'; return true; }
  if (code !== 'Enter' && code !== 'Space') return false;
  if (APP.selIdx >= APP.save.unlocked) { toast('LOCKED'); return true; }
  startCourse(APP.selIdx);
  irisIn(W / 2, H / 2);
  return true;
}

var PAUSE_ITEMS = ['RESUME', 'RESTART COURSE', 'QUIT TO MENU'];
function pauseKey(code) {
  if (code === 'Escape') { APP.state = 'PLAY'; return true; }
  if (code === 'ArrowUp' || code === 'KeyW') { APP.menuIdx = (APP.menuIdx + 2) % 3; return true; }
  if (code === 'ArrowDown' || code === 'KeyS') { APP.menuIdx = (APP.menuIdx + 1) % 3; return true; }
  if (code !== 'Enter' && code !== 'Space') return false;
  if (APP.menuIdx === 0) APP.state = 'PLAY';
  else if (APP.menuIdx === 1) startCourse(APP.course);
  else quitToMenu();
  return true;
}
