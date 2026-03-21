import { type Effect, ServiceMap } from "effect";

import type { SceneDefinition } from "./Scene.ts";

export class SceneDirector extends ServiceMap.Service<
	SceneDirector,
	{
		readonly currentScene: Effect.Effect<SceneDefinition>;
		readonly enterScene: (scene: SceneDefinition) => Effect.Effect<void>;
	}
>()("effect2d/scene/SceneDirector") {}
