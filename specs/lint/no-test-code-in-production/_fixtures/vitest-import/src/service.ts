import { expect } from 'vitest';

export function assertPositive(value: number): void {
    expect(value).toBeGreaterThan(0);
}
