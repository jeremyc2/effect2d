/**
 * Oxlint JS plugin enforcing Effect2d conventions.
 * Paired with Biome: keep `.oxlintrc.json` on `plugins: []` and all categories off
 * so only rules from this file run.
 *
 * @see https://oxc.rs/docs/guide/usage/linter/writing-js-plugins.html
 */

import {
	type Context,
	definePlugin,
	defineRule,
	type ESTree,
} from "@oxlint/plugins";

function isEffectGenCall(node: ESTree.CallExpression): boolean {
	const { callee } = node;
	// A member expression is an expression that accesses a property of an object.
	// A computed property is a property that is accessed using a square bracket notation.
	if (callee.type !== "MemberExpression" || callee.computed) {
		return false;
	}
	if (callee.object.type !== "Identifier" || callee.object.name !== "Effect") {
		return false;
	}
	return (
		callee.property.type === "Identifier" && callee.property.name === "gen"
	);
}

function isSingleReturnEffectGenBlock(body: ESTree.BlockStatement): boolean {
	if (body.body.length !== 1) {
		return false;
	}
	const only = body.body[0];
	if (only === undefined || only.type !== "ReturnStatement") {
		return false;
	}
	const { argument } = only;
	if (argument === null) {
		return false;
	}
	return argument.type === "CallExpression" && isEffectGenCall(argument);
}

function isAsConstAssertion(node: ESTree.TSAsExpression): boolean {
	const t = node.typeAnnotation;
	if (t.type !== "TSTypeReference") {
		return false;
	}
	const { typeName } = t;
	if (typeName.type !== "Identifier") {
		return false;
	}
	return typeName.name === "const";
}

function shouldSkipFunctionShape(
	node: ESTree.Function | ESTree.ArrowFunctionExpression,
): boolean {
	if (node.async === true) {
		return true;
	}
	if (node.type === "ArrowFunctionExpression") {
		return false;
	}
	return node.generator === true;
}

/**
 * Skip patterns like `Effect.forEach(x, (y) => Effect.gen(...))` — the wrapper is
 * required by the API. Targets *declared* helpers (`const f = () => ...`,
 * `function f() { return Effect.gen ... }`), not inline callbacks.
 *
 * `SourceCode#getAncestors` is typed with a loose `Node` shape (see `@oxlint/plugins`),
 * so we narrow with runtime checks instead of assertions.
 */
function isValueArgumentToCallOrNew(
	node: ESTree.Node,
	context: Context,
): boolean {
	const ancestors = context.sourceCode.getAncestors(node);
	const parent = ancestors[ancestors.length - 1];
	if (parent === undefined) {
		return false;
	}
	if (
		!("type" in parent) ||
		(parent.type !== "CallExpression" && parent.type !== "NewExpression")
	) {
		return false;
	}
	const args =
		"arguments" in parent && Array.isArray(parent.arguments)
			? parent.arguments
			: undefined;
	if (args === undefined) {
		return false;
	}
	return args.some((arg) => arg === node);
}

const noTypeAssertionExceptConst = defineRule({
	meta: {
		type: "problem",
		docs: {
			description: "Disallow TypeScript `as` assertions except `as const`.",
		},
		schema: [],
		messages: {
			noAssertion:
				"Avoid type assertions (`as`); use narrowing, checks, or schema parse. `as const` is allowed.",
		},
	},
	create(context: Context) {
		return {
			TSAsExpression(node: ESTree.TSAsExpression) {
				if (isAsConstAssertion(node)) {
					return;
				}
				context.report({
					node,
					messageId: "noAssertion",
				});
			},
			TSTypeAssertion(node: ESTree.TSTypeAssertion) {
				context.report({
					node,
					messageId: "noAssertion",
				});
			},
		};
	},
});

const noThrow = defineRule({
	meta: {
		type: "problem",
		docs: {
			description: "Disallow `throw`; use Effect errors and Effect.fail.",
		},
		schema: [],
		messages: {
			noThrow:
				"Do not use `throw`; use Effect errors, `Effect.fail`, `Effect.try*`, `Effect.catch*`.",
		},
	},
	create(context: Context) {
		return {
			ThrowStatement(node: ESTree.ThrowStatement) {
				context.report({ node, messageId: "noThrow" });
			},
		};
	},
});

const noTryCatch = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow `try` / `catch` / `finally`; use Effect error channels.",
		},
		schema: [],
		messages: {
			noTry:
				"Do not use `try` / `catch` / `finally`; use Effect errors and `Effect.try*`, `Effect.catch*`.",
		},
	},
	create(context: Context) {
		return {
			TryStatement(node: ESTree.TryStatement) {
				context.report({ node, messageId: "noTry" });
			},
		};
	},
});

const preferEffectFnForEffectGen = defineRule({
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Prefer `Effect.fn` / `Effect.fnUntraced` over a function or arrow that only returns `Effect.gen(...)`.",
		},
		schema: [],
		messages: {
			preferFn:
				"Prefer `const name = Effect.fn(function* () { ... })` or `Effect.fnUntraced(...)` instead of wrapping `Effect.gen(...)` in a plain function or arrow.",
		},
	},
	create(context: Context) {
		function reportIfBadFunctionBody(node: ESTree.Function) {
			if (
				node.type !== "FunctionDeclaration" &&
				node.type !== "FunctionExpression"
			) {
				return;
			}
			if (shouldSkipFunctionShape(node)) {
				return;
			}
			if (isValueArgumentToCallOrNew(node, context)) {
				return;
			}
			const { body } = node;
			if (body === null || body.type !== "BlockStatement") {
				return;
			}
			if (isSingleReturnEffectGenBlock(body)) {
				context.report({ node, messageId: "preferFn" });
			}
		}

		function reportIfBadArrow(node: ESTree.ArrowFunctionExpression) {
			if (shouldSkipFunctionShape(node)) {
				return;
			}
			if (isValueArgumentToCallOrNew(node, context)) {
				return;
			}
			if (node.body.type === "BlockStatement") {
				if (isSingleReturnEffectGenBlock(node.body)) {
					context.report({ node, messageId: "preferFn" });
				}
				return;
			}
			if (node.body.type === "CallExpression" && isEffectGenCall(node.body)) {
				context.report({ node, messageId: "preferFn" });
			}
		}

		return {
			FunctionDeclaration: reportIfBadFunctionBody,
			FunctionExpression: reportIfBadFunctionBody,
			ArrowFunctionExpression: reportIfBadArrow,
		};
	},
});

export default definePlugin({
	meta: {
		name: "effect2d",
	},
	rules: {
		"no-type-assertion-except-const": noTypeAssertionExceptConst,
		"no-throw": noThrow,
		"no-try-catch": noTryCatch,
		"prefer-effect-fn-for-effect-gen": preferEffectFnForEffectGen,
	},
});
