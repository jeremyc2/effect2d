export interface CavernButtonDefinition {
	readonly description: string;
	readonly height: number;
	readonly id: "continue" | "github" | "new-game" | "sound";
	readonly kind: "button" | "icon";
	readonly label: string;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}

export const cavernViewport = {
	height: 768,
	width: 1152,
} as const;

export const cavernMenuButtons = [
	{
		description: "Start a new game - erases old save file",
		height: 72,
		id: "new-game",
		kind: "button",
		label: "New Game",
		width: 360,
		x: 376,
		y: 380,
	},
	{
		description: "Continue from where you left off",
		height: 72,
		id: "continue",
		kind: "button",
		label: "Continue",
		width: 360,
		x: 376,
		y: 476,
	},
	{
		description: "Turn music and sound effects on or off",
		height: 72,
		id: "sound",
		kind: "icon",
		label: ".sound",
		width: 72,
		x: 14,
		y: 682,
	},
	{
		description: "View the code on GitHub",
		height: 72,
		id: "github",
		kind: "icon",
		label: ".github",
		width: 72,
		x: 1066,
		y: 682,
	},
] as const satisfies ReadonlyArray<CavernButtonDefinition>;

export const cavernWorldBounds = {
	height: 576,
	width: 896,
	x: 128,
	y: 96,
} as const;
