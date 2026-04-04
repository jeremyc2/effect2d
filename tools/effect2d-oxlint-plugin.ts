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

function isBuiltinErrorReference(node: ESTree.Expression): boolean {
	if (node.type === "Identifier") {
		return node.name === "Error";
	}
	if (node.type !== "MemberExpression" || node.computed) {
		return false;
	}
	if (
		node.object.type !== "Identifier" ||
		node.property.type !== "Identifier"
	) {
		return false;
	}
	return (
		(node.object.name === "globalThis" ||
			node.object.name === "window" ||
			node.object.name === "self" ||
			node.object.name === "global") &&
		node.property.name === "Error"
	);
}

function isBuiltinPromiseReference(node: ESTree.Expression): boolean {
	if (node.type === "Identifier") {
		return node.name === "Promise";
	}
	if (node.type !== "MemberExpression" || node.computed) {
		return false;
	}
	if (
		node.object.type !== "Identifier" ||
		node.property.type !== "Identifier"
	) {
		return false;
	}
	return (
		(node.object.name === "globalThis" ||
			node.object.name === "window" ||
			node.object.name === "self" ||
			node.object.name === "global") &&
		node.property.name === "Promise"
	);
}

function unwrapExpression(node: ESTree.Expression): ESTree.Expression {
	if (node.type === "ChainExpression") {
		return unwrapExpression(node.expression);
	}
	if (
		node.type === "TSInstantiationExpression" &&
		"expression" in node &&
		node.expression !== undefined
	) {
		return unwrapExpression(node.expression);
	}
	return node;
}

function usesBuiltinPromise(node: ESTree.Expression): boolean {
	const unwrapped = unwrapExpression(node);
	if (isBuiltinPromiseReference(unwrapped)) {
		return true;
	}
	if (unwrapped.type !== "MemberExpression" || unwrapped.computed) {
		return false;
	}
	return isBuiltinPromiseReference(unwrapExpression(unwrapped.object));
}

function isDataTaggedErrorExpression(node: ESTree.Expression): boolean {
	if (node.type !== "MemberExpression" || node.computed) {
		return false;
	}
	if (node.object.type !== "Identifier" || node.object.name !== "Data") {
		return false;
	}
	return (
		node.property.type === "Identifier" && node.property.name === "TaggedError"
	);
}

function getCalledMemberName(
	node: ESTree.CallExpression,
): "catch" | "finally" | undefined {
	const callee =
		node.callee.type === "ChainExpression"
			? node.callee.expression
			: node.callee;
	if (callee.type !== "MemberExpression" || callee.computed) {
		return undefined;
	}
	if (callee.property.type !== "Identifier") {
		return undefined;
	}
	switch (callee.property.name) {
		case "catch":
		case "finally":
			return callee.property.name;
		default:
			return undefined;
	}
}

function isEffectCatchCall(node: ESTree.CallExpression): boolean {
	const callee =
		node.callee.type === "ChainExpression"
			? node.callee.expression
			: node.callee;
	if (callee.type !== "MemberExpression" || callee.computed) {
		return false;
	}
	if (
		callee.object.type !== "Identifier" ||
		callee.object.name !== "Effect" ||
		callee.property.type !== "Identifier"
	) {
		return false;
	}
	return callee.property.name === "catch";
}

function isTagPropertyAccess(node: ESTree.MemberExpression): boolean {
	if (node.computed) {
		return node.property.type === "Literal" && node.property.value === "_tag";
	}
	return node.property.type === "Identifier" && node.property.name === "_tag";
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
			CallExpression(node: ESTree.CallExpression) {
				if (isEffectCatchCall(node)) {
					return;
				}
				if (getCalledMemberName(node) !== undefined) {
					context.report({ node, messageId: "noTry" });
				}
			},
		};
	},
});

const noErrorClass = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow the built-in JavaScript `Error` class; use Effect-native errors instead.",
		},
		schema: [],
		messages: {
			noErrorClass:
				"Do not use the built-in `Error` class. Use an Effect-native error type such as `Schema.TaggedErrorClass` instead.",
		},
	},
	create(context: Context) {
		return {
			NewExpression(node: ESTree.NewExpression) {
				if (isBuiltinErrorReference(node.callee)) {
					context.report({ node, messageId: "noErrorClass" });
				}
			},
			CallExpression(node: ESTree.CallExpression) {
				if (isBuiltinErrorReference(node.callee)) {
					context.report({ node, messageId: "noErrorClass" });
				}
			},
			ClassDeclaration(node) {
				if (
					node.superClass !== null &&
					isBuiltinErrorReference(node.superClass)
				) {
					context.report({ node, messageId: "noErrorClass" });
				}
			},
			ClassExpression(node) {
				if (
					node.superClass !== null &&
					isBuiltinErrorReference(node.superClass)
				) {
					context.report({ node, messageId: "noErrorClass" });
				}
			},
		};
	},
});

const noPromiseGlobal = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow the built-in JavaScript `Promise` global; use Effect APIs instead.",
		},
		schema: [],
		messages: {
			noPromiseGlobal:
				"Do not use the built-in `Promise` global. Use `Effect.promise`, `Effect.tryPromise`, or Effect-native APIs instead.",
		},
	},
	create(context: Context) {
		return {
			NewExpression(node: ESTree.NewExpression) {
				if (usesBuiltinPromise(node.callee)) {
					context.report({ node, messageId: "noPromiseGlobal" });
				}
			},
			CallExpression(node: ESTree.CallExpression) {
				if (usesBuiltinPromise(node.callee)) {
					context.report({ node, messageId: "noPromiseGlobal" });
				}
			},
			MemberExpression(node: ESTree.MemberExpression) {
				if (usesBuiltinPromise(node)) {
					context.report({ node, messageId: "noPromiseGlobal" });
				}
			},
		};
	},
});

const preferSchemaTaggedErrorClass = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Prefer `Schema.TaggedErrorClass` over `Data.TaggedError` for custom Effect errors.",
		},
		schema: [],
		messages: {
			preferSchemaTaggedErrorClass:
				"Prefer `Schema.TaggedErrorClass` instead of `Data.TaggedError` for custom Effect errors.",
		},
	},
	create(context: Context) {
		return {
			MemberExpression(node: ESTree.MemberExpression) {
				if (isDataTaggedErrorExpression(node)) {
					context.report({
						node,
						messageId: "preferSchemaTaggedErrorClass",
					});
				}
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

const noTagPropertyAccess = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow direct `_tag` property reads; prefer exported predicates, matchers, or helper APIs.",
		},
		schema: [],
		messages: {
			noTagPropertyAccess:
				"Do not read `._tag` directly. Prefer predicates, matchers, or helper APIs such as `isFailure`, `isSuccess`, `Exit.isFailure`, or `Option.match`.",
		},
	},
	create(context: Context) {
		return {
			MemberExpression(node: ESTree.MemberExpression) {
				if (isTagPropertyAccess(node)) {
					context.report({ node, messageId: "noTagPropertyAccess" });
				}
			},
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
		"no-error-class": noErrorClass,
		"no-promise-global": noPromiseGlobal,
		"no-tag-property-access": noTagPropertyAccess,
		"prefer-schema-tagged-error-class": preferSchemaTaggedErrorClass,
		"prefer-effect-fn-for-effect-gen": preferEffectFnForEffectGen,
	},
});
