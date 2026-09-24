// The project's config: the plugin's rule that writes a fix, and another
// Rulebook's fixer that the checker's own fix pass must leave alone.
export default {
    jsPlugins: [`${process.env.JTERRAZZ_TEST_REPO}/dist/oxlint.js`],
    plugins: ['unicorn'],
    rules: {
        'jterrazz/b16w-file-context': 'warn',
        'unicorn/no-useless-undefined': 'error',
    },
};
