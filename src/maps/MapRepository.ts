import { Effect, Layer, ServiceMap } from "effect";
import type { RoomContent } from "./MapContent.ts";
import { MapValidationError } from "./MapError.ts";
import { validateRoom } from "./MapValidation.ts";

export class MapRepository extends ServiceMap.Service<
	MapRepository,
	{
		readonly loadRoom: (
			roomId: string,
		) => Effect.Effect<RoomContent, MapValidationError>;
		readonly roomObjectById: (
			roomId: string,
			objectId: string,
		) => Effect.Effect<
			RoomContent["objectPlanes"][number]["entries"][number],
			MapValidationError
		>;
	}
>()("effect2d/maps/MapRepository") {
	static readonly layer = (rooms: ReadonlyArray<RoomContent>) =>
		Layer.effect(
			MapRepository,
			Effect.gen(function* () {
				const validatedRooms = new Map<string, RoomContent>();

				for (const room of rooms) {
					const validatedRoom = yield* validateRoom(room);
					validatedRooms.set(validatedRoom.id, validatedRoom);
				}

				const loadRoom = Effect.fn("MapRepository.loadRoom")(function* (
					roomId: string,
				) {
					const room = validatedRooms.get(roomId);
					if (room === undefined) {
						return yield* new MapValidationError({
							reason: `Unknown room id: ${roomId}.`,
							roomId,
						});
					}

					return room;
				});

				const roomObjectById = Effect.fn("MapRepository.roomObjectById")(
					function* (roomId: string, objectId: string) {
						const room = yield* loadRoom(roomId);
						const objectEntry = room.objectPlanes
							.flatMap((plane) => plane.entries)
							.find((entry) => entry.id === objectId);

						if (objectEntry === undefined) {
							return yield* new MapValidationError({
								reason: `Unknown object id ${objectId} in room ${roomId}.`,
								roomId,
							});
						}

						return objectEntry;
					},
				);

				return MapRepository.of({
					loadRoom,
					roomObjectById,
				});
			}),
		);
}
