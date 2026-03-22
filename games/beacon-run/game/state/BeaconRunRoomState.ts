import { Effect, Layer, Ref, ServiceMap } from "effect";
import {
	MapRepository,
	type MapValidationError,
	type RoomContent,
	type RoomObject,
	roomObjectById as roomObjectByIdInContent,
} from "../../../../src/index.ts";
import { ExpeditionState } from "./ExpeditionState.ts";

export class BeaconRunRoomState extends ServiceMap.Service<
	BeaconRunRoomState,
	{
		readonly currentObjectById: (
			objectId: string,
		) => Effect.Effect<RoomObject, MapValidationError>;
		readonly enterRoom: (
			roomId: string,
		) => Effect.Effect<void, MapValidationError>;
		readonly roomObjectById: (
			roomId: string,
			objectId: string,
		) => Effect.Effect<RoomObject, MapValidationError>;
		readonly snapshot: Effect.Effect<RoomContent>;
	}
>()("effect2d/beacon-run/game/state/BeaconRunRoomState") {
	static readonly layer = Layer.effect(
		BeaconRunRoomState,
		Effect.gen(function* () {
			const expeditionState = yield* ExpeditionState;
			const mapRepository = yield* MapRepository;
			const initialRoom = yield* mapRepository.loadRoom(
				(yield* expeditionState.snapshot).currentRoomId,
			);
			const roomRef = yield* Ref.make(initialRoom);

			const loadRoom = Effect.fn("BeaconRunRoomState.loadRoom")(function* (
				roomId: string,
			) {
				yield* Ref.set(roomRef, yield* mapRepository.loadRoom(roomId));
			});

			const enterRoom = Effect.fn("BeaconRunRoomState.enterRoom")(function* (
				roomId: string,
			) {
				yield* expeditionState.enterRoom(roomId);
				yield* loadRoom(roomId);
			});

			const roomObjectById = Effect.fn("BeaconRunRoomState.roomObjectById")(
				function* (roomId: string, objectId: string) {
					return yield* mapRepository.roomObjectById(roomId, objectId);
				},
			);

			const currentObjectById = Effect.fn(
				"BeaconRunRoomState.currentObjectById",
			)(function* (objectId: string) {
				const room = yield* Ref.get(roomRef);
				const objectEntry = roomObjectByIdInContent(room, objectId);

				if (objectEntry === undefined) {
					return yield* mapRepository.roomObjectById(room.id, objectId);
				}

				return objectEntry;
			});

			return BeaconRunRoomState.of({
				currentObjectById,
				enterRoom,
				roomObjectById,
				snapshot: Ref.get(roomRef),
			});
		}),
	);
}
