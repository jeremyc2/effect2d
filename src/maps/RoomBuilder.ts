import type {
	ObjectPlane,
	RoomContent,
	RoomMetadata,
	RoomObject,
	SpawnPoint,
	TilePlane,
	TransitionZone,
	TriggerZone,
} from "./MapContent.ts";

export const defineTilePlane = (plane: TilePlane): TilePlane => plane;

export const defineObjectPlane = (plane: ObjectPlane): ObjectPlane => plane;

export const defineRoom = (room: RoomContent): RoomContent => room;

export const roomObject = (object: RoomObject): RoomObject => object;

export const spawnPoint = (object: Omit<SpawnPoint, "kind">): SpawnPoint => ({
	...object,
	kind: "spawn-point",
});

export const transitionZone = (
	object: Omit<TransitionZone, "kind">,
): TransitionZone => ({
	...object,
	kind: "transition-zone",
});

export const triggerZone = (
	object: Omit<TriggerZone, "kind">,
): TriggerZone => ({
	...object,
	kind: "trigger-zone",
});

export const roomMetadata = (metadata: RoomMetadata): RoomMetadata => metadata;
