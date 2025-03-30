import jest from 'eslint-plugin-jest';

export default [
    {
        files: ['__tests__/**'],
        ...jest.configs['flat/recommended'],
    },
];
