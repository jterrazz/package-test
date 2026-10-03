export default {
    kind: 'library',
    platform: 'node',
    test: {
        projects: [{ facet: 'cli', literate: { specification: './specs/cli/cli.specification.ts' } }],
    },
};
