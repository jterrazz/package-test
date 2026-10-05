export default {
    kind: 'library',
    platform: 'node',
    test: {
        projects: { cli: { literate: { runner: './specs/cli/cli.specification.ts' }, reason: 'the documents' } },
    },
};
