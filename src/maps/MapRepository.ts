import { type Effect, ServiceMap } from "effect";

import type { RoomContent } from "./MapContent.ts";

export class MapRepository extends ServiceMap.Service<
	MapRepository,
	{
		readonly loadRoom: (roomId: string) => Effect.Effect<RoomContent>;
	}
>()("effect2d/maps/MapRepository") {}
