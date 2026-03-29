# Graphics

**Version:** 0.0.1 · **Repository:** [https://github.com/jeremyc2/effect2d](https://github.com/jeremyc2/effect2d)

> Public Graphics API.

## Camera

### CameraVector

- Kind: interface
- Source: `src/graphics/Camera.ts:3`

A 2D point or vector used by the camera API. World and screen coordinates both use this shape.

### CameraBounds

- Kind: interface
- Source: `src/graphics/Camera.ts:9`

Bounds that clamp the camera's focal position.



These bounds constrain the camera center, not the top-left corner of the
viewport.

### CameraViewport

- Kind: interface
- Source: `src/graphics/Camera.ts:24`

The authored viewport the camera projects into. This is usually your game's internal render resolution.

### CameraShakeState

- Kind: interface
- Source: `src/graphics/Camera.ts:30`

Transient screen-shake metadata managed by the pure shake helpers in this module.

### CameraState

- Kind: interface
- Source: `src/graphics/Camera.ts:37`

A complete snapshot of camera state.



`position` is the current camera center in world space.

### makeCameraState

- Kind: function
- Source: `src/graphics/Camera.ts:71`

Creates an initial camera state value.



```ts
const camera = makeCameraState({
 viewport: { width: 320, height: 180 },
 zoom: 2,
});
```

### setCameraViewport

- Kind: function
- Source: `src/graphics/Camera.ts:105`

Replaces the camera viewport without changing position or zoom.

### setCameraBounds

- Kind: function
- Source: `src/graphics/Camera.ts:116`

Sets or clears camera clamping bounds and immediately reclamps the current position.

### setCameraPosition

- Kind: function
- Source: `src/graphics/Camera.ts:128`

Moves the camera to a world-space position, respecting bounds when present.

### setCameraZoom

- Kind: function
- Source: `src/graphics/Camera.ts:139`

Changes zoom while enforcing a tiny positive minimum to avoid invalid projection math.

### followCameraTarget

- Kind: function
- Source: `src/graphics/Camera.ts:147`

Starts or stops following a world-space target. When a target is set, position snaps to it immediately.

### updateCameraFollow

- Kind: function
- Source: `src/graphics/Camera.ts:160`

Applies the current follow target to the camera position for this tick.

### startCameraShake

- Kind: function
- Source: `src/graphics/Camera.ts:170`

Starts a simple decay-based shake effect.

### updateCameraShake

- Kind: function
- Source: `src/graphics/Camera.ts:186`

Advances shake timing and clears the shake once its duration expires.

### getCameraShakeOffset

- Kind: function
- Source: `src/graphics/Camera.ts:212`

Computes the current shake offset that will be applied during projection.

### getScreenPositionFromWorld

- Kind: function
- Source: `src/graphics/Camera.ts:228`

Projects a world-space point into screen space using the current position, zoom, and shake offset.

### getWorldPositionFromScreen

- Kind: function
- Source: `src/graphics/Camera.ts:244`

Converts a screen-space point back into world space using the current camera state.

### SceneCamera

- Kind: service
- Source: `src/graphics/Camera.ts:262`

A scene-local camera service for authored gameplay and presentation logic.



`SceneCamera` is the runtime-friendly companion to the pure camera helper
functions in this module. Game code typically uses it to:

- define the viewport and zoom used by a scene
- clamp the camera to room bounds
- follow a player or focal target
- translate between world and screen coordinates
- apply temporary shake effects

If your scene needs a camera at all, this is usually the service you inject.

#### Methods

- `follow: (target: CameraVector | null) => Effect.Effect<void>`
- `screenToWorld: ( screenPoint: CameraVector, ) => Effect.Effect<CameraVector>`
- `setBounds: (bounds: CameraBounds | null) => Effect.Effect<void>`
- `setPosition: (position: CameraVector) => Effect.Effect<void>`
- `setViewport: (viewport: CameraViewport) => Effect.Effect<void>`
- `setZoom: (zoom: number) => Effect.Effect<void>`
- `shake: ( intensity: number, durationSeconds: number, ) => Effect.Effect<void>`
- `snapshot: Effect.Effect<CameraState>`
- `step: (deltaSeconds: number) => Effect.Effect<void>`
- `worldToScreen: ( worldPoint: CameraVector, ) => Effect.Effect<CameraVector>`

## Graphics

### Color

- Kind: interface
- Source: `src/graphics/Graphics.ts:4`

A normalized RGBA color used throughout the graphics API.



All channels are expected to be in the inclusive range `0..1`.

### Transform2D

- Kind: interface
- Source: `src/graphics/Graphics.ts:18`

A 2D transform recorded onto the graphics command stream.

### BlendMode

- Kind: type
- Source: `src/graphics/Graphics.ts:30`

Supported compositing modes for subsequent draw commands: `alpha`, `add`, and `multiply`.

### RectangleDrawMode

- Kind: type
- Source: `src/graphics/Graphics.ts:33`

Rectangle draw styles. `fill` paints the interior, `stroke` draws only the outline.

### CircleDrawMode

- Kind: type
- Source: `src/graphics/Graphics.ts:36`

Circle draw styles. `fill` paints the interior, `stroke` draws only the outline.

### DrawTextOptions

- Kind: interface
- Source: `src/graphics/Graphics.ts:39`

Parameters for a text draw command.



`align` controls how the text is anchored at `position`. Supplying `fontId`
lets the native backend pick an authored bitmap or custom font.

### DrawCommand

- Kind: type
- Source: `src/graphics/Graphics.ts:54`

A serializable render command recorded by [Graphics](./llms/graphics.md#graphics-graphics).



The native layer consumes these commands to present an actual frame. Game
code usually records commands through the `Graphics` service rather than
constructing `DrawCommand` objects directly.

### FrameSnapshot

- Kind: interface
- Source: `src/graphics/Graphics.ts:133`

The graphics frame currently being recorded or most recently completed.



`transformDepth` is especially useful in tests because it tells you whether
a presentation system forgot to balance `pushTransform` and `popTransform`.

### GraphicsFrameNotOpenError

- Kind: error
- Source: `src/graphics/Graphics.ts:170`

Indicates that game code attempted to record graphics commands without first
opening a frame.

### GraphicsTransformStackUnderflowError

- Kind: error
- Source: `src/graphics/Graphics.ts:183`

Indicates that more transforms were popped than pushed during a frame.

### Graphics

- Kind: service
- Source: `src/graphics/Graphics.ts:222`

Records immediate-mode rendering commands for the current frame.



"Immediate-mode" means:

- each frame, your game code says what should be drawn right now
- those instructions are recorded as commands such as "draw image", "draw
 text", or "draw rectangle"
- once the frame ends, the native backend presents that recorded command list

It does **not** mean the engine keeps a long-lived retained UI tree like the
DOM and then diffs it later. Instead, each frame is authored fresh from the
current game state.

`Graphics` is intentionally command-oriented instead of being a retained
scene graph. Game code opens a frame, records the draw operations it wants to
appear, and then hands the completed [FrameSnapshot](./llms/graphics.md#graphics-framesnapshot) to the native
boundary for presentation.

This service is a good fit for Effect users because it behaves like a typed,
testable log of rendering intent:

- gameplay and presentation code can be tested headlessly by inspecting the
 resulting command stream
- native backends can focus on playback rather than business logic
- transforms, tints, blend modes, text, fades, and flashes all share the
 same deterministic recording model

#### Methods

- `beginFrame: Effect.Effect<void>`
- `clear: ( color: Color, ) => Effect.Effect<void, GraphicsFrameNotOpenError>`
- `drawCircle: ( center: CameraVector, radius: number, mode?: CircleDrawMode, color?: Color, ) => Effect.Effect<void, GraphicsFrameNotOpenError>`
- `drawFade: ( opacity: number, color?: Color, ) => Effect.Effect<void, GraphicsFrameNotOpenError>`
- `drawFlash: ( intensity: number, color?: Color, ) => Effect.Effect<void, GraphicsFrameNotOpenError>`
- `drawImage: ( imageId: string, position: CameraVector, size?: { readonly height: number`
- `width: number`
- `drawLine: ( start: CameraVector, end: CameraVector, color?: Color, ) => Effect.Effect<void, GraphicsFrameNotOpenError>`
- `drawRectangle: ( position: CameraVector, size: { readonly height: number`
- `width: number`
- `drawText: ( options: DrawTextOptions, ) => Effect.Effect<void, GraphicsFrameNotOpenError>`
- `endFrame: Effect.Effect< FrameSnapshot, GraphicsFrameNotOpenError | GraphicsTransformStackUnderflowError >`
- `lastCompletedFrame: Effect.Effect<FrameSnapshot | null>`
- `popTransform: Effect.Effect< void, GraphicsFrameNotOpenError | GraphicsTransformStackUnderflowError >`
- `pushTransform: ( transform: Transform2D, ) => Effect.Effect<void, GraphicsFrameNotOpenError>`
- `setBlendMode: ( blendMode: BlendMode, ) => Effect.Effect<void, GraphicsFrameNotOpenError>`
- `setTint: ( color: Color, ) => Effect.Effect<void, GraphicsFrameNotOpenError>`
- `snapshot: Effect.Effect<FrameSnapshot>`