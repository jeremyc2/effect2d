# Scene

**Version:** 0.0.1 · **Repository:** [https://github.com/jeremyc2/effect2d](https://github.com/jeremyc2/effect2d)

> Public Scene API.

## Scene

### SceneId

- Kind: type
- Source: `src/scene/Scene.ts:3`

Identifies a scene inside a game.



Scene ids are usually short authored names like `"title"`, `"overworld"`,
or `"pause"`.

### SceneStackLevel

- Kind: type
- Source: `src/scene/Scene.ts:13`

Distinguishes the primary gameplay scene from temporary overlay scenes such
as pause menus, inventory sheets, or modal dialogue stacks.



Available levels:
- `primary`
- `overlay`

### SceneLifecycle

- Kind: interface
- Source: `src/scene/Scene.ts:25`

The lifecycle hooks a scene instance can contribute to the runtime.



A scene is responsible for its own setup, update, drawing, optional input
handling, and teardown. Each hook runs in a scene-local `Scope`, which makes
it natural to start background effects that should be cleaned up when the
scene exits.

### SceneDefinition

- Kind: interface
- Source: `src/scene/Scene.ts:43`

Declares how a scene is identified and instantiated.



In application code you usually author a `SceneDefinition` as a constant and
provide it through `SceneLookup.layer`.

```ts
const titleScene: SceneDefinition = {
 id: "title",
 instantiate: Effect.succeed({
 enter: Effect.void,
 update: Effect.void,
 draw: Effect.void,
 exit: Effect.void,
 }),
};
```

### SceneInstance

- Kind: interface
- Source: `src/scene/Scene.ts:68`

Represents a live instantiated scene managed by the engine.



This type is mostly useful in tests and scene-management internals.

### SceneStackEntry

- Kind: interface
- Source: `src/scene/Scene.ts:81`

A single entry in the runtime scene stack.



Overlay entries sit above the active primary scene.

### SceneStackSnapshot

- Kind: interface
- Source: `src/scene/Scene.ts:93`

A serializable view of the current scene stack.



This snapshot is useful for diagnostics and tests that want to assert stack
transitions without depending on scene internals.

## SceneDirector

### SceneDirector

- Kind: service
- Source: `src/scene/SceneDirector.ts:73`

Coordinates scene lifecycle, scene transitions, and the overlay stack.



This is the main scene-management service game authors use at runtime. It is
responsible for:

- instantiating the configured start scene
- switching between primary scenes
- pushing and popping overlay scenes
- ensuring scene-local scopes are released when a scene exits
- providing a snapshot suitable for diagnostics and UI

A common pattern is:

- provide authored scenes via [SceneLookup](./llms/scene.md#scene-scenelookup)
- build `SceneDirector.layer(startSceneId)`
- call `switchTo`, `pushOverlay`, or `popOverlay` from gameplay services
- let the **Frame updater** call the active scene's update and draw work

#### Methods

- `currentScene: Effect.Effect<SceneDefinition, SceneStackEmptyError>`
- `snapshot: Effect.Effect<SceneStackSnapshot, SceneStackEmptyError>`
- `switchTo: ( sceneId: SceneId, ) => Effect.Effect<void, SceneNotFoundError | SceneStackEmptyError>`
- `pushOverlay: ( sceneId: SceneId, ) => Effect.Effect<void, SceneNotFoundError | SceneStackEmptyError>`
- `popOverlay: () => Effect.Effect< void, OverlayStackUnderflowError | SceneStackEmptyError >`
- `updateCurrent: Effect.Effect<void, SceneStackEmptyError>`
- `drawStack: Effect.Effect<void, SceneStackEmptyError>`
- `handleInput: Effect.Effect<void, SceneStackEmptyError>`

## SceneError

### SceneNotFoundError

- Kind: error
- Source: `src/scene/SceneError.ts:3`

Indicates that a scene id was requested but not registered.

### SceneStackEmptyError

- Kind: error
- Source: `src/scene/SceneError.ts:11`

Indicates that a scene-stack operation required an active scene when none existed.

### OverlayStackUnderflowError

- Kind: error
- Source: `src/scene/SceneError.ts:19`

Indicates that code tried to pop an overlay when the overlay stack was empty.

## SceneLookup

### SceneLookup

- Kind: service
- Source: `src/scene/SceneLookup.ts:5`

Scene **Lookup**: id → authored [SceneDefinition](./llms/scene.md#scene-scenedefinition).



Intentionally minimal: answers “which definition matches this id?” and exposes
the full authored set for tooling or diagnostics.

#### Methods

- `all: Effect.Effect<ReadonlyArray<SceneDefinition>>`
- `get: ( sceneId: SceneId, ) => Effect.Effect<SceneDefinition, SceneNotFoundError>`