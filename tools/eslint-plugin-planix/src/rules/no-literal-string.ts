import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

type MessageIds = 'jsxText' | 'jsxAttribute';

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/hoanghainh1188/planix-v2/blob/main/tools/eslint-plugin-planix/src/rules/${name}.ts`,
);

/** Attributes whose value is read by people (or screen readers) and therefore must be translated. */
const DISPLAY_ATTRIBUTES = new Set([
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'title',
  'placeholder',
  'alt',
  'label',
]);

/** Text that contains at least one letter in any script; symbols, digits and whitespace alone are fine. */
const hasLetter = (text: string): boolean => /\p{L}/u.test(text);

function literalText(node: TSESTree.Node): string | undefined {
  if (node.type === AST_NODE_TYPES.Literal && typeof node.value === 'string') return node.value;
  if (node.type === AST_NODE_TYPES.TemplateLiteral && node.expressions.length === 0) {
    return node.quasis.map((quasi) => quasi.value.cooked ?? '').join('');
  }
  return undefined;
}

/**
 * Display strings in web screens must come from i18n (FR-029, SC-007): no JSX text, string-literal children or
 * literal display attributes such as aria-label. Replaces eslint-plugin-i18next, which reports no JSX text on
 * ESLint 10 (decision tech-stack, amendment 2026-09-15).
 */
export const noLiteralString = createRule<[], MessageIds>({
  name: 'no-literal-string',
  meta: {
    type: 'problem',
    docs: { description: 'Disallow hard-coded display strings in JSX; use i18n keys' },
    schema: [],
    messages: {
      jsxText: 'Hard-coded display text "{{text}}": use an i18n key (t(...)).',
      jsxAttribute: 'Hard-coded "{{name}}" text "{{text}}": use an i18n key (t(...)).',
    },
  },
  defaultOptions: [],
  create(context) {
    const report = (node: TSESTree.Node, messageId: MessageIds, text: string, name?: string) =>
      context.report({ node, messageId, data: { text: text.trim().slice(0, 40), name: name ?? '' } });

    return {
      JSXText(node) {
        if (hasLetter(node.value)) report(node, 'jsxText', node.value);
      },
      JSXExpressionContainer(node) {
        if (node.parent.type === AST_NODE_TYPES.JSXAttribute) return;
        if (node.expression.type === AST_NODE_TYPES.JSXEmptyExpression) return;
        const text = literalText(node.expression);
        if (text !== undefined && hasLetter(text)) report(node, 'jsxText', text);
      },
      JSXAttribute(node) {
        const name = node.name.type === AST_NODE_TYPES.JSXIdentifier ? node.name.name : node.name.name.name;
        if (!DISPLAY_ATTRIBUTES.has(name) || node.value === null) return;
        const valueNode =
          node.value.type === AST_NODE_TYPES.JSXExpressionContainer ? node.value.expression : node.value;
        const text = literalText(valueNode);
        if (text !== undefined && hasLetter(text)) report(node, 'jsxAttribute', text, name);
      },
    };
  },
});
