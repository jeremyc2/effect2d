import { Effect, Layer, ServiceMap } from "effect";
import type { SceneDefinition, SceneId } from "./Scene.ts";
import { SceneNotFoundError } from "./SceneError.ts";

export class SceneRegistry extends ServiceMap.Service<
	SceneRegistry,
	{
		readonly all: Effect.Effect<ReadonlyArray<SceneDefinition>>;
		readonly get: (
			sceneId: SceneId,
		) => Effect.Effect<SceneDefinition, SceneNotFoundError>;
	}
>()("effect2d/scene/SceneRegistry") {
	static readonly layer = (scenes: ReadonlyArray<SceneDefinition>) =>
		Layer.effect(
			SceneRegistry,
			Effect.sync(() => {
				const sceneMap = new Map(scenes.map((scene) => [scene.id, scene]));

				const get = Effect.fn("SceneRegistry.get")(function* (
					sceneId: SceneId,
				) {
					const scene = sceneMap.get(sceneId);
					if (scene === undefined) {
						return yield* new SceneNotFoundError({ sceneId });
					}

					return scene;
				});

				return SceneRegistry.of({
					all: Effect.succeed(scenes),
					get,
				});
			}),
		);
}
