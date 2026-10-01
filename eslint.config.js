import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const RELATIVE = '(?:\\.{1,2}/)+';
const banned = {
  react: [
    { regex: '^react(?:-dom|-is)?(?:/.*)?$', message: 'React is not allowed here (design §2).' },
  ],
  recharts: [
    {
      regex: '^recharts(?:/.*)?$',
      message: 'recharts is imported only under src/render/recharts (design §2).',
    },
  ],
  renderReactPrint: [
    {
      regex: `(?:^${RELATIVE}|(?:^|/)src/)(?:render|react|print)(?:/|$)`,
      message: 'src/core must not import render, react or print (design §2).',
    },
  ],
  reactFromPrint: [
    {
      regex: `(?:^${RELATIVE}|(?:^|/)src/)react(?:/|$)`,
      message: 'src/print must not import src/react (design §2).',
    },
  ],
  printFromReact: [
    {
      regex: `(?:^${RELATIVE}|(?:^|/)src/)print(?:/|$)`,
      message: 'src/react must not import src/print (design §2).',
    },
  ],
};

const restrict = (...groups) => ({
  'no-restricted-imports': ['error', { patterns: groups.flat() }],
});

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.pack/**',
      '.stage/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'spikes/**',
      'docs/**',
      '.superpowers/**',
      // Ajv standalone output bundled by scripts/gen-validator.ts; machine-written, drift-checked.
      'src/core/validate/ajv.gen.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'innerHTML is forbidden (design constraints).' },
        { property: 'outerHTML', message: 'outerHTML assignment is forbidden.' },
        { object: 'window', property: 'eval', message: 'eval is forbidden.' },
        { object: 'globalThis', property: 'eval', message: 'eval is forbidden.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Function']",
          message: 'new Function is forbidden.',
        },
        {
          selector: "CallExpression[callee.name='Function']",
          message: 'Function() is forbidden.',
        },
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML is forbidden.',
        },
        {
          selector: "Property[key.name='innerHTML'], Property[key.value='innerHTML']",
          message: 'innerHTML is forbidden.',
        },
      ],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  // Dependency rules (design §2). Each block restates recharts because a later
  // no-restricted-imports entry replaces an earlier one for the same file.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/render/recharts/**'],
    rules: restrict(banned.recharts),
  },
  {
    files: ['src/core/**/*.{ts,tsx}'],
    rules: restrict(banned.react, banned.recharts, banned.renderReactPrint),
  },
  {
    files: ['src/react/**/*.{ts,tsx}'],
    rules: restrict(banned.recharts, banned.printFromReact),
  },
  {
    files: ['src/print/**/*.{ts,tsx}'],
    rules: restrict(banned.recharts, banned.reactFromPrint),
  },
);
