import type { Effect, Scope } from "effect";

/**
 * Identifies a scene inside a game.
 *
 * @public
 */
export type SceneId = string;

/**
 * Distinguishes the primary gameplay scene from temporary overlay scenes such
 * as pause menus, inventory sheets, or modal dialogue stacks.
 *
 * @public
 */
export type SceneStackLevel = "overlay" | "primary";

/**
 * The lifecycle hooks a scene instance can contribute to the runtime.
 *
 * @public
 *
 * A scene is responsible for its own setup, update, drawing, optional input
 * handling, and teardown. Each hook runs in a scene-local `Scope`, which makes
 * it natural to start background effects that should be cleaned up when the
 * scene exits.
 */
export interface SceneLifecycle {
	readonly enter: () => Effect.Effect<void, never, Scope.Scope>;
	readonly update: () => Effect.Effect<void, never, Scope.Scope>;
	readonly draw: () => Effect.Effect<void, never, Scope.Scope>;
	readonly exit: () => Effect.Effect<void, never, Scope.Scope>;
	readonly handleInput?: () => Effect.Effect<void, never, Scope.Scope>;
}

/**
 * Declares how a scene is identified and instantiated.
 *
 * @public
 *
 * In application code you usually author a `SceneDefinition` as a constant and
 * register it with {@link SceneRegistry.layer}.
 */
export interface SceneDefinition {
	readonly id: SceneId;
	readonly instantiate: Effect.Effect<SceneLifecycle>;
}

/**
 * Represents a live instantiated scene managed by the engine.
 *
 * @public
 */
export interface SceneInstance {
	readonly definition: SceneDefinition;
	readonly lifecycle: SceneLifecycle;
	readonly scope: Scope.Closeable;
}

/**
 * A single entry in the runtime scene stack.
 *
 * @public
 */
export interface SceneStackEntry {
	readonly instance: SceneInstance;
	readonly level: SceneStackLevel;
}

/**
 * A serializable view of the current scene stack.
 *
 * @public
 */
export interface SceneStackSnapshot {
	readonly activeSceneId: SceneId;
	readonly entries: ReadonlyArray<{
		readonly level: SceneStackLevel;
		readonly sceneId: SceneId;
	}>;
}
