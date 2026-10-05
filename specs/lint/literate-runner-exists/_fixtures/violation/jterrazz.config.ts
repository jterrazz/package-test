export default {
    kind: 'library',
    platform: 'node',
    test: {
        projects: [{ specification: 'cli', literate: { runner: './specs/cli/cli.specification.ts' } }],
    },
};
