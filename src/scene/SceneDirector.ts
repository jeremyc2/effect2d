import { Effect, Layer, Ref, ServiceMap } from "effect";
import type {
	SceneDefinition,
	SceneId,
	SceneStackEntry,
	SceneStackSnapshot,
} from "./Scene.ts";
import {
	OverlayStackUnderflowError,
	type SceneNotFoundError,
	SceneStackEmptyError,
} from "./SceneError.ts";
import { SceneRegistry } from "./SceneRegistry.ts";

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

const stackSnapshot = (
	stack: ReadonlyArray<SceneStackEntry>,
): Effect.Effect<SceneStackSnapshot, SceneStackEmptyError> =>
	Effect.gen(function* () {
		const active = yield* topScene(stack);

		return {
			activeSceneId: active.scene.id,
			entries: stack.map((entry) => ({
				layer: entry.layer,
				sceneId: entry.scene.id,
			})),
		};
	});

export class SceneDirector extends ServiceMap.Service<
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
	static readonly layer = (startSceneId: SceneId) =>
		Layer.effect(
			SceneDirector,
			Effect.gen(function* () {
				const sceneRegistry = yield* SceneRegistry;
				const startScene = yield* sceneRegistry.get(startSceneId);
				const stack = yield* Ref.make<ReadonlyArray<SceneStackEntry>>([
					{
						layer: "primary",
						scene: startScene,
					},
				]);

				yield* startScene.lifecycle.enter();

				const currentScene = Ref.get(stack).pipe(
					Effect.flatMap((currentStack) =>
						topScene(currentStack).pipe(Effect.map((entry) => entry.scene)),
					),
				);

				const snapshot = Ref.get(stack).pipe(
					Effect.flatMap((currentStack) => stackSnapshot(currentStack)),
				);

				const switchTo = Effect.fn("SceneDirector.switchTo")(function* (
					sceneId: SceneId,
				) {
					const nextScene = yield* sceneRegistry.get(sceneId);
					const currentStack = yield* Ref.get(stack);

					for (const entry of currentStack.toReversed()) {
						yield* entry.scene.lifecycle.exit();
					}

					yield* Ref.set(stack, [
						{
							layer: "primary",
							scene: nextScene,
						},
					]);
					yield* nextScene.lifecycle.enter();
				});

				const pushOverlay = Effect.fn("SceneDirector.pushOverlay")(function* (
					sceneId: SceneId,
				) {
					const overlayScene = yield* sceneRegistry.get(sceneId);
					const currentStack = yield* Ref.get(stack);

					yield* Ref.set(stack, [
						...currentStack,
						{
							layer: "overlay",
							scene: overlayScene,
						},
					]);
					yield* overlayScene.lifecycle.enter();
				});

				const popOverlay = Effect.fn("SceneDirector.popOverlay")(function* () {
					const currentStack = yield* Ref.get(stack);
					const currentEntry = yield* topScene(currentStack);

					if (currentEntry.layer !== "overlay") {
						return yield* new OverlayStackUnderflowError({
							reason:
								"Cannot pop the primary scene as though it were an overlay.",
						});
					}

					yield* currentEntry.scene.lifecycle.exit();
					yield* Ref.set(stack, currentStack.slice(0, -1));
				});

				const updateCurrent = Ref.get(stack).pipe(
					Effect.flatMap((currentStack) => topScene(currentStack)),
					Effect.flatMap((entry) => entry.scene.lifecycle.update()),
				);

				const drawStack = Ref.get(stack).pipe(
					Effect.flatMap((currentStack) =>
						Effect.forEach(
							currentStack,
							(entry) => entry.scene.lifecycle.draw(),
							{
								concurrency: "unbounded",
								discard: true,
							},
						),
					),
				);

				const handleInput = Ref.get(stack).pipe(
					Effect.flatMap((currentStack) => topScene(currentStack)),
					Effect.flatMap((entry) =>
						entry.scene.lifecycle.handleInput === undefined
							? Effect.void
							: entry.scene.lifecycle.handleInput(),
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
