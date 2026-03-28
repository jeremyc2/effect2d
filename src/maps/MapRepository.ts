import { Effect, Layer, ServiceMap } from "effect";
import type { RoomContent } from "./MapContent.ts";
import { MapValidationError } from "./MapError.ts";
import { getRoomObjectById as getRoomObjectByIdInContent } from "./MapQueries.ts";
import { validateRoom } from "./MapValidation.ts";

/**
 * A validated in-memory repository of authored rooms.
 *
 * @public
 */
export class MapRepository extends ServiceMap.Service<
	MapRepository,
	{
		readonly loadRoom: (
			roomId: string,
		) => Effect.Effect<RoomContent, MapValidationError>;
		readonly getRoomObjectById: (
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
					yield* Effect.annotateCurrentSpan({
						"effect2d.map.room_id": roomId,
					});
					const room = validatedRooms.get(roomId);
					if (room === undefined) {
						return yield* new MapValidationError({
							reason: `Unknown room id: ${roomId}.`,
							roomId,
						});
					}

					return room;
				});

				const getRoomObjectById = Effect.fn("MapRepository.getRoomObjectById")(
					function* (roomId: string, objectId: string) {
						yield* Effect.annotateCurrentSpan({
							"effect2d.map.object_id": objectId,
							"effect2d.map.room_id": roomId,
						});
						const room = yield* loadRoom(roomId);
						const objectEntry = getRoomObjectByIdInContent(room, objectId);

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
					getRoomObjectById,
					loadRoom,
				});
			}),
		);
}
