import type {
	RoomContent,
	RoomObject,
	SpawnPoint,
	TransitionZone,
} from "./MapContent.ts";

function isSpawnPoint(entry: RoomObject): entry is SpawnPoint {
	return (
		entry.kind === "spawn-point" &&
		typeof entry.metadata["spawnId"] === "string"
	);
}

function isTransitionZone(entry: RoomObject): entry is TransitionZone {
	return (
		entry.kind === "transition-zone" &&
		typeof entry.metadata["targetRoomId"] === "string"
	);
}

/** Returns every authored object across all object planes in a room. Use this when plane boundaries do not matter to the query you are writing. @public */
export function getRoomObjects(room: RoomContent): ReadonlyArray<RoomObject> {
	return room.objectPlanes.flatMap((plane) => plane.entries);
}

/** Finds one authored room object by id. @public */
export function getRoomObjectById(
	room: RoomContent,
	objectId: string,
): RoomObject | undefined {
	return getRoomObjects(room).find((entry) => entry.id === objectId);
}

/** Filters room objects by authored `kind`, which is useful for game-specific object families in addition to the built-in helpers below. @public */
export function getRoomObjectsByKind(
	room: RoomContent,
	kind: string,
): ReadonlyArray<RoomObject> {
	return getRoomObjects(room).filter((entry) => entry.kind === kind);
}

/** Returns all authored spawn points in a room. @public */
export function getRoomSpawnPoints(
	room: RoomContent,
): ReadonlyArray<SpawnPoint> {
	return getRoomObjects(room).filter(isSpawnPoint);
}

/** Returns all authored transition zones in a room. @public */
export function getRoomTransitionZones(
	room: RoomContent,
): ReadonlyArray<TransitionZone> {
	return getRoomObjects(room).filter(isTransitionZone);
}
