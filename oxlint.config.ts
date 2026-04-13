import { defineConfig } from 'oxlint';
import { oxlint } from '@jterrazz/codestyle';

export default defineConfig({
    extends: [oxlint.node],
    ignorePatterns: ['tests/**/fixtures/**'],
    rules: {
        'import/exports-last': 'off',
    },
});
