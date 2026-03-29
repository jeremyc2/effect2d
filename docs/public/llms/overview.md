# Effect2d Overview

**Version:** 0.0.1

**Repository:** [https://github.com/jeremyc2/effect2d](https://github.com/jeremyc2/effect2d)

> Build games with clear systems and room to grow.

Build games with clear systems and room to grow.




`Effect2d` came out of wanting to learn game development in the same spirit
that made projects like [Challacade](https://github.com/challacade)'s work
feel so approachable: build a real game, keep going long enough to
understand the hard parts, and talk about the craft in plain language. Lua
and LÖVE have that energy. They make it feel possible to sit down, try an
idea, and slowly turn it into something real. This engine is an attempt to
bring that feeling into Effect and TypeScript without losing what makes
Effect valuable: explicit dependencies, typed errors, observability,
deterministic wiring, and a structure that helps AI tools and human
developers alike work on larger systems.
If you come from web development, this is meant to make scenes, input,
rendering, audio, and game state feel easier to learn, easier to test, and
easier to keep growing.

## What you get

- Runtime bootstrapping and launch helpers such as
 [Engine](./llms/runtime.md#runtime-engine), [EngineConfig](./llms/runtime.md#runtime-engineconfig), [defaultEngineConfig](./llms/runtime.md#runtime-defaultengineconfig),
 [makeRuntimeLayer](./llms/runtime.md#runtime-makeruntimelayer), and [engineProgram](./llms/runtime.md#runtime-engineprogram)
- Scene composition primitives such as [SceneDefinition](./llms/scene.md#scene-scenedefinition),
 [SceneDirector](./llms/scene.md#scene-scenedirector), and [SceneRegistry](./llms/scene.md#scene-sceneregistry)
- Core gameplay services including [Graphics](./llms/graphics.md#graphics-graphics), [Input](./llms/input.md#input-input),
 [Audio](./llms/audio.md#audio-audio), [Sequence](./llms/sequence.md#sequence-sequence), [Cutscene](./llms/cutscene.md#cutscene-cutscene), [UI](./llms/ui.md#ui-ui), and
 [SaveCoordinator](./llms/save.md#save-savecoordinator)
- Supporting data models such as room content, save documents, camera state,
 input bindings, and audio cue definitions
- Native integration points such as [makeSkiaNativeBoundaryLayer](./llms/native.md#native-makeskianativeboundarylayer) for
 playable desktop builds

## If you know Effect, you already know a lot

If you already think in terms of `Effect`, `Layer`, services, scopes, and
typed domain errors, you already know most of the architecture here.

A game built with `Effect2d` is organized around a small set of
long-lived services:

- `SceneDirector` decides which scene is active and manages scene lifecycle
- `Graphics` records draw commands for the current frame
- `Input` turns native keyboard and mouse events into stable action state
- `Audio` manages music and overlapping sound effects as typed cues
- `Sequence` coordinates timed gameplay beats such as waits, scene switches,
 fades, flashes, and audio cues
- `Cutscene` builds higher-level cinematic helpers on top of `Sequence` and
 `UI`
- `UI` helps with common text, menu, and dialogue presentation patterns
- `SaveCoordinator` snapshots and restores participant state across save slots

Your game code contributes domain-specific services on top of these:

- game state services such as player state, inventory, or combat rules
- gameplay directors that read input and mutate authored game state
- presentation directors that translate state into `Graphics` commands
- scene definitions that wire setup and teardown around those services

## What the engine takes care of

- deterministic service wiring through `Layer`
- a native launch boundary for desktop windowing, native input event
 collection, frame presentation, and audio synchronization
- frame recording through an immediate-mode graphics command model, meaning
 your game describes what to draw for the current frame right now as a list
 of draw commands like "draw this image here" or "draw this text here"
 instead of maintaining a long-lived retained scene tree like a DOM
- camera math, sequence orchestration, save migration plumbing, scene stack
 lifecycle, and typed error surfaces
- testability: most services can be exercised headlessly without opening a
 real window

## Where this engine shines

`Effect2d` is best understood as a 2D authored-game engine for TypeScript
and Effect developers. It is especially well suited to small-to-medium indie
games where the game is built from explicit state, scenes, rooms, maps, UI,
dialogue, and deterministic gameplay rules.

- room-based or scene-based adventure games
- top-down exploration games
- tile-based games
- dialogue-heavy narrative games
- puzzle games
- UI-heavy and menu-heavy games
- small arcade or action games with authored encounters and simple collision
- games where save/load, scripting, and deterministic orchestration matter

It does **not** have to be tile-based. Tile maps are a natural fit, but the
engine can also support non-tile 2D games as long as they still fit the
broader model of authored scenes, sprites or images, typed input actions, and
explicit state transitions.

## Where it is not a fit

- 3D games
- large open-world streaming games
- MMO or network-first game architectures
- heavy simulation or advanced physics sandbox games
- high-end rendering showcase games
- projects that need a giant built-in editor and asset pipeline ecosystem

## What is still up to you

- your game state and domain model
- movement rules, combat rules, win/loss conditions, and progression logic
- authored assets, room content, and scene flow
- which services you use and how you compose them

## One way to lay out a game

A practical game layout might look something like this, with each folder
taking on a clear job:

```text
games/my-game/
 assets/
 audio/ # sound effects and music
 fonts/ # typefaces used by menus and dialogue
 images/ # sprites, backgrounds, and UI art
 game/
 content/ # authored room data, constants, and encounter tables
 directors/ # frame-by-frame gameplay and presentation orchestration
 input/ # input binding declarations
 native/ # the game's NativeFrameSource wiring
 scenes/ # SceneDefinition values and scene-local bootstrapping
 state/ # Effect services that hold mutable game state
 MyGame.ts # the composition root for Layers, bootstrap code, and programs
 main.ts # startup entrypoint
 README.md # notes for the game itself
```

## Quick Start

1. Start from [defaultEngineConfig](./llms/runtime.md#runtime-defaultengineconfig) and define your `gameId`,
 `startScene`, and tick rate.
2. Create state services for the pieces of domain state your game owns.
3. Register authored scenes with [SceneRegistry](./llms/scene.md#scene-sceneregistry).
4. Add a gameplay director that reads `Input` and updates state.
5. Add a presentation director that records `Graphics` commands.
6. Expose a `NativeFrameSource` that steps gameplay and renders a frame.
7. Use [makeRuntimeLayer](./llms/runtime.md#runtime-makeruntimelayer) or [makeEngineLayer](./llms/runtime.md#runtime-makeenginelayer) to compose the
 engine with your game's services.
8. Use [makeSkiaNativeBoundaryLayer](./llms/native.md#native-makeskianativeboundarylayer) when you want a playable
 native desktop window.