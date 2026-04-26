import { Context, Effect, Layer, Ref, Schema } from "effect";
import { recordInputEvent } from "../debug/GameplayMetrics.ts";

/** Keyboard key identifiers as reported by the active platform backend. @public */
export type KeyCode = string;

/** Mouse button identifiers as reported by the platform backend. @public */
export type MouseButton = number;

/** The latest known mouse or pointer position. @public */
export interface PointerPosition {
	readonly x: number;
	readonly y: number;
}

/**
 * A raw native input event captured during the current frame.
 *
 * @public
 *
 * Available event variants:
 * - `key-down` and `key-up`
 * - `mouse-down` and `mouse-up`
 * - `mouse-move`
 * - `wheel`
 * - `text-input`
 */
export type InputEvent =
	| {
			readonly key: KeyCode;
			readonly type: "key-down" | "key-up";
	  }
	| {
			readonly button: MouseButton;
			readonly type: "mouse-down" | "mouse-up";
	  }
	| {
			readonly position: PointerPosition;
			readonly type: "mouse-move";
	  }
	| {
			readonly deltaX: number;
			readonly deltaY: number;
			readonly type: "wheel";
	  }
	| {
			readonly text: string;
			readonly type: "text-input";
	  };

/**
 * A **binding edge**: a physical key or mouse button attached to a {@link ActionBinding}.
 * Not a world **Trigger** (overlap region).
 *
 * @public
 *
 * Kinds:
 * - `key`
 * - `mouse-button`
 */
export type BindingEdge =
	| {
			readonly key: KeyCode;
			readonly type: "key";
	  }
	| {
			readonly button: MouseButton;
			readonly type: "mouse-button";
	  };

/**
 * Maps a named gameplay action to one or more {@link BindingEdge}s.
 *
 * @public
 *
 * Translate device details into domain language (`"jump"`, `"pause"`, …).
 *
 * ```ts
 * const jumpBinding: ActionBinding = {
 *   action: "jump",
 *   edges: [{ type: "key", key: "Space" }],
 * };
 * ```
 */
export interface ActionBinding {
	readonly action: string;
	readonly edges: ReadonlyArray<BindingEdge>;
}

/**
 * The derived state of a named gameplay action for the current frame.
 *
 * @public
 *
 * `justPressed` and `justReleased` are edge-triggered for the current frame,
 * while `isPressed` stays true until the binding edge is released or consumed.
 */
export interface ActionState {
	readonly action: string;
	readonly consumed: boolean;
	readonly isPressed: boolean;
	readonly justPressed: boolean;
	readonly justReleased: boolean;
}

/**
 * A frame-local snapshot of raw input state.
 *
 * @public
 *
 * This is most useful for pointer-heavy tools, text entry, or tests that need
 * to inspect the exact events captured during a frame.
 */
export interface InputSnapshot {
	readonly events: ReadonlyArray<InputEvent>;
	readonly mouseButtons: ReadonlySet<MouseButton>;
	readonly pointerPosition: PointerPosition;
	readonly pressedKeys: ReadonlySet<KeyCode>;
	readonly textBuffer: ReadonlyArray<string>;
	readonly wheelDeltaX: number;
	readonly wheelDeltaY: number;
}

interface InputState {
	readonly bindings: ReadonlyMap<string, ActionBinding>;
	readonly consumedActions: ReadonlySet<string>;
	readonly current: InputSnapshot;
	readonly previous: {
		readonly mouseButtons: ReadonlySet<MouseButton>;
		readonly pressedKeys: ReadonlySet<KeyCode>;
	};
}

const initialSnapshot: InputSnapshot = {
	events: [],
	mouseButtons: new Set<MouseButton>(),
	pointerPosition: { x: 0, y: 0 },
	pressedKeys: new Set<KeyCode>(),
	textBuffer: [],
	wheelDeltaX: 0,
	wheelDeltaY: 0,
};

const initialState: InputState = {
	bindings: new Map<string, ActionBinding>(),
	consumedActions: new Set<string>(),
	current: initialSnapshot,
	previous: {
		mouseButtons: new Set<MouseButton>(),
		pressedKeys: new Set<KeyCode>(),
	},
};

function getBindingEdgeKey(edge: BindingEdge): string {
	return edge.type === "key" ? `key:${edge.key}` : `mouse:${edge.button}`;
}

const includesBindingEdge = (
	pressedKeys: ReadonlySet<KeyCode>,
	mouseButtons: ReadonlySet<MouseButton>,
	edge: BindingEdge,
): boolean =>
	edge.type === "key"
		? pressedKeys.has(edge.key)
		: mouseButtons.has(edge.button);

const bindingState = (
	state: InputState,
	binding: ActionBinding,
): Pick<
	ActionState,
	"consumed" | "isPressed" | "justPressed" | "justReleased"
> => {
	const isPressed = binding.edges.some((edge) =>
		includesBindingEdge(
			state.current.pressedKeys,
			state.current.mouseButtons,
			edge,
		),
	);
	const wasPressed = binding.edges.some((edge) =>
		includesBindingEdge(
			state.previous.pressedKeys,
			state.previous.mouseButtons,
			edge,
		),
	);

	return {
		consumed: state.consumedActions.has(binding.action),
		isPressed: isPressed && !state.consumedActions.has(binding.action),
		justPressed:
			isPressed && !wasPressed && !state.consumedActions.has(binding.action),
		justReleased: !isPressed && wasPressed,
	};
};

const appendEvent = (
	snapshot: InputSnapshot,
	event: InputEvent,
): InputSnapshot => ({
	...snapshot,
	events: [...snapshot.events, event],
});

const nextSnapshot = (
	snapshot: InputSnapshot,
	event: InputEvent,
): InputSnapshot => {
	switch (event.type) {
		case "key-down": {
			const nextPressedKeys = new Set(snapshot.pressedKeys);
			nextPressedKeys.add(event.key);
			return {
				...appendEvent(snapshot, event),
				pressedKeys: nextPressedKeys,
			};
		}
		case "key-up": {
			const nextPressedKeys = new Set(snapshot.pressedKeys);
			nextPressedKeys.delete(event.key);
			return {
				...appendEvent(snapshot, event),
				pressedKeys: nextPressedKeys,
			};
		}
		case "mouse-down": {
			const nextButtons = new Set(snapshot.mouseButtons);
			nextButtons.add(event.button);
			return {
				...appendEvent(snapshot, event),
				mouseButtons: nextButtons,
			};
		}
		case "mouse-up": {
			const nextButtons = new Set(snapshot.mouseButtons);
			nextButtons.delete(event.button);
			return {
				...appendEvent(snapshot, event),
				mouseButtons: nextButtons,
			};
		}
		case "mouse-move":
			return {
				...appendEvent(snapshot, event),
				pointerPosition: event.position,
			};
		case "text-input":
			return {
				...appendEvent(snapshot, event),
				textBuffer: [...snapshot.textBuffer, event.text],
			};
		case "wheel":
			return {
				...appendEvent(snapshot, event),
				wheelDeltaX: snapshot.wheelDeltaX + event.deltaX,
				wheelDeltaY: snapshot.wheelDeltaY + event.deltaY,
			};
	}
};

/** Indicates that an action binding is structurally invalid. @public */
export class InvalidInputBindingError extends Schema.TaggedErrorClass<InvalidInputBindingError>()(
	"InvalidInputBindingError",
	{
		action: Schema.String,
		reason: Schema.String,
	},
) {}

/** Indicates that one action declared the same binding edge more than once. @public */
export class InputBindingConflictError extends Schema.TaggedErrorClass<InputBindingConflictError>()(
	"InputBindingConflictError",
	{
		action: Schema.String,
		edge: Schema.String,
	},
) {}

/** Indicates that code asked for an action that has not been bound. @public */
export class UnknownInputActionError extends Schema.TaggedErrorClass<UnknownInputActionError>()(
	"UnknownInputActionError",
	{
		action: Schema.String,
	},
) {}

const validateBinding = Effect.fn("Input.validateBinding")(function* (
	binding: ActionBinding,
) {
	if (binding.action.length === 0) {
		return yield* new InvalidInputBindingError({
			action: binding.action,
			reason: "Action bindings must have a non-empty action name.",
		});
	}

	if (binding.edges.length === 0) {
		return yield* new InvalidInputBindingError({
			action: binding.action,
			reason: "Action bindings must include at least one binding edge.",
		});
	}

	const seenEdges = new Set<string>();
	for (const edge of binding.edges) {
		const key = getBindingEdgeKey(edge);
		if (seenEdges.has(key)) {
			return yield* new InputBindingConflictError({
				action: binding.action,
				edge: key,
			});
		}

		seenEdges.add(key);
	}

	return binding;
});

/**
 * The engine's action-oriented input service.
 *
 * @public
 *
 * `Input` bridges **Raw input** and gameplay **Action map** / **Binding** queries.
 * queries. Game authors usually:
 *
 * - declare a set of {@link ActionBinding} values
 * - call `setBindings(...)` during bootstrap
 * - read `actionState(...)` or `isActionPressed(...)` in gameplay systems
 * - inspect raw `events` or `pointerPosition` only when they need lower-level
 *   control
 *
 * The service keeps frame transitions explicit through `beginFrame`, which lets
 * tests and native boundaries drive input deterministically.
 */
export class Input extends Context.Service<
	Input,
	{
		readonly actionState: (
			action: string,
		) => Effect.Effect<ActionState, UnknownInputActionError>;
		readonly applyEvent: (event: InputEvent) => Effect.Effect<void>;
		readonly beginFrame: Effect.Effect<void>;
		readonly bindAction: (
			binding: ActionBinding,
		) => Effect.Effect<
			void,
			InputBindingConflictError | InvalidInputBindingError
		>;
		readonly bindings: Effect.Effect<ReadonlyArray<ActionBinding>>;
		readonly consumeAction: (
			action: string,
		) => Effect.Effect<void, UnknownInputActionError>;
		readonly events: Effect.Effect<ReadonlyArray<InputEvent>>;
		readonly isActionPressed: (
			action: string,
		) => Effect.Effect<boolean, UnknownInputActionError>;
		readonly isKeyPressed: (key: KeyCode) => Effect.Effect<boolean>;
		readonly isMouseButtonPressed: (
			button: MouseButton,
		) => Effect.Effect<boolean>;
		readonly pointerPosition: Effect.Effect<PointerPosition>;
		readonly setBindings: (
			bindings: ReadonlyArray<ActionBinding>,
		) => Effect.Effect<
			void,
			InputBindingConflictError | InvalidInputBindingError
		>;
		readonly snapshot: Effect.Effect<InputSnapshot>;
	}
>()("effect2d/input/Input") {
	static readonly layer = Layer.effect(
		Input,
		Effect.gen(function* () {
			const stateRef = yield* Ref.make(initialState);

			const beginFrame = Ref.update(stateRef, (state) => ({
				...state,
				consumedActions: new Set<string>(),
				current: {
					...state.current,
					events: [],
					textBuffer: [],
					wheelDeltaX: 0,
					wheelDeltaY: 0,
				},
				previous: {
					mouseButtons: new Set(state.current.mouseButtons),
					pressedKeys: new Set(state.current.pressedKeys),
				},
			}));

			const applyEvent = Effect.fn("Input.applyEvent")(function* (
				event: InputEvent,
			) {
				yield* Effect.annotateCurrentSpan({
					"effect2d.input.event_type": event.type,
				});
				yield* recordInputEvent(event.type);
				yield* Ref.update(stateRef, (state) => ({
					...state,
					current: nextSnapshot(state.current, event),
				}));
			});

			const snapshot = Ref.get(stateRef).pipe(
				Effect.map((state) => state.current),
			);

			const events = snapshot.pipe(Effect.map((current) => current.events));

			const pointerPosition = snapshot.pipe(
				Effect.map((current) => current.pointerPosition),
			);

			const bindings = Ref.get(stateRef).pipe(
				Effect.map((state) => Array.from(state.bindings.values())),
			);

			const setBindings = Effect.fn("Input.setBindings")(function* (
				nextBindings: ReadonlyArray<ActionBinding>,
			) {
				yield* Effect.annotateCurrentSpan({
					"effect2d.input.binding_count": nextBindings.length,
				});
				const validatedBindings = new Map<string, ActionBinding>();

				for (const binding of nextBindings) {
					const validated = yield* validateBinding(binding);
					validatedBindings.set(validated.action, validated);
				}

				yield* Ref.update(stateRef, (state) => ({
					...state,
					bindings: validatedBindings,
				}));
				yield* Effect.logDebug("Registered input bindings.").pipe(
					Effect.annotateLogs({
						"effect2d.input.binding_count": nextBindings.length,
					}),
				);
			});

			const bindAction = Effect.fn("Input.bindAction")(function* (
				binding: ActionBinding,
			) {
				const validated = yield* validateBinding(binding);
				yield* Effect.annotateCurrentSpan({
					"effect2d.input.action": validated.action,
					"effect2d.input.edge_count": validated.edges.length,
				});
				yield* Ref.update(stateRef, (state) => ({
					...state,
					bindings: new Map(state.bindings).set(validated.action, validated),
				}));
			});

			const actionState = Effect.fn("Input.actionState")(function* (
				action: string,
			) {
				const state = yield* Ref.get(stateRef);
				const binding = state.bindings.get(action);

				if (binding === undefined) {
					return yield* new UnknownInputActionError({ action });
				}

				return {
					action,
					...bindingState(state, binding),
				} satisfies ActionState;
			});

			const isActionPressed = Effect.fn("Input.isActionPressed")(function* (
				action: string,
			) {
				const state = yield* actionState(action);
				return state.isPressed;
			});

			const consumeAction = Effect.fn("Input.consumeAction")(function* (
				action: string,
			) {
				yield* actionState(action);
				yield* Ref.update(stateRef, (state) => ({
					...state,
					consumedActions: new Set(state.consumedActions).add(action),
				}));
			});

			const isKeyPressed = Effect.fn("Input.isKeyPressed")(function* (
				key: KeyCode,
			) {
				const current = yield* snapshot;
				return current.pressedKeys.has(key);
			});

			const isMouseButtonPressed = Effect.fn("Input.isMouseButtonPressed")(
				function* (button: MouseButton) {
					const current = yield* snapshot;
					return current.mouseButtons.has(button);
				},
			);

			return Input.of({
				actionState,
				applyEvent,
				beginFrame,
				bindAction,
				bindings,
				consumeAction,
				events,
				isActionPressed,
				isKeyPressed,
				isMouseButtonPressed,
				pointerPosition,
				setBindings,
				snapshot,
			});
		}),
	);
}
