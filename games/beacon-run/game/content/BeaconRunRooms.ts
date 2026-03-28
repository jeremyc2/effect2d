import {
	createSpawnPoint,
	createTransitionZone,
	defineObjectPlane,
	defineRoom,
	defineRoomMetadata,
	defineRoomObject,
	defineTilePlane,
} from "../../../../src/maps/index.ts";

const fieldTiles = [
	2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 2, 2, 0, 1, 1, 0, 0, 0, 2, 2, 0,
	0, 0, 0, 1, 0, 2, 2, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2,
] as const;

const shrineTiles = [
	3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0, 3, 3, 0, 1, 1, 1, 0, 0, 3, 3, 0,
	0, 0, 1, 0, 0, 3, 3, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3,
] as const;

export const beaconRunRooms = [
	defineRoom({
		id: "field-room",
		metadata: defineRoomMetadata({
			backgroundImageId: "field-room-background",
			description: "A wind-swept field below the ridge.",
			displayName: "Open Field",
			hintText: "Reach the shrine and relight the beacon.",
		}),
		objectPlanes: [
			defineObjectPlane({
				id: "markers",
				entries: [
					createSpawnPoint({
						id: "field-spawn",
						height: 16,
						metadata: { spawnId: "field-spawn" },
						width: 16,
						x: 24,
						y: 32,
					}),
					createTransitionZone({
						id: "to-shrine-room",
						height: 32,
						metadata: {
							targetRoomId: "shrine-room",
							targetSpawnId: "shrine-entry",
						},
						width: 16,
						x: 96,
						y: 24,
					}),
				],
			}),
		],
		tilePlanes: [
			defineTilePlane({
				height: 6,
				id: "terrain",
				tiles: fieldTiles,
				width: 8,
			}),
		],
	}),
	defineRoom({
		id: "shrine-room",
		metadata: defineRoomMetadata({
			backgroundImageId: "shrine-room-background",
			description: "An old shrine waiting for signal fire.",
			displayName: "Beacon Shrine",
			hintText: "Press Space near the beacon brazier.",
		}),
		objectPlanes: [
			defineObjectPlane({
				id: "markers",
				entries: [
					createSpawnPoint({
						id: "shrine-entry",
						height: 16,
						metadata: { spawnId: "shrine-entry" },
						width: 16,
						x: 8,
						y: 32,
					}),
					defineRoomObject({
						id: "north-beacon",
						height: 14,
						kind: "beacon",
						metadata: {
							beaconId: "north-beacon",
						},
						width: 14,
						x: 64,
						y: 32,
					}),
				],
			}),
		],
		tilePlanes: [
			defineTilePlane({
				height: 6,
				id: "terrain",
				tiles: shrineTiles,
				width: 8,
			}),
		],
	}),
] as const;
