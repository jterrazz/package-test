export default {
    kind: 'library',
    platform: 'node',
    test: { projects: [{ specification: 'cli', setup: ['specs/_shared/_fixtures/shop/cli.sh'] }] },
};
