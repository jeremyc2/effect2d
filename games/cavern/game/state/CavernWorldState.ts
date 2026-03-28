import { Effect, Layer, Ref, ServiceMap } from "effect";
import {
	type CavernRoomId,
	cavernStartingRoomId,
	getCavernRoom,
} from "../content/CavernWorld.ts";

export interface CavernWorldSnapshot {
	readonly currentRoomId: CavernRoomId;
}

const initialCavernWorldSnapshot: CavernWorldSnapshot = {
	currentRoomId: cavernStartingRoomId,
};

export class CavernWorldState extends ServiceMap.Service<
	CavernWorldState,
	{
		readonly reset: Effect.Effect<void>;
		readonly setCurrentRoom: (roomId: CavernRoomId) => Effect.Effect<void>;
		readonly snapshot: Effect.Effect<CavernWorldSnapshot>;
	}
>()("Effect2d/games/cavern/game/state/CavernWorldState") {
	static readonly layer = Layer.effect(
		CavernWorldState,
		Effect.gen(function* () {
			const stateRef = yield* Ref.make(initialCavernWorldSnapshot);

			const setCurrentRoom = Effect.fn("CavernWorldState.setCurrentRoom")(
				function* (roomId: CavernRoomId) {
					getCavernRoom(roomId);
					yield* Ref.set(stateRef, {
						currentRoomId: roomId,
					});
				},
			);

			const reset = Ref.set(stateRef, initialCavernWorldSnapshot).pipe(
				Effect.withSpan("CavernWorldState.reset"),
			);

			return CavernWorldState.of({
				reset,
				setCurrentRoom,
				snapshot: Ref.get(stateRef),
			});
		}),
	);
}
