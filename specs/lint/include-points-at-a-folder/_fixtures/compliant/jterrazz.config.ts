export default {
    kind: 'library',
    platform: 'node',
    test: { projects: [{ facet: 'api', include: ['specs/api/**/*.spec.ts'] }] },
};
