import { Effect, Layer, Ref, ServiceMap } from "effect";
import {
	MapRepository,
	type MapValidationError,
	type RoomContent,
	type RoomObject,
} from "../../../src/index.ts";
import { WorldState } from "./WorldState.ts";

export class RoomState extends ServiceMap.Service<
	RoomState,
	{
		readonly currentObjectById: (
			objectId: string,
		) => Effect.Effect<RoomObject, MapValidationError>;
		readonly enterRoom: (
			roomId: string,
		) => Effect.Effect<void, MapValidationError>;
		readonly loadCurrentRoom: Effect.Effect<void, MapValidationError>;
		readonly loadRoom: (
			roomId: string,
		) => Effect.Effect<void, MapValidationError>;
		readonly roomObjectById: (
			roomId: string,
			objectId: string,
		) => Effect.Effect<RoomObject, MapValidationError>;
		readonly snapshot: Effect.Effect<RoomContent>;
	}
>()("effect2d/starter/game/state/RoomState") {
	static readonly layer = Layer.effect(
		RoomState,
		Effect.gen(function* () {
			const mapRepository = yield* MapRepository;
			const worldState = yield* WorldState;
			const initialRoom = yield* mapRepository.loadRoom(
				(yield* worldState.snapshot).currentRoomId,
			);
			const roomRef = yield* Ref.make(initialRoom);

			const loadRoom = Effect.fn("RoomState.loadRoom")(function* (
				roomId: string,
			) {
				yield* Ref.set(roomRef, yield* mapRepository.loadRoom(roomId));
			});

			const loadCurrentRoom = worldState.snapshot.pipe(
				Effect.map((snapshot) => snapshot.currentRoomId),
				Effect.flatMap(loadRoom),
			);

			const roomObjectById = Effect.fn("RoomState.roomObjectById")(function* (
				roomId: string,
				objectId: string,
			) {
				return yield* mapRepository.roomObjectById(roomId, objectId);
			});

			const currentObjectById = Effect.fn("RoomState.currentObjectById")(
				function* (objectId: string) {
					const room = yield* Ref.get(roomRef);
					const objectEntry = room.objectPlanes
						.flatMap((plane) => plane.entries)
						.find((entry) => entry.id === objectId);

					if (objectEntry === undefined) {
						return yield* mapRepository.roomObjectById(room.id, objectId);
					}

					return objectEntry;
				},
			);

			const enterRoom = Effect.fn("RoomState.enterRoom")(function* (
				roomId: string,
			) {
				yield* worldState.enterRoom(roomId);
				yield* loadRoom(roomId);
			});

			return RoomState.of({
				currentObjectById,
				enterRoom,
				loadCurrentRoom,
				loadRoom,
				roomObjectById,
				snapshot: Ref.get(roomRef),
			});
		}),
	);
}
