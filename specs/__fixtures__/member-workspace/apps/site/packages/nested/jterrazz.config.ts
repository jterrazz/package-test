export default {
    kind: 'library',
    platform: 'node',
    test: { projects: { unit: { include: ['src/**/*.test.ts'], reason: 'the modules sit under src/' } } },
};
