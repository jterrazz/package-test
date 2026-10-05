export default {
    kind: 'library',
    platform: 'node',
    test: { projects: { cli: { reason: 'the shop is served for the run', setup: ['specs/_shared/_fixtures/shop/cli.sh'] } } },
};
