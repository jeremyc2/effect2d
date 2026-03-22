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

/** Identity helper for authored tile planes. @public */
export const defineTilePlane = (plane: TilePlane): TilePlane => plane;

/** Identity helper for authored object planes. @public */
export const defineObjectPlane = (plane: ObjectPlane): ObjectPlane => plane;

/** Identity helper for authored rooms. @public */
export const defineRoom = (room: RoomContent): RoomContent => room;

/** Identity helper for generic room objects. @public */
export const roomObject = (object: RoomObject): RoomObject => object;

/** Builds a typed spawn-point object. @public */
export const spawnPoint = (object: Omit<SpawnPoint, "kind">): SpawnPoint => ({
	...object,
	kind: "spawn-point",
});

/** Builds a typed transition-zone object. @public */
export const transitionZone = (
	object: Omit<TransitionZone, "kind">,
): TransitionZone => ({
	...object,
	kind: "transition-zone",
});

/** Builds a typed trigger-zone object. @public */
export const triggerZone = (
	object: Omit<TriggerZone, "kind">,
): TriggerZone => ({
	...object,
	kind: "trigger-zone",
});

/** Identity helper for room metadata. @public */
export const roomMetadata = (metadata: RoomMetadata): RoomMetadata => metadata;
