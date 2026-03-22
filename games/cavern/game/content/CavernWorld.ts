import type {
	CameraBounds,
	CameraVector,
	CameraViewport,
} from "../../../../src/index.ts";

export interface CavernRectangle {
	readonly height: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}

export interface CavernTransitionDefinition extends CavernRectangle {
	readonly id: string;
	readonly spawnX: number;
	readonly spawnY: number;
	readonly targetRoomId: CavernRoomId;
}

export interface CavernDecorationDefinition {
	readonly color: {
		readonly alpha: number;
		readonly blue: number;
		readonly green: number;
		readonly red: number;
	};
	readonly rectangle: CavernRectangle;
}

export interface CavernRoomDefinition {
	readonly bounds: CavernRectangle;
	readonly decorations: ReadonlyArray<CavernDecorationDefinition>;
	readonly id: CavernRoomId;
	readonly name: string;
	readonly playerSpawn: CameraVector;
	readonly transitions: ReadonlyArray<CavernTransitionDefinition>;
}

export type CavernRoomId = "rm1" | "rm2" | "rm3";

export const cavernCameraZoom = 0.5;

export const cavernViewport = {
	height: 768,
	width: 1152,
} as const satisfies CameraViewport;

export const cavernStartingRoomId: CavernRoomId = "rm1";

export const cavernRooms = {
	rm1: {
		bounds: {
			height: 1536,
			width: 4608,
			x: 128,
			y: 128,
		},
		decorations: [
			{
				color: {
					alpha: 1,
					blue: 0.13,
					green: 0.2,
					red: 0.17,
				},
				rectangle: {
					height: 1024,
					width: 768,
					x: 768,
					y: 384,
				},
			},
			{
				color: {
					alpha: 1,
					blue: 0.1,
					green: 0.13,
					red: 0.18,
				},
				rectangle: {
					height: 768,
					width: 640,
					x: 2176,
					y: 256,
				},
			},
			{
				color: {
					alpha: 1,
					blue: 0.1,
					green: 0.13,
					red: 0.14,
				},
				rectangle: {
					height: 896,
					width: 512,
					x: 3328,
					y: 512,
				},
			},
		],
		id: "rm1",
		name: "Sunken Approach",
		playerSpawn: {
			x: 512,
			y: 704,
		},
		transitions: [
			{
				height: 512,
				id: "rm1-to-rm2",
				spawnX: 200,
				spawnY: 0,
				targetRoomId: "rm2",
				width: 128,
				x: 4736,
				y: 640,
			},
		],
	},
	rm2: {
		bounds: {
			height: 1536,
			width: 7296,
			x: 128,
			y: 128,
		},
		decorations: [
			{
				color: {
					alpha: 1,
					blue: 0.12,
					green: 0.18,
					red: 0.11,
				},
				rectangle: {
					height: 512,
					width: 1152,
					x: 896,
					y: 384,
				},
			},
			{
				color: {
					alpha: 1,
					blue: 0.1,
					green: 0.12,
					red: 0.18,
				},
				rectangle: {
					height: 896,
					width: 1024,
					x: 2816,
					y: 640,
				},
			},
			{
				color: {
					alpha: 1,
					blue: 0.14,
					green: 0.14,
					red: 0.09,
				},
				rectangle: {
					height: 640,
					width: 896,
					x: 4992,
					y: 256,
				},
			},
		],
		id: "rm2",
		name: "Flooded Hall",
		playerSpawn: {
			x: 512,
			y: 704,
		},
		transitions: [
			{
				height: 512,
				id: "rm2-to-rm1",
				spawnX: -200,
				spawnY: 0,
				targetRoomId: "rm1",
				width: 128,
				x: 0,
				y: 640,
			},
			{
				height: 640,
				id: "rm2-to-rm3",
				spawnX: 200,
				spawnY: 0,
				targetRoomId: "rm3",
				width: 128,
				x: 7424,
				y: 256,
			},
		],
	},
	rm3: {
		bounds: {
			height: 2944,
			width: 4864,
			x: 128,
			y: 128,
		},
		decorations: [
			{
				color: {
					alpha: 1,
					blue: 0.12,
					green: 0.16,
					red: 0.16,
				},
				rectangle: {
					height: 768,
					width: 1536,
					x: 896,
					y: 384,
				},
			},
			{
				color: {
					alpha: 1,
					blue: 0.09,
					green: 0.1,
					red: 0.18,
				},
				rectangle: {
					height: 896,
					width: 1280,
					x: 2432,
					y: 1664,
				},
			},
		],
		id: "rm3",
		name: "Lower Junction",
		playerSpawn: {
			x: 512,
			y: 640,
		},
		transitions: [
			{
				height: 640,
				id: "rm3-to-rm2",
				spawnX: -200,
				spawnY: 0,
				targetRoomId: "rm2",
				width: 128,
				x: 0,
				y: 256,
			},
		],
	},
} as const satisfies Record<CavernRoomId, CavernRoomDefinition>;

export const getCavernRoom = (roomId: CavernRoomId): CavernRoomDefinition =>
	cavernRooms[roomId];

export const getPlayerVisualCenter = (
	position: CameraVector,
	playerSize: {
		readonly height: number;
		readonly width: number;
	},
): CameraVector => ({
	x: position.x + playerSize.width / 2,
	y: position.y + playerSize.height / 2,
});

const halfVisibleWorld = (
	viewport: CameraViewport,
	zoom: number,
): {
	readonly height: number;
	readonly width: number;
} => ({
	height: viewport.height / (2 * zoom),
	width: viewport.width / (2 * zoom),
});

export const roomToCameraBounds = (
	room: CavernRoomDefinition,
	viewport: CameraViewport,
	zoom: number,
): CameraBounds => {
	const halfVisible = halfVisibleWorld(viewport, zoom);

	return {
		maxX: room.bounds.x + room.bounds.width - halfVisible.width,
		maxY: room.bounds.y + room.bounds.height - halfVisible.height,
		minX: room.bounds.x + halfVisible.width,
		minY: room.bounds.y + halfVisible.height,
	};
};

const overlapsOnAxis = (
	startA: number,
	lengthA: number,
	startB: number,
	lengthB: number,
): boolean => startA < startB + lengthB && startA + lengthA > startB;

export const rectangleIntersects = (
	left: CavernRectangle,
	right: CavernRectangle,
): boolean =>
	overlapsOnAxis(left.x, left.width, right.x, right.width) &&
	overlapsOnAxis(left.y, left.height, right.y, right.height);

export const applyTransitionSpawn = (
	transition: CavernTransitionDefinition,
	targetRoom: CavernRoomDefinition,
	playerPosition: CameraVector,
	playerSize: {
		readonly height: number;
		readonly width: number;
	},
): CameraVector => ({
	x:
		transition.spawnX === 0
			? playerPosition.x
			: transition.spawnX > 0
				? transition.spawnX
				: targetRoom.bounds.x +
					targetRoom.bounds.width +
					transition.spawnX -
					playerSize.width,
	y:
		transition.spawnY === 0
			? playerPosition.y
			: transition.spawnY > 0
				? transition.spawnY
				: targetRoom.bounds.y +
					targetRoom.bounds.height +
					transition.spawnY -
					playerSize.height,
});
