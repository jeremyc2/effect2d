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

export class SaveMigrationExecutionError extends Schema.TaggedErrorClass<SaveMigrationExecutionError>()(
	"SaveMigrationExecutionError",
	{
		details: Schema.String,
	},
) {}

export class SaveMigrationMissingError extends Schema.TaggedErrorClass<SaveMigrationMissingError>()(
	"SaveMigrationMissingError",
	{
		fromVersion: Schema.Number,
		targetVersion: Schema.Number,
	},
) {}

export class SaveMigrationFailedError extends Schema.TaggedErrorClass<SaveMigrationFailedError>()(
	"SaveMigrationFailedError",
	{
		fromVersion: Schema.Number,
		toVersion: Schema.Number,
	},
) {}

export class SaveMigrationVersionMismatchError extends Schema.TaggedErrorClass<SaveMigrationVersionMismatchError>()(
	"SaveMigrationVersionMismatchError",
	{
		actualVersion: Schema.Number,
		expectedVersion: Schema.Number,
	},
) {}
