export default {
    kind: 'library',
    platform: 'node',
    test: { projects: [{ specification: 'unit', include: ['src/**/*.test.ts'] }] },
};
