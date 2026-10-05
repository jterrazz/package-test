export default {
    kind: 'library',
    platform: 'node',
    test: { projects: [{ specification: 'unit', include: ['missing/**/*.test.ts'] }] },
};
