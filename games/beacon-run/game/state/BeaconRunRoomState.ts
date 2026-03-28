import { Effect, Layer, Ref, ServiceMap } from "effect";
import { recordRoomTransition } from "../../../../src/debug/GameplayMetrics.ts";
import {
	getRoomObjectById as getRoomObjectByIdInContent,
	MapRepository,
	type MapValidationError,
	type RoomContent,
	type RoomObject,
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
		readonly getRoomObjectById: (
			roomId: string,
			objectId: string,
		) => Effect.Effect<RoomObject, MapValidationError>;
		readonly snapshot: Effect.Effect<RoomContent>;
	}
>()("effect2d/games/beacon-run/game/state/BeaconRunRoomState") {
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
				const previousRoomId = (yield* Ref.get(roomRef)).id;
				yield* expeditionState.enterRoom(roomId);
				yield* loadRoom(roomId);
				if (previousRoomId !== roomId) {
					yield* recordRoomTransition({
						fromRoomId: previousRoomId,
						toRoomId: roomId,
					});
				}
			});

			const getRoomObjectById = Effect.fn(
				"BeaconRunRoomState.getRoomObjectById",
			)(function* (roomId: string, objectId: string) {
				return yield* mapRepository.getRoomObjectById(roomId, objectId);
			});

			const currentObjectById = Effect.fn(
				"BeaconRunRoomState.currentObjectById",
			)(function* (objectId: string) {
				const room = yield* Ref.get(roomRef);
				const objectEntry = getRoomObjectByIdInContent(room, objectId);

				if (objectEntry === undefined) {
					return yield* mapRepository.getRoomObjectById(room.id, objectId);
				}

				return objectEntry;
			});

			return BeaconRunRoomState.of({
				currentObjectById,
				enterRoom,
				getRoomObjectById,
				snapshot: Ref.get(roomRef),
			});
		}),
	);
}
