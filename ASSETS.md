# ASSETS

**All procedural, none third-party.**

There is not a single asset file in this repository. There is no `assets/` directory,
no image, no audio file, no font file, no data blob, and no third-party library.

- **Every visual** is drawn at runtime with Canvas 2D — terrain quads, slab side faces,
  the backdrop wash, the cup shaft, the ball, and every prop. Props are built from four
  volume primitives (`orb`, `tube`, `cone`, `boxIso`) in flat tones, lit from one shared
  light direction. Text uses the browser's own generic families only
  (`monospace` / `sans-serif`) — no webfont is loaded or embedded.
- **Every sound** is synthesized with WebAudio at runtime — a seeded noise buffer
  generated in JS for the rolling bed, biquad filters for the surface voice, and
  envelope-shaped one-shots for every cue. No sample is loaded, decoded, or embedded.
- **Every level** is authored by hand in `src/levels.js` as an ordered list of pieces.
  No level data is imported and none is generated from a seed.

`game.html` is self-contained: it is `build.js` concatenating `src/*.js` into one HTML
file. It makes no network request of any kind — no `fetch`, no `XMLHttpRequest`, no
`<script src>`, no `<link href>`, no `<img src>`, no remote font. Test 21 in
`node tests/run.js` asserts that by scanning the built artifact for external references,
and it is red if one ever appears.

**Third-party dependencies at runtime: none.** Dev-time tooling (Node, and optionally a
headless browser for posed-frame hashing) is not shipped and is not part of the
artifact.
