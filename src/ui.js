// UI — the HUD and the eight screens. Everything here draws; nothing here decides.

var FONT = 'monospace';
function txt(ctx, s, x, y, size, col, align, weight) {
  ctx.font = (weight || '') + ' ' + Math.round(size) + 'px ' + FONT;
  ctx.fillStyle = col;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
  RSTAT.fills++;
}

function panel(ctx, x, y, w, h, a) {
  ctx.fillStyle = 'rgba(14,12,20,' + (a === undefined ? 0.82 : a) + ')';
  ctx.fillRect(x, y, w, h);
  RSTAT.fills++;
  ctx.strokeStyle = 'rgba(246,241,226,0.22)'; ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  RSTAT.strokes++;
}

function clockStr(s) {
  if (s < 0) s = 0;
  var m = Math.floor(s / 60), r = s - m * 60;
  return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r.toFixed(1);
}

// ---- the HUD --------------------------------------------------------------------
function drawHUD(ctx, run) {
  var c = run.course;
  // Top right, counting up, measured in SIMULATION TICKS, never off a wall clock, so a
  // slow frame cannot cost the player a second.
  var shown = Math.max(0, run.clock - run.creditShown);
  txt(ctx, clockStr(shown), W - 26, 62, 46, '#f6f1e2', 'right', 'bold');
  txt(ctx, 'PAR ' + c.parTime.toFixed(0) + 's', W - 26, 88, 18, 'rgba(246,241,226,0.55)', 'right');

  // The credit DRAINS with a receipt beside it rather than jumping — a number that jumps
  // reads as a glitch.
  if (run.receipt > 0) {
    var a = Math.min(1, run.receipt / 0.35);
    txt(ctx, '-' + run.receiptVal.toFixed(1) + 's', W - 190, 62, 30,
        'rgba(120,230,150,' + a.toFixed(2) + ')', 'right', 'bold');
  }

  txt(ctx, c.name, 26, 46, 24, '#f6f1e2', 'left', 'bold');
  txt(ctx, 'COURSE ' + (APP.course + 1) + ' OF ' + courseCount(), 26, 70, 16,
      'rgba(246,241,226,0.55)');

  // Flags claimed, as flags.
  for (var i = 0; i < c.flags.length; i++) {
    var x = 28 + i * 26, y = 96;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x, y - 22);
    ctx.strokeStyle = 'rgba(246,241,226,0.7)'; ctx.lineWidth = 2; RSTAT.strokes++; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - 22); ctx.lineTo(x + 14, y - 17); ctx.lineTo(x, y - 12);
    ctx.closePath();
    ctx.fillStyle = run.flagsHit[i] ? COL_FLAG : 'rgba(246,241,226,0.18)';
    RSTAT.fills++; ctx.fill();
  }

  // BALL LOST — the lose state, named. Not a screen: a price.
  if (run.banner) {
    var b = run.banner;
    var al = Math.min(1, b.t / 0.3);
    var label = b.cause === 'water' ? 'WATER' : (b.cause === 'eaten' ? 'EATEN' : 'VOID');
    ctx.save();
    ctx.globalAlpha = al;
    panel(ctx, W / 2 - 220, H * 0.30, 440, 74, 0.80);
    txt(ctx, 'BALL LOST — ' + label, W / 2, H * 0.30 + 48, 36, COL_FLAG, 'center', 'bold');
    ctx.restore();
  }

  if (run.holdT > 0) {
    txt(ctx, 'RESPAWNING  ' + run.holdT.toFixed(1), W / 2, H * 0.30 + 118, 20,
        'rgba(246,241,226,0.75)', 'center');
  }

  // The only tutorial there is: ten seconds on course 1, fading over the last three.
  if (APP.course === 0 && run.clock < 10) {
    var f = run.clock > 7 ? (10 - run.clock) / 3 : 1;
    ctx.save(); ctx.globalAlpha = f;
    txt(ctx, 'W A S D  —  ACCELERATE, NEVER STEER.  BRAKE EARLY, TURN LATE.',
        W / 2, H - 46, 22, '#f6f1e2', 'center', 'bold');
    ctx.restore();
  }

  if (APP.toast > 0) txt(ctx, APP.toastText, W / 2, 40, 20, '#f6f1e2', 'center');

  // F3: what the frame cost US and what the browser actually DELIVERED, plus the worst
  // gap since it was switched on. An average hides exactly the frames being complained about.
  if (APP.perf) {
    var y2 = H - 128;
    panel(ctx, 20, y2, 268, 108, 0.72);
    txt(ctx, 'ours   ' + APP.perfNow.toFixed(2) + ' ms', 34, y2 + 30, 17, '#9fe8b0');
    txt(ctx, 'frame  ' + APP.perfFrame.toFixed(2) + ' ms', 34, y2 + 52, 17, '#9fe8b0');
    txt(ctx, 'worst  ' + APP.perfWorst.toFixed(2) + ' ms', 34, y2 + 74, 17, '#ffa63a');
    txt(ctx, 'fills ' + RSTAT.fills + '  strokes ' + RSTAT.strokes, 34, y2 + 96, 15,
        'rgba(246,241,226,0.6)');
  }
}

// ---- the iris -------------------------------------------------------------------
function drawIris(ctx) {
  var ir = APP.iris;
  if (!ir) return;
  var q = Math.min(1, ir.t / IRIS_TIME);
  var r = Math.hypot(W, H) * (ir.mode === 'out' ? (1 - q) : q);
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.arc(ir.cx, ir.cy, Math.max(0, r), 0, Math.PI * 2, true);
  ctx.fillStyle = '#0a0a10';
  RSTAT.fills++; ctx.fill('evenodd');
}

// ---- the screens ------------------------------------------------------------------
function menuBg(ctx) {
  var gr = ctx.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, 'rgb(30,26,42)');
  gr.addColorStop(0.55, 'rgb(20,18,30)');
  gr.addColorStop(1, 'rgb(10,9,16)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); RSTAT.fills++;
  txt(ctx, 'PAPER LINKS', W / 2, 190, 78, '#f6f1e2', 'center', 'bold');
  txt(ctx, 'BRAKE EARLY, TURN LATE', W / 2, 228, 22, 'rgba(255,93,93,0.85)', 'center');
}

function drawMenu(ctx) {
  menuBg(ctx);
  var can = hasProgress(APP.save);
  for (var i = 0; i < MENU_ITEMS.length; i++) {
    var on = i === APP.menuIdx;
    var grey = (i === 0 && !can);
    var col = grey ? 'rgba(246,241,226,0.25)' : (on ? '#ffa63a' : 'rgba(246,241,226,0.8)');
    txt(ctx, (on ? '▸ ' : '  ') + MENU_ITEMS[i], W / 2 - 130, 330 + i * 46, 28, col);
  }
  txt(ctx, 'WASD / ARROWS accelerate   ·   ESC pause   ·   M mute   ·   F3 frame times',
      W / 2, H - 96, 17, 'rgba(246,241,226,0.45)', 'center');
  txt(ctx, 'CTRL+SHIFT+U unlocks every course', W / 2, H - 68, 17,
      'rgba(246,241,226,0.30)', 'center');
  if (APP.toast > 0) txt(ctx, APP.toastText, W / 2, H - 130, 22, '#ffa63a', 'center', 'bold');
}

function drawSelect(ctx) {
  menuBg(ctx);
  txt(ctx, 'COURSE SELECT', W / 2, 292, 26, 'rgba(246,241,226,0.7)', 'center');
  for (var i = 0; i < courseCount(); i++) {
    var c = getCourse(i), on = i === APP.selIdx;
    var locked = i >= APP.save.unlocked;
    var col = locked ? 'rgba(246,241,226,0.25)' : (on ? '#ffa63a' : 'rgba(246,241,226,0.8)');
    var card = APP.save.cards[i];
    var line = (on ? '▸ ' : '  ') + (i + 1) + '  ' + c.name +
               (locked ? '   [LOCKED]' : '   ' + c.flags.length + ' FLAGS   PAR ' + c.parTime + 's');
    txt(ctx, line, W / 2 - 260, 340 + i * 40, 24, col);
    if (card && !locked)
      txt(ctx, clockStr(card.net) + '  ' + shotName(card.shots), W / 2 + 300, 340 + i * 40, 20,
          'rgba(159,232,176,0.85)', 'right');
  }
  txt(ctx, 'ESC back', W / 2, H - 80, 18, 'rgba(246,241,226,0.45)', 'center');
  if (APP.toast > 0) txt(ctx, APP.toastText, W / 2, H - 120, 22, '#ffa63a', 'center', 'bold');
}

function drawPause(ctx) {
  panel(ctx, W / 2 - 210, H / 2 - 130, 420, 260, 0.88);
  txt(ctx, 'PAUSED', W / 2, H / 2 - 74, 36, '#f6f1e2', 'center', 'bold');
  for (var i = 0; i < PAUSE_ITEMS.length; i++)
    txt(ctx, (i === APP.menuIdx ? '▸ ' : '  ') + PAUSE_ITEMS[i], W / 2 - 130,
        H / 2 - 12 + i * 44, 26, i === APP.menuIdx ? '#ffa63a' : 'rgba(246,241,226,0.8)');
}

function drawCard(ctx) {
  var c = APP.lastCard;
  if (!c) { APP.state = 'MENU'; return; }
  panel(ctx, W / 2 - 320, H / 2 - 190, 640, 380, 0.90);
  txt(ctx, c.name, W / 2, H / 2 - 132, 34, '#f6f1e2', 'center', 'bold');
  var rows = [
    ['TIME', clockStr(c.clock)],
    ['CHECKPOINTS', c.flags.filter(Boolean).length + ' / ' + c.flags.length +
                    '   −' + c.credit.toFixed(1) + 's'],
    ['NET', clockStr(c.net)],
    ['PAR', clockStr(c.par)],
  ];
  for (var i = 0; i < rows.length; i++) {
    txt(ctx, rows[i][0], W / 2 - 260, H / 2 - 70 + i * 42, 22, 'rgba(246,241,226,0.6)');
    txt(ctx, rows[i][1], W / 2 + 260, H / 2 - 70 + i * 42, 24, '#f6f1e2', 'right');
  }
  var col = c.shots < 0 ? '#9fe8b0' : (c.shots === 0 ? '#f6f1e2' : '#ffa63a');
  txt(ctx, shotName(c.shots), W / 2, H / 2 + 132, 48, col, 'center', 'bold');
  txt(ctx, APP.course + 1 < courseCount() ? 'ENTER  next course' : 'ENTER  round scorecard',
      W / 2, H / 2 + 172, 18, 'rgba(246,241,226,0.5)', 'center');
}

// THE WIN STATE. Six courses added twice — in seconds, and in shots to par, which is the
// only form a round adds up in.
function drawRound(ctx, viewing) {
  menuBg(ctx);
  var t = roundTotals(APP.save);
  txt(ctx, viewing ? 'SCORECARD' : 'ROUND COMPLETE', W / 2, 292, 30,
      'rgba(246,241,226,0.75)', 'center');
  for (var i = 0; i < courseCount(); i++) {
    var c = getCourse(i), card = APP.save.cards[i];
    var y = 340 + i * 38;
    txt(ctx, (i + 1) + '  ' + c.name, W / 2 - 300, y, 22, 'rgba(246,241,226,0.85)');
    if (!card) { txt(ctx, '—', W / 2 + 300, y, 22, 'rgba(246,241,226,0.3)', 'right'); continue; }
    txt(ctx, clockStr(card.net), W / 2 + 130, y, 22, '#f6f1e2', 'right');
    txt(ctx, (card.shots > 0 ? '+' : '') + card.shots, W / 2 + 300, y, 22,
        card.shots < 0 ? '#9fe8b0' : (card.shots === 0 ? '#f6f1e2' : '#ffa63a'), 'right');
  }
  var yb = 340 + courseCount() * 38 + 18;
  ctx.strokeStyle = 'rgba(246,241,226,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W / 2 - 300, yb - 22); ctx.lineTo(W / 2 + 300, yb - 22);
  RSTAT.strokes++; ctx.stroke();
  txt(ctx, 'TOTAL', W / 2 - 300, yb + 8, 24, '#f6f1e2', 'left', 'bold');
  txt(ctx, clockStr(t.secs), W / 2 + 130, yb + 8, 24, '#f6f1e2', 'right', 'bold');
  txt(ctx, (t.shots > 0 ? '+' : '') + t.shots, W / 2 + 300, yb + 8, 24, '#f6f1e2', 'right', 'bold');
  if (t.complete)
    txt(ctx, roundTitle(t.shots), W / 2, yb + 66, 44,
        t.shots <= -1 ? '#9fe8b0' : '#ffa63a', 'center', 'bold');
  txt(ctx, 'ENTER / ESC  menu', W / 2, H - 60, 18, 'rgba(246,241,226,0.45)', 'center');
}

function drawLoading(ctx) {
  menuBg(ctx);
  txt(ctx, 'COMPILING COURSES  ' + APP.loadIdx + ' / ' + courseCount(), W / 2, 340, 22,
      'rgba(246,241,226,0.6)', 'center');
}

// ---- the frame -------------------------------------------------------------------
function drawApp(ctx) {
  var s = APP.state;
  if (s === 'LOADING') { drawLoading(ctx); return; }
  if (s === 'MENU') { drawMenu(ctx); drawIris(ctx); return; }
  if (s === 'SELECT') { drawSelect(ctx); return; }
  if (s === 'VIEWCARD') { drawRound(ctx, true); return; }
  if (s === 'ROUND') { drawRound(ctx, false); return; }
  if (!APP.run) { drawMenu(ctx); return; }
  drawWorld(ctx, APP.run, APP.cam);
  drawHUD(ctx, APP.run);
  if (s === 'PAUSE') drawPause(ctx);
  if (s === 'CARD') drawCard(ctx);
  drawIris(ctx);
}
