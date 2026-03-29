import { Effect, Layer, Ref, ServiceMap } from "effect";
import type { CameraVector } from "../../../../src/graphics/Camera.ts";

export interface CavernPlayerSnapshot {
	readonly position: CameraVector;
	readonly velocity: CameraVector;
}

const initialCavernPlayerSnapshot: CavernPlayerSnapshot = {
	position: {
		x: 525,
		y: 430,
	},
	velocity: {
		x: 0,
		y: 0,
	},
};

export class CavernPlayerState extends ServiceMap.Service<
	CavernPlayerState,
	{
		readonly moveBy: (delta: CameraVector) => Effect.Effect<void>;
		readonly moveTo: (position: CameraVector) => Effect.Effect<void>;
		readonly setVelocity: (velocity: CameraVector) => Effect.Effect<void>;
		readonly snapshot: Effect.Effect<CavernPlayerSnapshot>;
	}
>()("effect2d/games/cavern/game/state/CavernPlayerState") {
	static readonly layer = Layer.effect(
		CavernPlayerState,
		Effect.gen(function* () {
			const stateRef = yield* Ref.make(initialCavernPlayerSnapshot);

			const moveBy = Effect.fn("CavernPlayerState.moveBy")(function* (
				delta: CameraVector,
			) {
				yield* Ref.update(stateRef, (state) => ({
					...state,
					position: {
						x: state.position.x + delta.x,
						y: state.position.y + delta.y,
					},
				}));
			});

			const moveTo = Effect.fn("CavernPlayerState.moveTo")(function* (
				position: CameraVector,
			) {
				yield* Ref.update(stateRef, (state) => ({
					...state,
					position,
				}));
			});

			const setVelocity = Effect.fn("CavernPlayerState.setVelocity")(function* (
				velocity: CameraVector,
			) {
				yield* Ref.update(stateRef, (state) => ({
					...state,
					velocity,
				}));
			});

			return CavernPlayerState.of({
				moveBy,
				moveTo,
				setVelocity,
				snapshot: Ref.get(stateRef),
			});
		}),
	);
}
