import { type DeepMockProxy, mockDeep } from "vitest-mock-extended";

export type MockPort = <T>() => DeepMockProxy<T>;

export const mockOf: MockPort = mockDeep;
