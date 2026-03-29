import type { ActionBinding } from "../../../../src/input/Input.ts";

export const cavernBindings = [
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
		action: "menu-click",
		triggers: [{ button: 1, type: "mouse-button" }],
	},
	{
		action: "move-left",
		triggers: [
			{ key: "ArrowLeft", type: "key" },
			{ key: "a", type: "key" },
			{ key: "A", type: "key" },
		],
	},
	{
		action: "move-right",
		triggers: [
			{ key: "ArrowRight", type: "key" },
			{ key: "d", type: "key" },
			{ key: "D", type: "key" },
		],
	},
	{
		action: "move-up",
		triggers: [
			{ key: "ArrowUp", type: "key" },
			{ key: "w", type: "key" },
			{ key: "W", type: "key" },
		],
	},
	{
		action: "move-down",
		triggers: [
			{ key: "ArrowDown", type: "key" },
			{ key: "s", type: "key" },
			{ key: "S", type: "key" },
		],
	},
	{
		action: "debug-toggle",
		triggers: [{ key: "F3", type: "key" }],
	},
] satisfies ReadonlyArray<ActionBinding>;
