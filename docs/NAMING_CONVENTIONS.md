# Naming conventions

Practical naming aligned with [UBIQUITOUS_LANGUAGE.md](../UBIQUITOUS_LANGUAGE.md). The goal is to keep game-engine vocabulary and Effect-native patterns from drifting into web-app or vague “manager” language.

## Functions and methods

- Use `function` declarations for module top-level functions instead of `const name = (...) => ...`.
- Top-level utilities start with a verb: `get`, `set`, `create`, `update`, `is`, `has`, `does`, `format`, …
- Prefer verb-led names on service methods that perform work or read state.

## Prefer engine terms

Use:

- `Scene`, not `Page` or `Route`
- `Room`, not `Screen` when the thing is a playable world area
- `Overlay`, not `Modal`
- `Actor`, not `Component`
- `Trigger`, not `ListenerZone` (for world regions)
- `BindingEdge`, not `InputTrigger` (for keys/buttons on a binding)
- `CollisionWorld`, not `PhysicsEngine` unless it really is full physics
- `Draw`, not `RenderComponent` for the draw phase
- `Tick` or `Update`, not `ReducerPass`
- `Binding`, not `Shortcut`
- `SaveDocument`, not `Snapshot` for persisted saves
- `Participant`, not `Plugin` when contributing to coordinated workflows
- `Director` for cross-domain gameplay orchestration; `Coordinator` for engine workflows such as save/load
- `SceneLookup` (and the **Lookup** pattern) for id→definition maps—not `Registry`
- `Repository` for authored world/content loading (e.g. maps)
- `PlatformBackend` for the low-level native adapter service; `FrameUpdater` for the service that steps simulation and draw per frame
- `TilePlane` / `ObjectPlane` as type names for the two **authoring plane** shapes in code

Avoid:

- `Manager`, `Controller`, `Util`, `Helper`, `Store` unless they are the precise domain word

## Runtime

Use:

- `launch` / `shutdown` for the runtime lifecycle
- `scope` for ownership boundaries
- `config` for startup configuration
- `nativeBoundary` for the platform-facing orchestration layer
- `platformBackend` for the swappable OS adapter

Avoid:

- `mount`, `hydrate`, `provider`, `container`, `hook` (web-framework terms)

## State

Name mutable domain services after what they own: `PlayerState`, `WorldState`, `InventoryState`. Avoid a single giant `AppState`.

## Drawing and content

Use:

- `DrawCommand`, `Sprite`, `SpriteSheet`, `TilePlane`, `ObjectPlane`, `SpawnPoint`, `TransitionZone`, `Camera`

Avoid:

- `Widget`, `CanvasComponent`, `LayoutBox`, `ViewModel`

## When something new appears

1. Check [UBIQUITOUS_LANGUAGE.md](../UBIQUITOUS_LANGUAGE.md) for a canonical term.
2. If the concept is new, add it there first (or agree a change), then name code and docs to match.
3. Update this file when the choice affects general conventions.
