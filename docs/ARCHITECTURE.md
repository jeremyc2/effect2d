# Architecture

This document captures the current engine shape before subsystem implementation fills in the details.

## Primary Boundaries

`effect2d` starts with one package and strong internal boundaries.

The current subsystem layout is:

- `runtime`: engine startup, fixed-step runtime composition, and launch entry points
- `native`: the thin capability-level bridge to platform APIs
- `scene`: scene definitions, scene instances, and scene stack orchestration
- `graphics`: immediate-mode rendering contracts
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

## Native Boundary

The native boundary must stay thin.

It is allowed to own:

- window creation
- graphics device access
- low-level frame presentation
- raw input collection
- audio device output
- native timing hooks

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

## Runtime Model

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

## Error Taxonomy

Known failures should be modeled as typed errors.

Examples:

- invalid engine configuration
- failed native startup
- malformed room content
- unsupported audio asset
- invalid save document
- missing or failed save migrations

The current engine guidance is intentionally simple:

- if we know a failure mode can happen, model it through the typed Effect error channel
- keep error data Schema-backed so it stays serializable and loggable
- do not design around defects yet
- prefer specific migration/decode/load failure types over catch-all path errors when the subsystem can distinguish them

## Current Intent

This structure is intentionally front-loaded before real rendering or windowing work so the next milestones have stable boundaries.

If implementation pressure exposes better boundaries, update this document and [ROADMAP.md](../ROADMAP.md) together.
