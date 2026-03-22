import { describe, expect, test } from "bun:test";
import { Effect, Exit } from "effect";
import { runLayerEffect } from "../testing/runEffectTest.ts";
import { Graphics } from "./Graphics.ts";

describe("Graphics", () => {
	test("records immediate-mode draw commands in frame order", async () => {
		await runLayerEffect(
			Graphics.layer,
			Effect.gen(function* () {
				const graphics = yield* Graphics;

				yield* graphics.beginFrame;
				yield* graphics.clear({
					alpha: 1,
					blue: 0,
					green: 0,
					red: 0,
				});
				yield* graphics.setBlendMode("alpha");
				yield* graphics.setTint({
					alpha: 1,
					blue: 1,
					green: 1,
					red: 1,
				});
				yield* graphics.pushTransform({
					rotationRadians: 0,
					scaleX: 1,
					scaleY: 1,
					translation: { x: 10, y: 20 },
				});
				yield* graphics.drawImage("hero", { x: 10, y: 20 });
				yield* graphics.drawRectangle(
					{ x: 0, y: 0 },
					{ height: 32, width: 48 },
					"fill",
				);
				yield* graphics.drawCircle({ x: 5, y: 5 }, 3);
				yield* graphics.drawLine({ x: 0, y: 0 }, { x: 5, y: 5 });
				yield* graphics.drawText({
					position: { x: 4, y: 8 },
					text: "hello",
				});
				yield* graphics.drawFade(0.4);
				yield* graphics.drawFlash(0.8);
				yield* graphics.popTransform;

				const frame = yield* graphics.endFrame;

				expect(frame.commands.map((command) => command.type)).toEqual([
					"clear",
					"set-blend-mode",
					"set-tint",
					"push-transform",
					"draw-image",
					"draw-rectangle",
					"draw-circle",
					"draw-line",
					"draw-text",
					"draw-fade",
					"draw-flash",
					"pop-transform",
				]);
				expect(frame.isOpen).toBe(false);
			}),
		);
	});

	test("fails on transform stack misuse", async () => {
		const exit = await runLayerEffect(
			Graphics.layer,
			Effect.gen(function* () {
				const graphics = yield* Graphics;
				yield* graphics.beginFrame;
				return yield* Effect.exit(graphics.popTransform);
			}),
		);

		expect(Exit.isFailure(exit)).toBe(true);
	});
});
