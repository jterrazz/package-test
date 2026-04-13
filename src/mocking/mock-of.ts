import { type DeepMockProxy, mockDeep } from 'vitest-mock-extended';

/** Factory signature that creates a deep mock proxy for any interface. */
export type MockPort = <T>() => DeepMockProxy<T>;

/**
 * Create a deep mock proxy for a given type.
 * Wraps `vitest-mock-extended`'s `mockDeep` for convenient port mocking.
 */
export const mockOf: MockPort = mockDeep;
