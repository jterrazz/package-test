import { ruleTester } from '@jterrazz/test';

import { noExpectOutsideATest } from './no-expect-outside-a-test.js';

const SETUP_MODULE = '/repo/specs/cli/_setup/built.ts';

ruleTester().run('no-expect-outside-a-test', noExpectOutsideATest, {
    invalid: [
        {
            code: `import { expect } from 'vitest';
export function expectBuilt(stdout: string): void {
    expect(stdout).toContain('Built.');
}`,
            errors: [{ column: 4, line: 3, messageId: 'expectOutsideATest' }],
            filename: SETUP_MODULE,
        },
        {
            code: `import { expect as check } from 'vitest';
export async function settled(read: () => Promise<number>): Promise<void> {
    check.soft(await read()).toBe(0);
    await check.poll(read).toBe(0);
}`,
            errors: [
                { column: 4, line: 3, messageId: 'expectOutsideATest' },
                { column: 10, line: 4, messageId: 'expectOutsideATest' },
            ],
            filename: SETUP_MODULE,
        },
        {
            code: `import { expect } from 'vitest';
export const { cli } = await specification.cli('./bin/cli.js');
expect(cli).toBeDefined();`,
            errors: [{ column: 0, line: 3, messageId: 'expectOutsideATest' }],
            filename: '/repo/specs/cli/cli.specification.ts',
        },
        {
            code: `import * as vitest from 'vitest';
export function expectBuilt(stdout: string): void {
    vitest.expect(stdout).toContain('Built.');
    vitest.expect.soft(stdout).toContain('Done.');
}`,
            errors: [
                { column: 4, line: 3, messageId: 'expectOutsideATest' },
                { column: 4, line: 4, messageId: 'expectOutsideATest' },
            ],
            filename: SETUP_MODULE,
        },
        {
            code: `export async function expectBuilt(stdout: string): Promise<void> {
    const { expect } = await import('vitest');
    const runner = await import('vitest');
    expect(stdout).toContain('Built.');
    runner.expect(stdout).toContain('Done.');
}`,
            errors: [
                { column: 4, line: 4, messageId: 'expectOutsideATest' },
                { column: 4, line: 5, messageId: 'expectOutsideATest' },
            ],
            filename: SETUP_MODULE,
        },
    ],
    valid: [
        {
            code: `import * as vitest from 'vitest';
vitest.expectTypeOf(build).returns.toBeString();`,
            filename: SETUP_MODULE,
        },
        {
            code: `import { expect, test } from 'vitest';
test('builds', () => {
    expect(build()).toBe('Built.');
});`,
            filename: '/repo/specs/cli/build/builds.spec.ts',
        },
        {
            code: `import { expect, test } from 'vitest';
test('builds', () => {
    expect(build()).toBe('Built.');
});`,
            filename: '/repo/src/build.test.ts',
        },
        {
            code: `import { expectTypeOf } from 'vitest';
expectTypeOf(build).returns.toBeString();`,
            filename: SETUP_MODULE,
        },
        {
            code: `class Probe {
    expect(line: string): boolean {
        return line.startsWith('Built');
    }
}
new Probe().expect('Built.');`,
            filename: SETUP_MODULE,
        },
        {
            code: `import { expect } from 'vitest';
expect(1).toBe(1);`,
            filename: '/repo/src/assertions.ts',
        },
    ],
});
