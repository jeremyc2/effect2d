# Ubiquitous language

Shared vocabulary for `Effect2d`. This document is **normative**: it states how we *want* to think and speak about the engine and games built on it—not a mirror of every identifier in the repository.

The **aliases to avoid** column blocks web-app and generic software language from displacing game-engine terms, and vice versa.

Source code, documentation, examples, and conversation should all use the terms in this document.

## How to read the columns


| Column       | Meaning                                                                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Origin**   | **Game** (common game-development usage), **Software** (broader CS / platforms / patterns), **Coined** (vocabulary we reserve in this project). |
| **Prolif.**  | Proliferation in *this* repository: **0**–**10**. Higher means more touchpoints; re-score when the codebase shifts.                             |
| **Audience** | **Game** (authors shipping a game), **Engine** (people working on `Effect2d`), **Both**.                                                        |
| **Learn**    | How important the term is early: **0**–**10** (**10** = unavoidable).                                                                           |


## Stance

- **Effect** owns composition (**Layer**, **Service**, **Scope**, typed errors). We do not rename those; we use them with engine vocabulary on top.
- **Native boundary** names the *edge* to the OS. **Platform backend** names the *swappable implementation* behind windowing, presentation, input drain, and audio device sync—not a second “engine inside the engine.”
- **Director** vs **Coordinator**: both orchestrate multiple services, but see [Director vs Coordinator](#director-vs-coordinator) below—game domains vs engine workflows.
- **Scene** is a runtime mode with lifecycle; **Room** is authored geography. **Lookup** and **Repository** are deliberate patterns for id→definition maps and authored content storage—not generic “managers.”
- We reserve **Layer** for Effect composition. Room content uses **authoring planes** (tile grids and object placement), not the word “layer” in the sense of Photoshop or web layout.

### Director vs Coordinator

Use these names so “orchestration” does not blur **game fiction** and **engine protocol**.

- **Director** — Orchestrates **your game’s** concerns across **domains** (simulation vs presentation, combat vs menu, overworld vs pause—whatever boundaries *you* draw). It answers: *what should the game do this frame, and which domain services need to cooperate?* Example pattern: separate gameplay and presentation directors that feed the **Frame updater**.
- **Coordinator** — Runs a **fixed engine workflow** where several services each own a slice of data and the engine defines the choreography. It answers: *how does this engine feature (save, load, migration) collect and apply contributions in order?* Example: **Save coordinator** merges **Save participant** slices into a **Save document**; the document shape and slot rules are engine-owned, not game-specific fiction.

Neither term implies seniority or size. If the workflow is defined primarily by **your** rules and domains, prefer **Director**. If it is defined primarily by **Effect2d’s** contracts and multi-participant pipelines, prefer **Coordinator**.

## Composition and runtime


| Term             | Definition                                                                                                                                                                                                  | Aliases to avoid                                          | Origin   | Prolif. | Audience | Learn |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------- | ------- | -------- | ----- |
| Engine           | The reusable runtime foundation and subsystems shipped as `Effect2d`.                                                                                                                                       | app, framework, platform (when meaning the product stack) | Game     | 8       | Both     | 10    |
| Game             | A userland project built on the engine.                                                                                                                                                                     | app, product                                              | Game     | 7       | Both     | 10    |
| Runtime          | The live executing process: engine plus game services.                                                                                                                                                      | host app, process manager                                 | Software | 8       | Both     | 9     |
| Native boundary  | The thin orchestration at the OS edge: window, input drain, frame presentation, audio sync, pacing. It wires **Platform backend**, **Input**, **Audio**, and **Frame updater**—it does not own game rules. | backend app, core engine, platform layer                  | Coined   | 6       | Engine   | 8     |
| Platform backend | The swappable implementation behind native windowing, drawing, input collection, timing waits, and device audio—everything the OS sees.                                                                     | provider, adapter layer, mini-engine                      | Coined   | 7       | Engine   | 7     |
| Frame updater    | The service that advances simulation and draw for the next frame before presentation. Lives in game land; invoked by the **Native boundary** loop.                                                          | frame producer, render loop, game loop, scene renderer      | Coined   | 5       | Both     | 8     |
| Launch           | Starting the runtime through Effect entrypoints.                                                                                                                                                            | boot, mount                                               | Coined   | 6       | Both     | 8     |
| Service          | An Effect service for engine or game behavior.                                                                                                                                                              | singleton, context object, helper (as a noun)             | Software | 10      | Both     | 10    |
| Layer            | Effect’s composition unit for assembling services.                                                                                                                                                          | setup object, config bundle                               | Software | 10      | Both     | 10    |
| Scope            | Ownership boundary for resources and background work.                                                                                                                                                       | lifetime bucket, cleanup zone                             | Software | 7       | Engine   | 7     |


## Roles and patterns


| Term        | Definition                                                                                                                     | Aliases to avoid                                                | Origin   | Prolif. | Audience | Learn |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | -------- | ------- | -------- | ----- |
| Director    | Orchestrates **game** domains you define (e.g. gameplay vs presentation); frames “what the game does” across those boundaries. | controller, manager when cross-domain orchestration is intended | Coined   | 6       | Both     | 7     |
| Coordinator | Orchestrates an **engine** workflow with fixed rules and multiple contributors (e.g. save/load, participants, document shape). | plugin host, workflow manager                                   | Software | 4       | Both     | 7     |
| Lookup      | A map from stable ids to definitions (e.g. scene ids).                                                                         | registry, lookup table, dictionary (when naming the pattern)    | Software | 5       | Both     | 7     |
| Repository  | Loads and holds authored **world** data (e.g. rooms).                                                                          | data access layer, DAO                                          | Software | 4       | Both     | 6     |
| Participant | A service that contributes one slice of data to a coordinated workflow (e.g. save).                                            | plugin, hook                                                    | Coined   | 5       | Engine   | 6     |


## Time and flow


| Term           | Definition                                                                 | Aliases to avoid                  | Origin | Prolif. | Audience | Learn |
| -------------- | -------------------------------------------------------------------------- | --------------------------------- | ------ | ------- | -------- | ----- |
| Simulation     | Advancing **world** state over time.                                       | business logic, app state updates | Game   | 6       | Both     | 8     |
| Fixed timestep | Simulation steps advance in stable increments.                             | variable tick, frame-tied update  | Game   | 4       | Both     | 7     |
| Frame          | One full render pass.                                                      | repaint, render cycle             | Game   | 8       | Both     | 9     |
| Tick           | One simulation step.                                                       | frame, render (when meaning draw) | Game   | 6       | Both     | 8     |
| Update         | Phase where simulation state advances.                                     | reducer pass, render prep         | Game   | 7       | Both     | 8     |
| Draw           | Phase where draw commands are recorded for the **Frame**.                  | render component, paint UI        | Game   | 7       | Both     | 8     |
| Sequence       | Effect-backed orchestration for timed beats (waits, fades, scene changes). | workflow, saga, async flow        | Coined | 6       | Both     | 7     |
| Cutscene       | Non-interactive cinematic flow built from **Sequence** and presentation.   | intro, cinematic, storyboard      | Game   | 5       | Game     | 6     |
| Transition     | Controlled change between **Scenes**, **Rooms**, or overlays.              | route change, navigation          | Game   | 6       | Both     | 7     |


## World and authorship


| Term             | Definition                                                                                                                                                          | Aliases to avoid                       | Origin | Prolif. | Audience | Learn |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------ | ------- | -------- | ----- |
| World            | Playable space and what is active in it.                                                                                                                            | app state tree, data graph             | Game   | 7       | Both     | 8     |
| Room             | A discrete authored playable area.                                                                                                                                  | page, screen (when meaning geography)  | Game   | 7       | Both     | 8     |
| Scene            | A scoped runtime unit with lifecycle (gameplay, menu, pause, …).                                                                                                    | page, route, component                 | Game   | 9       | Both     | 9     |
| Scene stack      | Ordered **Scenes**: primary stack plus **Overlays**.                                                                                                                | navigation stack, UI stack             | Coined | 6       | Both     | 8     |
| Overlay          | A **Scene** layered above another (pause, dialogue, …).                                                                                                             | modal, popover                         | Game   | 5       | Both     | 7     |
| Authored content | Engine-shaped representation of rooms, objects, and metadata—validated, serializable, owned by the **Repository** pattern.                                          | schema only, DTO set, content model    | Coined | 5       | Both     | 7     |
| Authoring plane  | A structured slice of **Room** data: either a **tile grid** or a set of placed objects (**Object plane** in code). We avoid calling these “layers” in conversation. | tile layer, layout layer, object layer | Coined | 4       | Both     | 6     |
| Trigger          | Non-blocking region that reacts to overlap or entry.                                                                                                                | event handler zone, listener area      | Game   | 6       | Both     | 7     |
| Spawn point      | Authored position for spawning or entry.                                                                                                                            | mount point, insertion point           | Game   | 5       | Game     | 7     |
| Transition zone  | **Trigger** that moves the player to another **Room** or **Scene**.                                                                                                 | route boundary, link                   | Coined | 4       | Both     | 6     |


## Actors and state


| Term         | Definition                                                              | Aliases to avoid                                | Origin   | Prolif. | Audience | Learn |
| ------------ | ----------------------------------------------------------------------- | ----------------------------------------------- | -------- | ------- | -------- | ----- |
| Actor        | Something that acts in the **World** (player, NPC, …).                  | component, widget                               | Game     | 7       | Both     | 8     |
| Domain       | A gameplay concern with its own rules (combat, inventory, …).           | feature slice, module (when meaning DDD domain) | Software | 5       | Both     | 6     |
| Domain state | Mutable state owned by a service for one **Domain** (`PlayerState`, …). | store, reducer, global state                    | Coined   | 6       | Both     | 7     |
| Resource     | Loaded asset or device-backed object with real lifetime.                | plain object, blob                              | Software | 7       | Both     | 7     |
| Cache        | Deliberately long-lived resource store.                                 | global map, singleton pool                      | Software | 5       | Both     | 6     |


## Presentation


| Term                     | Definition                                                         | Aliases to avoid                                 | Origin   | Prolif. | Audience | Learn |
| ------------------------ | ------------------------------------------------------------------ | ------------------------------------------------ | -------- | ------- | -------- | ----- |
| Immediate-mode rendering | Draw logic issues commands each **Frame**; no retained scene tree. | retained UI, DOM tree rendering                  | Game     | 4       | Both     | 6     |
| Draw command             | One graphics instruction in the current frame’s list.              | component render, DOM op                         | Game     | 5       | Both     | 7     |
| Sprite                   | Drawable 2D image or region.                                       | image component, icon (unless it is iconography) | Game     | 6       | Both     | 8     |
| Sprite sheet             | Texture holding multiple sprite regions.                           | image bundle                                     | Game     | 4       | Game     | 7     |
| Animation                | Time-based visual states (frames, key poses).                      | motion preset, transition-only                   | Game     | 6       | Both     | 8     |
| Tween                    | Interpolated value over time.                                      | CSS transition, animation state machine          | Game     | 5       | Both     | 6     |
| Camera                   | Transform from **World** to screen space.                          | scroll container, viewport component             | Game     | 7       | Both     | 8     |
| Render target            | Off-screen draw destination.                                       | buffer view, canvas component                    | Game     | 4       | Both     | 6     |
| Window                   | Native surface that receives frames and raw input.                 | browser tab, page                                | Software | 5       | Both     | 7     |


## Collision and motion


| Term            | Definition                                                                                  | Aliases to avoid                     | Origin | Prolif. | Audience | Learn |
| --------------- | ------------------------------------------------------------------------------------------- | ------------------------------------ | ------ | ------- | -------- | ----- |
| Collision       | Blocking or resolved overlap between shapes.                                                | validation, conflict                 | Game   | 7       | Both     | 8     |
| World query     | Looking up overlaps, solids, or actors in space (blocking **Collision** vs overlap checks). | spatial query, trigger query (split) | Coined | 4       | Both     | 6     |
| AABB            | Axis-aligned box for simple collision.                                                      | layout box, box model                | Game   | 5       | Both     | 7     |
| Hitbox          | Shape that deals damage or interaction.                                                     | attack zone, damage component        | Game   | 4       | Game     | 7     |
| Hurtbox         | Shape that receives damage or interaction.                                                  | target zone                          | Game   | 4       | Game     | 7     |
| Collision group | Named category controlling interaction. Not an Effect **Layer**.                            | collision layer, CSS layer           | Coined | 5       | Both     | 7     |
| Mask            | Filter of which **Collision groups** a shape cares about.                                   | allowlist, tag list                  | Game   | 4       | Both     | 6     |
| Physics         | Forces, impulses, restitution—not just overlap.                                             | collision system (when it is not)    | Game   | 5       | Both     | 7     |


## Input and audio


| Term         | Definition                                                                                            | Aliases to avoid                   | Origin | Prolif. | Audience | Learn |
| ------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------- | ------ | ------- | -------- | ----- |
| Raw input    | Device-level keys, buttons, pointer, wheel.                                                           | DOM event, browser event           | Game   | 5       | Both     | 7     |
| Action map   | Maps **Raw input** to named gameplay actions.                                                         | shortcut map, keymap handler       | Game   | 4       | Both     | 7     |
| Binding      | One action → one or more **Binding edges**.                                                           | hotkey (narrow sense)              | Game   | 4       | Both     | 7     |
| Binding edge | Physical key or button edge (press/release) attached to a **Binding**—not a **Trigger** in the world. | input trigger, trigger (ambiguous) | Coined | 4       | Both     | 7     |
| Sound effect | Short gameplay audio.                                                                                 | clip only, media asset             | Game   | 4       | Game     | 6     |
| Music        | Longer background audio.                                                                              | soundtrack only, stream            | Game   | 4       | Game     | 6     |
| AudioBus     | Logical buses for grouped audio (`master`, `music`, `sfx`); matches the public `AudioBus` type.        | audio context, playlist            | Coined | 4       | Both     | 6     |


## Persistence, testing, and observability


| Term              | Definition                                                          | Aliases to avoid               | Origin   | Prolif. | Audience | Learn |
| ----------------- | ------------------------------------------------------------------- | ------------------------------ | -------- | ------- | -------- | ----- |
| Save document     | Versioned JSON for one save.                                        | snapshot, dump                 | Coined   | 5       | Both     | 7     |
| Save participant  | **Participant** for save/load slices.                               | serializer plugin              | Coined   | 4       | Engine   | 6     |
| Slot              | Named save target.                                                  | record, row                    | Software | 4       | Both     | 6     |
| Seeded randomness | RNG fixed by seed for tests and replay.                             | Math.random, ambient random    | Software | 4       | Engine   | 6     |
| Headless runtime  | Engine path without real window/GPU—tests and CI.                   | mock app, fake browser         | Coined   | 3       | Engine   | 5     |
| Debug overlay     | Diagnostics drawn over the game.                                    | devtools, inspector UI         | Game     | 5       | Both     | 5     |
| Diagnostics       | Structured status (native, timing, audio, …)—not unstructured logs. | console spam, printf debugging | Software | 5       | Engine   | 5     |


## Errors and reliability


| Term          | Definition                                                      | Aliases to avoid            | Origin   | Prolif. | Audience | Learn |
| ------------- | --------------------------------------------------------------- | --------------------------- | -------- | ------- | -------- | ----- |
| Typed error   | Expected failure in the Effect error channel.                   | exception, null return      | Software | 6       | Both     | 8     |
| Determinism   | Same inputs and seed → same simulation outcomes.                | consistency, stable UI only | Software | 4       | Engine   | 6     |
| Replayability | Reproduce a run from inputs, timing, and **Seeded randomness**. | session replay, recording   | Software | 4       | Engine   | 5     |


