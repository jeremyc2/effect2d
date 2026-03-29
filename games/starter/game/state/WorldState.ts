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
		readonly addItem: (itemId: string) => Effect.Effect<void>;
		readonly enterRoom: (roomId: string) => Effect.Effect<void>;
		readonly lightLantern: Effect.Effect<void>;
		readonly restore: (snapshot: WorldSnapshot) => Effect.Effect<void>;
		readonly snapshot: Effect.Effect<WorldSnapshot>;
	}
>()("effect2d/games/starter/game/state/WorldState") {
	static readonly layer = Layer.effect(
		WorldState,
		Effect.gen(function* () {
			const stateRef = yield* Ref.make(initialWorldSnapshot);

			const addItem = Effect.fn("WorldState.addItem")(function* (
				itemId: string,
			) {
				yield* Ref.update(stateRef, (state) => ({
					...state,
					inventory: state.inventory.includes(itemId)
						? state.inventory
						: [...state.inventory, itemId],
				}));
			});

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
				addItem,
				enterRoom,
				lightLantern,
				restore,
				snapshot: Ref.get(stateRef),
			});
		}),
	);
}
