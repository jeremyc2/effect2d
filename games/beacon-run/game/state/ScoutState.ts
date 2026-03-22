import { Effect, Layer, Ref, ServiceMap } from "effect";
import type { CameraVector } from "../../../../src/graphics/Camera.ts";

export type ScoutFacing = "down" | "left" | "right" | "up";

export interface ScoutSnapshot {
	readonly facing: ScoutFacing;
	readonly position: CameraVector;
}

const initialScoutSnapshot: ScoutSnapshot = {
	facing: "down",
	position: {
		x: 24,
		y: 32,
	},
};

export class ScoutState extends ServiceMap.Service<
	ScoutState,
	{
		readonly moveBy: (delta: CameraVector) => Effect.Effect<void>;
		readonly moveTo: (position: CameraVector) => Effect.Effect<void>;
		readonly restore: (snapshot: ScoutSnapshot) => Effect.Effect<void>;
		readonly setFacing: (facing: ScoutFacing) => Effect.Effect<void>;
		readonly snapshot: Effect.Effect<ScoutSnapshot>;
	}
>()("effect2d/beacon-run/game/state/ScoutState") {
	static readonly layer = Layer.effect(
		ScoutState,
		Effect.gen(function* () {
			const stateRef = yield* Ref.make(initialScoutSnapshot);

			const moveBy = Effect.fn("ScoutState.moveBy")(function* (
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

			const moveTo = Effect.fn("ScoutState.moveTo")(function* (
				position: CameraVector,
			) {
				yield* Ref.update(stateRef, (state) => ({
					...state,
					position,
				}));
			});

			const restore = Effect.fn("ScoutState.restore")(function* (
				snapshot: ScoutSnapshot,
			) {
				yield* Ref.set(stateRef, snapshot);
			});

			const setFacing = Effect.fn("ScoutState.setFacing")(function* (
				facing: ScoutFacing,
			) {
				yield* Ref.update(stateRef, (state) => ({
					...state,
					facing,
				}));
			});

			return ScoutState.of({
				moveBy,
				moveTo,
				restore,
				setFacing,
				snapshot: Ref.get(stateRef),
			});
		}),
	);
}
