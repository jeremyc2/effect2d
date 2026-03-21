import { type Effect, ServiceMap } from "effect";

export interface Color {
	readonly red: number;
	readonly green: number;
	readonly blue: number;
	readonly alpha: number;
}

export class Graphics extends ServiceMap.Service<
	Graphics,
	{
		readonly beginFrame: Effect.Effect<void>;
		readonly clear: (color: Color) => Effect.Effect<void>;
		readonly endFrame: Effect.Effect<void>;
	}
>()("effect2d/graphics/Graphics") {}
