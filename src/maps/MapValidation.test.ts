import { describe, expect, test } from "bun:test";
import { Cause, Effect, Exit, Result, Schema } from "effect";

import { MapValidationError } from "./MapError.ts";
import { validateRoom } from "./MapValidation.ts";
import {
	defineObjectPlane,
	defineRoom,
	defineTilePlane,
	roomMetadata,
	roomObject,
	spawnPoint,
	transitionZone,
} from "./RoomBuilder.ts";

const isMapValidationError = Schema.is(MapValidationError);

describe("validateRoom", () => {
	test("accepts valid code-defined room content", async () => {
		const room = defineRoom({
			id: "start-room",
			metadata: roomMetadata({
				biome: "cavern",
			}),
			objectPlanes: [
				defineObjectPlane({
					id: "markers",
					entries: [
						spawnPoint({
							id: "spawn-player",
							height: 16,
							metadata: {
								spawnId: "player",
							},
							width: 16,
							x: 32,
							y: 48,
						}),
						transitionZone({
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

		const validatedRoom = await Effect.runPromise(validateRoom(room));
		expect(validatedRoom).toEqual(room);
	});

	test("rejects transition zones that do not declare a target room", async () => {
		const room = defineRoom({
			id: "broken-room",
			metadata: roomMetadata({}),
			objectPlanes: [
				defineObjectPlane({
					id: "markers",
					entries: [
						roomObject({
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

		const exit = await Effect.runPromiseExit(validateRoom(room));
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
	});
});
