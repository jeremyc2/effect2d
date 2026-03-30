import { describe, expect, test } from "bun:test";
import { Effect, Layer, Schema } from "effect";
import { Graphics } from "../graphics/Graphics.ts";
import { Input } from "../input/Input.ts";
import { runLayerEffect } from "../testing/runEffectTest.ts";
import { UI } from "./UI.ts";

class UITestAssertionError extends Schema.TaggedErrorClass<UITestAssertionError>()(
	"UITestAssertionError",
	{
		reason: Schema.String,
	},
) {}

const makeUILayer = () => {
	const dependencies = Layer.mergeAll(Graphics.layer, Input.layer);
	return Layer.mergeAll(
		dependencies,
		UI.layer.pipe(Layer.provide(dependencies)),
	);
};

describe("UI", () => {
	test("loads fonts and measures wrapped text", async () => {
		await runLayerEffect(
			makeUILayer(),
			Effect.gen(function* () {
				const ui = yield* UI;

				yield* ui.loadFont({
					fontId: "body",
					glyphWidth: 8,
					letterSpacing: 1,
					lineHeight: 12,
					sourcePath: "fonts/body.ttf",
					spaceWidth: 4,
				});

				const singleLine = yield* ui.measureText("body", "AB");
				const wrapped = yield* ui.wrapText("body", "alpha beta gamma", 50);

				expect(singleLine.width).toBe(17);
				expect(singleLine.height).toBe(12);
				expect(wrapped.lines.map((line) => line.text)).toEqual([
					"alpha",
					"beta",
					"gamma",
				]);
				expect(wrapped.height).toBe(36);
			}),
		);
	});

	test("draws dialogue boxes and text blocks through the graphics command model", async () => {
		await runLayerEffect(
			makeUILayer(),
			Effect.gen(function* () {
				const graphics = yield* Graphics;
				const ui = yield* UI;

				yield* ui.loadFont({
					fontId: "dialogue",
					glyphWidth: 8,
					lineHeight: 10,
					sourcePath: "fonts/dialogue.ttf",
				});

				const pages = yield* ui.paginateDialogue({
					fontId: "dialogue",
					maxLines: 2,
					maxWidth: 80,
					text: "Welcome to the cavern below. Stay close to the light.",
				});
				const firstPage = pages[0];
				if (firstPage === undefined) {
					return yield* new UITestAssertionError({
						reason:
							"Expected dialogue pagination to produce at least one page.",
					});
				}

				yield* graphics.beginFrame;
				yield* ui.drawDialogueBox({
					bounds: {
						position: { x: 8, y: 96 },
						size: { height: 40, width: 120 },
					},
					fontId: "dialogue",
					page: firstPage,
				});
				yield* ui.drawTextBlock({
					align: "center",
					fontId: "dialogue",
					maxWidth: 64,
					position: { x: 40, y: 16 },
					text: "Menu",
				});

				const frame = yield* graphics.endFrame;
				expect(
					frame.commands.some((command) => command.type === "draw-text"),
				).toBe(true);
				expect(
					frame.commands.some(
						(command) =>
							command.type === "draw-text" && command.fontId === "dialogue",
					),
				).toBe(true);
				expect(
					frame.commands.some((command) => command.type === "draw-rectangle"),
				).toBe(true);
			}),
		);
	});

	test("resolves menu navigation from input actions", async () => {
		await runLayerEffect(
			makeUILayer(),
			Effect.gen(function* () {
				const input = yield* Input;
				const ui = yield* UI;

				yield* input.setBindings([
					{
						action: "menu-down",
						edges: [{ key: "ArrowDown", type: "key" }],
					},
					{
						action: "menu-confirm",
						edges: [{ key: "Enter", type: "key" }],
					},
				]);

				yield* input.beginFrame;
				yield* input.applyEvent({
					key: "ArrowDown",
					type: "key-down",
				});
				yield* input.applyEvent({
					key: "Enter",
					type: "key-down",
				});

				const result = yield* ui.resolveMenuInput({
					currentIndex: 0,
					itemCount: 3,
				});

				expect(result.currentIndex).toBe(1);
				expect(result.confirmed).toBe(true);
				expect(result.moved).toBe(true);
			}),
		);
	});
});
