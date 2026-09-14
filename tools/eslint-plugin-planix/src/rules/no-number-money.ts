import path from 'node:path';
import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

/** Default money identifiers — mirrors 🔒/financial terms in docs/00-glossary.md. */
export const DEFAULT_MONEY_IDENTIFIERS: readonly string[] = [
  'billingRate',
  'budgetAtCompletion',
  'actualCost',
  'laborActualCost',
  'nonLaborActualCost',
  'plannedValue',
  'earnedValue',
  'estimateAtCompletion',
  'estimateToComplete',
  'costVariance',
  'scheduleVariance',
  'presentValue',
  'futureValue',
  'netPresentValue',
  'ceilingPrice',
  'targetPrice',
  'targetCost',
  'expectedMonetaryValue',
  'amount',
  'price',
  'cost',
];

type Options = [{ moneyIdentifiers?: readonly string[]; financialFileGlobs?: readonly string[] }];
type MessageIds = 'numberType' | 'arithmetic' | 'numberConversion';

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/hoanghainh1188/planix-v2/blob/main/tools/eslint-plugin-planix/src/rules/${name}.ts`,
);

const ARITHMETIC_OPERATORS = new Set(['+', '-', '*', '/']);

function identifierName(node: TSESTree.Node): string | undefined {
  if (node.type === AST_NODE_TYPES.Identifier) return node.name;
  if (node.type === AST_NODE_TYPES.MemberExpression && node.property.type === AST_NODE_TYPES.Identifier) {
    return node.property.name;
  }
  return undefined;
}

function isStringLike(node: TSESTree.Node): boolean {
  return (
    (node.type === AST_NODE_TYPES.Literal && typeof node.value === 'string') ||
    node.type === AST_NODE_TYPES.TemplateLiteral
  );
}

function hasNumberAnnotation(annotation: TSESTree.TSTypeAnnotation | undefined): boolean {
  return annotation?.typeAnnotation.type === AST_NODE_TYPES.TSNumberKeyword;
}

export const noNumberMoney = createRule<Options, MessageIds>({
  name: 'no-number-money',
  meta: {
    type: 'problem',
    docs: {
      description: 'Forbid JavaScript number for money and financial indices (constitution Principle I).',
    },
    schema: [
      {
        type: 'object',
        properties: {
          moneyIdentifiers: { type: 'array', items: { type: 'string' } },
          financialFileGlobs: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      numberType: '`{{name}}` is a financial value and must use Decimal, not number.',
      arithmetic: '`{{name}}` is a financial value; use Decimal methods instead of arithmetic operators.',
      numberConversion:
        '`{{name}}` converts to a floating-point number in a financial module; parse with Decimal.of().',
    },
  },
  defaultOptions: [{}],
  create(context, [options]) {
    const moneyIdentifiers = new Set(options.moneyIdentifiers ?? DEFAULT_MONEY_IDENTIFIERS);
    const globs = options.financialFileGlobs ?? [];
    const isFinancialFile = globs.some((glob) => path.matchesGlob(context.filename, glob));

    const checkAnnotated = (
      name: string | undefined,
      annotation: TSESTree.TSTypeAnnotation | undefined,
      node: TSESTree.Node,
    ) => {
      if (name !== undefined && moneyIdentifiers.has(name) && hasNumberAnnotation(annotation)) {
        context.report({ node, messageId: 'numberType', data: { name } });
      }
    };

    return {
      VariableDeclarator(node) {
        if (node.id.type === AST_NODE_TYPES.Identifier) checkAnnotated(node.id.name, node.id.typeAnnotation, node.id);
      },
      Identifier(node) {
        const parent = node.parent;
        const isParam =
          parent !== undefined &&
          (parent.type === AST_NODE_TYPES.FunctionDeclaration ||
            parent.type === AST_NODE_TYPES.FunctionExpression ||
            parent.type === AST_NODE_TYPES.ArrowFunctionExpression) &&
          parent.params.includes(node);
        if (isParam) checkAnnotated(node.name, node.typeAnnotation, node);
      },
      'PropertyDefinition, TSPropertySignature'(node: TSESTree.PropertyDefinition | TSESTree.TSPropertySignature) {
        checkAnnotated(identifierName(node.key), node.typeAnnotation, node.key);
      },
      BinaryExpression(node) {
        if (!ARITHMETIC_OPERATORS.has(node.operator)) return;
        if (node.operator === '+' && (isStringLike(node.left) || isStringLike(node.right))) return;
        const name = [node.left, node.right]
          .map(identifierName)
          .find((n) => n !== undefined && moneyIdentifiers.has(n));
        if (name !== undefined) context.report({ node, messageId: 'arithmetic', data: { name } });
      },
      CallExpression(node) {
        if (!isFinancialFile) return;
        const callee = node.callee;
        const name =
          callee.type === AST_NODE_TYPES.Identifier
            ? callee.name
            : callee.type === AST_NODE_TYPES.MemberExpression &&
                callee.object.type === AST_NODE_TYPES.Identifier &&
                callee.object.name === 'Number' &&
                callee.property.type === AST_NODE_TYPES.Identifier
              ? `Number.${callee.property.name}`
              : undefined;
        if (name === 'parseFloat' || name === 'Number' || name === 'Number.parseFloat' || name === 'parseInt') {
          context.report({ node, messageId: 'numberConversion', data: { name } });
        }
      },
      UnaryExpression(node) {
        if (isFinancialFile && node.operator === '+' && node.argument.type !== AST_NODE_TYPES.Literal) {
          context.report({ node, messageId: 'numberConversion', data: { name: 'unary +' } });
        }
      },
    };
  },
});
