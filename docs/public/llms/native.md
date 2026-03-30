# Native

**Version:** 0.0.1 · **Repository:** [https://github.com/jeremyc2/effect2d](https://github.com/jeremyc2/effect2d)

> Public Native API.

## FrameUpdater

### FrameUpdater

- Kind: service
- Source: `src/native/FrameUpdater.ts:6`

Runs simulation and draw for the next frame before presentation (**Frame updater** in the glossary).



Games provide this by composing update and draw into one step that returns a
[FrameSnapshot](./llms/graphics.md#graphics-framesnapshot).

#### Methods

- `nextFrame: Effect.Effect<FrameSnapshot, EngineLaunchError>`

## PlatformBackend

### PlatformWindowSnapshot

- Kind: interface
- Source: `src/native/PlatformBackend.ts:8`

Window state exposed by the platform backend.

### PlatformRendererSnapshot

- Kind: interface
- Source: `src/native/PlatformBackend.ts:19`

Renderer capabilities and counters from the platform backend.

### PlatformAudioOutputSnapshot

- Kind: interface
- Source: `src/native/PlatformBackend.ts:28`

Audio output capabilities and playback state from the platform backend.

### PlatformTimingSnapshot

- Kind: interface
- Source: `src/native/PlatformBackend.ts:39`

Frame pacing information from the platform backend.

### PlatformBackendDiagnostics

- Kind: interface
- Source: `src/native/PlatformBackend.ts:45`

Combined diagnostic snapshot for the active platform backend.



Startup diagnostics, tests, and debug overlays use this to inspect
renderer, audio, timing, and window state together.

### PlatformBackend

- Kind: service
- Source: `src/native/PlatformBackend.ts:63`

Swappable OS-facing adapter: windowing, presentation, input drain, audio device sync.



Most games do not implement `PlatformBackend` directly. Use
[makeSkiaNativeBoundaryLayer](./llms/native.md#native-makeskianativeboundarylayer), which wires a concrete backend into the
**Native boundary** and keeps **Frame updater** work in game land.

#### Methods

- `close: Effect.Effect<void>`
- `diagnostics: Effect.Effect<PlatformBackendDiagnostics>`
- `drainInputEvents: Effect.Effect< ReadonlyArray<InputEvent>, EngineLaunchError >`
- `open: (gameId: string) => Effect.Effect<void, EngineLaunchError>`
- `presentFrame: ( frame: FrameSnapshot, ) => Effect.Effect<void, EngineLaunchError>`
- `syncAudio: ( snapshot: AudioSnapshot, ) => Effect.Effect<ReadonlyArray<string>, EngineLaunchError>`
- `waitForNextFrame: Effect.Effect<void, EngineLaunchError>`

## SkiaPlatformBackend

### SkiaPlatformBackendOptions

- Kind: interface
- Source: `src/native/SkiaPlatformBackend.ts:38`

Configuration for the Skia platform backend.



This is the main option bag used by [makeSkiaNativeBoundaryLayer](./llms/native.md#native-makeskianativeboundarylayer).
Typical games set window title and size, logical render size, and their
authored image and font asset paths here.

### makeSkiaPlatformBackendLayer

- Kind: function
- Source: `src/native/SkiaPlatformBackend.ts:549`

Builds the Skia implementation of [PlatformBackend](./llms/native.md#native-platformbackend).

### makeSkiaNativeBoundaryLayer

- Kind: function
- Source: `src/native/SkiaPlatformBackend.ts:1387`

Builds a ready-to-use native playable boundary backed by a Skia window and
renderer.