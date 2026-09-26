// The only working React Native toolchain of the workspace lives here, and it
// Roots into the library beside it: the render tests are co-located with the
// Components they cover, and this is what runs them.
module.exports = {
    preset: 'jest-expo',
    roots: ['<rootDir>/../../packages/rn-library/src'],
};
