export default {
    kind: 'library',
    platform: 'node',
    test: { projects: { api: { include: ['specs/api/**/*.spec.ts'], reason: 'the api specs' } } },
};
