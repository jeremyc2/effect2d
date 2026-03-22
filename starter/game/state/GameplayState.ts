import { Effect, Layer, Ref, ServiceMap } from "effect";
import type { CameraVector } from "../../../src/graphics/Camera.ts";

export interface GameplaySnapshot {
	readonly enemyDefeated: boolean;
	readonly enemyPosition: CameraVector;
	readonly introSequencePlayed: boolean;
	readonly lanternPickupCollected: boolean;
}

const initialGameplaySnapshot: GameplaySnapshot = {
	enemyDefeated: false,
	enemyPosition: {
		x: 72,
		y: 32,
	},
	introSequencePlayed: false,
	lanternPickupCollected: false,
};

const stepToward = (
	current: number,
	target: number,
	stepSize: number,
): number => {
	if (current === target) {
		return current;
	}

	if (current < target) {
		return Math.min(current + stepSize, target);
	}

	return Math.max(current - stepSize, target);
};

export class GameplayState extends ServiceMap.Service<
	GameplayState,
	{
		readonly collectLantern: Effect.Effect<void>;
		readonly defeatEnemy: Effect.Effect<void>;
		readonly markIntroSequencePlayed: Effect.Effect<void>;
		readonly moveEnemyToward: (
			target: CameraVector,
			stepSize: number,
		) => Effect.Effect<void>;
		readonly restore: (snapshot: GameplaySnapshot) => Effect.Effect<void>;
		readonly snapshot: Effect.Effect<GameplaySnapshot>;
	}
>()("effect2d/starter/game/state/GameplayState") {
	static readonly layer = Layer.effect(
		GameplayState,
		Effect.gen(function* () {
			const stateRef = yield* Ref.make(initialGameplaySnapshot);

			const moveEnemyToward = Effect.fn("GameplayState.moveEnemyToward")(
				function* (target: CameraVector, stepSize: number) {
					yield* Ref.update(stateRef, (state) => {
						if (state.enemyDefeated) {
							return state;
						}

						return {
							...state,
							enemyPosition: {
								x: stepToward(state.enemyPosition.x, target.x, stepSize),
								y: stepToward(state.enemyPosition.y, target.y, stepSize),
							},
						};
					});
				},
			);

			const collectLantern = Ref.update(stateRef, (state) => ({
				...state,
				lanternPickupCollected: true,
			}));

			const defeatEnemy = Ref.update(stateRef, (state) => ({
				...state,
				enemyDefeated: true,
			}));

			const markIntroSequencePlayed = Ref.update(stateRef, (state) => ({
				...state,
				introSequencePlayed: true,
			}));

			const restore = Effect.fn("GameplayState.restore")(function* (
				snapshot: GameplaySnapshot,
			) {
				yield* Ref.set(stateRef, snapshot);
			});

			return GameplayState.of({
				collectLantern,
				defeatEnemy,
				markIntroSequencePlayed,
				moveEnemyToward,
				restore,
				snapshot: Ref.get(stateRef),
			});
		}),
	);
}
