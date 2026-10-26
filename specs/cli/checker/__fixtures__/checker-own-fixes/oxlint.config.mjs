// The project's config: the plugin's rule that writes a fix, and another
// rulebook's fixer that the checker's own fix pass must leave alone.
export default {
    jsPlugins: [`${process.env.STUDIO_TEST_REPO}/dist/oxlint.js`],
    plugins: ['unicorn'],
    rules: {
        'jterrazz/no-repeated-chain-setting': 'warn',
        'unicorn/no-useless-undefined': 'error',
    },
};
