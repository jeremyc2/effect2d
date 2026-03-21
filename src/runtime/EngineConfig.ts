export interface EngineConfig {
	readonly gameId: string;
	readonly startScene: string;
	readonly targetTicksPerSecond: number;
}

export const defaultEngineConfig = {
	gameId: "effect2d/game",
	startScene: "boot",
	targetTicksPerSecond: 60,
} satisfies EngineConfig;
