import { Glob } from "bun";
import { Console, Effect, Schema } from "effect";

type PublicDocEntry = {
	readonly filePath: string;
	readonly kind:
		| "class"
		| "const"
		| "error"
		| "function"
		| "interface"
		| "service"
		| "type";
	readonly line: number;
	readonly markdown: string;
	readonly name: string;
	readonly serviceMembers: ReadonlyArray<{
		readonly name: string;
		readonly signature: string;
	}>;
	readonly slug: string;
};

type FileDocGroup = {
	readonly entries: ReadonlyArray<PublicDocEntry>;
	readonly fileLabel: string;
	readonly filePath: string;
	readonly slug: string;
};

type ModuleDocGroup = {
	readonly fileGroups: ReadonlyArray<FileDocGroup>;
	readonly label: string;
	readonly moduleId: string;
	readonly slug: string;
};

type PackageDocumentation = {
	readonly markdown: string;
	readonly summary: string;
};

const effectDocsUrl = "https://effect.website/docs/introduction";
const loveWebsiteUrl = "https://love2d.org/";

class DocSiteReadError extends Schema.TaggedErrorClass<DocSiteReadError>()(
	"DocSiteReadError",
	{
		cause: Schema.Unknown,
		path: Schema.String,
	},
) {}

class DocSiteWriteError extends Schema.TaggedErrorClass<DocSiteWriteError>()(
	"DocSiteWriteError",
	{
		cause: Schema.Unknown,
		path: Schema.String,
	},
) {}

class DocSiteScanError extends Schema.TaggedErrorClass<DocSiteScanError>()(
	"DocSiteScanError",
	{
		cause: Schema.Unknown,
		pattern: Schema.String,
	},
) {}

const docsOutputPath = "docs/public/using-effect2d.html";
const llmsOutputPath = "docs/public/llms.txt";
const llmsDirectoryPath = "docs/public/llms";
const llmsFullOutputPath = "docs/public/llms-full.txt";
const rootEntrypointPath = "src/index.ts";

const moduleLabelOverrides: Record<string, string> = {
	ui: "UI",
};

const escapeHtml = (value: string): string =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");

const slugify = (value: string): string =>
	value
		// Collapse any non-alphanumeric run into one dash so ids stay URL-safe.
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		// Trim dashes that would otherwise remain at the edges.
		.replace(/^-+|-+$/g, "");

const toTitleCase = (value: string): string =>
	moduleLabelOverrides[value] ??
	value
		// Split module ids like "runtime-clock" or "runtime_clock" into words.
		.split(/[-_]/g)
		.map((part) =>
			part.length === 0 ? part : `${part[0]?.toUpperCase()}${part.slice(1)}`,
		)
		.join(" ");

type JsDocDeclarationKind =
	| "class"
	| "const"
	| "function"
	| "interface"
	| "type";

function isJsDocDeclarationKind(value: string): value is JsDocDeclarationKind {
	return (
		value === "class" ||
		value === "const" ||
		value === "function" ||
		value === "interface" ||
		value === "type"
	);
}

const readText = (path: string): Effect.Effect<string, DocSiteReadError> =>
	Effect.tryPromise({
		try: async () => Bun.file(path).text(),
		catch: (cause) => new DocSiteReadError({ cause, path }),
	});

const writeText = (
	path: string,
	value: string,
): Effect.Effect<void, DocSiteWriteError> =>
	Effect.tryPromise({
		try: async () => {
			await Bun.write(path, value);
		},
		catch: (cause) => new DocSiteWriteError({ cause, path }),
	});

// Matches `export * from "./module/index.ts";` lines in the root entrypoint so
// the docs navigation follows the library's official public module ordering.
const rootModuleExportRegex = /^export \* from "\.\/([^/]+)\/index\.ts";$/gm;

// Matches `export * from "./File.ts";` lines inside each module index so we
// only document files that are intentionally re-exported as public surface.
const moduleFileExportRegex = /^export \* from "\.\/([^"]+)";$/gm;

// Finds JSDoc blocks so we can inspect only comments that explicitly opt into
// the generated site via `@public`.
const jsDocBlockRegex = /\/\*\*[\s\S]*?\*\//g;

// Reads the exported declaration immediately following a JSDoc block. This is
// intentionally limited to the public declaration shapes used in this repo.
const declarationRegex =
	/^\s*export\s+(?:declare\s+)?(?:abstract\s+)?(interface|type|class|const|function)\s+([A-Za-z_$][A-Za-z0-9_$]*)/;

// Rewrites TSDoc inline links like `{@link Foo}` or `{@link Foo label}` into
// normal markdown links or code spans before sending the text through Bun's
// markdown renderer.
const tsDocLinkRegex = /\{@link\s+([^}\s]+)(?:\s+([^}]+))?\}/g;

const collectPublicModules = Effect.fn("collectPublicModules")(function* (
	rootEntrypointSource: string,
) {
	const modules: Array<{
		readonly files: ReadonlyArray<string>;
		readonly label: string;
		readonly moduleId: string;
	}> = [];

	for (const match of rootEntrypointSource.matchAll(rootModuleExportRegex)) {
		const moduleId = match[1];
		if (moduleId === undefined) {
			continue;
		}

		const moduleIndexPath = `src/${moduleId}/index.ts`;
		const moduleIndexSource = yield* readText(moduleIndexPath);
		const files = Array.from(moduleIndexSource.matchAll(moduleFileExportRegex))
			.map((fileMatch) => fileMatch[1])
			.filter((filePath): filePath is string => filePath !== undefined)
			.map((filePath) => `src/${moduleId}/${filePath}`);

		modules.push({
			files,
			label: toTitleCase(moduleId),
			moduleId,
		});
	}

	return modules;
});

const cleanJsDocMarkdown = (rawBlock: string): string => {
	const body = rawBlock
		// Remove the opening JSDoc marker before processing the comment body.
		.replace(/^\/\*\*/, "")
		// Remove the closing JSDoc marker from the final line.
		.replace(/\*\/$/, "")
		.split("\n")
		// Strip the leading "*" decoration from each JSDoc line.
		.map((line) => line.replace(/^\s*\*\s?/, ""))
		.map((line) =>
			line
				// Drop the generated-doc opt-in tag from rendered prose.
				.replace(/\s*@public\b/g, "")
				// Drop the package-docs tag from rendered prose.
				.replace(/\s*@packageDocumentation\b/g, ""),
		)
		.join("\n")
		.trim();

	return (
		body
			// Remove stray "Public" wording left behind after tag cleanup.
			.replace(/\b[Pp]ublic\b/g, "")
			// Collapse repeated spaces introduced by normalization.
			.replace(/ {2,}/g, " ")
			// Remove spaces that appear before punctuation after cleanup.
			.replace(/\s+([,.:;!?])/g, "$1")
			.trim()
	);
};

const extractSummary = (markdown: string): string => {
	const paragraphs = markdown
		// Split markdown into paragraph-sized chunks separated by blank lines.
		.split(/\n\s*\n/g)
		.map((part) => part.trim())
		.filter((part) => part.length > 0)
		.filter((part) => !part.startsWith("#"))
		.filter((part) => !part.startsWith("- "))
		.filter((part) => !part.startsWith("1. "));

	return paragraphs[0] ?? "";
};

const extractPackageDocumentation = (
	rootEntrypointSource: string,
): PackageDocumentation => {
	for (const match of rootEntrypointSource.matchAll(jsDocBlockRegex)) {
		const block = match[0];
		if (
			!block.includes("@packageDocumentation") ||
			!block.includes("@public")
		) {
			continue;
		}

		const markdown = cleanJsDocMarkdown(block);
		return {
			markdown,
			summary: extractSummary(markdown),
		};
	}

	return {
		markdown: "",
		summary: "",
	};
};

const makeInlineLinks = (
	markdown: string,
	slugBySymbol: ReadonlyMap<string, string>,
): string =>
	markdown
		// Turn inline code mentions of LÖVE/LÖVE 2D into one canonical external link.
		.replace(/`(LÖVE(?: 2D)?)`/g, (_match, label: string) => {
			return `[${label}](${loveWebsiteUrl})`;
		})
		.replace(tsDocLinkRegex, (_match, target: string, label?: string) => {
			const resolvedLabel = (label ?? target).trim();
			const slug = slugBySymbol.get(target);
			return slug === undefined
				? `\`${resolvedLabel}\``
				: `[${resolvedLabel}](#${slug})`;
		});

const extractPublicEntries = (
	filePath: string,
	source: string,
	moduleSlug: string,
): ReadonlyArray<PublicDocEntry> => {
	const entries: Array<PublicDocEntry> = [];

	for (const match of source.matchAll(jsDocBlockRegex)) {
		const block = match[0];
		const blockStart = match.index ?? 0;
		if (!block.includes("@public") || block.includes("@packageDocumentation")) {
			continue;
		}

		const rest = source.slice(blockStart + block.length);
		const declarationMatch = rest.match(declarationRegex);
		if (declarationMatch === null) {
			continue;
		}

		const rawDeclarationKind = declarationMatch[1];
		if (rawDeclarationKind === undefined) {
			continue;
		}
		if (!isJsDocDeclarationKind(rawDeclarationKind)) {
			continue;
		}
		const declarationKind = rawDeclarationKind;
		const name = declarationMatch[2];
		if (name === undefined) {
			continue;
		}

		const line = source.slice(0, blockStart).split("\n").length;
		const kind = getDocumentedKind(source, name, declarationKind);
		entries.push({
			filePath,
			kind,
			line,
			markdown: cleanJsDocMarkdown(block),
			name,
			serviceMembers:
				kind === "service" ? extractServiceMembers(source, name) : [],
			slug: `${moduleSlug}-${slugify(name)}`,
		});
	}

	return entries;
};

function getDocumentedKind(
	source: string,
	name: string,
	declarationKind: "class" | "const" | "function" | "interface" | "type",
): PublicDocEntry["kind"] {
	if (declarationKind === "const" && isEffectFunctionConst(source, name)) {
		return "function";
	}

	if (declarationKind !== "class") {
		return declarationKind;
	}

	if (source.includes(`export class ${name} extends ServiceMap.Service<`)) {
		return "service";
	}

	if (
		source.includes(
			`export class ${name} extends Schema.TaggedErrorClass<${name}>()(`,
		)
	) {
		return "error";
	}

	return "class";
}

function isEffectFunctionConst(source: string, name: string): boolean {
	const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	// Match exported top-level const helpers declared via Effect.fn(...) or
	// Effect.fnUntraced(...), allowing an optional function-type annotation
	// between the symbol name and the assignment.
	const effectFunctionConstPattern = new RegExp(
		String.raw`export const ${escapedName}(?:\s*:\s*[\s\S]*?)?\s*=\s*Effect\.(?:fn|fnUntraced)\b`,
	);
	return effectFunctionConstPattern.test(source);
}

function extractServiceMembers(
	source: string,
	className: string,
): ReadonlyArray<{
	readonly name: string;
	readonly signature: string;
}> {
	const classSignature = `export class ${className} extends ServiceMap.Service<`;
	const classStart = source.indexOf(classSignature);
	if (classStart === -1) {
		return [];
	}

	const classSlice = source.slice(classStart);
	const serviceEnd = classSlice.indexOf('>()("');
	if (serviceEnd === -1) {
		return [];
	}

	const serviceSignature = classSlice.slice(0, serviceEnd);
	const members: Array<{
		readonly name: string;
		readonly signature: string;
	}> = [];

	for (const match of serviceSignature.matchAll(
		// Capture `readonly memberName: signature;` lines from the service contract.
		/readonly\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*:\s*([\s\S]*?);/g,
	)) {
		const name = match[1];
		const rawSignature = match[2];
		if (name === undefined || rawSignature === undefined) {
			continue;
		}

		members.push({
			name,
			// Flatten multiline signatures so each method fits on one rendered line.
			signature: `${name}: ${rawSignature.replace(/\s+/g, " ").trim()}`,
		});
	}

	return members;
}

function renderServiceMembers(
	serviceMembers: ReadonlyArray<{
		readonly name: string;
		readonly signature: string;
	}>,
): string {
	return serviceMembers.length === 0
		? ""
		: `
			<section class="service-members">
				<h5>Methods</h5>
				<div class="service-member-list">
					${serviceMembers
						.map(
							(member) => `
								<div class="service-member">
									<div class="service-member-meta">
										<span class="doc-kind doc-kind-method">method</span>
										<strong>${escapeHtml(member.name)}</strong>
									</div>
									<code>${escapeHtml(member.signature)}</code>
								</div>
							`,
						)
						.join("")}
				</div>
			</section>
		`;
}

// Adds safe new-tab behavior to absolute http(s) links emitted by the markdown
// renderer while leaving internal hash links untouched.
const externalAnchorRegex = /<a\s+href="(https?:\/\/[^"]+)">/g;

const renderMarkdown = (markdown: string): string =>
	Bun.markdown
		.html(markdown, {
			headings: {
				autolink: false,
				ids: true,
			},
		})
		.replace(
			externalAnchorRegex,
			'<a href="$1" target="_blank" rel="noopener noreferrer">',
		);

const renderHero = (): string => `
	<section class="hero">
		<div class="hero-brand">
			<div class="hero-mark" aria-hidden="true">
				<span></span>
				<span></span>
				<span></span>
			</div>
			<div>
				<h1>Effect2d</h1>
			</div>
		</div>
		<p class="hero-copy">
			Inspired by
			<a href="${loveWebsiteUrl}" target="_blank" rel="noopener noreferrer">LÖVE 2D</a>
			for
			<a href="${effectDocsUrl}" target="_blank" rel="noopener noreferrer">Effect TS</a>
			developers.
		</p>
		<div class="hero-actions">
			<a href="#introduction">Read introduction</a>
			<a href="#modules">Browse modules</a>
		</div>
	</section>
`;

const renderPackageDocumentation = (
	packageDocs: PackageDocumentation,
	slugBySymbol: ReadonlyMap<string, string>,
): string =>
	packageDocs.markdown.length === 0
		? ""
		: `
			<section class="content-section intro-section" id="introduction">
				<div class="section-kicker">Overview</div>
				<div class="prose">${renderMarkdown(
					makeInlineLinks(packageDocs.markdown, slugBySymbol),
				)}</div>
			</section>
		`;

const renderModules = (
	modules: ReadonlyArray<ModuleDocGroup>,
	slugBySymbol: ReadonlyMap<string, string>,
): string =>
	modules
		.map((moduleGroup) => {
			const shouldFlattenSingleFileGroup =
				moduleGroup.fileGroups.length === 1 &&
				moduleGroup.fileGroups[0]?.fileLabel.toLowerCase() ===
					moduleGroup.label.toLowerCase();
			const filesMarkup = moduleGroup.fileGroups
				.map((fileGroup) => {
					const entriesMarkup = fileGroup.entries
						.map((entry) => {
							const resolvedMarkdown = makeInlineLinks(
								entry.markdown,
								slugBySymbol,
							);
							return `
								<article
									class="doc-entry"
									id="${entry.slug}"
								>
									<div class="doc-entry-meta">
										<span class="doc-kind doc-kind-${entry.kind}">${entry.kind}</span>
										<a class="doc-source" href="#${entry.slug}">${escapeHtml(
											`${entry.filePath}:${entry.line}`,
										)}</a>
									</div>
									<h4>${escapeHtml(entry.name)}</h4>
									<div class="prose">${renderMarkdown(resolvedMarkdown)}</div>
									${renderServiceMembers(entry.serviceMembers)}
								</article>
							`;
						})
						.join("");

					return shouldFlattenSingleFileGroup
						? `
							<div class="file-group-entries file-group-entries-flat">
								${entriesMarkup}
							</div>
						`
						: `
							<section class="file-group" id="${fileGroup.slug}">
								<header class="file-group-header">
									<p class="file-path">${escapeHtml(fileGroup.filePath)}</p>
									<h3>${escapeHtml(fileGroup.fileLabel)}</h3>
								</header>
								<div class="file-group-entries">
									${entriesMarkup}
								</div>
							</section>
						`;
				})
				.join("");

			return `
				<section class="content-section module-section" id="${moduleGroup.slug}">
					<div class="section-kicker">Module</div>
					<h2>${escapeHtml(moduleGroup.label)}</h2>
					${filesMarkup}
				</section>
			`;
		})
		.join("");

const renderSidebar = (modules: ReadonlyArray<ModuleDocGroup>): string =>
	modules
		.map((moduleGroup) => {
			const shouldFlattenSingleFileGroup =
				moduleGroup.fileGroups.length === 1 &&
				moduleGroup.fileGroups[0]?.fileLabel.toLowerCase() ===
					moduleGroup.label.toLowerCase();

			return `
					<section class="nav-group">
						<a class="nav-group-title" href="#${moduleGroup.slug}">${escapeHtml(moduleGroup.label)}</a>
						${moduleGroup.fileGroups
							.map((fileGroup) => {
								const entriesMarkup = fileGroup.entries
									.map(
										(entry) => `
											<a class="nav-entry" href="#${entry.slug}">
												<span>${escapeHtml(entry.name)}</span>
												<small class="nav-kind nav-kind-${entry.kind}">${escapeHtml(entry.kind)}</small>
											</a>
										`,
									)
									.join("");

								return shouldFlattenSingleFileGroup
									? `
										<div class="nav-file nav-file-flat">
											${entriesMarkup}
										</div>
									`
									: `
										<div class="nav-file">
											<a class="nav-file-title" href="#${fileGroup.slug}">${escapeHtml(fileGroup.fileLabel)}</a>
											${entriesMarkup}
										</div>
									`;
							})
							.join("")}
					</section>
				`;
		})
		.join("");

const renderOnThisPage = (modules: ReadonlyArray<ModuleDocGroup>): string => `
	<nav class="toc">
		<a href="#top">Top</a>
		<a href="#introduction">Overview</a>
		${modules
			.map(
				(moduleGroup) => `
					<a href="#${moduleGroup.slug}">${escapeHtml(moduleGroup.label)}</a>
				`,
			)
			.join("")}
	</nav>
`;

function makeLlmsInlineLinks(
	markdown: string,
	linkBySymbol: ReadonlyMap<string, string>,
): string {
	return (
		markdown
			// Turn inline code mentions of LÖVE/LÖVE 2D into one canonical external link.
			.replace(/`(LÖVE(?: 2D)?)`/g, (_match, label: string) => {
				return `[${label}](${loveWebsiteUrl})`;
			})
			.replace(tsDocLinkRegex, (_match, target: string, label?: string) => {
				const resolvedLabel = (label ?? target).trim();
				const href = linkBySymbol.get(target);
				return href === undefined
					? `\`${resolvedLabel}\``
					: `[${resolvedLabel}](${href})`;
			})
	);
}

function getLlmsOverviewPath(): string {
	return "./llms/overview.md";
}

function getLlmsModulePath(moduleGroup: ModuleDocGroup): string {
	return `./llms/${moduleGroup.slug}.md`;
}

function getLlmsLinkBySymbol(
	modules: ReadonlyArray<ModuleDocGroup>,
): ReadonlyMap<string, string> {
	const linkBySymbol = new Map<string, string>();

	for (const moduleGroup of modules) {
		const modulePath = getLlmsModulePath(moduleGroup);
		for (const fileGroup of moduleGroup.fileGroups) {
			for (const entry of fileGroup.entries) {
				if (!linkBySymbol.has(entry.name)) {
					linkBySymbol.set(entry.name, `${modulePath}#${entry.slug}`);
				}
			}
		}
	}

	return linkBySymbol;
}

function renderLlmsOverview(
	packageDocs: PackageDocumentation,
	linkBySymbol: ReadonlyMap<string, string>,
): string {
	return [
		"# Effect2d Overview",
		"",
		`> ${packageDocs.summary}`,
		"",
		makeLlmsInlineLinks(packageDocs.markdown, linkBySymbol),
		"",
	]
		.join("\n")
		.trimEnd();
}

function renderLlmsModuleDocument(
	moduleGroup: ModuleDocGroup,
	linkBySymbol: ReadonlyMap<string, string>,
): string {
	const sections = moduleGroup.fileGroups
		.map((fileGroup) => {
			const entries = fileGroup.entries
				.map((entry) => {
					const body = makeLlmsInlineLinks(entry.markdown, linkBySymbol);
					const methods =
						entry.serviceMembers.length === 0
							? ""
							: [
									"",
									"#### Methods",
									"",
									...entry.serviceMembers.map(
										(method) => `- \`${method.signature}\``,
									),
								].join("\n");

					return [
						`### ${entry.name}`,
						"",
						`- Kind: ${entry.kind}`,
						`- Source: \`${entry.filePath}:${entry.line}\``,
						"",
						body,
						methods,
						"",
					]
						.join("\n")
						.trimEnd();
				})
				.join("\n\n");

			return [`## ${fileGroup.fileLabel}`, "", entries].join("\n").trimEnd();
		})
		.join("\n\n");

	return [
		`# ${moduleGroup.label}`,
		"",
		`> Public ${moduleGroup.label} API.`,
		"",
		sections,
		"",
	]
		.join("\n")
		.trimEnd();
}

function renderLlmsText(
	modules: ReadonlyArray<ModuleDocGroup>,
	packageDocs: PackageDocumentation,
	llmsFullSizeBytes: number,
): string {
	const moduleSections = modules
		.map((moduleGroup) => {
			const entryCount = moduleGroup.fileGroups.reduce(
				(total, fileGroup) => total + fileGroup.entries.length,
				0,
			);
			const path = getLlmsModulePath(moduleGroup);
			return `- [${moduleGroup.label}](${path}): ${entryCount} public entries covering ${moduleGroup.label.toLowerCase()} services, functions, types, interfaces, and errors.`;
		})
		.join("\n");

	return [
		"# Effect2d",
		"",
		`> ${packageDocs.summary}`,
		"",
		"This file is a Markdown index for LLM-friendly engine docs generated from the same public JSDoc comments as the HTML API reference.",
		"Use it for progressive disclosure: start with the overview or a module file, then open `llms-full.txt` when you need the whole public surface in one context.",
		"",
		"## Core Docs",
		"",
		`- [Overview](${getLlmsOverviewPath()}): Package overview, goals, quick-start guidance, and engine fit.`,
		`- [Full Context](./llms-full.txt): One-file Markdown expansion of the full public API for direct ingestion (${Math.round(llmsFullSizeBytes / 1024)} KB).`,
		"",
		"## Modules",
		"",
		moduleSections,
	]
		.join("\n")
		.trimEnd();
}

function renderLlmsFullText(
	packageDocs: PackageDocumentation,
	modules: ReadonlyArray<ModuleDocGroup>,
	linkBySymbol: ReadonlyMap<string, string>,
): string {
	const moduleDocuments = modules
		.map((moduleGroup) => renderLlmsModuleDocument(moduleGroup, linkBySymbol))
		.join("\n\n");

	return [
		"# Effect2d Full Context",
		"",
		`> ${packageDocs.summary}`,
		"",
		"This file expands the package overview and every generated module markdown file into one Markdown context.",
		"",
		renderLlmsOverview(packageDocs, linkBySymbol),
		"",
		moduleDocuments,
		"",
	]
		.join("\n")
		.trimEnd();
}

const renderHtmlDocument = ({
	modules,
	packageDocs,
	slugBySymbol,
}: {
	readonly modules: ReadonlyArray<ModuleDocGroup>;
	readonly packageDocs: PackageDocumentation;
	readonly slugBySymbol: ReadonlyMap<string, string>;
}): string => `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Effect2d User Guide</title>
		<meta name="description" content="${escapeHtml(packageDocs.summary)}" />
		<style>
			:root {
				--bg: #0a0b10;
				--bg-elevated: rgba(18, 20, 30, 0.88);
				--bg-soft: rgba(255, 255, 255, 0.03);
				--border: rgba(255, 255, 255, 0.08);
				--border-strong: rgba(255, 255, 255, 0.14);
				--text: #f3efe4;
				--muted: #b8b3a7;
				--accent: #9ae6b4;
				--accent-strong: #d4ff72;
				--accent-warm: #f8bf72;
				--header-height: 64px;
				--shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
				--hero-glow:
					radial-gradient(circle at 20% 20%, rgba(154, 230, 180, 0.14), transparent 34%),
					radial-gradient(circle at 80% 0%, rgba(248, 191, 114, 0.12), transparent 28%),
					radial-gradient(circle at 50% 100%, rgba(76, 201, 240, 0.08), transparent 32%);
				color-scheme: dark;
				font-family:
					"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino,
					"URW Palladio L", Georgia, serif;
			}

			* {
				box-sizing: border-box;
			}

			::selection {
				background: rgba(163, 127, 255, 0.38);
				color: #fff7ed;
			}

			.main [id] {
				scroll-margin-top: calc(var(--header-height) + 16px);
			}

			body {
				margin: 0;
				background:
					linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 24%),
					var(--hero-glow),
					var(--bg);
				color: var(--text);
			}

			body::before {
				content: "";
				position: fixed;
				inset: 0;
				pointer-events: none;
				background-image:
					linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
					linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
				background-size: 32px 32px;
				mask-image: radial-gradient(circle at center, black 38%, transparent 95%);
				opacity: 0.25;
			}

			a {
				color: inherit;
				text-decoration: none;
			}

			code,
			pre,
			input {
				font-family:
					"Berkeley Mono", "SFMono-Regular", Consolas, "Liberation Mono",
					Menlo, monospace;
			}

			.app-shell {
				min-height: 100vh;
			}

			.topbar {
				position: sticky;
				top: 0;
				z-index: 40;
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 1rem;
				padding: 1rem 1.5rem;
				border-bottom: 1px solid var(--border);
				background: rgba(7, 9, 14, 0.82);
				backdrop-filter: blur(22px);
			}

			.brand {
				display: inline-flex;
				align-items: center;
				gap: 0.9rem;
				font-size: 1.35rem;
				font-weight: 700;
				letter-spacing: 0.02em;
			}

			.topbar-links {
				display: flex;
				align-items: center;
				justify-content: flex-end;
				gap: 0.85rem;
				flex-wrap: wrap;
			}

			.topbar-link {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-height: 2.45rem;
				padding: 0.58rem 0.98rem;
				border: 1px solid rgba(255, 255, 255, 0.1);
				border-radius: 999px;
				background:
					linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
					rgba(255, 255, 255, 0.02);
				box-shadow:
					inset 0 1px 0 rgba(255, 255, 255, 0.08),
					0 14px 28px rgba(0, 0, 0, 0.22);
				color: rgba(243, 239, 228, 0.94);
				font-family:
					"Berkeley Mono", "SFMono-Regular", Consolas, "Liberation Mono",
					Menlo, monospace;
				font-size: 0.78rem;
				font-weight: 700;
				letter-spacing: 0.12em;
				text-transform: uppercase;
				transition:
					transform 160ms ease,
					border-color 160ms ease,
					background 160ms ease,
					color 160ms ease,
					box-shadow 160ms ease;
			}

			.topbar-link:hover,
			.topbar-link:focus-visible {
				border-color: rgba(212, 255, 114, 0.45);
				background:
					linear-gradient(135deg, rgba(212, 255, 114, 0.18), rgba(154, 230, 180, 0.08)),
					rgba(255, 255, 255, 0.04);
				color: var(--accent-strong);
				transform: translateY(-1px);
				box-shadow:
					inset 0 1px 0 rgba(255, 255, 255, 0.12),
					0 18px 30px rgba(0, 0, 0, 0.28);
			}

			.brand-mark,
			.hero-mark {
				position: relative;
				display: inline-grid;
				gap: 0.18rem;
			}

			.brand-mark span,
			.hero-mark span {
				display: block;
				width: 1.35rem;
				height: 0.42rem;
				border: 1px solid rgba(255, 255, 255, 0.14);
				background: linear-gradient(135deg, var(--accent-strong), var(--accent));
				clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
				filter: drop-shadow(0 0 10px rgba(154, 230, 180, 0.24));
			}

			.layout {
				display: grid;
				grid-template-columns: 300px minmax(0, 1fr) 240px;
				gap: 0;
			}

			.sidebar,
			.aside {
				position: sticky;
				top: var(--header-height);
				max-height: calc(100vh - var(--header-height));
				overflow: auto;
				padding: 1.5rem 1.1rem 2rem;
				border-right: 1px solid var(--border);
				background: linear-gradient(180deg, rgba(255, 255, 255, 0.015), transparent);
			}

			.aside {
				border-right: 0;
				border-left: 1px solid var(--border);
			}

			.sidebar-inner,
			.aside-inner {
				padding-top: 0;
			}

			.sidebar-label,
			.aside-label,
			.section-kicker,
			.eyebrow,
			.file-path,
			.doc-kind {
				font-family:
					"Berkeley Mono", "SFMono-Regular", Consolas, "Liberation Mono",
					Menlo, monospace;
				letter-spacing: 0.12em;
				text-transform: uppercase;
			}

			.sidebar-label,
			.aside-label {
				margin: 0 0 1rem;
				color: var(--muted);
				font-size: 0.74rem;
			}

			.nav-group + .nav-group {
				margin-top: 1.5rem;
				padding-top: 1.5rem;
				border-top: 1px solid var(--border);
			}

			.nav-group-title {
				display: block;
				margin-bottom: 0.8rem;
				font-size: 1.05rem;
				font-weight: 700;
			}

			.nav-file + .nav-file {
				margin-top: 0.9rem;
			}

			.nav-file-title {
				display: block;
				margin-bottom: 0.45rem;
				color: var(--muted);
				font-size: 0.92rem;
			}

			.nav-entry {
				display: grid;
				grid-template-columns: minmax(0, 1fr) auto;
				align-items: start;
				justify-content: space-between;
				gap: 0.75rem;
				padding: 0.38rem 0.5rem;
				border-radius: 10px;
				color: rgba(243, 239, 228, 0.92);
				transition:
					background 150ms ease,
					transform 150ms ease,
					color 150ms ease;
			}

			.nav-entry:hover,
			.nav-entry:focus-visible {
				background: rgba(255, 255, 255, 0.05);
				color: var(--accent-strong);
				transform: translateX(3px);
			}

			.nav-entry small {
				align-self: start;
				padding-top: 0.08rem;
				color: var(--muted);
				font-size: 0.72rem;
			}

			.nav-entry .nav-kind-class {
				color: #ffd08f;
			}

			.nav-entry .nav-kind-const {
				color: #9fd8ff;
			}

			.nav-entry .nav-kind-error {
				color: #ff8a8a;
			}

			.nav-entry .nav-kind-function {
				color: #ffb3d6;
			}

			.nav-entry .nav-kind-interface {
				color: #c7ff9e;
			}

			.nav-entry .nav-kind-service {
				color: #ffd08f;
			}

			.nav-entry .nav-kind-type {
				color: #d7c2ff;
			}

			.nav-entry span,
			.nav-file-title,
			.nav-group-title {
				min-width: 0;
				overflow-wrap: anywhere;
				word-break: break-word;
			}

			.main {
				padding: 1.8rem 2rem 5rem;
			}

			.hero {
				position: relative;
				padding: 2.5rem 2.2rem 2.4rem;
				border: 1px solid var(--border-strong);
				background:
					linear-gradient(135deg, rgba(154, 230, 180, 0.08), rgba(248, 191, 114, 0.05) 38%, rgba(255, 255, 255, 0.02)),
					rgba(255, 255, 255, 0.02);
				box-shadow: var(--shadow);
				overflow: hidden;
				animation: hero-enter 700ms cubic-bezier(0.2, 1, 0.2, 1);
			}

			.hero::after {
				content: "";
				position: absolute;
				inset: auto -10% -35% 35%;
				height: 260px;
				background: radial-gradient(circle, rgba(212, 255, 114, 0.12), transparent 62%);
				transform: rotate(-6deg);
			}

			.hero-brand {
				position: relative;
				z-index: 1;
				display: flex;
				align-items: center;
				gap: 1rem;
			}

			.hero-mark span {
				width: 2rem;
				height: 0.62rem;
			}

			.eyebrow {
				margin: 0 0 0.35rem;
				color: var(--accent);
				font-size: 0.75rem;
			}

			.hero h1 {
				margin: 0;
				font-size: clamp(2.9rem, 8vw, 5.8rem);
				line-height: 0.95;
				letter-spacing: -0.04em;
			}

			.hero-copy {
				position: relative;
				z-index: 1;
				max-width: 44rem;
				margin: 1.25rem 0 0;
				color: rgba(243, 239, 228, 0.88);
				font-size: 1.14rem;
				line-height: 1.7;
			}

			.hero-copy a,
			.prose a,
			.doc-source {
				color: var(--accent);
				text-decoration: underline;
				text-decoration-color: rgba(154, 230, 180, 0.55);
				text-decoration-thickness: 0.09em;
				text-underline-offset: 0.16em;
			}

			.hero-copy a:hover,
			.hero-copy a:focus-visible,
			.prose a:hover,
			.prose a:focus-visible,
			.doc-source:hover,
			.doc-source:focus-visible {
				color: var(--accent-strong);
				text-decoration-color: rgba(212, 255, 114, 0.55);
			}

			.hero-actions {
				position: relative;
				z-index: 1;
				display: flex;
				flex-wrap: wrap;
				gap: 0.8rem;
				margin-top: 1.4rem;
			}

			.hero-actions a {
				padding: 0.75rem 1rem;
				border: 1px solid var(--border);
				background: rgba(255, 255, 255, 0.03);
				font-size: 0.95rem;
				transition:
					transform 160ms ease,
					border-color 160ms ease,
					background 160ms ease;
			}

			.hero-actions a:hover,
			.hero-actions a:focus-visible {
				transform: translateY(-2px);
				border-color: rgba(154, 230, 180, 0.36);
				background: rgba(154, 230, 180, 0.06);
			}

			.content-section {
				margin-top: 2rem;
				padding-top: 2rem;
				border-top: 1px solid var(--border);
			}

			.section-kicker {
				margin: 0 0 0.7rem;
				color: var(--accent-warm);
				font-size: 0.72rem;
			}

			.intro-section .prose > :first-child {
				margin-top: 0;
			}

			.module-section > h2 {
				margin: 0 0 1.2rem;
				font-size: clamp(2rem, 4.2vw, 3rem);
				letter-spacing: -0.03em;
			}

			.file-group + .file-group {
				margin-top: 2rem;
				padding-top: 2rem;
				border-top: 1px solid var(--border);
			}

			.file-group-header h3 {
				margin: 0.2rem 0 0;
				font-size: 1.45rem;
			}

			.file-path {
				margin: 0;
				color: var(--muted);
				font-size: 0.72rem;
			}

			.file-group-entries {
				display: grid;
				gap: 1rem;
				margin-top: 1rem;
			}

			.doc-entry {
				padding: 1rem 1.05rem 1.1rem;
				border: 1px solid var(--border);
				background: var(--bg-soft);
				opacity: 0;
				transform: translateY(16px);
				animation: section-enter 500ms cubic-bezier(0.2, 1, 0.2, 1) forwards;
			}

			.doc-entry-meta {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				justify-content: space-between;
				gap: 0.75rem;
			}

			.doc-kind {
				display: inline-flex;
				padding: 0.28rem 0.46rem;
				font-size: 0.68rem;
				border: 1px solid rgba(154, 230, 180, 0.24);
				background: rgba(154, 230, 180, 0.07);
				color: var(--accent-strong);
			}

			.doc-kind-class {
				border-color: rgba(248, 191, 114, 0.32);
				background: rgba(248, 191, 114, 0.08);
				color: #ffd08f;
			}

			.doc-kind-const {
				border-color: rgba(120, 197, 255, 0.3);
				background: rgba(120, 197, 255, 0.08);
				color: #9fd8ff;
			}

			.doc-kind-error {
				border-color: rgba(255, 138, 138, 0.34);
				background: rgba(255, 138, 138, 0.08);
				color: #ffb1b1;
			}

			.doc-kind-function {
				border-color: rgba(255, 154, 201, 0.3);
				background: rgba(255, 154, 201, 0.08);
				color: #ffb3d6;
			}

			.doc-kind-interface {
				border-color: rgba(154, 230, 180, 0.28);
				background: rgba(154, 230, 180, 0.07);
				color: #c7ff9e;
			}

			.doc-kind-service {
				border-color: rgba(248, 191, 114, 0.32);
				background: rgba(248, 191, 114, 0.08);
				color: #ffd08f;
			}

			.doc-kind-type {
				border-color: rgba(196, 167, 255, 0.3);
				background: rgba(196, 167, 255, 0.08);
				color: #d7c2ff;
			}

			.doc-kind-method {
				border-color: rgba(248, 191, 114, 0.32);
				background: rgba(248, 191, 114, 0.08);
				color: #ffd08f;
			}

			.doc-source {
				font-size: 0.84rem;
			}

			.doc-entry h4 {
				margin: 0.8rem 0 0.7rem;
				font-size: 1.45rem;
				letter-spacing: -0.02em;
			}

			.prose {
				color: rgba(243, 239, 228, 0.88);
				line-height: 1.72;
				font-size: 1rem;
			}

			.service-members {
				margin-top: 1rem;
				padding-top: 1rem;
				border-top: 1px solid rgba(255, 255, 255, 0.08);
			}

			.service-members h5 {
				margin: 0 0 0.8rem;
				font-size: 0.94rem;
				letter-spacing: 0.12em;
				text-transform: uppercase;
				color: var(--muted);
			}

			.service-member-list {
				display: grid;
				gap: 0.7rem;
			}

			.service-member {
				padding: 0.9rem 0.95rem;
				border: 1px solid rgba(255, 255, 255, 0.08);
				background: rgba(255, 255, 255, 0.025);
			}

			.service-member-meta {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.65rem;
				margin-bottom: 0.55rem;
			}

			.service-member code {
				display: block;
				padding: 0.75rem 0.8rem;
				overflow-x: auto;
				border: 1px solid rgba(255, 255, 255, 0.08);
				background: rgba(7, 14, 10, 0.72);
				color: #f7f4ea;
				font-size: 0.86rem;
				line-height: 1.55;
			}

			.prose h1,
			.prose h2,
			.prose h3,
			.prose h4 {
				margin: 1.6em 0 0.65em;
				letter-spacing: -0.03em;
				line-height: 1.1;
			}

			.prose h1 {
				font-size: 2.2rem;
			}

			.prose h2 {
				font-size: 1.7rem;
			}

			.prose h3 {
				font-size: 1.35rem;
			}

			.prose p,
			.prose ul,
			.prose ol,
			.prose pre,
			.prose table,
			.prose blockquote {
				margin: 0 0 1rem;
			}

			.prose ul,
			.prose ol {
				padding-left: 1.25rem;
			}

			.prose li + li {
				margin-top: 0.42rem;
			}

			.prose code {
				padding: 0.1rem 0.32rem;
				border: 1px solid rgba(255, 255, 255, 0.08);
				background: rgba(255, 255, 255, 0.04);
				border-radius: 6px;
				font-size: 0.92em;
			}

			.prose pre {
				overflow: auto;
				padding: 0.95rem 1rem;
				border: 1px solid var(--border);
				background:
					linear-gradient(180deg, rgba(154, 230, 180, 0.04), rgba(154, 230, 180, 0.015)),
					rgba(7, 9, 14, 0.78);
			}

			.prose pre code {
				padding: 0;
				border: 0;
				background: transparent;
			}

			.prose table {
				width: 100%;
				border-collapse: collapse;
			}

			.prose th,
			.prose td {
				padding: 0.7rem;
				border-bottom: 1px solid var(--border);
				text-align: left;
			}

			.toc {
				display: grid;
				gap: 0.55rem;
			}

			.toc a {
				color: var(--muted);
				transition:
					color 150ms ease,
					transform 150ms ease;
			}

			.toc a:hover,
			.toc a:focus-visible {
				color: var(--accent-strong);
				transform: translateX(2px);
			}

			@keyframes hero-enter {
				from {
					opacity: 0;
					transform: translateY(18px) scale(0.985);
				}
				to {
					opacity: 1;
					transform: translateY(0) scale(1);
				}
			}

			@keyframes section-enter {
				to {
					opacity: 1;
					transform: translateY(0);
				}
			}

			@media (max-width: 1180px) {
				.layout {
					grid-template-columns: 280px minmax(0, 1fr);
				}

				.aside {
					display: none;
				}
			}

			@media (max-width: 920px) {
				.topbar {
					flex-wrap: wrap;
				}

				.topbar-links {
					width: 100%;
					justify-content: flex-start;
				}

				.layout {
					grid-template-columns: 1fr;
				}

				.sidebar,
				.aside {
					position: static;
					height: auto;
					border: 0;
				}

				.sidebar {
					padding-bottom: 0;
				}

				.main {
					padding-top: 1rem;
				}
			}

			@media (prefers-reduced-motion: reduce) {
				html {
					scroll-behavior: auto;
				}

				*,
				*::before,
				*::after {
					animation: none;
					transition: none;
				}
			}
		</style>
	</head>
	<body>
		<div class="app-shell" id="top">
			<header class="topbar">
				<a class="brand" href="#top">
					<div class="brand-mark" aria-hidden="true">
						<span></span>
						<span></span>
						<span></span>
					</div>
					<span>Effect2d Docs</span>
				</a>
				<nav class="topbar-links" aria-label="Primary">
					<a class="topbar-link" href="#where-this-engine-shines">Ideas</a>
					<a class="topbar-link" href="#quick-start">Quick Start</a>
				</nav>
			</header>
			<div class="layout">
				<aside class="sidebar">
					<div class="sidebar-inner">
						<p class="sidebar-label">Navigation</p>
						<nav id="sidebar-nav">
							<a class="nav-group-title" href="#introduction">Overview</a>
							${renderSidebar(modules)}
						</nav>
					</div>
				</aside>
				<main class="main">
					${renderHero()}
					${renderPackageDocumentation(packageDocs, slugBySymbol)}
					<section class="content-section" id="modules">
						<div class="section-kicker">Reference</div>
						<h2 style="margin: 0; font-size: clamp(2.1rem, 4.4vw, 3.1rem); letter-spacing: -0.03em;">Modules</h2>
						<div style="margin-top: 1.25rem;">
							${renderModules(modules, slugBySymbol)}
						</div>
					</section>
				</main>
				<aside class="aside">
					<div class="aside-inner">
						<p class="aside-label">On this page</p>
						${renderOnThisPage(modules)}
					</div>
				</aside>
			</div>
		</div>
		<script>
			if ("scrollRestoration" in history && location.hash.length === 0) {
				history.scrollRestoration = "manual";
			}

			const resetScrollToTop = () => {
				if (location.hash.length === 0) {
					window.scrollTo(0, 0);
				}
			};

			const scrollToHashTarget = () => {
				if (location.hash.length === 0) {
					return;
				}

				const target = document.getElementById(location.hash.slice(1));
				if (!(target instanceof HTMLElement)) {
					return;
				}

				target.scrollIntoView({
					block: "start",
				});
			};

			window.addEventListener("pageshow", resetScrollToTop);
			window.addEventListener("load", () => {
				requestAnimationFrame(() => {
					resetScrollToTop();
					scrollToHashTarget();
				});
			});
		</script>
	</body>
</html>
`;

const main = Effect.gen(function* () {
	const rootEntrypointSource = yield* readText(rootEntrypointPath);
	const packageDocs = extractPackageDocumentation(rootEntrypointSource);
	const publicModules = yield* collectPublicModules(rootEntrypointSource);
	const sourceFileGlob = new Glob("src/**/*.ts");
	const availableSourceFiles = new Set(
		yield* Effect.tryPromise({
			try: async () =>
				Array.fromAsync(sourceFileGlob.scan({ cwd: ".", onlyFiles: true })),
			catch: (cause) =>
				new DocSiteScanError({
					cause,
					pattern: "src/**/*.ts",
				}),
		}),
	);

	const modules = yield* Effect.forEach(publicModules, (moduleSpec) =>
		Effect.gen(function* () {
			const publicFiles = moduleSpec.files.filter((filePath) =>
				availableSourceFiles.has(filePath),
			);
			const fileGroups = yield* Effect.forEach(publicFiles, (filePath) =>
				Effect.gen(function* () {
					const source = yield* readText(filePath);
					const entries = extractPublicEntries(
						filePath,
						source,
						slugify(moduleSpec.moduleId),
					);
					if (entries.length === 0) {
						return null;
					}

					return {
						entries,
						fileLabel:
							// Show a clean nav label without the TypeScript file suffix.
							filePath.split("/").at(-1)?.replace(/\.ts$/, "") ?? filePath,
						filePath,
						slug: `${slugify(moduleSpec.moduleId)}-${slugify(
							filePath.split("/").at(-1) ?? filePath,
						)}`,
					} satisfies FileDocGroup;
				}),
			).pipe(
				Effect.map((groups) =>
					groups.filter((group): group is FileDocGroup => group !== null),
				),
			);

			return {
				fileGroups,
				label: moduleSpec.label,
				moduleId: moduleSpec.moduleId,
				slug: slugify(moduleSpec.moduleId),
			} satisfies ModuleDocGroup;
		}),
	).pipe(
		Effect.map((groups) =>
			groups.filter((group) => group.fileGroups.length > 0),
		),
	);

	const slugBySymbol = new Map<string, string>();
	for (const moduleGroup of modules) {
		for (const fileGroup of moduleGroup.fileGroups) {
			for (const entry of fileGroup.entries) {
				if (!slugBySymbol.has(entry.name)) {
					slugBySymbol.set(entry.name, entry.slug);
				}
			}
		}
	}

	const html = renderHtmlDocument({
		modules,
		packageDocs,
		slugBySymbol,
	});
	const llmsLinkBySymbol = getLlmsLinkBySymbol(modules);
	const llmsOverview = renderLlmsOverview(packageDocs, llmsLinkBySymbol);
	const llmsFullText = renderLlmsFullText(
		packageDocs,
		modules,
		llmsLinkBySymbol,
	);
	const llmsText = renderLlmsText(
		modules,
		packageDocs,
		Buffer.byteLength(llmsFullText, "utf8"),
	);

	yield* writeText(docsOutputPath, html);
	yield* writeText(`${llmsDirectoryPath}/overview.md`, llmsOverview);
	yield* writeText(llmsOutputPath, llmsText);
	yield* writeText(llmsFullOutputPath, llmsFullText);
	for (const moduleGroup of modules) {
		yield* writeText(
			`${llmsDirectoryPath}/${moduleGroup.slug}.md`,
			renderLlmsModuleDocument(moduleGroup, llmsLinkBySymbol),
		);
	}
	yield* Console.log(
		`Built public docs site with ${modules.reduce(
			(total, moduleGroup) =>
				total +
				moduleGroup.fileGroups.reduce(
					(fileTotal, fileGroup) => fileTotal + fileGroup.entries.length,
					0,
				),
			0,
		)} entries at ${docsOutputPath}, ${llmsOutputPath}, and ${llmsFullOutputPath}`,
	);
});

Effect.runPromise(main);
