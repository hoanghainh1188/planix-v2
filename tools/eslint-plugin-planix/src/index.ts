import { noLiteralString } from './rules/no-literal-string.ts';
import { noNumberMoney } from './rules/no-number-money.ts';

const plugin = {
  meta: { name: 'eslint-plugin-planix', version: '0.0.0' },
  rules: {
    'no-number-money': noNumberMoney,
    'no-literal-string': noLiteralString,
  },
};

export default plugin;
