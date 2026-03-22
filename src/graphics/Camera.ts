import { Effect, Layer, Ref, ServiceMap } from "effect";

export interface CameraVector {
	readonly x: number;
	readonly y: number;
}

export interface CameraBounds {
	readonly maxX: number;
	readonly maxY: number;
	readonly minX: number;
	readonly minY: number;
}

export interface CameraViewport {
	readonly height: number;
	readonly width: number;
}

export interface CameraShakeState {
	readonly durationSeconds: number;
	readonly elapsedSeconds: number;
	readonly intensity: number;
}

export interface CameraState {
	readonly bounds: CameraBounds | null;
	readonly followTarget: CameraVector | null;
	readonly position: CameraVector;
	readonly shake: CameraShakeState | null;
	readonly viewport: CameraViewport;
	readonly zoom: number;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
	Math.min(maximum, Math.max(minimum, value));

const clampPosition = (
	position: CameraVector,
	bounds: CameraBounds | null,
): CameraVector => {
	if (bounds === null) {
		return position;
	}

	return {
		x: clamp(position.x, bounds.minX, bounds.maxX),
		y: clamp(position.y, bounds.minY, bounds.maxY),
	};
};

export const makeCameraState = (options?: {
	readonly bounds?: CameraBounds | null;
	readonly position?: CameraVector;
	readonly viewport?: CameraViewport;
	readonly zoom?: number;
}): CameraState => ({
	bounds: options?.bounds ?? null,
	followTarget: null,
	position: clampPosition(
		options?.position ?? { x: 0, y: 0 },
		options?.bounds ?? null,
	),
	shake: null,
	viewport: options?.viewport ?? {
		height: 180,
		width: 320,
	},
	zoom: Math.max(options?.zoom ?? 1, 0.01),
});

export const setCameraViewport = (
	state: CameraState,
	viewport: CameraViewport,
): CameraState => ({
	...state,
	viewport,
});

export const setCameraBounds = (
	state: CameraState,
	bounds: CameraBounds | null,
): CameraState => ({
	...state,
	bounds,
	position: clampPosition(state.position, bounds),
});

export const setCameraPosition = (
	state: CameraState,
	position: CameraVector,
): CameraState => ({
	...state,
	position: clampPosition(position, state.bounds),
});

export const setCameraZoom = (
	state: CameraState,
	zoom: number,
): CameraState => ({
	...state,
	zoom: Math.max(zoom, 0.01),
});

export const followCameraTarget = (
	state: CameraState,
	target: CameraVector | null,
): CameraState => ({
	...state,
	followTarget: target,
	position:
		target === null ? state.position : clampPosition(target, state.bounds),
});

export const stepCameraFollow = (state: CameraState): CameraState =>
	state.followTarget === null
		? state
		: {
				...state,
				position: clampPosition(state.followTarget, state.bounds),
			};

export const startCameraShake = (
	state: CameraState,
	intensity: number,
	durationSeconds: number,
): CameraState => ({
	...state,
	shake: {
		durationSeconds: Math.max(durationSeconds, 0),
		elapsedSeconds: 0,
		intensity: Math.max(intensity, 0),
	},
});

export const stepCameraShake = (
	state: CameraState,
	deltaSeconds: number,
): CameraState => {
	if (state.shake === null || deltaSeconds <= 0) {
		return state;
	}

	const elapsedSeconds = Math.min(
		state.shake.elapsedSeconds + deltaSeconds,
		state.shake.durationSeconds,
	);

	return {
		...state,
		shake:
			elapsedSeconds >= state.shake.durationSeconds
				? null
				: {
						...state.shake,
						elapsedSeconds,
					},
	};
};

export const shakeOffset = (state: CameraState): CameraVector => {
	if (state.shake === null || state.shake.durationSeconds <= 0) {
		return { x: 0, y: 0 };
	}

	const remaining =
		1 - state.shake.elapsedSeconds / state.shake.durationSeconds;
	const strength = state.shake.intensity * remaining;

	return {
		x: strength,
		y: -strength,
	};
};

export const worldToScreen = (
	state: CameraState,
	worldPoint: CameraVector,
): CameraVector => {
	const offset = shakeOffset(state);
	return {
		x:
			(worldPoint.x - state.position.x + offset.x) * state.zoom +
			state.viewport.width / 2,
		y:
			(worldPoint.y - state.position.y + offset.y) * state.zoom +
			state.viewport.height / 2,
	};
};

export const screenToWorld = (
	state: CameraState,
	screenPoint: CameraVector,
): CameraVector => {
	const offset = shakeOffset(state);
	return {
		x:
			(screenPoint.x - state.viewport.width / 2) / state.zoom +
			state.position.x -
			offset.x,
		y:
			(screenPoint.y - state.viewport.height / 2) / state.zoom +
			state.position.y -
			offset.y,
	};
};

export class SceneCamera extends ServiceMap.Service<
	SceneCamera,
	{
		readonly follow: (target: CameraVector | null) => Effect.Effect<void>;
		readonly screenToWorld: (
			screenPoint: CameraVector,
		) => Effect.Effect<CameraVector>;
		readonly setBounds: (bounds: CameraBounds | null) => Effect.Effect<void>;
		readonly setPosition: (position: CameraVector) => Effect.Effect<void>;
		readonly setViewport: (viewport: CameraViewport) => Effect.Effect<void>;
		readonly setZoom: (zoom: number) => Effect.Effect<void>;
		readonly shake: (
			intensity: number,
			durationSeconds: number,
		) => Effect.Effect<void>;
		readonly snapshot: Effect.Effect<CameraState>;
		readonly step: (deltaSeconds: number) => Effect.Effect<void>;
		readonly worldToScreen: (
			worldPoint: CameraVector,
		) => Effect.Effect<CameraVector>;
	}
>()("effect2d/graphics/Camera/SceneCamera") {
	static readonly layer = (initialState?: Partial<CameraState>) =>
		Layer.effect(
			SceneCamera,
			Effect.gen(function* () {
				const stateRef = yield* Ref.make(
					makeCameraState({
						bounds: initialState?.bounds,
						position: initialState?.position,
						viewport: initialState?.viewport,
						zoom: initialState?.zoom,
					}),
				);

				const setViewport = Effect.fn("SceneCamera.setViewport")(function* (
					viewport: CameraViewport,
				) {
					yield* Ref.update(stateRef, (state) =>
						setCameraViewport(state, viewport),
					);
				});

				const setBounds = Effect.fn("SceneCamera.setBounds")(function* (
					bounds: CameraBounds | null,
				) {
					yield* Ref.update(stateRef, (state) =>
						setCameraBounds(state, bounds),
					);
				});

				const setPosition = Effect.fn("SceneCamera.setPosition")(function* (
					position: CameraVector,
				) {
					yield* Ref.update(stateRef, (state) =>
						setCameraPosition(state, position),
					);
				});

				const setZoom = Effect.fn("SceneCamera.setZoom")(function* (
					zoom: number,
				) {
					yield* Ref.update(stateRef, (state) => setCameraZoom(state, zoom));
				});

				const follow = Effect.fn("SceneCamera.follow")(function* (
					target: CameraVector | null,
				) {
					yield* Ref.update(stateRef, (state) =>
						followCameraTarget(state, target),
					);
				});

				const shake = Effect.fn("SceneCamera.shake")(function* (
					intensity: number,
					durationSeconds: number,
				) {
					yield* Ref.update(stateRef, (state) =>
						startCameraShake(state, intensity, durationSeconds),
					);
				});

				const step = Effect.fn("SceneCamera.step")(function* (
					deltaSeconds: number,
				) {
					yield* Ref.update(stateRef, (state) =>
						stepCameraShake(stepCameraFollow(state), deltaSeconds),
					);
				});

				const worldPointToScreen = Effect.fn("SceneCamera.worldToScreen")(
					function* (worldPoint: CameraVector) {
						const state = yield* Ref.get(stateRef);
						return worldToScreen(state, worldPoint);
					},
				);

				const screenPointToWorld = Effect.fn("SceneCamera.screenToWorld")(
					function* (screenPoint: CameraVector) {
						const state = yield* Ref.get(stateRef);
						return screenToWorld(state, screenPoint);
					},
				);

				return SceneCamera.of({
					follow,
					screenToWorld: screenPointToWorld,
					setBounds,
					setPosition,
					setViewport,
					setZoom,
					shake,
					snapshot: Ref.get(stateRef),
					step,
					worldToScreen: worldPointToScreen,
				});
			}),
		);
}
