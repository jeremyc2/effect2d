# Architecture

This document captures the current engine shape before subsystem implementation fills in the details.

## Primary boundaries

`Effect2d` starts with one package and strong internal boundaries.

The current subsystem layout is:

- `runtime`: engine startup, fixed-step runtime composition, and launch entry points
- `native`: the **Native boundary** and **Platform backend** bridge to OS APIs
- `scene`: scene definitions, scene instances, and scene stack orchestration
- `graphics`: immediate-mode rendering contracts
  - each frame records a fresh list of draw commands from current game state rather than keeping a retained DOM-like tree
- `audio`: music and sound effect contracts
- `input`: raw input and action-oriented input contracts
- `maps`: room content and room loading contracts
- `collision`: collision, trigger, and spatial query contracts with a gameplay-first world model
- `animation`: sprite animation and tween-adjacent contracts
- `save`: explicit save coordination and save document shapes
- `debug`: runtime diagnostics and overlays
- `errors`: typed engine errors

The package root export should stay focused on engine/runtime APIs.

Supporting repo-local utilities such as test helpers may exist under their own internal paths, but they should not automatically become part of the root package surface.

## Native boundary

The **Native boundary** stays thin. It is the orchestration loop that connects:

- **`PlatformBackend`**: OS-facing adapter (windowing, presentation, input drain, audio device sync, pacing, diagnostics)
- **`Input`**, **`Audio`**, and **`FrameUpdater`**: game-authored services

The **Frame updater** advances simulation and draw for each frame; the boundary presents it and waits for the next step.

The initial practical implementation is:

- Skia via `skia-canvas` for native windowing, input, and frame presentation
- `node-web-audio-api` as the in-process audio output path

This is intentionally a thin **Platform backend** contract—not a second engine under `native`.

It is allowed to own:

- window creation
- graphics device access
- low-level frame presentation
- raw input collection
- audio device output
- native timing waits

It is not allowed to own:

- scene logic
- room logic
- gameplay state
- save semantics
- collision rules
- dialogue
- cutscenes
- animation state machines
- high-level engine orchestration

If logic starts drifting downward into `native`, that is an architectural bug.

### Platform backend contract

`PlatformBackend` is capability-level on purpose. It owns:

- `open` / `close` for native resource lifetime
- `drainInputEvents` for raw input event collection
- `presentFrame` for low-level frame presentation
- `syncAudio` for device-facing playback state updates
- `waitForNextFrame` for pacing
- `diagnostics` for backend status and initialization failure visibility

It does not own scene stepping, gameplay rules, save logic, dialogue flow, or game-specific orchestration.

## Runtime model

The engine launch model is Layer-based and Effect-native:

- the game launches through `Effect.runPromise(...)`
- the composition root is a Layer-assembled runtime
- long-lived runtime services are scoped Layers
- simulation timing is tracked through a dedicated runtime clock service
- seeded randomness is configured at the runtime boundary
- scenes are registered runtime definitions coordinated by scene services
- entered scenes become scoped scene instances
- scene lifecycle effects run inside scene-owned scopes
- leaving a scene closes its scope and cancels scene-local background work
- resources follow scopes by default
- resource diagnostics should be able to mirror scoped lifetimes instead of relying only on manual release calls

## Error taxonomy

Known failures should be modeled as typed errors.

## Observability

Structured logging and optional telemetry should align with engine domains and the ubiquitous language—not ad hoc strings.
