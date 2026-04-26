import { Context, Effect, Exit, Layer, Ref, Scope } from "effect";
import type {
	SceneDefinition,
	SceneId,
	SceneInstance,
	SceneStackEntry,
	SceneStackSnapshot,
} from "./Scene.ts";
import {
	OverlayStackUnderflowError,
	type SceneNotFoundError,
	SceneStackEmptyError,
} from "./SceneError.ts";
import { SceneLookup } from "./SceneLookup.ts";

const topScene = (
	stack: ReadonlyArray<SceneStackEntry>,
): Effect.Effect<SceneStackEntry, SceneStackEmptyError> => {
	const entry = stack[stack.length - 1];
	return entry === undefined
		? Effect.fail(
				new SceneStackEmptyError({
					reason: "Scene stack is empty.",
				}),
			)
		: Effect.succeed(entry);
};

const instantiateScene = Effect.fn("SceneDirector.instantiateScene")(function* (
	sceneDefinition: SceneDefinition,
) {
	yield* Effect.annotateCurrentSpan({
		"effect2d.scene.id": sceneDefinition.id,
	});
	const scope = yield* Scope.make();
	const lifecycle = yield* Scope.provide(scope)(sceneDefinition.instantiate);

	return {
		definition: sceneDefinition,
		lifecycle,
		scope,
	} satisfies SceneInstance;
});

const runInSceneScope = Effect.fn("SceneDirector.runInSceneScope")(function* (
	sceneInstance: SceneInstance,
	effect: Effect.Effect<void, never, Scope.Scope>,
) {
	yield* Scope.provide(sceneInstance.scope)(effect);
});

const releaseSceneInstance = Effect.fn("SceneDirector.releaseSceneInstance")(
	function* (sceneInstance: SceneInstance) {
		yield* runInSceneScope(sceneInstance, sceneInstance.lifecycle.exit());
		yield* Scope.close(sceneInstance.scope, Exit.void);
	},
);

const stackSnapshot = Effect.fn("SceneDirector.stackSnapshot")(function* (
	stack: ReadonlyArray<SceneStackEntry>,
) {
	const active = yield* topScene(stack);

	return {
		activeSceneId: active.instance.definition.id,
		entries: stack.map((entry) => ({
			level: entry.level,
			sceneId: entry.instance.definition.id,
		})),
	};
});

/**
 * Coordinates scene lifecycle, scene transitions, and the overlay stack.
 *
 * @public
 *
 * This is the main scene-management service game authors use at runtime. It is
 * responsible for:
 *
 * - instantiating the configured start scene
 * - switching between primary scenes
 * - pushing and popping overlay scenes
 * - ensuring scene-local scopes are released when a scene exits
 * - providing a snapshot suitable for diagnostics and UI
 *
 * A common pattern is:
 *
 * - provide authored scenes via {@link SceneLookup}
 * - build `SceneDirector.layer(startSceneId)`
 * - call `switchTo`, `pushOverlay`, or `popOverlay` from gameplay services
 * - let the **Frame updater** call the active scene's update and draw work
 */
export class SceneDirector extends Context.Service<
	SceneDirector,
	{
		readonly currentScene: Effect.Effect<SceneDefinition, SceneStackEmptyError>;
		readonly snapshot: Effect.Effect<SceneStackSnapshot, SceneStackEmptyError>;
		readonly switchTo: (
			sceneId: SceneId,
		) => Effect.Effect<void, SceneNotFoundError | SceneStackEmptyError>;
		readonly pushOverlay: (
			sceneId: SceneId,
		) => Effect.Effect<void, SceneNotFoundError | SceneStackEmptyError>;
		readonly popOverlay: () => Effect.Effect<
			void,
			OverlayStackUnderflowError | SceneStackEmptyError
		>;
		readonly updateCurrent: Effect.Effect<void, SceneStackEmptyError>;
		readonly drawStack: Effect.Effect<void, SceneStackEmptyError>;
		readonly handleInput: Effect.Effect<void, SceneStackEmptyError>;
	}
>()("effect2d/scene/SceneDirector") {
	static readonly layer = ({ startSceneId }: { startSceneId: SceneId }) =>
		Layer.effect(
			SceneDirector,
			Effect.gen(function* () {
				const sceneLookup = yield* SceneLookup;
				const startScene = yield* sceneLookup.get(startSceneId);
				const startSceneInstance = yield* instantiateScene(startScene);
				const stack = yield* Ref.make<ReadonlyArray<SceneStackEntry>>([
					{
						instance: startSceneInstance,
						level: "primary",
					},
				]);

				yield* runInSceneScope(
					startSceneInstance,
					startSceneInstance.lifecycle.enter(),
				);

				const currentScene = Ref.get(stack).pipe(
					Effect.flatMap((currentStack) =>
						topScene(currentStack).pipe(
							Effect.map((entry) => entry.instance.definition),
						),
					),
				);

				const snapshot = Ref.get(stack).pipe(
					Effect.flatMap((currentStack) => stackSnapshot(currentStack)),
				);

				const switchTo = Effect.fn("SceneDirector.switchTo")(function* (
					sceneId: SceneId,
				) {
					const nextScene = yield* sceneLookup.get(sceneId);
					const currentStack = yield* Ref.get(stack);
					const previousSceneId =
						currentStack[currentStack.length - 1]?.instance.definition.id ??
						"none";
					const nextSceneInstance = yield* instantiateScene(nextScene);
					yield* Effect.annotateCurrentSpan({
						"effect2d.scene.from": previousSceneId,
						"effect2d.scene.to": sceneId,
						"effect2d.scene.transition": "switch",
					});
					yield* Effect.logInfo("Switching active scene.").pipe(
						Effect.annotateLogs({
							"effect2d.scene.from": previousSceneId,
							"effect2d.scene.to": sceneId,
							"effect2d.scene.transition": "switch",
						}),
					);

					for (const entry of currentStack.toReversed()) {
						yield* releaseSceneInstance(entry.instance);
					}

					yield* Ref.set(stack, [
						{
							instance: nextSceneInstance,
							level: "primary",
						},
					]);
					yield* runInSceneScope(
						nextSceneInstance,
						nextSceneInstance.lifecycle.enter(),
					);
				});

				const pushOverlay = Effect.fn("SceneDirector.pushOverlay")(function* (
					sceneId: SceneId,
				) {
					const overlayScene = yield* sceneLookup.get(sceneId);
					const currentStack = yield* Ref.get(stack);
					const overlaySceneInstance = yield* instantiateScene(overlayScene);
					const parentSceneId =
						currentStack[currentStack.length - 1]?.instance.definition.id ??
						"none";
					yield* Effect.annotateCurrentSpan({
						"effect2d.scene.overlay_parent": parentSceneId,
						"effect2d.scene.overlay_scene": sceneId,
						"effect2d.scene.transition": "push-overlay",
					});
					yield* Effect.logDebug("Pushing overlay scene.").pipe(
						Effect.annotateLogs({
							"effect2d.scene.overlay_parent": parentSceneId,
							"effect2d.scene.overlay_scene": sceneId,
							"effect2d.scene.transition": "push-overlay",
						}),
					);

					yield* Ref.set(stack, [
						...currentStack,
						{
							instance: overlaySceneInstance,
							level: "overlay",
						},
					]);
					yield* runInSceneScope(
						overlaySceneInstance,
						overlaySceneInstance.lifecycle.enter(),
					);
				});

				const popOverlay = Effect.fn("SceneDirector.popOverlay")(function* () {
					const currentStack = yield* Ref.get(stack);
					const currentEntry = yield* topScene(currentStack);
					yield* Effect.annotateCurrentSpan({
						"effect2d.scene.overlay_scene": currentEntry.instance.definition.id,
						"effect2d.scene.transition": "pop-overlay",
					});

					if (currentEntry.level !== "overlay") {
						return yield* new OverlayStackUnderflowError({
							reason:
								"Cannot pop the primary scene as though it were an overlay.",
						});
					}

					yield* Effect.logDebug("Popping overlay scene.").pipe(
						Effect.annotateLogs({
							"effect2d.scene.overlay_scene":
								currentEntry.instance.definition.id,
							"effect2d.scene.transition": "pop-overlay",
						}),
					);
					yield* releaseSceneInstance(currentEntry.instance);
					yield* Ref.set(stack, currentStack.slice(0, -1));
				});

				const updateCurrent = Ref.get(stack).pipe(
					Effect.flatMap((currentStack) => topScene(currentStack)),
					Effect.flatMap((entry) =>
						runInSceneScope(entry.instance, entry.instance.lifecycle.update()),
					),
				);

				const drawStack = Ref.get(stack).pipe(
					Effect.flatMap((currentStack) =>
						Effect.forEach(
							currentStack,
							(entry) =>
								runInSceneScope(
									entry.instance,
									entry.instance.lifecycle.draw(),
								),
							{
								discard: true,
							},
						),
					),
				);

				const handleInput = Ref.get(stack).pipe(
					Effect.flatMap((currentStack) => topScene(currentStack)),
					Effect.flatMap((entry) =>
						entry.instance.lifecycle.handleInput === undefined
							? Effect.void
							: runInSceneScope(
									entry.instance,
									entry.instance.lifecycle.handleInput(),
								),
					),
				);

				return SceneDirector.of({
					currentScene,
					snapshot,
					switchTo,
					pushOverlay,
					popOverlay,
					updateCurrent,
					drawStack,
					handleInput,
				});
			}),
		);
}
