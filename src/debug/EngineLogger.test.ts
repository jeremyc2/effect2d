import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { runLayerEffect } from "../testing/runEffectTest.ts";
import { EngineLogger } from "./EngineLogger.ts";

describe("EngineLogger", () => {
	test("records ordered structured log entries", async () => {
		await runLayerEffect(
			EngineLogger.layer,
			Effect.gen(function* () {
				const logger = yield* EngineLogger;

				yield* logger.debug("Starting scene preload.", {
					sceneId: "overworld",
				});
				yield* logger.error("Unable to decode image atlas.", {
					assetId: "player-sheet",
				});

				expect(yield* logger.entries).toEqual([
					{
						context: {
							sceneId: "overworld",
						},
						level: "debug",
						message: "Starting scene preload.",
						sequence: 0,
					},
					{
						context: {
							assetId: "player-sheet",
						},
						level: "error",
						message: "Unable to decode image atlas.",
						sequence: 1,
					},
				]);
			}),
		);
	});
});
