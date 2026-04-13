import { oxlint } from '@jterrazz/codestyle';
import { defineConfig } from 'oxlint';

export default defineConfig({
    extends: [oxlint.node],
    ignorePatterns: ['tests/**/fixtures/**'],
    rules: {
        'import/exports-last': 'off',
    },
});
