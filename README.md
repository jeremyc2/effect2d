# Effect2d

`Effect2d` is a Bun-native, Effect-native 2D game engine inspired by LÖVE.

It is not a Lua compatibility layer. It is not a browser engine. It is not a React-style UI framework. It is a TypeScript and Effect-first engine for building small 2D games with a strong runtime model, explicit services, and code-defined content.

## Vision

- Build a 2D engine in TypeScript, Bun, and Effect without using C++ for engine authoring.
- Preserve the best parts of LÖVE's feel: approachable 2D workflows, immediate-mode drawing, small-engine energy, and practical modules like graphics, audio, input, timer, and filesystem.
- Reject the parts that do not fit the new direction: Lua globals, hidden runtime singletons, Promise-first APIs, and engine designs that hide resource lifetime or effect boundaries.

## Core Direction

- `Effect2d` is macOS-first in its earliest phase.
- Bun is the real runtime, not just a build tool.
- The engine is Effect-native all the way down.
- Games are assembled with real Effect services and Layers.
- Scenes are defined as services and entered as scoped scene instances.
- Game-specific systems live in userland services, not in the engine core.
- The native boundary stays thin and capability-focused.

## Public Model

Game code should look like a real Effect application:

- the game launches via `Effect.runPromise(...)`
- engine capabilities are accessed through services
- scene logic is written as Effects
- save/load is Effectful and explicit
- scripts and cutscenes are Effects with scoped cancellation
- game state is split across domain services instead of one giant mutable blob

The engine should be honest about Effect rather than hiding it behind a faux-simple facade.

## Early Engine Shape

The first phase of `Effect2d` centers on:

- a Bun-native desktop runtime
- one practical rendering backend
- immediate-mode 2D rendering
- fixed-timestep simulation
- code-defined rooms and maps
- hybrid room content with tile planes plus object planes and trigger zones
- collision, triggers, and spatial queries before full physics
- simple sprite animation and tween helpers
- lightweight scenes, overlays, and transitions
- raw input plus action mapping
- JSON save/load with explicit save participants
- debug overlays and inspectable services
- headless-testable core subsystems where practical

## Architecture Principles

### Effect Native

`Effect2d` should use Effect heavily in both the engine and userland:

- services instead of hidden globals
- Layers instead of ad hoc wiring
- typed errors for expected failures
- known failures modeled through the typed Effect error channel
- scoped resources and scoped scene instances
- structured concurrency for scripts and long-running workflows

### LÖVE-Inspired, Not LÖVE-Compatible

The engine should preserve LÖVE's module boundaries and ergonomic spirit, but it should not attempt source compatibility with Lua projects.

That means:

- preserve domains like graphics, audio, window, input, filesystem, timer, and math
- keep drawing immediate-mode at the public level
- redesign APIs to fit TypeScript and Effect cleanly
- avoid global callbacks and ambient mutable state

### Small Core, Rich Userland

The engine core should provide strong primitives and runtime contracts.

Userland should own game-specific systems such as:

- player state
- combat rules
- dialogue
- quests
- inventory
- room logic
- enemy behavior

## First Milestone

The first milestone is not "clone all of LÖVE."

The first milestone is a tiny playable top-down action-adventure vertical slice that proves the architecture.

That slice should validate:

- Bun-native launch
- one window
- one scene stack
- fixed-timestep update and draw
- keyboard and mouse input
- immediate-mode 2D rendering
- image and text rendering
- code-defined room data
- collision and triggers
- sprite animation
- music and sound effects
- JSON save/load
- a debug overlay
- an Effect-based scripted sequence

`0.1` is successful when that slice is good enough that we would willingly start a real small game on top of it.

## Non-Goals

Early `Effect2d` is explicitly not trying to be:

- a browser game engine
- a React-like framework
- an ECS-first engine
- a full physics engine
- a multi-platform engine from day one
- a Lua compatibility layer
- a Promise-first API
- a giant editor suite
- a 3D engine
- a framework that owns all gameplay architecture

## Documentation Strategy

The docs should teach the actual model:

- services
- Layers
- scopes
- typed errors
- scene instances
- save participants
- Effect-based scripts

The goal is not to hide Effect. The goal is to make game development with Effect legible and enjoyable.

## Shared Language

The project glossary lives in [UBIQUITOUS_LANGUAGE.md](./UBIQUITOUS_LANGUAGE.md).

Its job is to define the shared game-engine language for the project and to prevent multiple terms from drifting into use for the same concept. We use it to keep docs, code, variable names, and conversations aligned around one vocabulary.

## Roadmap

The milestone checklist lives in [ROADMAP.md](./ROADMAP.md).

It is the working plan for the engine. When implementation pressure forces a pivot, the roadmap should be updated along with the architecture docs so the written plan stays honest.

## Starter

The canonical starter lives in [games/starter/README.md](./games/starter/README.md).

It shows the intended small-game architecture in code:

- Layer-composed runtime assembly
- domain state services
- registered scenes
- save participants
- input bindings
- debug toggles

The package root export is intended for engine/runtime APIs. Repo-local testing helpers stay under `src/testing` and are not part of the package root surface.

## Pressure Test

The first real small game pressure-test lives in [games/beacon-run/README.md](./games/beacon-run/README.md).

It exists to prove that `Effect2d` can support a separate game-specific domain and composition root without sliding back into starter-specific assumptions.

## Debugging With OTEL + Commentary

Playable games write local OpenTelemetry data when you launch them through the repo run scripts:

- `bun run:starter`
- `bun run:beacon-run`
- `bun run:cavern`

By default sessions land under `.effect2d/otel/<game-id>/...`. Each session directory contains:

- `session.json`
- `commentary.ndjson`
- `otel-logs.ndjson`
- `otel-metrics.ndjson`
- `otel-traces.ndjson`

### Play + Narrate

Run the game in one terminal:

```bash
bun run:beacon-run
```

Store commentary in another terminal. `live` creates the session immediately, prints the file paths, then keeps recording each line you enter:

```bash
bun commentary live --game Effect2d/beacon-run
```

Or append one note at a time:

```bash
bun commentary append --game Effect2d/beacon-run "Room transition felt late after lighting the beacon."
```

If you want to force a specific session directory, either pass `--session-dir <path>` or set `EFFECT2D_OTEL_SESSION_DIR=<path>` before launching the game.

The `live` command is for continuous narration while you play. `append` is good when you want short deliberate notes tied to exact moments, and it will reuse the latest session for that game unless you point it at a specific one.

### Analyze After The Run

When the run is over, keep the whole session directory. The commentary and OTEL files are meant to be read together: commentary says what the player felt, telemetry says what the engine did.

Use the repo skill [gameplay-telemetry-analysis](./.agents/skills/gameplay-telemetry-analysis/SKILL.md). Give the agent the finished session directory and ask it to use that skill to analyze the run.
