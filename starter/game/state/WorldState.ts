import { Effect, Layer, Ref, ServiceMap } from "effect";

export interface WorldSnapshot {
	readonly currentRoomId: string;
	readonly inventory: ReadonlyArray<string>;
	readonly lanternLit: boolean;
}

const initialWorldSnapshot: WorldSnapshot = {
	currentRoomId: "overworld-room",
	inventory: ["map"],
	lanternLit: false,
};

export class WorldState extends ServiceMap.Service<
	WorldState,
	{
		readonly enterRoom: (roomId: string) => Effect.Effect<void>;
		readonly lightLantern: Effect.Effect<void>;
		readonly restore: (snapshot: WorldSnapshot) => Effect.Effect<void>;
		readonly snapshot: Effect.Effect<WorldSnapshot>;
	}
>()("effect2d/starter/game/state/WorldState") {
	static readonly layer = Layer.effect(
		WorldState,
		Effect.gen(function* () {
			const stateRef = yield* Ref.make(initialWorldSnapshot);

			const enterRoom = Effect.fn("WorldState.enterRoom")(function* (
				roomId: string,
			) {
				yield* Ref.update(stateRef, (state) => ({
					...state,
					currentRoomId: roomId,
				}));
			});

			const lightLantern = Ref.update(stateRef, (state) => ({
				...state,
				lanternLit: true,
			}));

			const restore = Effect.fn("WorldState.restore")(function* (
				snapshot: WorldSnapshot,
			) {
				yield* Ref.set(stateRef, snapshot);
			});

			return WorldState.of({
				enterRoom,
				lightLantern,
				restore,
				snapshot: Ref.get(stateRef),
			});
		}),
	);
}
