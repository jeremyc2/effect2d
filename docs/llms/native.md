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

Low-level native runtime adapter used by [NativeBoundary](./llms/native.md#native-nativeboundary).



Most games do not implement or consume `NativeBackend` directly. Instead
they use a helper such as [makeSkiaNativeBoundaryLayer](./llms/native.md#native-makeskianativeboundarylayer), which wires a
concrete backend into [NativeBoundary](./llms/native.md#native-nativeboundary). This service exists so the
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

## NativeBoundary

### NativeBoundary

- Kind: service
- Source: `src/native/NativeBoundary.ts:12`

The playable bridge between authored game services and a concrete native
runtime.



`NativeBoundary` owns the real-time launch loop for a native build. It is
responsible for:

- opening the native backend
- collecting native input events and applying them to [Input](./llms/input.md#input-input)
- asking the active [NativeFrameSource](./llms/native.md#native-nativeframesource) for the next frame
- synchronizing authored audio state with the backend
- presenting frames and waiting for the next step

Most application code does not implement this service directly. Instead it
uses helpers such as [makeSkiaNativeBoundaryLayer](./llms/native.md#native-makeskianativeboundarylayer).

#### Methods

- `diagnostics: Effect.Effect<NativeBackendDiagnostics>`
- `initialize: ( gameId: string, ) => Effect.Effect<void, EngineLaunchError>`
- `shutdown: Effect.Effect<void>`

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
- Source: `src/native/SkiaNativeBackend.ts:539`

Builds the Skia implementation of [NativeBackend](./llms/native.md#native-nativebackend).

### makeSkiaNativeBoundaryLayer

- Kind: function
- Source: `src/native/SkiaNativeBackend.ts:1360`

Builds a ready-to-use [NativeBoundary](./llms/native.md#native-nativeboundary) backed by a Skia window and
renderer.