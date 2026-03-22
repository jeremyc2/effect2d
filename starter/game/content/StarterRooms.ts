import {
	defineObjectPlane,
	defineRoom,
	defineTilePlane,
	roomMetadata,
	roomObject,
	spawnPoint,
	transitionZone,
} from "../../../src/maps/index.ts";

const overworldTerrainTiles = [
	1, 1, 1, 1, 1, 1, 1, 2, 1, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 1, 2, 1, 0,
	0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2,
] as const;

const lanternTerrainTiles = [
	3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0, 3, 3, 0, 0, 0, 0, 0, 0, 3, 3, 0,
	0, 0, 0, 0, 0, 3, 3, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3,
] as const;

export const starterRooms = [
	defineRoom({
		id: "overworld-room",
		metadata: roomMetadata({
			backgroundImageId: "room-overworld",
			description: "Starter overworld entrance.",
			displayName: "Overworld",
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
						y: 32,
					}),
					transitionZone({
						id: "to-lantern-room",
						height: 32,
						metadata: {
							targetRoomId: "lantern-room",
							targetSpawnId: "lantern-entry",
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
				tiles: overworldTerrainTiles,
				width: 8,
			}),
		],
	}),
	defineRoom({
		id: "lantern-room",
		metadata: roomMetadata({
			backgroundImageId: "room-lantern",
			description: "Starter lantern chamber.",
			displayName: "Lantern Room",
			hintText: "Press Space near the lantern.",
		}),
		objectPlanes: [
			defineObjectPlane({
				id: "markers",
				entries: [
					spawnPoint({
						id: "lantern-entry",
						height: 16,
						metadata: {
							spawnId: "lantern-entry",
						},
						width: 16,
						x: 8,
						y: 32,
					}),
					roomObject({
						id: "lantern-pickup",
						height: 12,
						kind: "pickup",
						metadata: {
							itemId: "lantern",
						},
						width: 12,
						x: 24,
						y: 32,
					}),
					roomObject({
						id: "slime-enemy",
						height: 14,
						kind: "enemy",
						metadata: {
							enemyId: "slime",
						},
						width: 14,
						x: 72,
						y: 32,
					}),
				],
			}),
		],
		tilePlanes: [
			defineTilePlane({
				height: 6,
				id: "terrain",
				tiles: lanternTerrainTiles,
				width: 8,
			}),
		],
	}),
] as const;
