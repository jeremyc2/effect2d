import { Schema } from "effect";

export class SaveParticipantKeyConflictError extends Schema.TaggedErrorClass<SaveParticipantKeyConflictError>()(
	"SaveParticipantKeyConflictError",
	{
		key: Schema.String,
	},
) {}

export class SaveSlotNotFoundError extends Schema.TaggedErrorClass<SaveSlotNotFoundError>()(
	"SaveSlotNotFoundError",
	{
		slotId: Schema.String,
	},
) {}

export class SaveDocumentDecodeError extends Schema.TaggedErrorClass<SaveDocumentDecodeError>()(
	"SaveDocumentDecodeError",
	{
		details: Schema.String,
	},
) {}

export class SaveMigrationPathError extends Schema.TaggedErrorClass<SaveMigrationPathError>()(
	"SaveMigrationPathError",
	{
		details: Schema.String,
	},
) {}
