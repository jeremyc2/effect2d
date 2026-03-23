/**
 * Build games with clear systems and room to grow.
 *
 * @packageDocumentation
 * @public
 *
 * `effect2d` came out of wanting to learn game development in the same spirit
 * that made projects like [Challacade](https://github.com/challacade)'s work
 * feel so approachable: build a real game, keep going long enough to
 * understand the hard parts, and talk about the craft in plain language. Lua
 * and LÖVE have that energy. They make it feel possible to sit down, try an
 * idea, and slowly turn it into something real. This engine is an attempt to
 * bring that feeling into Effect and TypeScript without losing what makes
 * Effect valuable: explicit dependencies, typed errors, observability,
 * deterministic wiring, and a structure that helps AI tools and human
 * developers alike work on larger systems.
 * If you come from web development, this is meant to make scenes, input,
 * rendering, audio, and game state feel easier to learn, easier to test, and
 * easier to keep growing.
 *
 * ## What you get
 *
 * The root entrypoint re-exports the engine's public authoring APIs:
 *
 * - Runtime bootstrapping and launch helpers such as
 *   {@link Engine}, {@link EngineConfig}, {@link defaultEngineConfig},
 *   {@link makeRuntimeLayer}, and {@link engineProgram}
 * - Scene composition primitives such as {@link SceneDefinition},
 *   {@link SceneDirector}, and {@link SceneRegistry}
 * - Core gameplay services including {@link Graphics}, {@link Input},
 *   {@link Audio}, {@link Script}, {@link Ui}, and {@link SaveCoordinator}
 * - Supporting data models such as room content, save documents, camera state,
 *   input bindings, and audio cue definitions
 * - Native integration points such as {@link NativeBoundary} and
 *   {@link makeSdlCanvasNativeBoundaryLayer} for playable desktop builds
 *
 * ## If you know Effect, you already know a lot
 *
 * If you already think in terms of `Effect`, `Layer`, services, scopes, and
 * typed domain errors, you already know most of the architecture here.
 *
 * A game built with `effect2d` is usually organized around a small set of
 * long-lived services:
 *
 * - `SceneDirector` decides which scene is active and manages scene lifecycle
 * - `Graphics` records draw commands for the current frame
 * - `Input` turns native keyboard and mouse events into stable action state
 * - `Audio` manages music and overlapping sound effects as typed cues
 * - `Script` coordinates timed sequences, dialogue, fades, and domain events
 * - `Ui` helps with common text, menu, and dialogue presentation patterns
 * - `SaveCoordinator` snapshots and restores participant state across save slots
 *
 * Your game code usually contributes domain-specific services on top of these:
 *
 * - game state services such as player state, inventory, or combat rules
 * - gameplay directors that read input and mutate authored game state
 * - presentation directors that translate state into `Graphics` commands
 * - scene definitions that wire setup and teardown around those services
 *
 * ## What the engine takes care of
 *
 * The engine takes care of several pieces that game teams would otherwise have
 * to reinvent:
 *
 * - deterministic service wiring through `Layer`
 * - a native launch boundary for desktop windowing, native input event
 *   collection, frame presentation, and audio synchronization
 * - frame recording through an immediate-mode graphics command model, meaning
 *   your game describes what to draw for the current frame right now as a list
 *   of draw commands like "draw this image here" or "draw this text here"
 *   instead of maintaining a long-lived retained scene tree like a DOM
 * - camera math, script orchestration, save migration plumbing, scene stack
 *   lifecycle, and typed error surfaces
 * - testability: most services can be exercised headlessly without opening a
 *   real window
 *
 * ## Where this engine shines
 *
 * `effect2d` is best understood as a 2D authored-game engine for TypeScript
 * and Effect developers. It is especially well suited to small-to-medium indie
 * games where the game is built from explicit state, scenes, rooms, maps, UI,
 * dialogue, and deterministic gameplay rules.
 *
 * Strong fits include:
 *
 * - room-based or scene-based adventure games
 * - top-down exploration games
 * - tile-based games
 * - dialogue-heavy narrative games
 * - puzzle games
 * - UI-heavy and menu-heavy games
 * - small arcade or action games with authored encounters and simple collision
 * - games where save/load, scripting, and deterministic orchestration matter
 *
 * It does **not** have to be tile-based. Tile maps are a natural fit, but the
 * engine can also support non-tile 2D games as long as they still fit the
 * broader model of authored scenes, sprites or images, typed input actions, and
 * explicit state transitions.
 *
 * ## Where it is not a fit
 *
 * This engine is currently **not** aimed at:
 *
 * - 3D games
 * - large open-world streaming games
 * - MMO or network-first game architectures
 * - heavy simulation or advanced physics sandbox games
 * - high-end rendering showcase games
 * - projects that need a giant built-in editor and asset pipeline ecosystem
 *
 * ## What is still up to you
 *
 * The engine intentionally does not decide your game design, content, or domain
 * rules. You still own:
 *
 * - your game state and domain model
 * - movement rules, combat rules, win/loss conditions, and progression logic
 * - authored assets, room content, and scene flow
 * - which optional services you use and how you compose them
 *
 * ## One way to lay out a game
 *
 * A practical game layout usually looks something like this:
 *
 * ```text
 * games/my-game/
 *   assets/
 *     audio/
 *     fonts/
 *     images/
 *   game/
 *     content/
 *     directors/
 *     input/
 *     native/
 *     scenes/
 *     state/
 *     MyGame.ts
 *   main.ts
 *   README.md
 * ```
 *
 * Common responsibilities:
 *
 * - `content/`: authored room data, constants, menus, encounter tables, etc.
 * - `directors/`: frame-by-frame gameplay and presentation orchestration
 * - `input/`: input binding declarations
 * - `native/`: the game's `NativeFrameSource` wiring
 * - `scenes/`: `SceneDefinition` values and scene-local bootstrapping
 * - `state/`: Effect services that hold mutable game state
 * - `MyGame.ts`: the composition root for Layers, bootstrap code, and programs
 *
 * ## A good place to start
 *
 * A good starting sequence for a new game is:
 *
 * 1. Start from {@link defaultEngineConfig} and define your `gameId`,
 *    `startScene`, and tick rate.
 * 2. Create state services for the pieces of domain state your game owns.
 * 3. Register authored scenes with {@link SceneRegistry}.
 * 4. Add a gameplay director that reads `Input` and updates state.
 * 5. Add a presentation director that records `Graphics` commands.
 * 6. Expose a `NativeFrameSource` that steps gameplay and renders a frame.
 * 7. Use {@link makeRuntimeLayer} or {@link makeEngineLayer} to compose the
 *    engine with your game's services.
 * 8. Use {@link makeSdlCanvasNativeBoundaryLayer} when you want a playable
 *    native desktop window.
 *
 * ## When the root import is enough
 *
 * Import from this file when:
 *
 * - you are writing a game against the engine
 * - you are reading the engine as an application developer
 * - you want the documentation site to present the "official" public surface
 *
 * If you are contributing to the engine itself, the submodules are often a
 * better place to work because they show tighter implementation boundaries.
 */
export * from "./animation/index.ts";
export * from "./audio/index.ts";
export * from "./collision/index.ts";
export * from "./debug/index.ts";
export * from "./errors/index.ts";
export * from "./graphics/index.ts";
export * from "./input/index.ts";
export * from "./maps/index.ts";
export * from "./native/index.ts";
export * from "./runtime/index.ts";
export * from "./save/index.ts";
export * from "./scene/index.ts";
export * from "./script/index.ts";
export * from "./ui/index.ts";
