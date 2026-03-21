export interface TileLayer {
	readonly id: string;
	readonly width: number;
	readonly height: number;
	readonly tiles: ReadonlyArray<number>;
}

export interface ObjectLayerEntry {
	readonly id: string;
	readonly kind: string;
	readonly x: number;
	readonly y: number;
	readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ObjectLayer {
	readonly id: string;
	readonly entries: ReadonlyArray<ObjectLayerEntry>;
}

export interface RoomContent {
	readonly id: string;
	readonly tileLayers: ReadonlyArray<TileLayer>;
	readonly objectLayers: ReadonlyArray<ObjectLayer>;
}
