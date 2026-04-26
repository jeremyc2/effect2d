import { describe, expect, test } from "bun:test";
import { Cause, Effect, Exit, Result, Schema } from "effect";

import { MapValidationError } from "./MapError.ts";
import { validateRoom } from "./MapValidation.ts";
import {
	createSpawnPoint,
	createTransitionZone,
	defineObjectPlane,
	defineRoom,
	defineRoomMetadata,
	defineRoomObject,
	defineTilePlane,
} from "./RoomBuilder.ts";

const isMapValidationError = Schema.is(MapValidationError);

describe("validateRoom", () => {
	test("accepts valid code-defined room content", () => {
		const room = defineRoom({
			id: "start-room",
			metadata: defineRoomMetadata({
				biome: "cavern",
			}),
			objectPlanes: [
				defineObjectPlane({
					id: "markers",
					entries: [
						createSpawnPoint({
							id: "spawn-player",
							height: 16,
							metadata: {
								spawnId: "player",
							},
							width: 16,
							x: 32,
							y: 48,
						}),
						createTransitionZone({
							id: "to-boss-room",
							height: 32,
							metadata: {
								targetRoomId: "boss-room",
								targetSpawnId: "entry",
							},
							width: 16,
							x: 128,
							y: 48,
						}),
					],
				}),
			],
			tilePlanes: [
				defineTilePlane({
					height: 2,
					id: "terrain",
					tiles: [1, 1, 0, 2],
					width: 2,
				}),
			],
		});

		return Effect.runPromise(
			Effect.gen(function* () {
				const validatedRoom = yield* validateRoom(room);
				expect(validatedRoom).toEqual(room);
			}),
		);
	});

	test("rejects transition zones that do not declare a target room", () => {
		const room = defineRoom({
			id: "broken-room",
			metadata: defineRoomMetadata({}),
			objectPlanes: [
				defineObjectPlane({
					id: "markers",
					entries: [
						defineRoomObject({
							id: "broken-transition",
							height: 16,
							kind: "transition-zone",
							metadata: {},
							width: 16,
							x: 0,
							y: 0,
						}),
					],
				}),
			],
			tilePlanes: [],
		});

		return Effect.runPromise(
			Effect.gen(function* () {
				const exit = yield* Effect.exit(validateRoom(room));
				expect(Exit.isFailure(exit)).toBe(true);
				if (!Exit.isFailure(exit)) {
					return;
				}

				const failure = Cause.findError(exit.cause);
				expect(Result.isSuccess(failure)).toBe(true);
				if (!Result.isSuccess(failure)) {
					return;
				}

				const isKnownFailure = isMapValidationError(failure.success);
				expect(isKnownFailure).toBe(true);
				if (!isKnownFailure) {
					return;
				}

				expect(failure.success.roomId).toBe("broken-room");
				expect(failure.success.reason).toContain("metadata.targetRoomId");
			}),
		);
	});
});
