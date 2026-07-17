import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const nodeGlobals = {
    AbortController: 'readonly',
    Buffer: 'readonly',
    URL: 'readonly',
    __dirname: 'readonly',
    clearTimeout: 'readonly',
    console: 'readonly',
    fetch: 'readonly',
    globalThis: 'readonly',
    process: 'readonly',
    setTimeout: 'readonly',
    TextDecoder: 'readonly',
    TextEncoder: 'readonly'
};

export default [
    {
        ignores: [
            '**/.cursor/**',
            '**/node_modules/**',
            '**/out/**',
            '**/dist/**',
            '**/*.tsbuildinfo',
            '**/*.js',
            '**/*.cjs',
            '**/*.mjs',
            '**/syntaxes/**',
            'src/codegen/assets/mcp-fallback-icon-b64.ts'
        ]
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: nodeGlobals
        },
        rules: {
            'no-undef': 'off',
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                    varsIgnorePattern: '^_'
                }
            ]
        }
    }
];
