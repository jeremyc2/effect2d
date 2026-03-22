import { describe, expect, test } from "bun:test";
import { Effect, Exit } from "effect";
import { runEffectTest } from "../testing/runEffectTest.ts";
import { deserializeRoom, serializeRoom } from "./MapSerialization.ts";
import {
	defineObjectPlane,
	defineRoom,
	defineTilePlane,
	transitionZone,
} from "./RoomBuilder.ts";

const sampleRoom = defineRoom({
	id: "starting-room",
	metadata: {
		biome: "cavern",
	},
	objectPlanes: [
		defineObjectPlane({
			id: "markers",
			entries: [
				transitionZone({
					id: "east-exit",
					metadata: {
						targetRoomId: "next-room",
						targetSpawnId: "west-entry",
					},
					height: 16,
					width: 8,
					x: 120,
					y: 48,
				}),
			],
		}),
	],
	tilePlanes: [
		defineTilePlane({
			id: "ground",
			width: 2,
			height: 2,
			tiles: [1, 1, 1, 1],
		}),
	],
});

describe("MapSerialization", () => {
	test("round-trips valid room content through JSON", async () => {
		const roundTrippedRoom = await runEffectTest(
			Effect.gen(function* () {
				const serializedRoom = yield* serializeRoom(sampleRoom);
				return yield* deserializeRoom(serializedRoom);
			}),
		);

		expect(roundTrippedRoom).toEqual(sampleRoom);
	});

	test("rejects malformed serialized room content", async () => {
		const result = await Effect.runPromiseExit(
			deserializeRoom(
				'{"id":"broken-room","metadata":{},"tilePlanes":[],"objectPlanes":[{"id":"objects","entries":[{"id":"bad-transition","kind":"transition-zone","metadata":{},"height":8,"width":8,"x":0,"y":0}]}]}',
			),
		);

		expect(Exit.isFailure(result)).toBe(true);
	});
});
