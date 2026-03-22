/** Free-form metadata attached to a room or room object. @public */
export type RoomMetadata = Readonly<Record<string, unknown>>;

/** A dense tile plane authored for a room. @public */
export interface TilePlane {
	readonly id: string;
	readonly width: number;
	readonly height: number;
	readonly tiles: ReadonlyArray<number>;
}

/** A positioned authored room object. @public */
export interface RoomObject {
	readonly id: string;
	readonly kind: string;
	readonly metadata: Readonly<Record<string, unknown>>;
	readonly height: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}

/** A named collection of room objects. @public */
export interface ObjectPlane {
	readonly entries: ReadonlyArray<RoomObject>;
	readonly id: string;
}

/** The canonical authored representation of a room. @public */
export interface RoomContent {
	readonly id: string;
	readonly metadata: RoomMetadata;
	readonly objectPlanes: ReadonlyArray<ObjectPlane>;
	readonly tilePlanes: ReadonlyArray<TilePlane>;
}

/** A room object that identifies a spawn location. @public */
export interface SpawnPoint extends RoomObject {
	readonly kind: "spawn-point";
	readonly metadata: Readonly<{
		readonly spawnId: string;
		readonly [key: string]: unknown;
	}>;
}

/** A room object that moves the player to another room. @public */
export interface TransitionZone extends RoomObject {
	readonly kind: "transition-zone";
	readonly metadata: Readonly<{
		readonly targetRoomId: string;
		readonly targetSpawnId?: string;
		readonly [key: string]: unknown;
	}>;
}

/** A generic authored trigger zone. @public */
export interface TriggerZone extends RoomObject {
	readonly kind: "trigger-zone";
}
