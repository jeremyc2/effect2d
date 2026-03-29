import { Effect, Layer, Ref, ServiceMap } from "effect";
import type { DialoguePage } from "../../../../src/ui/UI.ts";

export interface ActiveDialogueSnapshot {
	readonly dialogueId: string;
	readonly page: DialoguePage;
	readonly pageCount: number;
}

export interface DialogueStateSnapshot {
	readonly activeDialogue: ActiveDialogueSnapshot | null;
	readonly currentPageIndex: number;
	readonly dialogueId: string | null;
	readonly pages: ReadonlyArray<DialoguePage>;
}

const initialDialogueStateSnapshot: DialogueStateSnapshot = {
	activeDialogue: null,
	currentPageIndex: 0,
	dialogueId: null,
	pages: [],
};

const activeDialogueSnapshot = (
	dialogueId: string,
	pages: ReadonlyArray<DialoguePage>,
	currentPageIndex: number,
): ActiveDialogueSnapshot | null => {
	const page = pages[currentPageIndex];
	if (page === undefined) {
		return null;
	}

	return {
		dialogueId,
		page,
		pageCount: pages.length,
	};
};

export class DialogueState extends ServiceMap.Service<
	DialogueState,
	{
		readonly advance: Effect.Effect<void>;
		readonly clear: Effect.Effect<void>;
		readonly open: (
			dialogueId: string,
			pages: ReadonlyArray<DialoguePage>,
		) => Effect.Effect<void>;
		readonly restore: (snapshot: DialogueStateSnapshot) => Effect.Effect<void>;
		readonly snapshot: Effect.Effect<DialogueStateSnapshot>;
	}
>()("effect2d/games/starter/game/state/DialogueState") {
	static readonly layer = Layer.effect(
		DialogueState,
		Effect.gen(function* () {
			const stateRef = yield* Ref.make(initialDialogueStateSnapshot);

			const clear = Ref.set(stateRef, initialDialogueStateSnapshot);

			const open = Effect.fn("DialogueState.open")(function* (
				dialogueId: string,
				pages: ReadonlyArray<DialoguePage>,
			) {
				yield* Ref.set(stateRef, {
					activeDialogue:
						pages.length === 0
							? null
							: activeDialogueSnapshot(dialogueId, pages, 0),
					currentPageIndex: 0,
					dialogueId,
					pages,
				});
			});

			const advance = Ref.update(stateRef, (state) => {
				if (state.dialogueId === null || state.pages.length === 0) {
					return state;
				}

				const nextPageIndex = state.currentPageIndex + 1;
				if (nextPageIndex >= state.pages.length) {
					return initialDialogueStateSnapshot;
				}

				return {
					...state,
					activeDialogue: activeDialogueSnapshot(
						state.dialogueId,
						state.pages,
						nextPageIndex,
					),
					currentPageIndex: nextPageIndex,
				};
			});

			const restore = Effect.fn("DialogueState.restore")(function* (
				snapshot: DialogueStateSnapshot,
			) {
				yield* Ref.set(stateRef, snapshot);
			});

			return DialogueState.of({
				advance,
				clear,
				open,
				restore,
				snapshot: Ref.get(stateRef),
			});
		}),
	);
}
