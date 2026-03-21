export interface SaveDocument {
	readonly version: number;
	readonly slots: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}
