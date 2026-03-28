import { Effect, Layer, Ref, ServiceMap } from "effect";

/** A 2D point or vector used by the camera API. World and screen coordinates both use this shape. @public */
export interface CameraVector {
	readonly x: number;
	readonly y: number;
}

/**
 * Bounds that clamp the camera's focal position.
 *
 * @public
 *
 * These bounds constrain the camera center, not the top-left corner of the
 * viewport.
 */
export interface CameraBounds {
	readonly maxX: number;
	readonly maxY: number;
	readonly minX: number;
	readonly minY: number;
}

/** The authored viewport the camera projects into. This is usually your game's internal render resolution. @public */
export interface CameraViewport {
	readonly height: number;
	readonly width: number;
}

/** Transient screen-shake metadata managed by the pure shake helpers in this module. @public */
export interface CameraShakeState {
	readonly durationSeconds: number;
	readonly elapsedSeconds: number;
	readonly intensity: number;
}

/**
 * A complete snapshot of camera state.
 *
 * @public
 *
 * `position` is the current camera center in world space.
 */
export interface CameraState {
	readonly bounds: CameraBounds | null;
	readonly followTarget: CameraVector | null;
	readonly position: CameraVector;
	readonly shake: CameraShakeState | null;
	readonly viewport: CameraViewport;
	readonly zoom: number;
}

function clampValue(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

const clampPosition = (
	position: CameraVector,
	bounds: CameraBounds | null,
): CameraVector => {
	if (bounds === null) {
		return position;
	}

	return {
		x: clampValue(position.x, bounds.minX, bounds.maxX),
		y: clampValue(position.y, bounds.minY, bounds.maxY),
	};
};

/**
 * Creates an initial camera state value.
 *
 * @public
 *
 * ```ts
 * const camera = makeCameraState({
 *   viewport: { width: 320, height: 180 },
 *   zoom: 2,
 * });
 * ```
 */
export function makeCameraState(options?: {
	readonly bounds?: CameraBounds | null;
	readonly position?: CameraVector;
	readonly viewport?: CameraViewport;
	readonly zoom?: number;
}): CameraState {
	return {
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
	};
}

/** Replaces the camera viewport without changing position or zoom. @public */
export function setCameraViewport(
	state: CameraState,
	viewport: CameraViewport,
): CameraState {
	return {
		...state,
		viewport,
	};
}

/** Sets or clears camera clamping bounds and immediately reclamps the current position. @public */
export function setCameraBounds(
	state: CameraState,
	bounds: CameraBounds | null,
): CameraState {
	return {
		...state,
		bounds,
		position: clampPosition(state.position, bounds),
	};
}

/** Moves the camera to a world-space position, respecting bounds when present. @public */
export function setCameraPosition(
	state: CameraState,
	position: CameraVector,
): CameraState {
	return {
		...state,
		position: clampPosition(position, state.bounds),
	};
}

/** Changes zoom while enforcing a tiny positive minimum to avoid invalid projection math. @public */
export function setCameraZoom(state: CameraState, zoom: number): CameraState {
	return {
		...state,
		zoom: Math.max(zoom, 0.01),
	};
}

/** Starts or stops following a world-space target. When a target is set, position snaps to it immediately. @public */
export function followCameraTarget(
	state: CameraState,
	target: CameraVector | null,
): CameraState {
	return {
		...state,
		followTarget: target,
		position:
			target === null ? state.position : clampPosition(target, state.bounds),
	};
}

/** Applies the current follow target to the camera position for this tick. @public */
export function updateCameraFollow(state: CameraState): CameraState {
	return state.followTarget === null
		? state
		: {
				...state,
				position: clampPosition(state.followTarget, state.bounds),
			};
}

/** Starts a simple decay-based shake effect. @public */
export function startCameraShake(
	state: CameraState,
	intensity: number,
	durationSeconds: number,
): CameraState {
	return {
		...state,
		shake: {
			durationSeconds: Math.max(durationSeconds, 0),
			elapsedSeconds: 0,
			intensity: Math.max(intensity, 0),
		},
	};
}

/** Advances shake timing and clears the shake once its duration expires. @public */
export function updateCameraShake(
	state: CameraState,
	deltaSeconds: number,
): CameraState {
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
}

/** Computes the current shake offset that will be applied during projection. @public */
export function getCameraShakeOffset(state: CameraState): CameraVector {
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
}

/** Projects a world-space point into screen space using the current position, zoom, and shake offset. @public */
export function getScreenPositionFromWorld(
	state: CameraState,
	worldPoint: CameraVector,
): CameraVector {
	const offset = getCameraShakeOffset(state);
	return {
		x:
			(worldPoint.x - state.position.x + offset.x) * state.zoom +
			state.viewport.width / 2,
		y:
			(worldPoint.y - state.position.y + offset.y) * state.zoom +
			state.viewport.height / 2,
	};
}

/** Converts a screen-space point back into world space using the current camera state. @public */
export function getWorldPositionFromScreen(
	state: CameraState,
	screenPoint: CameraVector,
): CameraVector {
	const offset = getCameraShakeOffset(state);
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
}

/**
 * A scene-local camera service for authored gameplay and presentation logic.
 *
 * @public
 *
 * `SceneCamera` is the runtime-friendly companion to the pure camera helper
 * functions in this module. Game code typically uses it to:
 *
 * - define the viewport and zoom used by a scene
 * - clamp the camera to room bounds
 * - follow a player or focal target
 * - translate between world and screen coordinates
 * - apply temporary shake effects
 *
 * If your scene needs a camera at all, this is usually the service you inject.
 */
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
						updateCameraShake(updateCameraFollow(state), deltaSeconds),
					);
				});

				const worldPointToScreen = Effect.fn("SceneCamera.worldToScreen")(
					function* (worldPoint: CameraVector) {
						const state = yield* Ref.get(stateRef);
						return getScreenPositionFromWorld(state, worldPoint);
					},
				);

				const screenPointToWorld = Effect.fn("SceneCamera.screenToWorld")(
					function* (screenPoint: CameraVector) {
						const state = yield* Ref.get(stateRef);
						return getWorldPositionFromScreen(state, screenPoint);
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
