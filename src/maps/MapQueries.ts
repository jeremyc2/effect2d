import type {
	RoomContent,
	RoomObject,
	SpawnPoint,
	TransitionZone,
} from "./MapContent.ts";

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
	return getRoomObjectsByKind(room, "spawn-point") as ReadonlyArray<SpawnPoint>;
}

/** Returns all authored transition zones in a room. @public */
export function getRoomTransitionZones(
	room: RoomContent,
): ReadonlyArray<TransitionZone> {
	return getRoomObjectsByKind(
		room,
		"transition-zone",
	) as ReadonlyArray<TransitionZone>;
}
