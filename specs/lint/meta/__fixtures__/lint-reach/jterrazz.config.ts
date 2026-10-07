export default {
    kind: 'library',
    platform: 'node',
    test: { projects: { unit: { include: ['missing/**/*.test.ts'], reason: 'the modules sit under missing/' } } },
};
