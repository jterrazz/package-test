import { expect } from 'vitest';

export function expectBuilt(stdout: string): void {
    expect(stdout).toContain('Built.');
}
