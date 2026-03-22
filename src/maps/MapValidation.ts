import { Effect } from "effect";
import type { RoomContent, RoomObject, TilePlane } from "./MapContent.ts";
import { MapValidationError } from "./MapError.ts";

const duplicateIds = (values: ReadonlyArray<string>): ReadonlyArray<string> => {
	const seen = new Set<string>();
	const duplicates = new Set<string>();

	for (const value of values) {
		if (seen.has(value)) {
			duplicates.add(value);
			continue;
		}

		seen.add(value);
	}

	return Array.from(duplicates);
};

const validateTilePlane = (
	roomId: string,
	plane: TilePlane,
): Effect.Effect<void, MapValidationError> => {
	if (plane.id.length === 0) {
		return Effect.fail(
			new MapValidationError({
				reason: "Tile plane ids must be non-empty.",
				roomId,
			}),
		);
	}

	if (plane.width <= 0 || plane.height <= 0) {
		return Effect.fail(
			new MapValidationError({
				reason: `Tile plane ${plane.id} must have positive dimensions.`,
				roomId,
			}),
		);
	}

	if (plane.tiles.length !== plane.width * plane.height) {
		return Effect.fail(
			new MapValidationError({
				reason: `Tile plane ${plane.id} must contain width * height tiles.`,
				roomId,
			}),
		);
	}

	return Effect.void;
};

const validateObjectEntry = (
	roomId: string,
	entry: RoomObject,
): Effect.Effect<void, MapValidationError> => {
	if (entry.id.length === 0) {
		return Effect.fail(
			new MapValidationError({
				reason: "Object ids must be non-empty.",
				roomId,
			}),
		);
	}

	if (entry.width < 0 || entry.height < 0) {
		return Effect.fail(
			new MapValidationError({
				reason: `Object ${entry.id} cannot have negative dimensions.`,
				roomId,
			}),
		);
	}

	if (
		entry.kind === "transition-zone" &&
		typeof entry.metadata["targetRoomId"] !== "string"
	) {
		return Effect.fail(
			new MapValidationError({
				reason: `Transition zone ${entry.id} must declare metadata.targetRoomId.`,
				roomId,
			}),
		);
	}

	if (
		entry.kind === "spawn-point" &&
		typeof entry.metadata["spawnId"] !== "string"
	) {
		return Effect.fail(
			new MapValidationError({
				reason: `Spawn point ${entry.id} must declare metadata.spawnId.`,
				roomId,
			}),
		);
	}

	return Effect.void;
};

export const validateRoom = Effect.fn("MapValidation.validateRoom")(function* (
	room: RoomContent,
) {
	if (room.id.length === 0) {
		return yield* new MapValidationError({
			reason: "Room ids must be non-empty.",
			roomId: room.id,
		});
	}

	const duplicateTilePlaneIds = duplicateIds(
		room.tilePlanes.map((plane) => plane.id),
	);
	if (duplicateTilePlaneIds.length > 0) {
		return yield* new MapValidationError({
			reason: `Duplicate tile plane ids found: ${duplicateTilePlaneIds.join(", ")}.`,
			roomId: room.id,
		});
	}

	const duplicateObjectPlaneIds = duplicateIds(
		room.objectPlanes.map((plane) => plane.id),
	);
	if (duplicateObjectPlaneIds.length > 0) {
		return yield* new MapValidationError({
			reason: `Duplicate object plane ids found: ${duplicateObjectPlaneIds.join(", ")}.`,
			roomId: room.id,
		});
	}

	for (const tilePlane of room.tilePlanes) {
		yield* validateTilePlane(room.id, tilePlane);
	}

	const objectEntries = room.objectPlanes.flatMap((plane) => plane.entries);
	const duplicateObjectIds = duplicateIds(
		objectEntries.map((entry) => entry.id),
	);
	if (duplicateObjectIds.length > 0) {
		return yield* new MapValidationError({
			reason: `Duplicate object ids found: ${duplicateObjectIds.join(", ")}.`,
			roomId: room.id,
		});
	}

	for (const entry of objectEntries) {
		yield* validateObjectEntry(room.id, entry);
	}

	return room;
});
