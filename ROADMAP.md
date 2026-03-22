# ROADMAP

## Milestone 0: Project Foundation

- [x] Establish the source layout for engine subsystems and native integration boundaries.
- [x] Create the initial public export surface for the engine package.
- [x] Define the internal module boundaries for runtime, scenes, graphics, audio, input, maps, collision, animation, save, debug, and testing.
- [x] Add architecture notes describing the thin native boundary and the small-core rich-userland strategy.
- [x] Decide and document the initial error taxonomy for engine typed errors.
- [x] Decide and document the initial directory structure for engine code, sample game code, and demos.

## Milestone 1: Effect Runtime Composition

- [x] Define the top-level engine launch model using `Effect.runPromise(...)`.
- [x] Implement the engine composition root as Layer-based runtime assembly.
- [x] Define the core engine services for runtime boot, shutdown, and capability access.
- [x] Add scoped resource ownership patterns for long-lived runtime services.
- [x] Add controlled time services for simulation time, frame time, and fixed-step scheduling.
- [x] Add a seeded randomness service strategy using Effect primitives.
- [x] Add typed configuration for engine startup options.
- [x] Add startup failure handling with typed engine errors.

## Milestone 2: Native Boundary

- [ ] Define the native boundary contract for windowing, rendering device access, raw input, audio device output, and timing hooks.
- [ ] Choose and wire up the initial macOS windowing path.
- [ ] Choose and wire up the initial practical rendering backend.
- [ ] Choose and wire up the initial audio output path.
- [ ] Define a backend-facing service API that stays capability-level and does not absorb engine semantics.
- [ ] Add clean shutdown and resource teardown for all native services.
- [ ] Add diagnostics for backend initialization failures.

## Milestone 3: Scene Model And Runtime Flow

- [x] Define the scene service model.
- [x] Implement scoped scene instances created when scenes are entered.
- [x] Implement scene lifecycle hooks for enter, exit, update, draw, and input handling.
- [x] Implement a scene stack for primary scenes and overlays.
- [x] Implement scene transitions and transition errors.
- [x] Add scoped cancellation for scene-local scripts, resources, and long-running work.
- [x] Add scene-owned camera support hooks.
- [x] Add scene inspection hooks for debug tooling.

## Milestone 4: Core Rendering Model

- [ ] Define the immediate-mode 2D drawing API.
- [ ] Implement frame begin, frame end, and clear operations.
- [ ] Implement draw commands for images, rectangles, circles, lines, and text.
- [ ] Implement transforms, color tinting, blend controls, and draw order handling.
- [x] Implement a camera transform model for world-to-screen rendering.
- [ ] Add render command recording so the user-facing API stays stable while the backend evolves.
- [ ] Add basic batching strategy for common 2D draw paths.
- [ ] Add typed rendering errors where operations can fail meaningfully.
- [ ] Add built-in visual effects support for fades, flashes, tinting, and simple screen effects without depending on custom shaders.

## Milestone 5: Text, Fonts, And Lightweight UI

- [ ] Implement font loading through Effect.
- [ ] Implement text measurement and wrapped text layout helpers.
- [ ] Implement text drawing with alignment options.
- [ ] Implement lightweight immediate-mode UI primitives for panels, highlights, cursors, and framed boxes.
- [ ] Implement simple dialogue box helpers.
- [ ] Implement simple menu input helpers for selection and confirm/cancel flows.
- [ ] Add text and dialogue test coverage where headless verification is practical.

## Milestone 6: Input

- [ ] Implement raw keyboard input.
- [ ] Implement raw mouse input.
- [ ] Implement polling access for current input state.
- [ ] Implement event-style access for presses, releases, wheel, and text entry where applicable.
- [ ] Implement action mapping on top of raw input.
- [ ] Implement rebindable action bindings.
- [ ] Implement scene-aware input routing so overlays and menus can intentionally consume input.
- [ ] Add typed errors for invalid or conflicting bindings where needed.

## Milestone 7: Maps And World Content

- [x] Define the internal content model for rooms, tile planes, object planes, triggers, spawn points, and transitions.
- [x] Implement TypeScript-first room authoring APIs.
- [x] Implement room loading as Effect.
- [x] Implement typed metadata support for rooms and room objects.
- [x] Implement transition zones between rooms.
- [x] Implement object lookup helpers for authored room content.
- [x] Implement room validation with typed errors for malformed content.
- [x] Add serialization hooks so future in-game editing can target the same model.

## Milestone 8: Collision, Triggers, And Spatial Queries

- [x] Define the collision world model separate from full rigid-body physics.
- [x] Implement AABB shapes.
- [x] Implement circle shapes.
- [x] Implement collision groups and masks.
- [x] Implement solid collision checks.
- [x] Implement non-blocking trigger regions.
- [x] Implement overlap queries.
- [x] Implement area queries for collision and trigger lookup.
- [x] Implement hitbox and hurtbox helpers.
- [x] Implement tile collision helpers for room-based gameplay.
- [ ] Add deterministic test coverage for collision rules and query semantics.

## Milestone 9: Animation And Tweening

- [x] Define the sprite animation model for named animation sequences.
- [x] Implement frame-based sprite animation playback.
- [x] Implement looping, pausing, speed control, and direction control.
- [x] Implement simple animation state helpers without building a giant framework.
- [x] Implement tween helpers for scalar and vector values.
- [x] Add utility support for fades, flashes, and small value transitions used by scenes and UI.
- [x] Add headless tests for animation stepping and tween progression.

## Milestone 10: Audio

- [ ] Define the audio service split between sound effects and music.
- [ ] Implement audio asset loading through Effect.
- [ ] Implement music playback controls.
- [ ] Implement sound effect playback controls.
- [ ] Implement overlapping sound effect playback.
- [ ] Implement mixer buses for `master`, `music`, and `sfx`.
- [ ] Implement audio resource ownership and teardown.
- [ ] Add convenience helpers for common playback patterns while preserving lower-level handles.
- [ ] Add typed audio errors for load and playback failure modes where meaningful.

## Milestone 11: Persistence

- [x] Define the versioned JSON save document model.
- [x] Define the save participant contract for domain state services.
- [x] Implement save coordination across multiple participants.
- [x] Implement load coordination across multiple participants.
- [x] Implement save slot handling.
- [x] Implement versioning and migration hooks for save data evolution.
- [x] Add typed save and load errors.
- [x] Add tests covering round-trip persistence and version migration.

## Milestone 12: Debugging And Diagnostics

- [ ] Implement a debug overlay service.
- [ ] Implement frame timing and FPS diagnostics.
- [ ] Implement collision and trigger visualization.
- [ ] Implement camera bounds and room marker visualization.
- [ ] Implement scene stack inspection.
- [ ] Implement resource and asset diagnostics where practical.
- [ ] Implement structured logging patterns through Effect.
- [ ] Add debug toggles that can be disabled cleanly in normal play.

## Milestone 13: Scripting And Orchestration

- [ ] Define the script helper layer built on Effect.
- [ ] Implement helpers for waiting, timing, and sequencing.
- [ ] Implement helpers for dialogue progression, fades, and audio cues.
- [ ] Implement lifecycle-aware cancellation for long-running scripts.
- [ ] Implement coordinator service patterns for multi-domain workflows.
- [ ] Implement selective typed domain events for broadcast-worthy situations.
- [ ] Add examples showing direct service orchestration versus event-based coordination.

## Milestone 14: Testing Infrastructure

- [x] Establish the test layout for unit and integration coverage.
- [x] Add headless test harness support for core engine services.
- [x] Add deterministic test helpers for fixed timestep and seeded randomness.
- [x] Add scene lifecycle tests.
- [x] Add persistence tests.
- [x] Add collision and map validation tests.
- [x] Add animation and tween tests.
- [ ] Add service composition tests for common engine launch paths.

## Milestone 15: Starter And Sample Game Structure

- [ ] Create one canonical small starter for new games.
- [ ] Show a Layer-composed game runtime in the starter.
- [ ] Show scene services and scoped scene instances in the starter.
- [ ] Show multiple domain state services in the starter.
- [ ] Show save participants in the starter.
- [ ] Show action mapping in the starter.
- [ ] Show debug toggles in the starter.
- [ ] Keep the starter intentionally small and opinionated.

## Milestone 16: Vertical Slice Demo

- [ ] Build a tiny top-down action-adventure demo on the engine.
- [ ] Implement a title or menu scene.
- [ ] Implement one primary gameplay scene.
- [ ] Implement at least one overlay scene such as pause or dialogue.
- [ ] Implement player movement and facing.
- [ ] Implement one enemy with simple behavior.
- [ ] Implement one pickup or interactable object.
- [ ] Implement one room transition.
- [ ] Implement one short Effect-based scripted sequence.
- [ ] Implement image rendering, text rendering, collision, animation, music, sound effects, and save/load in one cohesive loop.
- [ ] Implement a debug overlay inside the demo.
- [ ] Validate that the demo feels like a real game slice instead of a disconnected subsystem showcase.

## Milestone 17: Hardening For 0.1

- [ ] Review the public API for coherence with the documented architecture.
- [ ] Remove or rename obviously wrong early abstractions.
- [ ] Tighten error types across engine subsystems.
- [ ] Tighten scene and resource lifetime semantics.
- [ ] Reduce duplication discovered during the demo build.
- [ ] Improve docs where the sample game exposed confusion.
- [ ] Add missing integration tests for the validated engine paths.
- [ ] Confirm that the engine is good enough to begin a real small game.

## Milestone 18: First Real Game Pressure Test

- [ ] Start a small real game on top of `effect2d`.
- [ ] Reuse the canonical engine architecture instead of inventing a separate one.
- [ ] Let real game needs reveal the next engine gaps.
- [ ] Refine maps and room content APIs under real usage.
- [ ] Refine save participants under real usage.
- [ ] Refine scene and script ergonomics under real usage.
- [ ] Refine debug tooling under real usage.
- [ ] Decide what belongs in engine core versus game userland based on pressure from the real game.

## Milestone Completion Criteria

### 0.1

- [ ] A small playable vertical slice exists.
- [ ] The game launches through `Effect.runPromise(...)`.
- [x] Scenes are service-defined and scene instances are scoped.
- [ ] Multiple domain state services exist and persist through save participants.
- [ ] Input, rendering, audio, maps, animation, collision, transitions, and save/load all work together in one slice.
- [ ] A debug overlay exists.
- [ ] At least one scripted sequence is implemented as Effect.
- [ ] The architecture feels strong enough to build a real game on it.

### After 0.1

- [ ] Begin a real small game immediately.
- [ ] Evolve the engine under pressure from that game instead of polishing in abstraction.
- [ ] Keep the core small and capability-focused.
- [ ] Continue rejecting non-goals that would distort the architecture.
