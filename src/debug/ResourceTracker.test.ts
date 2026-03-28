import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { runLayerEffect } from "../testing/runEffectTest.ts";
import { ResourceTracker } from "./ResourceTracker.ts";

describe("ResourceTracker", () => {
	test("tracks resource lifecycle state changes", async () => {
		await runLayerEffect(
			ResourceTracker.layer,
			Effect.gen(function* () {
				const resourceTracker = yield* ResourceTracker;

				yield* resourceTracker.register(
					"player-sheet",
					"image",
					"Sprite atlas is queued for load.",
				);
				yield* resourceTracker.setLoaded(
					"player-sheet",
					"Sprite atlas decoded successfully.",
				);
				yield* resourceTracker.register("pause-scene", "scene");
				yield* resourceTracker.fault(
					"pause-scene",
					"Scene instantiate hook failed.",
				);

				expect(yield* resourceTracker.records).toEqual([
					{
						details: "Sprite atlas decoded successfully.",
						id: "player-sheet",
						kind: "image",
						state: "loaded",
					},
					{
						details: "Scene instantiate hook failed.",
						id: "pause-scene",
						kind: "scene",
						state: "faulted",
					},
				]);
			}),
		);
	});
});

test("releases scoped resources automatically when their scope closes", async () => {
	await runLayerEffect(
		ResourceTracker.layer,
		Effect.gen(function* () {
			const resourceTracker = yield* ResourceTracker;

			yield* Effect.scoped(
				Effect.gen(function* () {
					yield* resourceTracker.registerScoped(
						"overworld-scene",
						"scene",
						"Scene instance is live.",
					);
					yield* resourceTracker.setLoaded(
						"overworld-scene",
						"Scene instance finished loading.",
					);
				}),
			);

			expect(yield* resourceTracker.records).toEqual([
				{
					details: "Scene instance finished loading.",
					id: "overworld-scene",
					kind: "scene",
					state: "released",
				},
			]);
		}),
	);
});
