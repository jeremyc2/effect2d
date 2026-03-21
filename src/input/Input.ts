import { type Effect, ServiceMap } from "effect";

export interface InputSnapshot {
	readonly pressedKeys: ReadonlySet<string>;
	readonly mouseButtons: ReadonlySet<number>;
}

export class Input extends ServiceMap.Service<
	Input,
	{
		readonly snapshot: Effect.Effect<InputSnapshot>;
		readonly isActionPressed: (action: string) => Effect.Effect<boolean>;
	}
>()("effect2d/input/Input") {}
