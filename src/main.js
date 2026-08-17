// MAIN — the browser entry. The only file that touches the DOM.
//
// Everything above this line runs headlessly under Node in the suite, which is the whole
// point of keeping the simulation pure: rendering is never proof.

function bootPaperLinks() {
  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d', { alpha: false });

  APP.save = loadSave(courseCount());

  window.addEventListener('keydown', function (e) {
    // The audio graph is built on the first key, which is the gesture browsers want.
    ensureAudio();
    if (onKeyDown(e.code, e.shiftKey, e.ctrlKey || e.metaKey)) e.preventDefault();
  });
  window.addEventListener('keyup', function (e) {
    if (onKeyUp(e.code)) e.preventDefault();
  });
  window.addEventListener('blur', function () { APP.keys = {}; });

  function frame(ts) {
    window.requestAnimationFrame(frame);
    var dt = APP.last < 0 ? 0 : (ts - APP.last) / 1000;
    APP.last = ts;
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.25) dt = 0.25;                  // clamp before the accumulator sees it
    APP.perfFrame = dt * 1000;

    var t0 = ts;
    stepApp(dt);
    drawApp(ctx);
    var spent = (window.performance ? window.performance.now() : ts) - t0;
    APP.perfNow = spent;
    var gap = Math.max(spent, APP.perfFrame);
    if (APP.perf && gap > APP.perfWorst) APP.perfWorst = gap;
  }
  window.requestAnimationFrame(frame);
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') bootPaperLinks();
