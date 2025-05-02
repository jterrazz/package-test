import MockDatePackage from 'mockdate';
import { mockDeep } from 'vitest-mock-extended';

// Mock of Dates

interface MockDatePort {
    reset: () => void;
    set: (date: Date | number | string) => void;
}

const mockOfDate: MockDatePort = MockDatePackage;

// Mock of Generic Types

const mockOf = mockDeep;

export { mockOf, mockOfDate };
export * from 'vitest';
