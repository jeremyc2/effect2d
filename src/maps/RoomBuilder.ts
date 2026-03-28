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

/** Identity helper for authored tile planes. Useful when you want inference and generated docs without introducing a builder DSL. @public */
export function defineTilePlane(plane: TilePlane): TilePlane {
	return plane;
}

/** Identity helper for authored object planes. @public */
export function defineObjectPlane(plane: ObjectPlane): ObjectPlane {
	return plane;
}

/**
 * Identity helper for authored rooms.
 *
 * @public
 *
 * ```ts
 * const room = defineRoom({
 *   id: "field",
 *   metadata: {},
 *   tilePlanes: [],
 *   objectPlanes: [],
 * });
 * ```
 */
export function defineRoom(room: RoomContent): RoomContent {
	return room;
}

/** Identity helper for generic room objects when you are using a custom `kind`. @public */
export function defineRoomObject(object: RoomObject): RoomObject {
	return object;
}

/** Builds a typed spawn-point object and inserts the fixed `kind: "spawn-point"` tag for you. @public */
export function createSpawnPoint(object: Omit<SpawnPoint, "kind">): SpawnPoint {
	return {
		...object,
		kind: "spawn-point",
	};
}

/** Builds a typed transition-zone object and inserts the fixed `kind: "transition-zone"` tag for you. @public */
export function createTransitionZone(
	object: Omit<TransitionZone, "kind">,
): TransitionZone {
	return {
		...object,
		kind: "transition-zone",
	};
}

/** Builds a typed trigger-zone object and inserts the fixed `kind: "trigger-zone"` tag for you. @public */
export function createTriggerZone(
	object: Omit<TriggerZone, "kind">,
): TriggerZone {
	return {
		...object,
		kind: "trigger-zone",
	};
}

/** Identity helper for room metadata when you want inline authored objects to stay strongly typed. @public */
export function defineRoomMetadata(metadata: RoomMetadata): RoomMetadata {
	return metadata;
}
