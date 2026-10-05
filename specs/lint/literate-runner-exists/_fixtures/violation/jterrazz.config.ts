export default {
    kind: 'library',
    platform: 'node',
    test: {
        projects: [{ facet: 'cli', literate: { runner: './specs/cli/cli.specification.ts' } }],
    },
};
