# Ubiquitous Language

The "Aliases to Avoid" column is intentionally strict. We use it to prevent multiple names for the same concept from creeping into docs, APIs, variable names, and conversations.

## Column guide


| Column       | Meaning                                                                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Origin**   | Where the term comes from: **Game** (common game-development usage), **Software** (broader CS / platforms / patterns), **Coined** (vocabulary we established or reserve in this project).     |
| **Prolif.**  | Proliferation in *this* repository: **0**–**10**. Higher means the name appears across more modules, tests, and docs; already well established. Estimates; re-score when the codebase shifts. |
| **Audience** | **Game** (authors shipping a game on the engine), **Engine** (people working on `Effect2d` itself), **Both**.                                                                                 |
| **Learn**    | How important it is to learn the term early: **0**–**10**. **10** = you will be lost without it; **0** = fine to pick up later or only if you touch that area.                                |


## Runtime


| Term            | Definition                                                                                                                                                                          | Aliases to Avoid                                                                      | Origin   | Prolif. | Audience | Learn |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------- | ------- | -------- | ----- |
| Engine          | The reusable runtime and subsystem foundation provided by `Effect2d`.                                                                                                               | app, framework, platform                                                              | Game     | 8       | Both     | 10    |
| Game            | A userland project built on top of the engine.                                                                                                                                      | app, product                                                                          | Game     | 7       | Both     | 10    |
| Runtime         | The live executing game process, including the engine and userland services.                                                                                                        | process manager, host app                                                             | Software | 8       | Both     | 9     |
| Native Boundary | The thin layer that talks to platform capabilities like windowing, rendering, audio devices, and raw input.                                                                         | backend app, core engine, platform layer                                              | Coined   | 6       | Engine   | 7     |
| Backend         | A low-level implementation behind an engine capability such as rendering or audio output.                                                                                           | provider, adapter layer                                                               | Software | 7       | Engine   | 6     |
| Native Backend  | The capability-level implementation that owns real device interaction such as opening a window, draining input, presenting frames, syncing audio output, and reporting diagnostics. | mini-engine, platform app                                                             | Coined   | 6       | Engine   | 7     |
| Frame Source    | The service that supplies the next fully prepared frame for native presentation.                                                                                                    | render loop, scene renderer                                                           | Coined   | 4       | Engine   | 6     |
| Launch          | Starting the runtime through Effect.                                                                                                                                                | boot app, mount                                                                       | Coined   | 6       | Both     | 8     |
| Capability      | A low-level engine power exposed through services, such as graphics, audio, input, or filesystem.                                                                                   | utility, helper                                                                       | Software | 5       | Engine   | 6     |
| Service         | An Effect service that provides engine or game behavior.                                                                                                                            | singleton, context object, manager unless it is specifically a director-style service | Software | 10      | Both     | 10    |
| Layer           | The composition unit used to assemble engine and game services.                                                                                                                     | setup object, config bundle                                                           | Software | 10      | Both     | 10    |
| Scope           | The ownership boundary for resources and long-running work.                                                                                                                         | lifetime bucket, cleanup zone                                                         | Software | 7       | Engine   | 7     |


## Time And Flow


| Term           | Definition                                                                   | Aliases to Avoid                  | Origin | Prolif. | Audience | Learn |
| -------------- | ---------------------------------------------------------------------------- | --------------------------------- | ------ | ------- | -------- | ----- |
| Simulation     | The advancing game world state.                                              | business logic, app state updates | Game   | 6       | Both     | 8     |
| Fixed Timestep | A simulation model where update steps advance in stable increments.          | frame-tied update, variable tick  | Game   | 4       | Both     | 7     |
| Frame          | One render pass of the game.                                                 | render cycle, repaint             | Game   | 8       | Both     | 9     |
| Tick           | A single simulation step.                                                    | frame, render                     | Game   | 6       | Both     | 8     |
| Timing Hook    | A native wait or scheduling point that helps pace frame presentation.        | sleep hack, event loop trick      | Coined | 3       | Engine   | 5     |
| Update         | The simulation phase where game state advances.                              | reducer pass, render prep         | Game   | 7       | Both     | 8     |
| Draw           | The rendering phase where the frame's visuals are submitted.                 | render component, paint UI        | Game   | 7       | Both     | 8     |
| Sequence       | An Effect-backed orchestration helper for timed gameplay beats over time.    | workflow, saga, async flow        | Coined | 6       | Both     | 7     |
| Cutscene       | A cinematic non-interactive scene built from sequences plus UI presentation. | intro, cinematic, storyboard      | Game   | 5       | Game     | 6     |
| Transition     | A controlled change between scenes, rooms, or overlays.                      | route change, navigation          | Game   | 6       | Both     | 7     |


## World And Content


| Term            | Definition                                                                                                                                                         | Aliases to Avoid                               | Origin | Prolif. | Audience | Learn |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ------ | ------- | -------- | ----- |
| World           | The playable game space and its active content.                                                                                                                    | app state tree, data graph                     | Game   | 7       | Both     | 8     |
| Room            | A discrete authored playable area.                                                                                                                                 | page, screen when it means a world location    | Game   | 7       | Both     | 8     |
| Scene           | A scoped runtime unit with its own lifecycle, such as gameplay, menu, intro, or pause.                                                                             | page, route, component                         | Game   | 9       | Both     | 9     |
| Overlay         | A scene layered on top of another scene, such as pause or dialogue.                                                                                                | modal, popover                                 | Game   | 5       | Both     | 7     |
| Tile Plane      | A grid-based authored plane of room content. We avoid the word "layer" here so `Layer` stays reserved for Effect composition.                                      | tile layer, grid component, layout layer       | Coined | 4       | Both     | 6     |
| Object Plane    | An authored plane of placed gameplay objects, spawn points, triggers, or markers. We avoid the word "layer" here so `Layer` stays reserved for Effect composition. | object layer, metadata layer, annotation layer | Coined | 4       | Both     | 6     |
| Trigger         | A non-blocking gameplay region that reacts to overlap or entry.                                                                                                    | event handler zone, listener area              | Game   | 6       | Both     | 7     |
| Spawn Point     | A designated position for creating an actor, pickup, or scene entry.                                                                                               | mount point, insertion point                   | Game   | 5       | Game     | 7     |
| Transition Zone | A trigger that causes movement into another room or scene.                                                                                                         | route boundary, page link                      | Coined | 4       | Both     | 6     |
| Content Model   | The engine-owned representation of authored room and world data.                                                                                                   | schema only, DTO set                           | Coined | 5       | Engine   | 6     |


## Actors And State


| Term          | Definition                                                                                  | Aliases to Avoid                                                | Origin   | Prolif. | Audience | Learn |
| ------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------- | ------- | -------- | ----- |
| Actor         | A gameplay thing that acts in the world, such as the player, an enemy, or an NPC.           | component, widget                                               | Game     | 7       | Both     | 8     |
| State Service | A domain service that owns mutable game state for one part of the game.                     | store unless it is intentionally named as one, reducer          | Coined   | 6       | Both     | 7     |
| Domain        | A gameplay concern with its own language and rules, such as combat, inventory, or dialogue. | feature slice, module only                                      | Software | 5       | Both     | 6     |
| Director      | A coordinating service that orchestrates work across multiple domains.                      | controller, manager when cross-domain orchestration is intended | Coined   | 6       | Both     | 7     |
| Participant   | A service that contributes to a wider engine workflow, such as save/load.                   | plugin, hook                                                    | Coined   | 5       | Engine   | 6     |
| Resource      | A loaded runtime asset or device-backed object with a real lifetime.                        | plain object, data blob                                         | Software | 7       | Both     | 7     |
| Cache         | A deliberately long-lived resource store.                                                   | global map, singleton resource pool                             | Software | 5       | Both     | 6     |


## Rendering


| Term                     | Definition                                                                      | Aliases to Avoid                                           | Origin   | Prolif. | Audience | Learn |
| ------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------- | ------- | -------- | ----- |
| Immediate-Mode Rendering | A model where draw logic issues rendering commands each frame.                  | retained UI, scene graph rendering                         | Game     | 4       | Both     | 6     |
| Draw Command             | A single rendering instruction issued during draw.                              | component render, DOM op                                   | Game     | 5       | Both     | 7     |
| Sprite                   | A drawable 2D image or image region used in gameplay rendering.                 | image component, icon unless it is actually UI iconography | Game     | 6       | Both     | 8     |
| Sprite Sheet             | A texture containing multiple sprite frames or regions.                         | image bundle                                               | Game     | 4       | Game     | 7     |
| Animation                | A time-based sequence of visual states such as sprite frames.                   | transition only, motion preset                             | Game     | 6       | Both     | 8     |
| Tween                    | A value interpolation over time.                                                | animation state machine, CSS transition                    | Game     | 5       | Both     | 6     |
| Camera                   | The viewport transform that determines how world coordinates map to the screen. | scroll container, viewport component                       | Game     | 7       | Both     | 8     |
| Canvas2D                 | The immediate drawing surface used by the current native renderer backend.      | browser canvas, DOM canvas                                 | Other    | 5       | Engine   | 6     |
| Parallax                 | Layered movement at different rates to imply depth.                             | background scroll effect                                   | Game     | 3       | Game     | 5     |
| Render Target            | An off-screen destination for drawing.                                          | canvas component, buffer view                              | Game     | 4       | Both     | 6     |
| Window                   | The native desktop surface that receives presented frames and raw player input. | browser tab, page                                          | Software | 5       | Both     | 7     |


## Collision And Motion


| Term            | Definition                                                                                                                                                  | Aliases to Avoid                     | Origin | Prolif. | Audience | Learn |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------ | ------- | -------- | ----- |
| Collision       | A blocking or resolving overlap between gameplay shapes.                                                                                                    | validation, conflict                 | Game   | 7       | Both     | 8     |
| Trigger Query   | A non-blocking overlap or region check.                                                                                                                     | event lookup, selector               | Coined | 4       | Both     | 6     |
| Spatial Query   | A world lookup for shapes or actors in an area.                                                                                                             | search filter, query selector        | Game   | 4       | Both     | 6     |
| AABB            | An axis-aligned bounding box used for simple rectangular collision.                                                                                         | box model, layout box                | Game   | 5       | Both     | 7     |
| Hitbox          | The shape that deals damage or interaction.                                                                                                                 | attack component, damage zone        | Game   | 4       | Game     | 7     |
| Hurtbox         | The shape that can receive damage or interaction.                                                                                                           | receiver box, target zone            | Game   | 4       | Game     | 7     |
| Collision Group | A named gameplay collision category used to control which things interact. We avoid the word "layer" here so `Layer` stays reserved for Effect composition. | collision layer, tag only, CSS layer | Coined | 5       | Both     | 7     |
| Mask            | A filter that limits which collision groups a shape responds to.                                                                                            | permission list, allowlist only      | Game   | 4       | Both     | 6     |
| Physics         | Full simulated body behavior such as forces, impulses, and restitution.                                                                                     | collision system                     | Game   | 5       | Both     | 7     |


## Input And Audio


| Term              | Definition                                                                                 | Aliases to Avoid                            | Origin | Prolif. | Audience | Learn |
| ----------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------- | ------ | ------- | -------- | ----- |
| Raw Input         | Direct device-level keyboard or mouse state and events.                                    | DOM event, browser event                    | Game   | 5       | Both     | 7     |
| Action Mapping    | A layer that maps raw inputs to gameplay actions like move, attack, or pause.              | shortcut system, key handler map            | Game   | 4       | Both     | 7     |
| Binding           | A mapping from one or more inputs to a named action.                                       | hotkey only                                 | Game   | 4       | Game     | 7     |
| SDL               | The current native windowing and raw input path used by the playable desktop build.        | browser shell, game engine                  | Other  | 4       | Engine   | 5     |
| Sound Effect      | A short gameplay audio event.                                                              | clip only, media asset                      | Game   | 4       | Game     | 6     |
| Music             | A longer-running background audio track.                                                   | soundtrack only, media stream               | Game   | 4       | Game     | 6     |
| Audio Output Path | The concrete native route that turns engine audio state into audible sound on the machine. | media player integration, soundtrack system | Coined | 3       | Engine   | 5     |
| Mixer Bus         | A controllable audio channel group such as master, music, or sfx.                          | audio context, playlist                     | Game   | 4       | Both     | 6     |


## Persistence And Testing


| Term              | Definition                                                                                                            | Aliases to Avoid                    | Origin   | Prolif. | Audience | Learn |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------- | ------- | -------- | ----- |
| Save Document     | The versioned JSON data written for one save.                                                                         | snapshot, dump                      | Coined   | 5       | Both     | 7     |
| Save Participant  | A service that contributes and restores one slice of save data.                                                       | serializer plugin, persistence hook | Coined   | 4       | Engine   | 6     |
| Slot              | A named save target.                                                                                                  | record, row                         | Software | 4       | Both     | 6     |
| Seeded Randomness | Randomness driven by an explicit seed for replayability and testing.                                                  | ambient random, Math.random usage   | Software | 4       | Engine   | 6     |
| Headless Core     | Engine subsystems that can run and be tested without a real window or GPU.                                            | mock app, fake browser mode         | Coined   | 3       | Engine   | 5     |
| Demo Slice        | A small playable scenario used to validate engine behavior manually.                                                  | end-to-end test app, sandbox page   | Coined   | 2       | Engine   | 3     |
| Debug Overlay     | Runtime visualization or diagnostics drawn over the game.                                                             | devtools panel, inspector UI        | Game     | 5       | Both     | 5     |
| Diagnostics       | Structured runtime status information about native services, frame presentation, audio output, or other engine state. | console spam, ad hoc logs           | Software | 5       | Engine   | 5     |


## Error And Reliability


| Term          | Definition                                                                      | Aliases to Avoid                  | Origin   | Prolif. | Audience | Learn |
| ------------- | ------------------------------------------------------------------------------- | --------------------------------- | -------- | ------- | -------- | ----- |
| Typed Error   | An expected failure represented explicitly in Effect.                           | exception, null return            | Software | 6       | Both     | 8     |
| Determinism   | The property that the same inputs and seed lead to the same simulation results. | consistency only, stable UI       | Software | 4       | Engine   | 6     |
| Replayability | The ability to reproduce a run from controlled inputs, timing, and randomness.  | browser recording, session replay | Software | 4       | Engine   | 5     |


