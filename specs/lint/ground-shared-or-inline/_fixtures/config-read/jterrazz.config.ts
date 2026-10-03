export default {
    kind: 'library',
    platform: 'node',
    test: { projects: [{ facet: 'cli', setup: ['specs/_shared/_fixtures/shop/cli.sh'] }] },
};
