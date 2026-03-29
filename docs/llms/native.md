# Native

> Public Native API.

## NativeBackend

### NativeWindowSnapshot

- Kind: interface
- Source: `src/native/NativeBackend.ts:8`

The current native window state exposed by the backend.

### NativeRendererSnapshot

- Kind: interface
- Source: `src/native/NativeBackend.ts:19`

Renderer capabilities and counters exposed by the native backend.

### NativeAudioOutputSnapshot

- Kind: interface
- Source: `src/native/NativeBackend.ts:28`

Native audio output capabilities and current playback state.

### NativeTimingSnapshot

- Kind: interface
- Source: `src/native/NativeBackend.ts:39`

Native frame pacing information exposed by the backend.

### NativeBackendDiagnostics

- Kind: interface
- Source: `src/native/NativeBackend.ts:45`

A combined diagnostic snapshot for the active native backend.



This is useful for startup diagnostics, test assertions, and debug screens
that need to inspect renderer, audio, timing, and window state together.

### NativeBackend

- Kind: service
- Source: `src/native/NativeBackend.ts:63`

Low-level native runtime adapter used by the internal native boundary.



Most games do not implement or consume `NativeBackend` directly. Instead
they use a helper such as [makeSkiaNativeBoundaryLayer](./llms/native.md#native-makeskianativeboundarylayer), which wires a
concrete backend into the internal native boundary. This service exists so the
engine can separate authored frame production from platform-specific window,
input, rendering, and audio work.

#### Methods

- `close: Effect.Effect<void>`
- `diagnostics: Effect.Effect<NativeBackendDiagnostics>`
- `drainInputEvents: Effect.Effect< ReadonlyArray<InputEvent>, EngineLaunchError >`
- `open: (gameId: string) => Effect.Effect<void, EngineLaunchError>`
- `presentFrame: ( frame: FrameSnapshot, ) => Effect.Effect<void, EngineLaunchError>`
- `syncAudio: ( snapshot: AudioSnapshot, ) => Effect.Effect<ReadonlyArray<string>, EngineLaunchError>`
- `waitForNextFrame: Effect.Effect<void, EngineLaunchError>`

## NativeFrameSource

### NativeFrameSource

- Kind: service
- Source: `src/native/NativeFrameSource.ts:6`

Produces the next authored frame for the native runtime.



Games usually provide this service by composing gameplay and presentation
directors into one step that returns a [FrameSnapshot](./llms/graphics.md#graphics-framesnapshot).

#### Methods

- `nextFrame: Effect.Effect<FrameSnapshot, EngineLaunchError>`

## SkiaNativeBackend

### SkiaNativeBackendOptions

- Kind: interface
- Source: `src/native/SkiaNativeBackend.ts:38`

Configuration for the Skia native backend.



This is the main option bag used by [makeSkiaNativeBoundaryLayer](./llms/native.md#native-makeskianativeboundarylayer).
Typical games set window title and size, logical render size, and their
authored image and font asset paths here.

### makeSkiaNativeBackendLayer

- Kind: function
- Source: `src/native/SkiaNativeBackend.ts:547`

Builds the Skia implementation of [NativeBackend](./llms/native.md#native-nativebackend).

### makeSkiaNativeBoundaryLayer

- Kind: function
- Source: `src/native/SkiaNativeBackend.ts:1385`

Builds a ready-to-use native playable boundary backed by a Skia window and
renderer.