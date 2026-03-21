export interface EngineConfig {
	readonly gameId: string;
	readonly randomSeed?: number | string;
	readonly startScene: string;
	readonly targetTicksPerSecond: number;
}

export const defaultEngineConfig = {
	gameId: "effect2d/game",
	randomSeed: "effect2d",
	startScene: "boot",
	targetTicksPerSecond: 60,
} satisfies EngineConfig;
