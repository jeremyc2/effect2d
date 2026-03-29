import type { CameraVector } from "../../../../src/index.ts";

export interface CavernEnemyDefinition {
	readonly id: string;
	readonly position: CameraVector;
}
