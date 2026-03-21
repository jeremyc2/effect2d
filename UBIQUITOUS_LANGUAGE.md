# Ubiquitous Language

This glossary defines the shared game-engine language for `effect2d`.

The "Aliases to Avoid" column is intentionally strict. We use it to prevent multiple names for the same concept from creeping into docs, APIs, variable names, and conversations.

## Runtime

| Term | Definition | Aliases to Avoid |
| --- | --- | --- |
| Engine | The reusable runtime and subsystem foundation provided by `effect2d`. | app, framework, platform |
| Game | A userland project built on top of the engine. | app, product |
| Runtime | The live executing game process, including the engine and userland services. | process manager, host app |
| Native Boundary | The thin layer that talks to platform capabilities like windowing, rendering, audio devices, and raw input. | backend app, core engine, platform layer |
| Backend | A low-level implementation behind an engine capability such as rendering or audio output. | provider, adapter layer |
| Launch | Starting the runtime through Effect. | boot app, mount |
| Capability | A low-level engine power exposed through services, such as graphics, audio, input, or filesystem. | utility, helper |
| Service | An Effect service that provides engine or game behavior. | singleton, context object, manager unless it is specifically a director-style service |
| Layer | The composition unit used to assemble engine and game services. | setup object, config bundle |
| Scope | The ownership boundary for resources and long-running work. | lifetime bucket, cleanup zone |

## Time And Flow

| Term | Definition | Aliases to Avoid |
| --- | --- | --- |
| Simulation | The advancing game world state. | business logic, app state updates |
| Fixed Timestep | A simulation model where update steps advance in stable increments. | frame-tied update, variable tick |
| Frame | One render pass of the game. | render cycle, repaint |
| Tick | A single simulation step. | frame, render |
| Update | The simulation phase where game state advances. | reducer pass, render prep |
| Draw | The rendering phase where the frame's visuals are submitted. | render component, paint UI |
| Script | An Effect program that sequences gameplay events over time. | workflow, saga, async flow |
| Transition | A controlled change between scenes, rooms, or overlays. | route change, navigation |

## World And Content

| Term | Definition | Aliases to Avoid |
| --- | --- | --- |
| World | The playable game space and its active content. | app state tree, data graph |
| Room | A discrete authored playable area. | page, screen when it means a world location |
| Scene | A scoped runtime unit with its own lifecycle, such as gameplay, menu, intro, or pause. | page, route, component |
| Overlay | A scene layered on top of another scene, such as pause or dialogue. | modal, popover |
| Tile Plane | A grid-based authored plane of room content. We avoid the word "layer" here so `Layer` stays reserved for Effect composition. | tile layer, grid component, layout layer |
| Object Plane | An authored plane of placed gameplay objects, spawn points, triggers, or markers. We avoid the word "layer" here so `Layer` stays reserved for Effect composition. | object layer, metadata layer, annotation layer |
| Trigger | A non-blocking gameplay region that reacts to overlap or entry. | event handler zone, listener area |
| Spawn Point | A designated position for creating an actor, pickup, or scene entry. | mount point, insertion point |
| Transition Zone | A trigger that causes movement into another room or scene. | route boundary, page link |
| Content Model | The engine-owned representation of authored room and world data. | schema only, DTO set |

## Actors And State

| Term | Definition | Aliases to Avoid |
| --- | --- | --- |
| Actor | A gameplay thing that acts in the world, such as the player, an enemy, or an NPC. | component, widget |
| State Service | A domain service that owns mutable game state for one part of the game. | store unless it is intentionally named as one, reducer |
| Domain | A gameplay concern with its own language and rules, such as combat, inventory, or dialogue. | feature slice, module only |
| Director | A coordinating service that orchestrates work across multiple domains. | controller, manager when cross-domain orchestration is intended |
| Participant | A service that contributes to a wider engine workflow, such as save/load. | plugin, hook |
| Resource | A loaded runtime asset or device-backed object with a real lifetime. | plain object, data blob |
| Cache | A deliberately long-lived resource store. | global map, singleton resource pool |

## Rendering

| Term | Definition | Aliases to Avoid |
| --- | --- | --- |
| Immediate-Mode Rendering | A model where draw logic issues rendering commands each frame. | retained UI, scene graph rendering |
| Draw Command | A single rendering instruction issued during draw. | component render, DOM op |
| Sprite | A drawable 2D image or image region used in gameplay rendering. | image component, icon unless it is actually UI iconography |
| Sprite Sheet | A texture containing multiple sprite frames or regions. | image bundle |
| Animation | A time-based sequence of visual states such as sprite frames. | transition only, motion preset |
| Tween | A value interpolation over time. | animation state machine, CSS transition |
| Camera | The viewport transform that determines how world coordinates map to the screen. | scroll container, viewport component |
| Parallax | Layered movement at different rates to imply depth. | background scroll effect |
| Render Target | An off-screen destination for drawing. | canvas component, buffer view |

## Collision And Motion

| Term | Definition | Aliases to Avoid |
| --- | --- | --- |
| Collision | A blocking or resolving overlap between gameplay shapes. | validation, conflict |
| Trigger Query | A non-blocking overlap or region check. | event lookup, selector |
| Spatial Query | A world lookup for shapes or actors in an area. | search filter, query selector |
| AABB | An axis-aligned bounding box used for simple rectangular collision. | box model, layout box |
| Hitbox | The shape that deals damage or interaction. | attack component, damage zone |
| Hurtbox | The shape that can receive damage or interaction. | receiver box, target zone |
| Collision Group | A named gameplay collision category used to control which things interact. We avoid the word "layer" here so `Layer` stays reserved for Effect composition. | collision layer, tag only, CSS layer |
| Mask | A filter that limits which collision groups a shape responds to. | permission list, allowlist only |
| Physics | Full simulated body behavior such as forces, impulses, and restitution. | collision system |

## Input And Audio

| Term | Definition | Aliases to Avoid |
| --- | --- | --- |
| Raw Input | Direct device-level keyboard or mouse state and events. | DOM event, browser event |
| Action Mapping | A layer that maps raw inputs to gameplay actions like move, attack, or pause. | shortcut system, key handler map |
| Binding | A mapping from one or more inputs to a named action. | hotkey only |
| Sound Effect | A short gameplay audio event. | clip only, media asset |
| Music | A longer-running background audio track. | soundtrack only, media stream |
| Mixer Bus | A controllable audio channel group such as master, music, or sfx. | audio context, playlist |

## Persistence And Testing

| Term | Definition | Aliases to Avoid |
| --- | --- | --- |
| Save Document | The versioned JSON data written for one save. | snapshot, dump |
| Save Participant | A service that contributes and restores one slice of save data. | serializer plugin, persistence hook |
| Slot | A named save target. | record, row |
| Seeded Randomness | Randomness driven by an explicit seed for replayability and testing. | ambient random, Math.random usage |
| Headless Core | Engine subsystems that can run and be tested without a real window or GPU. | mock app, fake browser mode |
| Demo Slice | A small playable scenario used to validate engine behavior manually. | end-to-end test app, sandbox page |
| Debug Overlay | Runtime visualization or diagnostics drawn over the game. | devtools panel, inspector UI |

## Error And Reliability

| Term | Definition | Aliases to Avoid |
| --- | --- | --- |
| Typed Error | An expected failure represented explicitly in Effect. | exception, null return |
| Determinism | The property that the same inputs and seed lead to the same simulation results. | consistency only, stable UI |
| Replayability | The ability to reproduce a run from controlled inputs, timing, and randomness. | browser recording, session replay |
