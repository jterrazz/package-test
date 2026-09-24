// The own-fixes project's config in cap01's web shape: the plugin armed only
// Through a config the root extends, beside another rulebook's fixer.
export default {
    extends: [
        {
            jsPlugins: [`${process.env.JTERRAZZ_TEST_REPO}/dist/oxlint.js`],
            plugins: ['unicorn'],
            rules: {
                'jterrazz/b16w-file-context': 'warn',
                'unicorn/no-useless-undefined': 'error',
            },
        },
    ],
};
