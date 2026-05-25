import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import type { CollisionBody } from "../collision/CollisionWorld.ts";
import { makeCameraState, startCameraShake } from "../graphics/Camera.ts";
import { RuntimeClock } from "../runtime/RuntimeClock.ts";
import type { SceneDefinition, SceneId } from "../scene/Scene.ts";
import { SceneDirector } from "../scene/SceneDirector.ts";
import { SceneLookup } from "../scene/SceneLookup.ts";
import { runLayerEffect } from "../testing/runEffectTest.ts";
import { DebugOverlay } from "./DebugOverlay.ts";
import { EngineLogger } from "./EngineLogger.ts";
import { ResourceTracker } from "./ResourceTracker.ts";

const makeScene = (id: SceneId): SceneDefinition => ({
	id,
	instantiate: Effect.succeed({
		enter: Effect.void,
		update: Effect.void,
		draw: Effect.void,
		exit: Effect.void,
	}),
});

const body: CollisionBody = {
	group: "wall",
	id: "wall-1",
	isTrigger: false,
	mask: ["player"],
	shape: {
		kind: "aabb",
		shape: {
			height: 16,
			width: 16,
			x: 8,
			y: 8,
		},
	},
};

describe("DebugOverlay", () => {
	test("captures frame timing, scene stack, and authored debug diagnostics", () => {
		const dependencies = Layer.mergeAll(
			EngineLogger.layer,
			ResourceTracker.layer,
			RuntimeClock.layer(60),
			SceneDirector.layer({ startSceneId: "overworld" }).pipe(
				Layer.provide(SceneLookup.layer([makeScene("overworld")])),
			),
		);
		const layer = Layer.mergeAll(
			dependencies,
			DebugOverlay.layer.pipe(Layer.provide(dependencies)),
		);

		return runLayerEffect(
			layer,
			Effect.gen(function* () {
				const runtimeClock = yield* RuntimeClock;
				const debugOverlay = yield* DebugOverlay;
				const engineLogger = yield* EngineLogger;
				const resourceTracker = yield* ResourceTracker;

				yield* runtimeClock.beginFrame;
				yield* runtimeClock.advanceTick;
				yield* debugOverlay.enable;
				yield* engineLogger.info("Loaded starting room.", {
					sceneId: "overworld",
				});
				yield* resourceTracker.register("player-sheet", "image");
				yield* resourceTracker.setLoaded(
					"player-sheet",
					"Main player sprite atlas is ready.",
				);
				yield* debugOverlay.setCollisionBodies([body]);
				yield* debugOverlay.setRoomMarkers([
					{
						id: "spawn-a",
						kind: "spawn-point",
						position: { x: 12, y: 14 },
					},
				]);
				yield* debugOverlay.setResourceDiagnostics([
					{
						id: "player-sheet",
						kind: "image",
						state: "loaded",
					},
				]);
				yield* debugOverlay.setCameraState(
					startCameraShake(
						makeCameraState({
							position: { x: 64, y: 32 },
						}),
						2,
						1,
					),
				);

				const snapshot = yield* debugOverlay.captureSnapshot;
				const drawModel = yield* debugOverlay.drawModel;

				expect(snapshot.enabled).toBe(true);
				expect(snapshot.logs).toEqual([
					{
						context: {
							sceneId: "overworld",
						},
						level: "info",
						message: "Loaded starting room.",
						sequence: 0,
					},
				]);
				expect(snapshot.sceneStack.activeSceneId).toBe("overworld");
				expect(snapshot.collisionBodies).toEqual([body]);
				expect(snapshot.roomMarkers).toEqual([
					{
						id: "spawn-a",
						kind: "spawn-point",
						position: { x: 12, y: 14 },
					},
				]);
				expect(snapshot.resources).toEqual([
					{
						id: "player-sheet",
						kind: "image",
						state: "loaded",
					},
					{
						id: "player-sheet",
						kind: "image",
						state: "loaded",
					},
				]);
				expect(snapshot.camera.position).toEqual({ x: 64, y: 32 });
				expect(snapshot.camera.shakeActive).toBe(true);
				expect(snapshot.timing.frameCount).toBe(1);
				expect(snapshot.timing.tickCount).toBe(1);
				expect(drawModel.lines).toContain("active-scene: overworld");
				expect(drawModel.lines).toContain("collision-bodies: 1");
				expect(drawModel.lines).toContain("logs: 1");
			}),
		);
	});

	test("toggles visibility without losing collected diagnostics", () => {
		const dependencies = Layer.mergeAll(
			EngineLogger.layer,
			ResourceTracker.layer,
			RuntimeClock.layer(60),
			SceneDirector.layer({ startSceneId: "overworld" }).pipe(
				Layer.provide(SceneLookup.layer([makeScene("overworld")])),
			),
		);
		const layer = Layer.mergeAll(
			dependencies,
			DebugOverlay.layer.pipe(Layer.provide(dependencies)),
		);

		return runLayerEffect(
			layer,
			Effect.gen(function* () {
				const debugOverlay = yield* DebugOverlay;
				const engineLogger = yield* EngineLogger;

				yield* debugOverlay.setCollisionBodies([body]);
				yield* engineLogger.warn("Overlay toggled for diagnostics.");
				yield* debugOverlay.toggle;
				yield* debugOverlay.toggle;

				const snapshot = yield* debugOverlay.captureSnapshot;
				expect(snapshot.enabled).toBe(false);
				expect(snapshot.collisionBodies).toEqual([body]);
				expect(snapshot.logs).toHaveLength(1);
			}),
		);
	});
});
