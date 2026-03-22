import type {
	RoomContent,
	RoomObject,
	SpawnPoint,
	TransitionZone,
} from "./MapContent.ts";

/** Returns every authored object across all object planes in a room. @public */
export const roomObjects = (room: RoomContent): ReadonlyArray<RoomObject> =>
	room.objectPlanes.flatMap((plane) => plane.entries);

/** Finds one authored room object by id. @public */
export const roomObjectById = (
	room: RoomContent,
	objectId: string,
): RoomObject | undefined =>
	roomObjects(room).find((entry) => entry.id === objectId);

/** Filters room objects by authored kind. @public */
export const roomObjectsByKind = (
	room: RoomContent,
	kind: string,
): ReadonlyArray<RoomObject> =>
	roomObjects(room).filter((entry) => entry.kind === kind);

/** Returns all authored spawn points in a room. @public */
export const roomSpawnPoints = (room: RoomContent): ReadonlyArray<SpawnPoint> =>
	roomObjectsByKind(room, "spawn-point") as ReadonlyArray<SpawnPoint>;

/** Returns all authored transition zones in a room. @public */
export const roomTransitionZones = (
	room: RoomContent,
): ReadonlyArray<TransitionZone> =>
	roomObjectsByKind(room, "transition-zone") as ReadonlyArray<TransitionZone>;
