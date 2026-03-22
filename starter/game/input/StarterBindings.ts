import type { ActionBinding } from "../../../src/input/Input.ts";

export const starterBindings = [
	{
		action: "menu-up",
		triggers: [{ key: "ArrowUp", type: "key" }],
	},
	{
		action: "menu-down",
		triggers: [{ key: "ArrowDown", type: "key" }],
	},
	{
		action: "menu-confirm",
		triggers: [{ key: "Enter", type: "key" }],
	},
	{
		action: "menu-cancel",
		triggers: [{ key: "Escape", type: "key" }],
	},
	{
		action: "move-right",
		triggers: [{ key: "ArrowRight", type: "key" }],
	},
	{
		action: "debug-toggle",
		triggers: [{ key: "F3", type: "key" }],
	},
] satisfies ReadonlyArray<ActionBinding>;
