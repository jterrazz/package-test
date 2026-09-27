import type { OxlintConfig } from '@jterrazz/typescript/oxlint';

type Override = NonNullable<OxlintConfig['overrides']>[number];

export const importRulesForSpecifications: Override = {
    files: ['**/*.specification.ts'],
    rules: { 'import/exports-last': 'off' },
};
