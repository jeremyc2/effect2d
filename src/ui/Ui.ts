import { Effect, Layer, Ref, Schema, ServiceMap } from "effect";
import type { CameraVector } from "../graphics/Camera.ts";
import {
	type Color,
	Graphics,
	type GraphicsFrameNotOpenError,
} from "../graphics/Graphics.ts";
import { Input } from "../input/Input.ts";

export interface FontDefinition {
	readonly fontId: string;
	readonly glyphWidth: number;
	readonly letterSpacing?: number;
	readonly lineHeight: number;
	readonly sourcePath: string;
	readonly spaceWidth?: number;
}

export interface TextLine {
	readonly text: string;
	readonly width: number;
}

export interface TextLayout {
	readonly fontId: string;
	readonly height: number;
	readonly lineHeight: number;
	readonly lines: ReadonlyArray<TextLine>;
	readonly width: number;
}

export interface UiBounds {
	readonly position: CameraVector;
	readonly size: {
		readonly height: number;
		readonly width: number;
	};
}

export interface DialoguePage {
	readonly hasNextPage: boolean;
	readonly layout: TextLayout;
	readonly pageCount: number;
	readonly pageIndex: number;
}

export interface DrawDialogueBoxOptions {
	readonly bounds: UiBounds;
	readonly fontId: string;
	readonly page: DialoguePage;
	readonly panelColor?: Color;
	readonly padding?: number;
	readonly textColor?: Color;
}

export interface MenuNavigationOptions {
	readonly cancelAction?: string;
	readonly confirmAction?: string;
	readonly currentIndex: number;
	readonly itemCount: number;
	readonly nextAction?: string;
	readonly previousAction?: string;
	readonly wrap?: boolean;
}

export interface MenuNavigationResult {
	readonly cancelled: boolean;
	readonly confirmed: boolean;
	readonly currentIndex: number;
	readonly moved: boolean;
}

interface UiState {
	readonly fonts: ReadonlyMap<string, FontDefinition>;
}

const initialState: UiState = {
	fonts: new Map<string, FontDefinition>(),
};

const white: Color = {
	alpha: 1,
	blue: 1,
	green: 1,
	red: 1,
};

const black: Color = {
	alpha: 1,
	blue: 0,
	green: 0,
	red: 0,
};

export class DuplicateFontError extends Schema.TaggedErrorClass<DuplicateFontError>()(
	"DuplicateFontError",
	{
		fontId: Schema.String,
	},
) {}

export class InvalidFontDefinitionError extends Schema.TaggedErrorClass<InvalidFontDefinitionError>()(
	"InvalidFontDefinitionError",
	{
		fontId: Schema.String,
		reason: Schema.String,
	},
) {}

export class UnknownFontError extends Schema.TaggedErrorClass<UnknownFontError>()(
	"UnknownFontError",
	{
		fontId: Schema.String,
	},
) {}

const measureLineWidth = (font: FontDefinition, text: string): number => {
	const letterSpacing = font.letterSpacing ?? 0;
	const spaceWidth = font.spaceWidth ?? font.glyphWidth;
	let width = 0;

	for (let index = 0; index < text.length; index += 1) {
		const character = text[index];
		if (character === undefined) {
			continue;
		}

		width += character === " " ? spaceWidth : font.glyphWidth;
		if (index < text.length - 1) {
			width += letterSpacing;
		}
	}

	return width;
};

const splitParagraphWords = (paragraph: string): Array<string> => {
	const words: Array<string> = [];
	let current = "";

	for (const character of paragraph) {
		if (character === " ") {
			if (current.length > 0) {
				words.push(current);
				current = "";
			}
			continue;
		}

		current += character;
	}

	if (current.length > 0) {
		words.push(current);
	}

	return words;
};

const splitParagraphs = (text: string): Array<string> => {
	const paragraphs: Array<string> = [];
	let current = "";

	for (const character of text) {
		if (character === "\n") {
			paragraphs.push(current);
			current = "";
			continue;
		}

		current += character;
	}

	paragraphs.push(current);
	return paragraphs;
};

const wrapTextLines = (
	font: FontDefinition,
	text: string,
	maxWidth: number,
): Array<TextLine> => {
	const lines: Array<TextLine> = [];
	const paragraphs = splitParagraphs(text);

	for (const paragraph of paragraphs) {
		if (paragraph.length === 0) {
			lines.push({
				text: "",
				width: 0,
			});
			continue;
		}

		const words = splitParagraphWords(paragraph);
		let currentLine = "";

		for (const word of words) {
			const nextLine =
				currentLine.length === 0 ? word : `${currentLine} ${word}`;
			const nextWidth = measureLineWidth(font, nextLine);
			if (currentLine.length > 0 && nextWidth > maxWidth) {
				lines.push({
					text: currentLine,
					width: measureLineWidth(font, currentLine),
				});
				currentLine = word;
				continue;
			}

			currentLine = nextLine;
		}

		lines.push({
			text: currentLine,
			width: measureLineWidth(font, currentLine),
		});
	}

	return lines;
};

const clampIndex = (
	value: number,
	minimum: number,
	maximum: number,
): number => {
	if (value < minimum) {
		return minimum;
	}

	if (value > maximum) {
		return maximum;
	}

	return value;
};

const wrapIndex = (value: number, count: number): number => {
	if (count <= 0) {
		return 0;
	}

	const remainder = value % count;
	return remainder < 0 ? remainder + count : remainder;
};

const layoutFromLines = (
	fontId: string,
	lineHeight: number,
	lines: ReadonlyArray<TextLine>,
): TextLayout => ({
	fontId,
	height: lines.length * lineHeight,
	lineHeight,
	lines,
	width: lines.reduce(
		(currentWidth, line) => Math.max(currentWidth, line.width),
		0,
	),
});

export class Ui extends ServiceMap.Service<
	Ui,
	{
		readonly drawCursor: (
			bounds: UiBounds,
			color?: Color,
		) => Effect.Effect<void, GraphicsFrameNotOpenError>;
		readonly drawDialogueBox: (
			options: DrawDialogueBoxOptions,
		) => Effect.Effect<void, GraphicsFrameNotOpenError | UnknownFontError>;
		readonly drawFrame: (
			bounds: UiBounds,
			color?: Color,
		) => Effect.Effect<void, GraphicsFrameNotOpenError>;
		readonly drawHighlight: (
			bounds: UiBounds,
			color?: Color,
		) => Effect.Effect<void, GraphicsFrameNotOpenError>;
		readonly drawPanel: (
			bounds: UiBounds,
			fillColor?: Color,
			borderColor?: Color,
		) => Effect.Effect<void, GraphicsFrameNotOpenError>;
		readonly drawTextBlock: (options: {
			readonly align?: "center" | "left" | "right";
			readonly fontId: string;
			readonly maxWidth?: number;
			readonly position: CameraVector;
			readonly text: string;
		}) => Effect.Effect<void, GraphicsFrameNotOpenError | UnknownFontError>;
		readonly loadFont: (
			definition: FontDefinition,
		) => Effect.Effect<void, DuplicateFontError | InvalidFontDefinitionError>;
		readonly measureText: (
			fontId: string,
			text: string,
		) => Effect.Effect<TextLayout, UnknownFontError>;
		readonly paginateDialogue: (options: {
			readonly fontId: string;
			readonly maxLines: number;
			readonly maxWidth: number;
			readonly text: string;
		}) => Effect.Effect<ReadonlyArray<DialoguePage>, UnknownFontError>;
		readonly resolveMenuInput: (
			options: MenuNavigationOptions,
		) => Effect.Effect<MenuNavigationResult, never>;
		readonly wrapText: (
			fontId: string,
			text: string,
			maxWidth: number,
		) => Effect.Effect<TextLayout, UnknownFontError>;
	}
>()("effect2d/ui/Ui") {
	static readonly layer = Layer.effect(
		Ui,
		Effect.gen(function* () {
			const stateRef = yield* Ref.make(initialState);
			const graphics = yield* Graphics;
			const input = yield* Input;

			const drawTextLines = Effect.fn("Ui.drawTextLines")(function* (
				fontId: string,
				lines: ReadonlyArray<TextLine>,
				position: CameraVector,
				lineHeight: number,
				align: "center" | "left" | "right",
			) {
				for (let index = 0; index < lines.length; index += 1) {
					const line = lines[index];
					if (line === undefined) {
						continue;
					}

					yield* graphics.drawText({
						align,
						fontId,
						position: {
							x: position.x,
							y: position.y + index * lineHeight,
						},
						text: line.text,
					});
				}
			});

			const readOptionalActionJustPressed = Effect.fn(
				"Ui.readOptionalActionJustPressed",
			)(function* (action: string | undefined) {
				if (action === undefined) {
					return false;
				}

				return yield* input.actionState(action).pipe(
					Effect.map((state) => state.justPressed),
					Effect.catchTag("UnknownInputActionError", () =>
						Effect.succeed(false),
					),
				);
			});

			const getFont = Effect.fn("Ui.getFont")(function* (fontId: string) {
				const state = yield* Ref.get(stateRef);
				const font = state.fonts.get(fontId);
				if (font === undefined) {
					return yield* new UnknownFontError({
						fontId,
					});
				}

				return font;
			});

			const loadFont = Effect.fn("Ui.loadFont")(function* (
				definition: FontDefinition,
			) {
				if (definition.fontId.length === 0) {
					return yield* new InvalidFontDefinitionError({
						fontId: definition.fontId,
						reason: "Fonts must declare a non-empty font id.",
					});
				}

				if (definition.sourcePath.length === 0) {
					return yield* new InvalidFontDefinitionError({
						fontId: definition.fontId,
						reason: "Fonts must declare a non-empty source path.",
					});
				}

				if (definition.glyphWidth <= 0 || definition.lineHeight <= 0) {
					return yield* new InvalidFontDefinitionError({
						fontId: definition.fontId,
						reason: "Fonts must declare positive glyph width and line height.",
					});
				}

				const state = yield* Ref.get(stateRef);
				if (state.fonts.has(definition.fontId)) {
					return yield* new DuplicateFontError({
						fontId: definition.fontId,
					});
				}

				yield* Ref.update(stateRef, (current) => ({
					...current,
					fonts: new Map(current.fonts).set(definition.fontId, definition),
				}));
			});

			const measureText = Effect.fn("Ui.measureText")(function* (
				fontId: string,
				text: string,
			) {
				const font = yield* getFont(fontId);
				return layoutFromLines(fontId, font.lineHeight, [
					{
						text,
						width: measureLineWidth(font, text),
					},
				]);
			});

			const wrapText = Effect.fn("Ui.wrapText")(function* (
				fontId: string,
				text: string,
				maxWidth: number,
			) {
				const font = yield* getFont(fontId);
				return layoutFromLines(
					fontId,
					font.lineHeight,
					wrapTextLines(font, text, maxWidth),
				);
			});

			const drawPanel = Effect.fn("Ui.drawPanel")(function* (
				bounds: UiBounds,
				fillColor: Color = black,
				borderColor: Color = white,
			) {
				yield* graphics.drawRectangle(
					bounds.position,
					bounds.size,
					"fill",
					fillColor,
				);
				yield* graphics.drawRectangle(
					bounds.position,
					bounds.size,
					"stroke",
					borderColor,
				);
			});

			const drawFrame = Effect.fn("Ui.drawFrame")(function* (
				bounds: UiBounds,
				color: Color = white,
			) {
				yield* graphics.drawRectangle(
					bounds.position,
					bounds.size,
					"stroke",
					color,
				);
			});

			const drawHighlight = Effect.fn("Ui.drawHighlight")(function* (
				bounds: UiBounds,
				color: Color = {
					alpha: 0.35,
					blue: 0.25,
					green: 0.7,
					red: 0.9,
				},
			) {
				yield* graphics.drawRectangle(
					bounds.position,
					bounds.size,
					"fill",
					color,
				);
			});

			const drawCursor = Effect.fn("Ui.drawCursor")(function* (
				bounds: UiBounds,
				color: Color = white,
			) {
				yield* graphics.drawRectangle(
					bounds.position,
					bounds.size,
					"fill",
					color,
				);
			});

			const drawTextBlock = Effect.fn("Ui.drawTextBlock")(function* (options: {
				readonly align?: "center" | "left" | "right";
				readonly fontId: string;
				readonly maxWidth?: number;
				readonly position: CameraVector;
				readonly text: string;
			}) {
				const layout =
					options.maxWidth === undefined
						? yield* measureText(options.fontId, options.text)
						: yield* wrapText(options.fontId, options.text, options.maxWidth);

				yield* drawTextLines(
					options.fontId,
					layout.lines,
					options.position,
					layout.lineHeight,
					options.align ?? "left",
				);
			});

			const paginateDialogue = Effect.fn("Ui.paginateDialogue")(
				function* (options: {
					readonly fontId: string;
					readonly maxLines: number;
					readonly maxWidth: number;
					readonly text: string;
				}) {
					const layout = yield* wrapText(
						options.fontId,
						options.text,
						options.maxWidth,
					);
					const pages: Array<DialoguePage> = [];

					for (
						let lineIndex = 0;
						lineIndex < layout.lines.length;
						lineIndex += options.maxLines
					) {
						const pageLines = layout.lines.slice(
							lineIndex,
							lineIndex + options.maxLines,
						);
						pages.push({
							hasNextPage: false,
							layout: layoutFromLines(
								options.fontId,
								layout.lineHeight,
								pageLines,
							),
							pageCount: 0,
							pageIndex: pages.length,
						});
					}

					return pages.map((page, pageIndex) => ({
						...page,
						hasNextPage: pageIndex < pages.length - 1,
						pageCount: pages.length,
						pageIndex,
					}));
				},
			);

			const drawDialogueBox = Effect.fn("Ui.drawDialogueBox")(function* (
				options: DrawDialogueBoxOptions,
			) {
				yield* drawPanel(
					options.bounds,
					options.panelColor ?? {
						alpha: 0.9,
						blue: 0.08,
						green: 0.08,
						red: 0.08,
					},
				);

				const padding = options.padding ?? 8;
				yield* drawTextLines(
					options.fontId,
					options.page.layout.lines,
					{
						x: options.bounds.position.x + padding,
						y: options.bounds.position.y + padding,
					},
					options.page.layout.lineHeight,
					"left",
				);

				if (options.page.hasNextPage) {
					yield* drawCursor(
						{
							position: {
								x:
									options.bounds.position.x +
									options.bounds.size.width -
									padding -
									6,
								y:
									options.bounds.position.y +
									options.bounds.size.height -
									padding -
									6,
							},
							size: {
								height: 6,
								width: 6,
							},
						},
						options.textColor ?? white,
					);
				}
			});

			const resolveMenuInput = Effect.fn("Ui.resolveMenuInput")(function* (
				options: MenuNavigationOptions,
			) {
				const previousPressed = yield* readOptionalActionJustPressed(
					options.previousAction ?? "menu-up",
				);
				const nextPressed = yield* readOptionalActionJustPressed(
					options.nextAction ?? "menu-down",
				);
				const confirmPressed = yield* readOptionalActionJustPressed(
					options.confirmAction ?? "menu-confirm",
				);
				const cancelPressed = yield* readOptionalActionJustPressed(
					options.cancelAction ?? "menu-cancel",
				);

				let currentIndex = options.currentIndex;
				let moved = false;

				if (options.itemCount > 0) {
					if (previousPressed && !nextPressed) {
						currentIndex =
							options.wrap === false
								? clampIndex(currentIndex - 1, 0, options.itemCount - 1)
								: wrapIndex(currentIndex - 1, options.itemCount);
						moved = currentIndex !== options.currentIndex;
					} else if (nextPressed && !previousPressed) {
						currentIndex =
							options.wrap === false
								? clampIndex(currentIndex + 1, 0, options.itemCount - 1)
								: wrapIndex(currentIndex + 1, options.itemCount);
						moved = currentIndex !== options.currentIndex;
					}
				}

				return {
					cancelled: cancelPressed,
					confirmed: confirmPressed,
					currentIndex,
					moved,
				} satisfies MenuNavigationResult;
			});

			return Ui.of({
				drawCursor,
				drawDialogueBox,
				drawFrame,
				drawHighlight,
				drawPanel,
				drawTextBlock,
				loadFont,
				measureText,
				paginateDialogue,
				resolveMenuInput,
				wrapText,
			});
		}),
	);
}
