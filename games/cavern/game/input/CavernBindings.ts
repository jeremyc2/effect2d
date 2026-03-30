import type { ActionBinding } from "../../../../src/input/Input.ts";

export const cavernBindings = [
	{
		action: "menu-up",
		edges: [{ key: "ArrowUp", type: "key" }],
	},
	{
		action: "menu-down",
		edges: [{ key: "ArrowDown", type: "key" }],
	},
	{
		action: "menu-confirm",
		edges: [{ key: "Enter", type: "key" }],
	},
	{
		action: "menu-cancel",
		edges: [{ key: "Escape", type: "key" }],
	},
	{
		action: "menu-click",
		edges: [{ button: 1, type: "mouse-button" }],
	},
	{
		action: "move-left",
		edges: [
			{ key: "ArrowLeft", type: "key" },
			{ key: "a", type: "key" },
			{ key: "A", type: "key" },
		],
	},
	{
		action: "move-right",
		edges: [
			{ key: "ArrowRight", type: "key" },
			{ key: "d", type: "key" },
			{ key: "D", type: "key" },
		],
	},
	{
		action: "move-up",
		edges: [
			{ key: "ArrowUp", type: "key" },
			{ key: "w", type: "key" },
			{ key: "W", type: "key" },
		],
	},
	{
		action: "move-down",
		edges: [
			{ key: "ArrowDown", type: "key" },
			{ key: "s", type: "key" },
			{ key: "S", type: "key" },
		],
	},
	{
		action: "debug-toggle",
		edges: [{ key: "F3", type: "key" }],
	},
] satisfies ReadonlyArray<ActionBinding>;
