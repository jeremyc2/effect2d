import { type Effect, ServiceMap } from "effect";

import type { SaveDocument } from "./SaveDocument.ts";

export interface SaveParticipantSnapshot {
	readonly key: string;
	readonly state: Readonly<Record<string, unknown>>;
}

export class SaveCoordinator extends ServiceMap.Service<
	SaveCoordinator,
	{
		readonly capture: Effect.Effect<ReadonlyArray<SaveParticipantSnapshot>>;
		readonly restore: (document: SaveDocument) => Effect.Effect<void>;
	}
>()("effect2d/save/SaveCoordinator") {}
