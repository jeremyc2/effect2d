import { Effect, Layer, Ref, ServiceMap } from "effect";
import type { CameraVector } from "../../../src/graphics/Camera.ts";

export type FacingDirection = "down" | "left" | "right" | "up";

export interface PlayerSnapshot {
	readonly facing: FacingDirection;
	readonly health: number;
	readonly position: CameraVector;
}

const initialPlayerSnapshot: PlayerSnapshot = {
	facing: "down",
	health: 3,
	position: {
		x: 32,
		y: 32,
	},
};

export class PlayerState extends ServiceMap.Service<
	PlayerState,
	{
		readonly moveTo: (position: CameraVector) => Effect.Effect<void>;
		readonly moveBy: (delta: CameraVector) => Effect.Effect<void>;
		readonly restore: (snapshot: PlayerSnapshot) => Effect.Effect<void>;
		readonly setFacing: (facing: FacingDirection) => Effect.Effect<void>;
		readonly snapshot: Effect.Effect<PlayerSnapshot>;
	}
>()("Effect2d/starter/game/state/PlayerState") {
	static readonly layer = Layer.effect(
		PlayerState,
		Effect.gen(function* () {
			const stateRef = yield* Ref.make(initialPlayerSnapshot);

			const moveBy = Effect.fn("PlayerState.moveBy")(function* (
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

			const moveTo = Effect.fn("PlayerState.moveTo")(function* (
				position: CameraVector,
			) {
				yield* Ref.update(stateRef, (state) => ({
					...state,
					position,
				}));
			});

			const setFacing = Effect.fn("PlayerState.setFacing")(function* (
				facing: FacingDirection,
			) {
				yield* Ref.update(stateRef, (state) => ({
					...state,
					facing,
				}));
			});

			const restore = Effect.fn("PlayerState.restore")(function* (
				snapshot: PlayerSnapshot,
			) {
				yield* Ref.set(stateRef, snapshot);
			});

			return PlayerState.of({
				moveTo,
				moveBy,
				restore,
				setFacing,
				snapshot: Ref.get(stateRef),
			});
		}),
	);
}
