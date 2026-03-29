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

- [x] Define the native boundary contract for windowing, rendering device access, raw input, audio device output, and timing hooks.
- [x] Choose and wire up the initial macOS windowing path.
- [x] Choose and wire up the initial practical rendering backend.
- [x] Choose and wire up the initial audio output path.
- [x] Define a backend-facing service API that stays capability-level and does not absorb engine semantics.
- [x] Add clean shutdown and resource teardown for all native services.
- [x] Add diagnostics for backend initialization failures.

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

- [x] Define the immediate-mode 2D drawing API.
- [x] Implement frame begin, frame end, and clear operations.
- [x] Implement draw commands for images, rectangles, circles, lines, and text.
- [x] Implement transforms, color tinting, blend controls, and draw order handling.
- [x] Implement a camera transform model for world-to-screen rendering.
- [x] Add render command recording so the user-facing API stays stable while the backend evolves.
- [ ] Add basic batching strategy for common 2D draw paths.
- [x] Add typed rendering errors where operations can fail meaningfully.
- [x] Add built-in visual effects support for fades, flashes, tinting, and simple screen effects without depending on custom shaders.

## Milestone 5: Text, Fonts, And Lightweight UI

- [x] Implement font loading through Effect.
- [x] Implement text measurement and wrapped text layout helpers.
- [x] Implement text drawing with alignment options.
- [x] Implement lightweight immediate-mode UI primitives for panels, highlights, cursors, and framed boxes.
- [x] Implement simple dialogue box helpers.
- [x] Implement simple menu input helpers for selection and confirm/cancel flows.
- [x] Add text and dialogue test coverage where headless verification is practical.

## Milestone 6: Input

- [x] Implement raw keyboard input.
- [x] Implement raw mouse input.
- [x] Implement polling access for current input state.
- [x] Implement event-style access for presses, releases, wheel, and text entry where applicable.
- [x] Implement action mapping on top of raw input.
- [x] Implement rebindable action bindings.
- [x] Implement scene-aware input routing so overlays and menus can intentionally consume input.
- [x] Add typed errors for invalid or conflicting bindings where needed.

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

- [x] Define the audio service split between sound effects and music.
- [x] Implement audio asset loading through Effect.
- [x] Implement music playback controls.
- [x] Implement sound effect playback controls.
- [x] Implement overlapping sound effect playback.
- [x] Implement mixer buses for `master`, `music`, and `sfx`.
- [x] Implement audio resource ownership and teardown.
- [x] Add convenience helpers for common playback patterns while preserving lower-level handles.
- [x] Add typed audio errors for load and playback failure modes where meaningful.

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

- [x] Implement a debug overlay service.
- [x] Implement frame timing and FPS diagnostics.
- [x] Implement collision and trigger visualization.
- [x] Implement camera bounds and room marker visualization.
- [x] Implement scene stack inspection.
- [x] Implement resource and asset diagnostics where practical.
- [x] Implement structured logging patterns through Effect.
- [x] Add debug toggles that can be disabled cleanly in normal play.

## Milestone 13: Scripting And Orchestration

- [x] Define the script helper layer built on Effect.
- [x] Implement helpers for waiting, timing, and sequencing.
- [x] Implement helpers for dialogue progression, fades, and audio cues.
- [x] Implement lifecycle-aware cancellation for long-running scripts.
- [x] Implement coordinator service patterns for multi-domain workflows.
- [x] Implement selective typed domain events for broadcast-worthy situations.
- [x] Add examples showing direct service orchestration versus event-based coordination.

## Milestone 14: Testing Infrastructure

- [x] Establish the test layout for unit and integration coverage.
- [x] Add headless test harness support for core engine services.
- [x] Add deterministic test helpers for fixed timestep and seeded randomness.
- [x] Add scene lifecycle tests.
- [x] Add persistence tests.
- [x] Add collision and map validation tests.
- [x] Add animation and tween tests.
- [x] Add service composition tests for common engine launch paths.

## Milestone 15: Canonical Cavern Game Structure

- [x] Establish Cavern as the canonical small playable example for new games.
- [x] Show a Layer-composed game runtime in Cavern.
- [x] Show scene services and scoped scene instances in Cavern.
- [x] Show multiple domain state services in Cavern.
- [x] Show save participants in Cavern.
- [x] Show action mapping in Cavern.
- [x] Show debug toggles in Cavern.
- [x] Keep Cavern intentionally small and opinionated.

## Milestone 16: Vertical Slice Demo

- [x] Build Cavern as a tiny top-down exploration demo on the engine.
- [x] Implement a title or menu scene.
- [x] Implement one primary gameplay scene.
- [x] Implement at least one overlay scene such as pause or dialogue.
- [x] Implement player movement and facing.
- [x] Implement one enemy with simple behavior.
- [x] Implement one pickup or interactable object.
- [x] Implement one room transition.
- [x] Implement one short Effect-based scripted sequence.
- [x] Implement image rendering, text rendering, collision, animation, music, sound effects, and save/load in one cohesive loop.
- [x] Implement a debug overlay inside the demo.
- [x] Validate that the demo feels like a real game slice instead of a disconnected subsystem showcase.

## Milestone 17: Hardening For 0.1

- [x] Review the public API for coherence with the documented architecture.
- [x] Remove or rename obviously wrong early abstractions.
- [x] Tighten error types across engine subsystems.
- [x] Tighten scene and resource lifetime semantics.
- [x] Reduce duplication discovered during the demo build.
- [x] Improve docs where the sample game exposed confusion.
- [x] Add missing integration tests for the validated engine paths.
- [x] Confirm that the engine is good enough to begin a real small game.

## Milestone 18: First Real Game Pressure Test

- [x] Start a small real game on top of `Effect2d`.
- [x] Reuse the canonical engine architecture instead of inventing a separate one.
- [x] Let real game needs reveal the next engine gaps.
- [x] Refine maps and room content APIs under real usage.
- [ ] Refine save participants under real usage.
- [ ] Refine scene and script ergonomics under real usage.
- [ ] Refine debug tooling under real usage.
- [ ] Decide what belongs in engine core versus game userland based on pressure from the real game.

## Milestone Completion Criteria

### 0.1

- [x] A small playable vertical slice exists.
- [x] The game launches through `Effect.runPromise(...)`.
- [x] Scenes are service-defined and scene instances are scoped.
- [x] Multiple domain state services exist and persist through save participants.
- [x] Input, rendering, audio, maps, animation, collision, transitions, and save/load all work together in one slice.
- [x] A debug overlay exists.
- [x] At least one scripted sequence is implemented as Effect.
- [x] The architecture feels strong enough to build a real game on it.

### After 0.1

- [x] Begin a real small game immediately.
- [ ] Evolve the engine under pressure from that game instead of polishing in abstraction.
- [ ] Keep the core small and capability-focused.
- [ ] Continue rejecting non-goals that would distort the architecture.
