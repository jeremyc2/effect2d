import type {
	RoomContent,
	RoomObject,
	SpawnPoint,
	TransitionZone,
} from "./MapContent.ts";

export const roomObjects = (room: RoomContent): ReadonlyArray<RoomObject> =>
	room.objectPlanes.flatMap((plane) => plane.entries);

export const roomObjectById = (
	room: RoomContent,
	objectId: string,
): RoomObject | undefined =>
	roomObjects(room).find((entry) => entry.id === objectId);

export const roomObjectsByKind = (
	room: RoomContent,
	kind: string,
): ReadonlyArray<RoomObject> =>
	roomObjects(room).filter((entry) => entry.kind === kind);

export const roomSpawnPoints = (room: RoomContent): ReadonlyArray<SpawnPoint> =>
	roomObjectsByKind(room, "spawn-point") as ReadonlyArray<SpawnPoint>;

export const roomTransitionZones = (
	room: RoomContent,
): ReadonlyArray<TransitionZone> =>
	roomObjectsByKind(room, "transition-zone") as ReadonlyArray<TransitionZone>;
