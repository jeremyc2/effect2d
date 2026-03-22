import { Effect, Layer, Ref, ServiceMap } from "effect";

export interface ExpeditionSnapshot {
	readonly currentRoomId: string;
	readonly litBeaconIds: ReadonlyArray<string>;
	readonly missionComplete: boolean;
}

const initialExpeditionSnapshot: ExpeditionSnapshot = {
	currentRoomId: "field-room",
	litBeaconIds: [],
	missionComplete: false,
};

export class ExpeditionState extends ServiceMap.Service<
	ExpeditionState,
	{
		readonly enterRoom: (roomId: string) => Effect.Effect<void>;
		readonly lightBeacon: (beaconId: string) => Effect.Effect<void>;
		readonly restore: (snapshot: ExpeditionSnapshot) => Effect.Effect<void>;
		readonly snapshot: Effect.Effect<ExpeditionSnapshot>;
	}
>()("effect2d/games/beacon-run/game/state/ExpeditionState") {
	static readonly layer = Layer.effect(
		ExpeditionState,
		Effect.gen(function* () {
			const stateRef = yield* Ref.make(initialExpeditionSnapshot);

			const enterRoom = Effect.fn("ExpeditionState.enterRoom")(function* (
				roomId: string,
			) {
				yield* Ref.update(stateRef, (state) => ({
					...state,
					currentRoomId: roomId,
				}));
			});

			const lightBeacon = Effect.fn("ExpeditionState.lightBeacon")(function* (
				beaconId: string,
			) {
				yield* Ref.update(stateRef, (state) => ({
					...state,
					litBeaconIds: state.litBeaconIds.includes(beaconId)
						? state.litBeaconIds
						: [...state.litBeaconIds, beaconId],
					missionComplete: true,
				}));
			});

			const restore = Effect.fn("ExpeditionState.restore")(function* (
				snapshot: ExpeditionSnapshot,
			) {
				yield* Ref.set(stateRef, snapshot);
			});

			return ExpeditionState.of({
				enterRoom,
				lightBeacon,
				restore,
				snapshot: Ref.get(stateRef),
			});
		}),
	);
}
