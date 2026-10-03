export default {
    kind: 'library',
    platform: 'node',
    test: { projects: [{ facet: 'unit', include: ['missing/**/*.test.ts'] }] },
};
