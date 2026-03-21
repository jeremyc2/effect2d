import { Effect, Schema } from "effect";
import type { RoomContent } from "./MapContent.ts";
import { MapSerializationError } from "./MapError.ts";
import { validateRoom } from "./MapValidation.ts";

const RoomMetadataSchema = Schema.Record(Schema.String, Schema.Unknown);

const TilePlaneSchema = Schema.Struct({
	id: Schema.String,
	width: Schema.Number,
	height: Schema.Number,
	tiles: Schema.Array(Schema.Number),
});

const RoomObjectSchema = Schema.Struct({
	id: Schema.String,
	kind: Schema.String,
	metadata: Schema.Record(Schema.String, Schema.Unknown),
	height: Schema.Number,
	width: Schema.Number,
	x: Schema.Number,
	y: Schema.Number,
});

const ObjectPlaneSchema = Schema.Struct({
	entries: Schema.Array(RoomObjectSchema),
	id: Schema.String,
});

export const RoomContentSchema = Schema.Struct({
	id: Schema.String,
	metadata: RoomMetadataSchema,
	objectPlanes: Schema.Array(ObjectPlaneSchema),
	tilePlanes: Schema.Array(TilePlaneSchema),
});

const RoomContentFromJsonString = Schema.fromJsonString(RoomContentSchema);

const toSerializationError = (
	operation: "deserialize" | "serialize",
	error: unknown,
): MapSerializationError =>
	new MapSerializationError({
		details: error instanceof Error ? error.message : String(error),
		operation,
	});

export const serializeRoom = (
	room: RoomContent,
): Effect.Effect<string, MapSerializationError> =>
	validateRoom(room).pipe(
		Effect.flatMap((validatedRoom) =>
			Schema.encodeUnknownEffect(RoomContentFromJsonString)(validatedRoom),
		),
		Effect.mapError((error) => toSerializationError("serialize", error)),
	);

export const deserializeRoom = (
	serializedRoom: string,
): Effect.Effect<
	RoomContent,
	MapSerializationError | import("./MapError.ts").MapValidationError
> =>
	Effect.gen(function* () {
		const decodedRoom = yield* Schema.decodeUnknownEffect(
			RoomContentFromJsonString,
		)(serializedRoom).pipe(
			Effect.mapError((error) => toSerializationError("deserialize", error)),
		);
		return yield* validateRoom(decodedRoom);
	});
