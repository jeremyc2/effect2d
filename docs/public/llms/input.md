# Input

**Version:** 0.0.1 · **Repository:** [https://github.com/jeremyc2/effect2d](https://github.com/jeremyc2/effect2d)

> Public Input API.

## Input

### KeyCode

- Kind: type
- Source: `src/input/Input.ts:4`

Keyboard key identifiers as reported by the active platform backend.

### MouseButton

- Kind: type
- Source: `src/input/Input.ts:7`

Mouse button identifiers as reported by the platform backend.

### PointerPosition

- Kind: interface
- Source: `src/input/Input.ts:10`

The latest known mouse or pointer position.

### InputEvent

- Kind: type
- Source: `src/input/Input.ts:16`

A raw native input event captured during the current frame.



Available event variants:
- `key-down` and `key-up`
- `mouse-down` and `mouse-up`
- `mouse-move`
- `wheel`
- `text-input`

### BindingEdge

- Kind: type
- Source: `src/input/Input.ts:51`

A **binding edge**: a physical key or mouse button attached to a [ActionBinding](./llms/input.md#input-actionbinding).
Not a world **Trigger** (overlap region).



Kinds:
- `key`
- `mouse-button`

### ActionBinding

- Kind: interface
- Source: `src/input/Input.ts:71`

Maps a named gameplay action to one or more [BindingEdge](./llms/input.md#input-bindingedge)s.



Translate device details into domain language (`"jump"`, `"pause"`, …).

```ts
const jumpBinding: ActionBinding = {
 action: "jump",
 edges: [{ type: "key", key: "Space" }],
};
```

### ActionState

- Kind: interface
- Source: `src/input/Input.ts:90`

The derived state of a named gameplay action for the current frame.



`justPressed` and `justReleased` are edge-triggered for the current frame,
while `isPressed` stays true until the binding edge is released or consumed.

### InputSnapshot

- Kind: interface
- Source: `src/input/Input.ts:106`

A frame-local snapshot of raw input state.



This is most useful for pointer-heavy tools, text entry, or tests that need
to inspect the exact events captured during a frame.

### InvalidInputBindingError

- Kind: error
- Source: `src/input/Input.ts:262`

Indicates that an action binding is structurally invalid.

### InputBindingConflictError

- Kind: error
- Source: `src/input/Input.ts:271`

Indicates that one action declared the same binding edge more than once.

### UnknownInputActionError

- Kind: error
- Source: `src/input/Input.ts:280`

Indicates that code asked for an action that has not been bound.

### Input

- Kind: service
- Source: `src/input/Input.ts:321`

The engine's action-oriented input service.



`Input` bridges **Raw input** and gameplay **Action map** / **Binding** queries.
queries. Game authors usually:

- declare a set of [ActionBinding](./llms/input.md#input-actionbinding) values
- call `setBindings(...)` during bootstrap
- read `actionState(...)` or `isActionPressed(...)` in gameplay systems
- inspect raw `events` or `pointerPosition` only when they need lower-level
 control

The service keeps frame transitions explicit through `beginFrame`, which lets
tests and native boundaries drive input deterministically.

#### Methods

- `actionState: ( action: string, ) => Effect.Effect<ActionState, UnknownInputActionError>`
- `applyEvent: (event: InputEvent) => Effect.Effect<void>`
- `beginFrame: Effect.Effect<void>`
- `bindAction: ( binding: ActionBinding, ) => Effect.Effect< void, InputBindingConflictError | InvalidInputBindingError >`
- `bindings: Effect.Effect<ReadonlyArray<ActionBinding>>`
- `consumeAction: ( action: string, ) => Effect.Effect<void, UnknownInputActionError>`
- `events: Effect.Effect<ReadonlyArray<InputEvent>>`
- `isActionPressed: ( action: string, ) => Effect.Effect<boolean, UnknownInputActionError>`
- `isKeyPressed: (key: KeyCode) => Effect.Effect<boolean>`
- `isMouseButtonPressed: ( button: MouseButton, ) => Effect.Effect<boolean>`
- `pointerPosition: Effect.Effect<PointerPosition>`
- `setBindings: ( bindings: ReadonlyArray<ActionBinding>, ) => Effect.Effect< void, InputBindingConflictError | InvalidInputBindingError >`
- `snapshot: Effect.Effect<InputSnapshot>`