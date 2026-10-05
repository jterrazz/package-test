export default {
    kind: 'library',
    platform: 'node',
    test: { projects: [{ specification: 'api', include: ['specs/api/**/*.spec.ts'] }] },
};
