import { Effect, Layer, Ref, ServiceMap } from "effect";
import type { CollisionBody } from "../collision/CollisionWorld.ts";
import type {
	CameraBounds,
	CameraState,
	CameraVector,
} from "../graphics/Camera.ts";
import { RuntimeClock } from "../runtime/RuntimeClock.ts";
import { SceneDirector } from "../scene/SceneDirector.ts";
import { EngineLogger, type LogEntry } from "./EngineLogger.ts";
import { ResourceTracker } from "./ResourceTracker.ts";

export interface DebugRoomMarker {
	readonly id: string;
	readonly kind: string;
	readonly position: CameraVector;
}

export interface ResourceDiagnostic {
	readonly id: string;
	readonly kind: string;
	readonly state: "faulted" | "loaded" | "pending" | "released";
}

export interface FrameTimingDiagnostics {
	readonly fixedTickMillis: number;
	readonly fps: number;
	readonly frameCount: number;
	readonly lastFrameDeltaMillis: number;
	readonly tickCount: number;
}

export interface DebugOverlaySnapshot {
	readonly camera: {
		readonly bounds: CameraBounds | null;
		readonly position: CameraVector | null;
		readonly shakeActive: boolean;
		readonly zoom: number | null;
	};
	readonly collisionBodies: ReadonlyArray<CollisionBody>;
	readonly enabled: boolean;
	readonly logs: ReadonlyArray<LogEntry>;
	readonly roomMarkers: ReadonlyArray<DebugRoomMarker>;
	readonly sceneStack: {
		readonly activeSceneId: string | null;
		readonly entries: ReadonlyArray<{
			readonly level: string;
			readonly sceneId: string;
		}>;
	};
	readonly resources: ReadonlyArray<ResourceDiagnostic>;
	readonly timing: FrameTimingDiagnostics;
}

export interface DebugOverlayDrawModel {
	readonly lines: ReadonlyArray<string>;
	readonly snapshot: DebugOverlaySnapshot;
}

interface DebugOverlayState {
	readonly cameraState: CameraState | null;
	readonly collisionBodies: ReadonlyArray<CollisionBody>;
	readonly enabled: boolean;
	readonly authoredResources: ReadonlyArray<ResourceDiagnostic>;
	readonly roomMarkers: ReadonlyArray<DebugRoomMarker>;
}

const initialState: DebugOverlayState = {
	cameraState: null,
	collisionBodies: [],
	enabled: false,
	authoredResources: [],
	roomMarkers: [],
};

const formatFps = (lastFrameDeltaMillis: number): number =>
	lastFrameDeltaMillis <= 0 ? 0 : Math.round(1_000 / lastFrameDeltaMillis);

const formatDrawModel = (
	snapshot: DebugOverlaySnapshot,
): DebugOverlayDrawModel => ({
	lines: [
		`overlay: ${snapshot.enabled ? "enabled" : "disabled"}`,
		`fps: ${snapshot.timing.fps}`,
		`frame-delta-ms: ${snapshot.timing.lastFrameDeltaMillis}`,
		`tick-count: ${snapshot.timing.tickCount}`,
		`active-scene: ${snapshot.sceneStack.activeSceneId ?? "none"}`,
		`collision-bodies: ${snapshot.collisionBodies.length}`,
		`room-markers: ${snapshot.roomMarkers.length}`,
		`resources: ${snapshot.resources.length}`,
		`logs: ${snapshot.logs.length}`,
	],
	snapshot,
});

export class DebugOverlay extends ServiceMap.Service<
	DebugOverlay,
	{
		readonly captureSnapshot: Effect.Effect<DebugOverlaySnapshot>;
		readonly disable: Effect.Effect<void>;
		readonly drawModel: Effect.Effect<DebugOverlayDrawModel>;
		readonly enable: Effect.Effect<void>;
		readonly setCameraState: (
			cameraState: CameraState | null,
		) => Effect.Effect<void>;
		readonly setCollisionBodies: (
			bodies: ReadonlyArray<CollisionBody>,
		) => Effect.Effect<void>;
		readonly setResourceDiagnostics: (
			resources: ReadonlyArray<ResourceDiagnostic>,
		) => Effect.Effect<void>;
		readonly setRoomMarkers: (
			markers: ReadonlyArray<DebugRoomMarker>,
		) => Effect.Effect<void>;
		readonly toggle: Effect.Effect<void>;
	}
>()("effect2d/debug/DebugOverlay") {
	static readonly layer = Layer.effect(
		DebugOverlay,
		Effect.gen(function* () {
			const stateRef = yield* Ref.make(initialState);
			const engineLogger = yield* EngineLogger;
			const resourceTracker = yield* ResourceTracker;
			const runtimeClock = yield* RuntimeClock;
			const sceneDirector = yield* SceneDirector;

			const enable = Ref.update(stateRef, (state) => ({
				...state,
				enabled: true,
			}));

			const disable = Ref.update(stateRef, (state) => ({
				...state,
				enabled: false,
			}));

			const toggle = Ref.update(stateRef, (state) => ({
				...state,
				enabled: !state.enabled,
			}));

			const setCollisionBodies = Effect.fn("DebugOverlay.setCollisionBodies")(
				function* (bodies: ReadonlyArray<CollisionBody>) {
					yield* Ref.update(stateRef, (state) => ({
						...state,
						collisionBodies: bodies,
					}));
				},
			);

			const setRoomMarkers = Effect.fn("DebugOverlay.setRoomMarkers")(
				function* (markers: ReadonlyArray<DebugRoomMarker>) {
					yield* Ref.update(stateRef, (state) => ({
						...state,
						roomMarkers: markers,
					}));
				},
			);

			const setResourceDiagnostics = Effect.fn(
				"DebugOverlay.setResourceDiagnostics",
			)(function* (resources: ReadonlyArray<ResourceDiagnostic>) {
				yield* Ref.update(stateRef, (state) => ({
					...state,
					authoredResources: resources,
				}));
			});

			const setCameraState = Effect.fn("DebugOverlay.setCameraState")(
				function* (cameraState: CameraState | null) {
					yield* Ref.update(stateRef, (state) => ({
						...state,
						cameraState,
					}));
				},
			);

			const captureSnapshot = Effect.gen(function* () {
				const state = yield* Ref.get(stateRef);
				const liveLogs = yield* engineLogger.entries;
				const trackedResources = yield* resourceTracker.records;
				const timingSnapshot = yield* runtimeClock.snapshot();
				const sceneSnapshot = yield* Effect.match(sceneDirector.snapshot, {
					onFailure: () => ({
						activeSceneId: null,
						entries: [],
					}),
					onSuccess: (snapshot) => snapshot,
				});

				return {
					camera: {
						bounds: state.cameraState?.bounds ?? null,
						position: state.cameraState?.position ?? null,
						shakeActive: state.cameraState?.shake !== null,
						zoom: state.cameraState?.zoom ?? null,
					},
					collisionBodies: state.collisionBodies,
					enabled: state.enabled,
					logs: liveLogs,
					roomMarkers: state.roomMarkers,
					sceneStack: sceneSnapshot,
					resources: [
						...trackedResources.map((resource) => ({
							id: resource.id,
							kind: resource.kind,
							state: resource.state,
						})),
						...state.authoredResources,
					],
					timing: {
						fixedTickMillis: timingSnapshot.fixedTickMillis,
						fps: formatFps(timingSnapshot.lastFrameDeltaMillis),
						frameCount: timingSnapshot.frameCount,
						lastFrameDeltaMillis: timingSnapshot.lastFrameDeltaMillis,
						tickCount: timingSnapshot.tickCount,
					},
				} satisfies DebugOverlaySnapshot;
			});

			const drawModel = captureSnapshot.pipe(
				Effect.map((snapshot) => formatDrawModel(snapshot)),
			);

			return DebugOverlay.of({
				captureSnapshot,
				disable,
				drawModel,
				enable,
				setCameraState,
				setCollisionBodies,
				setResourceDiagnostics,
				setRoomMarkers,
				toggle,
			});
		}),
	);
}
