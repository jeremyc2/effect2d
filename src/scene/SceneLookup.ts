import { Effect, Layer, ServiceMap } from "effect";
import type { SceneDefinition, SceneId } from "./Scene.ts";
import { SceneNotFoundError } from "./SceneError.ts";

/**
 * Scene **Lookup**: id → authored {@link SceneDefinition}.
 *
 * @public
 *
 * Intentionally minimal: answers “which definition matches this id?” and exposes
 * the full authored set for tooling or diagnostics.
 */
export class SceneLookup extends ServiceMap.Service<
	SceneLookup,
	{
		readonly all: Effect.Effect<ReadonlyArray<SceneDefinition>>;
		readonly get: (
			sceneId: SceneId,
		) => Effect.Effect<SceneDefinition, SceneNotFoundError>;
	}
>()("effect2d/scene/SceneLookup") {
	static readonly layer = (scenes: ReadonlyArray<SceneDefinition>) =>
		Layer.effect(
			SceneLookup,
			Effect.sync(() => {
				const sceneMap = new Map(scenes.map((scene) => [scene.id, scene]));

				const get = Effect.fn("SceneLookup.get")(function* (sceneId: SceneId) {
					const scene = sceneMap.get(sceneId);
					if (scene === undefined) {
						return yield* new SceneNotFoundError({ sceneId });
					}

					return scene;
				});

				return SceneLookup.of({
					all: Effect.succeed(scenes),
					get,
				});
			}),
		);
}
