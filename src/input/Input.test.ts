import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { runLayerEffect } from "../testing/runEffectTest.ts";
import { Input } from "./Input.ts";

describe("Input", () => {
	test("tracks raw keyboard and mouse input with polling and event access", async () => {
		await runLayerEffect(
			Input.layer,
			Effect.gen(function* () {
				const input = yield* Input;

				yield* input.applyEvent({
					key: "ArrowLeft",
					type: "key-down",
				});
				yield* input.applyEvent({
					button: 0,
					type: "mouse-down",
				});
				yield* input.applyEvent({
					position: { x: 24, y: 32 },
					type: "mouse-move",
				});
				yield* input.applyEvent({
					deltaX: 0,
					deltaY: -1,
					type: "wheel",
				});
				yield* input.applyEvent({
					text: "a",
					type: "text-input",
				});

				expect(yield* input.isKeyPressed("ArrowLeft")).toBe(true);
				expect(yield* input.isMouseButtonPressed(0)).toBe(true);
				expect(yield* input.pointerPosition).toEqual({ x: 24, y: 32 });
				expect(yield* input.events).toHaveLength(5);

				const snapshot = yield* input.snapshot;
				expect(snapshot.wheelDeltaY).toBe(-1);
				expect(snapshot.textBuffer).toEqual(["a"]);
			}),
		);
	});

	test("supports action mapping, rebinding, and action consumption", async () => {
		await runLayerEffect(
			Input.layer,
			Effect.gen(function* () {
				const input = yield* Input;

				yield* input.setBindings([
					{
						action: "pause",
						edges: [{ key: "Escape", type: "key" }],
					},
					{
						action: "attack",
						edges: [{ button: 0, type: "mouse-button" }],
					},
				]);

				yield* input.beginFrame;
				yield* input.applyEvent({
					key: "Escape",
					type: "key-down",
				});

				const pauseState = yield* input.actionState("pause");
				expect(pauseState.justPressed).toBe(true);
				expect(pauseState.isPressed).toBe(true);

				yield* input.consumeAction("pause");
				expect(yield* input.isActionPressed("pause")).toBe(false);

				yield* input.bindAction({
					action: "pause",
					edges: [{ key: "Enter", type: "key" }],
				});
				yield* input.beginFrame;
				yield* input.applyEvent({
					key: "Enter",
					type: "key-down",
				});

				expect(yield* input.isActionPressed("pause")).toBe(true);
			}),
		);
	});
});
