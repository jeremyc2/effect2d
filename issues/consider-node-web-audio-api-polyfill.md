# Consider `node-web-audio-api/polyfill.js` for browser-shaped audio integrations

`node-web-audio-api` `2.0.0` added a `polyfill.js` entry point that extends `globalThis` and creates a `window` namespace for code that expects Web Audio constructors such as `AudioContext` to be globally available.

Effect2d's Skia platform backend currently imports Web Audio classes directly, which is clear and should stay the default path. A follow-up should consider whether the polyfill helps compatibility for sample games or author-provided audio libraries that were originally written for browser Web Audio globals, while keeping the engine-owned `AudioBus` and native audio diagnostics explicit.

Sources:
- https://raw.githubusercontent.com/ircam-ismm/node-web-audio-api/v2.0.0/CHANGELOG.md
- https://raw.githubusercontent.com/ircam-ismm/node-web-audio-api/v2.0.0/README.md
