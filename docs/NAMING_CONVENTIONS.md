# Naming Conventions

This document turns the project glossary into practical naming guidance for code.

The goal is to keep names aligned with [UBIQUITOUS_LANGUAGE.md](/Users/jeremy/Documents/personal/effect2d/UBIQUITOUS_LANGUAGE.md) so we do not accidentally import web-app language into the engine.

## Prefer Game-Engine Terms

Use:

- `Scene`, not `Page` or `Route`
- `Room`, not `Screen` when the thing is a playable world area
- `Overlay`, not `Modal`
- `Actor`, not `Component`
- `Trigger`, not `ListenerZone`
- `CollisionWorld`, not `PhysicsEngine` unless it really is full physics
- `Draw`, not `RenderComponent`
- `Tick` or `Update`, not `ReducerPass`
- `Binding`, not `Shortcut`
- `SaveDocument`, not `Snapshot`
- `Participant`, not `Plugin` when contributing to save/load or similar workflows
- `Director`, not `Controller` when a service coordinates multiple domains

## Service Naming

Service names should describe their gameplay or engine role clearly.

Prefer:

- `SceneDirector`
- `SaveCoordinator`
- `MapRepository`
- `CollisionWorld`
- `DebugOverlay`

Avoid vague names like:

- `Manager`
- `Controller`
- `Util`
- `Helper`
- `Store`

Use those only when they are the most precise domain term.

## Runtime Naming

Use:

- `launch` for starting the engine runtime
- `shutdown` for ending the runtime
- `scope` for ownership boundaries
- `config` for startup configuration
- `backend` for low-level implementation details
- `nativeBoundary` for platform-facing capabilities

Avoid:

- `mount`
- `hydrate`
- `provider`
- `container`
- `hook`

## State Naming

For mutable domain services, prefer names that say what domain they own.

Examples:

- `PlayerState`
- `InventoryState`
- `QuestState`
- `WorldState`

Do not default to one giant `AppState`.

## Drawing And Content Naming

Use:

- `DrawCommand`
- `Sprite`
- `SpriteSheet`
- `TilePlane`
- `ObjectPlane`
- `SpawnPoint`
- `TransitionZone`
- `Camera`

Avoid:

- `Widget`
- `CanvasComponent`
- `LayoutBox`
- `ViewModel`

## Consistency Rule

When a new concept appears, first check whether the glossary already has a term for it.

If not:

- add the term to [UBIQUITOUS_LANGUAGE.md](/Users/jeremy/Documents/personal/effect2d/UBIQUITOUS_LANGUAGE.md)
- use the same term in docs and code
- update this file if the naming choice affects general conventions
