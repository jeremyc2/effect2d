/** Free-form metadata attached to a room or room object. Use this for authored data your own game understands. @public */
export type RoomMetadata = Readonly<Record<string, unknown>>;

/** A dense tile plane authored for a room. Tiles are stored in row-major order. @public */
export interface TilePlane {
	readonly id: string;
	readonly width: number;
	readonly height: number;
	readonly tiles: ReadonlyArray<number>;
}

/**
 * A positioned authored room object.
 *
 * @public
 *
 * `kind` is the extension point your game usually switches on when translating
 * room content into gameplay entities.
 */
export interface RoomObject {
	readonly id: string;
	readonly kind: string;
	readonly metadata: Readonly<Record<string, unknown>>;
	readonly height: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}

/** A named collection of room objects, often used to separate gameplay objects from editor-only helpers or decorative markers. @public */
export interface ObjectPlane {
	readonly entries: ReadonlyArray<RoomObject>;
	readonly id: string;
}

/**
 * The canonical authored representation of a room.
 *
 * @public
 *
 * A room combines tile planes, object planes, and optional metadata into one
 * value that can be validated, queried, serialized, and loaded into gameplay.
 */
export interface RoomContent {
	readonly id: string;
	readonly metadata: RoomMetadata;
	readonly objectPlanes: ReadonlyArray<ObjectPlane>;
	readonly tilePlanes: ReadonlyArray<TilePlane>;
}

/** A room object that identifies a spawn location. The required metadata key is `spawnId`. @public */
export interface SpawnPoint extends RoomObject {
	readonly kind: "spawn-point";
	readonly metadata: Readonly<{
		readonly spawnId: string;
		readonly [key: string]: unknown;
	}>;
}

/** A room object that moves the player to another room. `targetSpawnId` lets the destination room choose which spawn point to use. @public */
export interface TransitionZone extends RoomObject {
	readonly kind: "transition-zone";
	readonly metadata: Readonly<{
		readonly targetRoomId: string;
		readonly targetSpawnId?: string;
		readonly [key: string]: unknown;
	}>;
}

/** A generic authored trigger zone for game-defined interactions that are not special-cased by the map helpers. @public */
export interface TriggerZone extends RoomObject {
	readonly kind: "trigger-zone";
}
