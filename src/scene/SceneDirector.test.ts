import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { runLayerEffect } from "../testing/runEffectTest.ts";
import type { SceneDefinition, SceneId } from "./Scene.ts";
import { SceneDirector } from "./SceneDirector.ts";
import { SceneLookup } from "./SceneLookup.ts";

const makeScene = (id: SceneId, trace: Array<string>): SceneDefinition => ({
	id,
	instantiate: Effect.succeed({
		enter: Effect.sync(() => trace.push(`${id}:enter`)),
		update: Effect.sync(() => trace.push(`${id}:update`)),
		draw: Effect.sync(() => trace.push(`${id}:draw`)),
		exit: Effect.sync(() => trace.push(`${id}:exit`)),
		handleInput: Effect.sync(() => trace.push(`${id}:input`)),
	}),
});

describe("SceneDirector", () => {
	test("runs scene lifecycle hooks for the active scene and overlay stack deterministically", () => {
		const trace: Array<string> = [];
		const overworld = makeScene("overworld", trace);
		const pause = makeScene("pause", trace);
		const layer = SceneDirector.layer({ startSceneId: "overworld" }).pipe(
			Layer.provide(SceneLookup.layer([overworld, pause])),
		);

		return runLayerEffect(
			layer,
			Effect.gen(function* () {
				const sceneDirector = yield* SceneDirector;

				yield* sceneDirector.updateCurrent;
				yield* sceneDirector.handleInput;
				yield* sceneDirector.pushOverlay("pause");
				yield* sceneDirector.updateCurrent;
				yield* sceneDirector.handleInput;
				yield* sceneDirector.drawStack;
				yield* sceneDirector.popOverlay;
				yield* sceneDirector.switchTo("pause");
				yield* sceneDirector.drawStack;

				const snapshot = yield* sceneDirector.snapshot;

				expect(snapshot.activeSceneId).toBe("pause");
				expect(snapshot.entries).toEqual([
					{
						level: "primary",
						sceneId: "pause",
					},
				]);
				expect(trace).toEqual([
					"overworld:enter",
					"overworld:update",
					"overworld:input",
					"pause:enter",
					"pause:update",
					"pause:input",
					"overworld:draw",
					"pause:draw",
					"pause:exit",
					"overworld:exit",
					"pause:enter",
					"pause:draw",
				]);
			}),
		);
	});

	test("closes scene scopes so scene-local background work is canceled on transition", () => {
		const trace: Array<string> = [];
		const overworld: SceneDefinition = {
			id: "overworld",
			instantiate: Effect.succeed({
				enter: Effect.addFinalizer(() =>
					Effect.sync(() => {
						trace.push("overworld:background-stopped");
					}),
				),
				update: Effect.void,
				draw: Effect.void,
				exit: Effect.sync(() => {
					trace.push("overworld:exit");
				}),
			}),
		};
		const pause = makeScene("pause", trace);
		const layer = SceneDirector.layer({ startSceneId: "overworld" }).pipe(
			Layer.provide(SceneLookup.layer([overworld, pause])),
		);

		return runLayerEffect(
			layer,
			Effect.gen(function* () {
				const sceneDirector = yield* SceneDirector;
				yield* sceneDirector.switchTo("pause");
				expect(trace).toEqual([
					"overworld:exit",
					"overworld:background-stopped",
					"pause:enter",
				]);
			}),
		);
	});
});
