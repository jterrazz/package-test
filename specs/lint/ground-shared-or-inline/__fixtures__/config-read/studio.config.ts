export default {
    kind: 'library',
    platform: 'node',
    test: { projects: { cli: { reason: 'the shop is served for the run', setup: ['specs/__fixtures__/shop/cli.sh'] } } },
};
