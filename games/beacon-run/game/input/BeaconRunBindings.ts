import type { ActionBinding } from "../../../../src/input/Input.ts";

export const beaconRunBindings = [
	{
		action: "menu-confirm",
		triggers: [{ key: "Enter", type: "key" }],
	},
	{
		action: "menu-cancel",
		triggers: [{ key: "Escape", type: "key" }],
	},
	{
		action: "move-left",
		triggers: [{ key: "ArrowLeft", type: "key" }],
	},
	{
		action: "move-right",
		triggers: [{ key: "ArrowRight", type: "key" }],
	},
	{
		action: "move-up",
		triggers: [{ key: "ArrowUp", type: "key" }],
	},
	{
		action: "move-down",
		triggers: [{ key: "ArrowDown", type: "key" }],
	},
	{
		action: "interact",
		triggers: [{ key: "Space", type: "key" }],
	},
	{
		action: "debug-toggle",
		triggers: [{ key: "F3", type: "key" }],
	},
] satisfies ReadonlyArray<ActionBinding>;
