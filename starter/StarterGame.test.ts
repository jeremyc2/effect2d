import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { DebugOverlay, EngineLogger, Input } from "../src/index.ts";
import { runLayerEffect } from "../src/testing/runEffectTest.ts";
import { starterBindings } from "./game/input/StarterBindings.ts";
import {
	StarterGameLive,
	starterBootstrap,
	starterProgram,
} from "./game/StarterGame.ts";
import { StarterSaveParticipants } from "./game/save/StarterSaveParticipants.ts";
import { PlayerState } from "./game/state/PlayerState.ts";
import { WorldState } from "./game/state/WorldState.ts";

describe("starter", () => {
	test("bootstraps the canonical starter runtime and save participants", async () => {
		await runLayerEffect(
			StarterGameLive,
			Effect.gen(function* () {
				const debugOverlay = yield* DebugOverlay;
				const engineLogger = yield* EngineLogger;
				const input = yield* Input;
				const playerState = yield* PlayerState;
				const starterSaveParticipants = yield* StarterSaveParticipants;
				const worldState = yield* WorldState;

				yield* starterBootstrap;

				expect(yield* input.bindings).toEqual(starterBindings);
				expect(
					(yield* starterSaveParticipants.all).map(
						(participant) => participant.key,
					),
				).toEqual(["player", "world", "debug-settings"]);
				expect(yield* engineLogger.entries).toHaveLength(1);
				expect((yield* playerState.snapshot).position).toEqual({
					x: 32,
					y: 32,
				});
				expect((yield* worldState.snapshot).currentRoomId).toBe(
					"overworld-room",
				);
				expect((yield* debugOverlay.captureSnapshot).enabled).toBe(false);
			}),
		);
	});

	test("launches through the starter program entry point", async () => {
		await runLayerEffect(StarterGameLive, starterProgram);
	});
});
