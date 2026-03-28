# Input

> Public Input API.

## Input

### KeyCode

- Kind: type
- Source: `src/input/Input.ts:3`

Keyboard key identifiers as reported by the active native backend.

### MouseButton

- Kind: type
- Source: `src/input/Input.ts:6`

Mouse button identifiers as reported by the native backend.

### PointerPosition

- Kind: interface
- Source: `src/input/Input.ts:9`

The latest known mouse or pointer position.

### InputEvent

- Kind: type
- Source: `src/input/Input.ts:15`

A raw native input event captured during the current frame.



Available event variants:
- `key-down` and `key-up`
- `mouse-down` and `mouse-up`
- `mouse-move`
- `wheel`
- `text-input`

### InputTrigger

- Kind: type
- Source: `src/input/Input.ts:50`

A declarative trigger that can activate a named gameplay action.



Available trigger kinds:
- `key`
- `mouse-button`

### ActionBinding

- Kind: interface
- Source: `src/input/Input.ts:69`

Maps a named gameplay action to one or more low-level triggers.



This is the point where you translate native details into domain language
like `"jump"`, `"pause"`, or `"confirm"`.

```ts
const jumpBinding: ActionBinding = {
 action: "jump",
 triggers: [{ type: "key", key: "Space" }],
};
```

### ActionState

- Kind: interface
- Source: `src/input/Input.ts:89`

The derived state of a named gameplay action for the current frame.



`justPressed` and `justReleased` are edge-triggered for the current frame,
while `isPressed` stays true until the trigger is released or consumed.

### InputSnapshot

- Kind: interface
- Source: `src/input/Input.ts:105`

A frame-local snapshot of raw input state.



This is most useful for pointer-heavy tools, text entry, or tests that need
to inspect the exact events captured during a frame.

### InvalidInputBindingError

- Kind: error
- Source: `src/input/Input.ts:263`

Indicates that an action binding is structurally invalid.

### InputBindingConflictError

- Kind: error
- Source: `src/input/Input.ts:272`

Indicates that one action declared the same trigger more than once.

### UnknownInputActionError

- Kind: error
- Source: `src/input/Input.ts:281`

Indicates that code asked for an action that has not been bound.

### Input

- Kind: service
- Source: `src/input/Input.ts:322`

The engine's action-oriented input service.



`Input` bridges the gap between native events and gameplay-friendly action
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