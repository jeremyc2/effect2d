export type RoomMetadata = Readonly<Record<string, unknown>>;

export interface TilePlane {
	readonly id: string;
	readonly width: number;
	readonly height: number;
	readonly tiles: ReadonlyArray<number>;
}

export interface RoomObject {
	readonly id: string;
	readonly kind: string;
	readonly metadata: Readonly<Record<string, unknown>>;
	readonly height: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}

export interface ObjectPlane {
	readonly entries: ReadonlyArray<RoomObject>;
	readonly id: string;
}

export interface RoomContent {
	readonly id: string;
	readonly metadata: RoomMetadata;
	readonly objectPlanes: ReadonlyArray<ObjectPlane>;
	readonly tilePlanes: ReadonlyArray<TilePlane>;
}

export interface SpawnPoint extends RoomObject {
	readonly kind: "spawn-point";
	readonly metadata: Readonly<{
		readonly spawnId: string;
		readonly [key: string]: unknown;
	}>;
}

export interface TransitionZone extends RoomObject {
	readonly kind: "transition-zone";
	readonly metadata: Readonly<{
		readonly targetRoomId: string;
		readonly targetSpawnId?: string;
		readonly [key: string]: unknown;
	}>;
}

export interface TriggerZone extends RoomObject {
	readonly kind: "trigger-zone";
}
