import { type Effect, ServiceMap } from "effect";

export interface Aabb {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

export interface Circle {
	readonly x: number;
	readonly y: number;
	readonly radius: number;
}

export class CollisionWorld extends ServiceMap.Service<
	CollisionWorld,
	{
		readonly overlapsAabb: (left: Aabb, right: Aabb) => Effect.Effect<boolean>;
		readonly overlapsCircle: (
			left: Circle,
			right: Circle,
		) => Effect.Effect<boolean>;
	}
>()("effect2d/collision/CollisionWorld") {}
