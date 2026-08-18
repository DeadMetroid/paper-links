// A FULL PLAYTHROUGH OF THE SHIPPED ARTIFACT — `node tests/playthrough.js`
//
// Six courses, start to finish, in a real browser over a real `file://` URL, driven
// entirely through the game's own input path: the fairness oracle is injected into the
// page and its eight-direction output is turned back into the four movement KEYS a human
// presses, which `onKeyDown` receives exactly as it would from a keyboard.
//
// Nothing is teleported. No state is poked. The only thing this does that a player does
// not is hold the right keys — which is the point: it answers "is this playable start to
// finish in one sitting", and it answers it about `game.html` rather than about `src/`.

'use strict';
var fs = require('fs');
var path = require('path');
var shots = require('./shots.js');

var URL = 'file://' + path.join(__dirname, '..', 'game.html').replace(/\\/g, '/');

// The oracle drives in WORLD space. The game reads KEYS and builds a world vector from
// them, so this is that mapping run backwards — the eight directions a keyboard can make.
//   up (-1,-1)  down (1,1)  left (-1,1)  right (1,-1), each over root two.
var KEYS_FOR = [
  ['down', 'right'],   // (  1,  0 )
  ['down'],            // ( .7, .7 )
  ['down', 'left'],    // (  0,  1 )
  ['left'],            // (-.7, .7 )
  ['up', 'left'],      // ( -1,  0 )
  ['up'],              // (-.7,-.7 )
  ['up', 'right'],     // (  0, -1 )
  ['right'],           // ( .7,-.7 )
];

async function main() {
  var exe = shots.findBrowser();
  if (!exe) throw new Error('no installed browser found');
  var puppeteer = require('puppeteer-core');
  var browser = await puppeteer.launch({
    executablePath: exe, headless: 'new',
    args: ['--hide-scrollbars', '--force-device-scale-factor=1'],
  });
  var errors = [];
  var results = [];
  try {
    var page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    page.on('pageerror', function (e) { errors.push('pageerror: ' + e.message); });
    page.on('console', function (m) { if (m.type() === 'error') errors.push('console: ' + m.text()); });

    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForFunction('typeof APP !== "undefined" && APP.state === "MENU"', { timeout: 15000 });

    // Inject the oracle. It is test code and is NOT in the artifact; everything it reads —
    // pointAt, project, solidAt, heightAt, MAX_SPEED, G — is already a global there.
    var oracleSrc = fs.readFileSync(path.join(__dirname, 'oracle.js'), 'utf8')
      .replace(/^'use strict';$/m, '')
      .replace(/module\.exports[\s\S]*$/, '');
    await page.evaluate(oracleSrc + '\nwindow.__oracle = makeOracle(window);');

    // The driver: every frame, ask the oracle where to go and hold the keys that go there.
    // The keys go in through onKeyDown/onKeyUp, so the game cannot tell the difference.
    await page.evaluate(function (keysFor) {
      window.__KEYS_FOR = keysFor;
      window.__auto = { on: false, route: 0, held: {} };
      var realStep = window.stepApp;
      window.stepApp = function (dt) {
        var a = window.__auto;
        if (a.on && APP.state === 'PLAY' && APP.run) {
          var want = {};
          if (APP.run.ball.state === ST.ROLL && APP.run.holdT <= 0) {
            var v = window.__oracle.autopilotInput(APP.run, a.route);
            if (v[0] || v[1]) {
              var k = ((Math.round(Math.atan2(v[1], v[0]) / (Math.PI / 4)) % 8) + 8) % 8;
              window.__KEYS_FOR[k].forEach(function (name) { want[name] = 1; });
            }
          }
          ['up', 'down', 'left', 'right'].forEach(function (name) {
            var code = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' }[name];
            if (want[name] && !a.held[name]) { onKeyDown(code, false, false); a.held[name] = 1; }
            else if (!want[name] && a.held[name]) { onKeyUp(code); delete a.held[name]; }
          });
        }
        realStep(dt);
      };
    }, KEYS_FOR);

    // NEW ROUND, through the menu — navigated by ITEM NAME, never by counting keystrokes.
    // With no save the cursor already starts on it, and an ArrowDown "to be safe" lands on
    // COURSE SELECT instead.
    var MENU = ['CONTINUE', 'NEW ROUND', 'COURSE SELECT', 'SCORECARD', 'ERASE SAVE'];
    for (var g = 0; g < 8; g++) {
      var idx = await page.evaluate('APP.menuIdx');
      if (MENU[idx] === 'NEW ROUND') break;
      await page.keyboard.press('ArrowDown');
      await new Promise(function (r) { setTimeout(r, 140); });
    }
    await page.keyboard.press('Enter');
    await page.waitForFunction('APP.state === "PLAY"', { timeout: 5000 });

    for (var course = 0; course < 6; course++) {
      await page.evaluate('window.__auto.on = true; window.__auto.route = 0;');
      var t0 = Date.now();
      await page.waitForFunction('APP.state === "CARD" || APP.state === "ROUND"',
                                 { timeout: 180000, polling: 250 });
      await page.evaluate('window.__auto.on = false;');
      var card = JSON.parse(await page.evaluate('JSON.stringify(APP.lastCard)'));
      results.push({
        course: course + 1, name: card.name,
        clock: +card.clock.toFixed(1), credit: card.credit, net: +card.net.toFixed(1),
        par: card.par, rating: await page.evaluate('shotName(' + card.shots + ')'),
        flags: card.flags.filter(Boolean).length + '/' + card.flags.length,
        falls: await page.evaluate('APP.run ? APP.run.falls : -1'),
        wall: ((Date.now() - t0) / 1000).toFixed(1) + 's',
      });
      if (course < 5) {
        await page.keyboard.press('Enter');                 // next course
        await page.waitForFunction('APP.state === "PLAY"', { timeout: 8000 });
      }
    }

    await page.keyboard.press('Enter');
    await page.waitForFunction('APP.state === "ROUND"', { timeout: 8000 });
    var totals = JSON.parse(await page.evaluate('JSON.stringify(roundTotals(APP.save))'));
    var title = await page.evaluate('roundTitle(roundTotals(APP.save).shots)');
    var buf = await page.screenshot({ type: 'png' });
    fs.mkdirSync(path.join(__dirname, '_out'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '_out', 'playthrough-round.png'), buf);

    console.log('\nFULL PLAYTHROUGH — six courses, real keys, real artifact, from file://\n');
    console.log('  #  course            clock   credit   net    par   rating         flags  falls  wall');
    console.log('  ' + '-'.repeat(88));
    results.forEach(function (r) {
      console.log('  ' + String(r.course).padEnd(3) + r.name.padEnd(18) +
                  String(r.clock).padEnd(8) + String(r.credit).padEnd(9) +
                  String(r.net).padEnd(7) + String(r.par).padEnd(6) +
                  r.rating.padEnd(15) + r.flags.padEnd(7) + String(r.falls).padEnd(7) + r.wall);
    });
    console.log('\n  ROUND: ' + totals.secs.toFixed(1) + 's, ' +
                (totals.shots > 0 ? '+' : '') + totals.shots + ' to par  ->  ' + title);
    console.log('  wrote tests/_out/playthrough-round.png');
  } finally {
    await browser.close();
  }

  if (errors.length) {
    console.log('\nCONSOLE / PAGE ERRORS:');
    errors.forEach(function (e) { console.log('  ' + e); });
    process.exit(1);
  }
  if (results.length !== 6) { console.log('\nonly ' + results.length + ' courses finished'); process.exit(1); }
  console.log('  six courses completed, zero crashes, zero console errors.');
}

if (require.main === module) {
  main().then(function () { process.exit(0); })
        .catch(function (e) { console.error('\nFAILED: ' + String(e.stack || e)); process.exit(2); });
}
