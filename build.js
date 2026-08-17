// build.js — concatenates src/*.js into the single self-contained game.html.
//
// The player runs no build step: game.html is committed and is the deliverable.
// NEVER hand-edit game.html. NEVER inline the sources into it by hand.
//
// This fails the build on a file in src/ that is not declared in MODULES, which is the
// check against dead modules.

'use strict';
var fs = require('fs');
var path = require('path');

// Load order is dependency order. Everything shares one function scope.
var MODULES = [
  'tuning.js',
  'heightfield.js',
  'physics.js',
  'level.js',
  'hazards.js',
  'levels.js',
  'audio.js',
  'render.js',
  'save.js',
  'game.js',
  'ui.js',
  'main.js',
];

var SRC = path.join(__dirname, 'src');
var OUT = path.join(__dirname, 'game.html');

function build() {
  var onDisk = fs.readdirSync(SRC).filter(function (f) { return /\.js$/.test(f); }).sort();
  var declared = MODULES.slice().sort();

  var undeclared = onDisk.filter(function (f) { return declared.indexOf(f) === -1; });
  if (undeclared.length) {
    console.error('build failed: src/ contains files not declared in MODULES:');
    undeclared.forEach(function (f) { console.error('  src/' + f); });
    console.error('Declare them in build.js or delete them. A module nothing loads is dead code.');
    process.exit(1);
  }
  var missing = declared.filter(function (f) { return onDisk.indexOf(f) === -1; });
  if (missing.length) {
    console.error('build failed: MODULES names files that are not in src/:');
    missing.forEach(function (f) { console.error('  src/' + f); });
    process.exit(1);
  }

  var parts = MODULES.map(function (f) {
    var body = fs.readFileSync(path.join(SRC, f), 'utf8');
    return '/* ===== src/' + f + ' ===== */\n' + body;
  });

  var html = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>PAPER LINKS</title>',
    '<style>',
    'html,body{margin:0;padding:0;background:#0a0a10;overflow:hidden;}',
    'body{display:flex;align-items:center;justify-content:center;height:100vh;width:100vw;}',
    '#c{display:block;image-rendering:auto;max-width:100vw;max-height:100vh;',
    'width:auto;height:auto;background:#0a0a10;touch-action:none;}',
    '</style>',
    '</head>',
    '<body>',
    '<canvas id="c" width="1280" height="900"></canvas>',
    '<script>',
    '(function(){',
    '"use strict";',
    parts.join('\n'),
    '})();',
    '<\/script>',
    '</body>',
    '</html>',
    '',
  ].join('\n');

  fs.writeFileSync(OUT, html);
  var kb = (Buffer.byteLength(html) / 1024).toFixed(1);
  console.log('built game.html  ' + kb + ' KB  from ' + MODULES.length + ' modules');
}

if (require.main === module) build();
module.exports = { MODULES: MODULES, SRC: SRC, OUT: OUT, build: build };
