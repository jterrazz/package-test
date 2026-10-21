export default {
    test: {
        projects: [
            {
                include: [
                    'specs/api/**/*.test.ts',
                    'specs/api/users/creation.test.ts',
                ],
                name: 'api',
            },
            { include: ['src/**/*.test.ts', 'specs/build/**/*.test.ts'], name: 'unit' },
        ],
    },
};
