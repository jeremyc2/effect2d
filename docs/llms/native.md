# Native

> Public Native API.

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

### makeSkiaNativeBackendLayer

- Kind: function
- Source: `src/native/SkiaNativeBackend.ts:535`

Builds the Skia implementation of `NativeBackend`.

### makeSkiaNativeBoundaryLayer

- Kind: function
- Source: `src/native/SkiaNativeBackend.ts:1331`

Builds a ready-to-use [NativeBoundary](./llms/native.md#native-nativeboundary) backed by a Skia window and
renderer.