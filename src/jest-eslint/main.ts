// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import jest from 'eslint-plugin-jest';

export default [
    {
        files: ['__tests__/**'],
        ...jest.configs['flat/recommended'],
    },
];
