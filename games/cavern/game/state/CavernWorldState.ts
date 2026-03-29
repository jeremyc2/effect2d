import { Effect, Layer, Ref, ServiceMap } from "effect";
import { recordRoomTransition } from "../../../../src/debug/GameplayMetrics.ts";
import {
	type CavernRoomId,
	cavernStartingRoomId,
	getCavernRoom,
} from "../content/CavernWorld.ts";

export interface CavernWorldSnapshot {
	readonly currentRoomId: CavernRoomId;
	readonly roomInstructionsFadeStartedAtMillis: number | null;
}

const initialCavernWorldSnapshot: CavernWorldSnapshot = {
	currentRoomId: cavernStartingRoomId,
	roomInstructionsFadeStartedAtMillis: null,
};

export class CavernWorldState extends ServiceMap.Service<
	CavernWorldState,
	{
		readonly beginRoomInstructionsFade: (
			startedAtMillis: number,
		) => Effect.Effect<void>;
		readonly reset: Effect.Effect<void>;
		readonly setCurrentRoom: (roomId: CavernRoomId) => Effect.Effect<void>;
		readonly snapshot: Effect.Effect<CavernWorldSnapshot>;
	}
>()("effect2d/games/cavern/game/state/CavernWorldState") {
	static readonly layer = Layer.effect(
		CavernWorldState,
		Effect.gen(function* () {
			const stateRef = yield* Ref.make(initialCavernWorldSnapshot);

			const setCurrentRoom = Effect.fn("CavernWorldState.setCurrentRoom")(
				function* (roomId: CavernRoomId) {
					getCavernRoom(roomId);
					const previousState = yield* Ref.get(stateRef);
					const previousRoomId = previousState.currentRoomId;
					yield* Ref.set(stateRef, {
						currentRoomId: roomId,
						roomInstructionsFadeStartedAtMillis:
							previousState.roomInstructionsFadeStartedAtMillis,
					});
					if (previousRoomId !== roomId) {
						yield* recordRoomTransition({
							fromRoomId: previousRoomId,
							toRoomId: roomId,
						});
					}
				},
			);

			const beginRoomInstructionsFade = Effect.fn(
				"CavernWorldState.beginRoomInstructionsFade",
			)(function* (startedAtMillis: number) {
				yield* Ref.update(stateRef, (state) => ({
					...state,
					roomInstructionsFadeStartedAtMillis:
						state.roomInstructionsFadeStartedAtMillis ?? startedAtMillis,
				}));
			});

			const reset = Ref.set(stateRef, initialCavernWorldSnapshot).pipe(
				Effect.withSpan("CavernWorldState.reset"),
			);

			return CavernWorldState.of({
				beginRoomInstructionsFade,
				reset,
				setCurrentRoom,
				snapshot: Ref.get(stateRef),
			});
		}),
	);
}
