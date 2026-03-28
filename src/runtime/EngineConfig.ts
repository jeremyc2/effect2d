/**
 * Describes the minimal engine-level settings required to boot a game.
 *
 * @public
 *
 * In most projects you start from {@link defaultEngineConfig} and override only
 * the fields that are specific to your game.
 *
 * ```ts
 * const engineConfig: EngineConfig = {
 *   ...defaultEngineConfig,
 *   gameId: "beacon-run",
 *   startScene: "title",
 * };
 * ```
 */
export interface EngineConfig {
	/** A stable identifier used for save data, diagnostics, and launch context. */
	readonly gameId: string;
	/** Optional deterministic seed for authored randomness and reproducible tests. */
	readonly randomSeed?: number | string;
	/** The scene id the engine should activate when the game launches. */
	readonly startScene: string;
	/** The fixed-step update rate used by the runtime clock. */
	readonly targetTicksPerSecond: number;
}

/**
 * A conservative starting configuration for new games.
 *
 * @public
 *
 * This value is intentionally plain and production-safe. Treat it as a base
 * object to spread into a game-specific config rather than a one-size-fits-all
 * preset.
 */
export const defaultEngineConfig = {
	gameId: "Effect2d/game",
	randomSeed: "Effect2d",
	startScene: "boot",
	targetTicksPerSecond: 60,
} satisfies EngineConfig;
