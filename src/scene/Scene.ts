import type { Effect, Scope } from "effect";

export type SceneId = string;

export type SceneStackLevel = "overlay" | "primary";

export interface SceneLifecycle {
	readonly enter: () => Effect.Effect<void, never, Scope.Scope>;
	readonly update: () => Effect.Effect<void, never, Scope.Scope>;
	readonly draw: () => Effect.Effect<void, never, Scope.Scope>;
	readonly exit: () => Effect.Effect<void, never, Scope.Scope>;
	readonly handleInput?: () => Effect.Effect<void, never, Scope.Scope>;
}

export interface SceneDefinition {
	readonly id: SceneId;
	readonly instantiate: Effect.Effect<SceneLifecycle>;
}

export interface SceneInstance {
	readonly definition: SceneDefinition;
	readonly lifecycle: SceneLifecycle;
	readonly scope: Scope.Closeable;
}

export interface SceneStackEntry {
	readonly instance: SceneInstance;
	readonly level: SceneStackLevel;
}

export interface SceneStackSnapshot {
	readonly activeSceneId: SceneId;
	readonly entries: ReadonlyArray<{
		readonly level: SceneStackLevel;
		readonly sceneId: SceneId;
	}>;
}
