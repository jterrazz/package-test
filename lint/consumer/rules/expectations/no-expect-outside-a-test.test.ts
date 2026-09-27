import { asOxlintRule, ruleTester } from '../../../engine/testing/rule-tester.fixtures.js';
import { noExpectOutsideATest } from './no-expect-outside-a-test.js';

const SETUP_MODULE = '/repo/specs/cli/_setup/built.ts';

ruleTester().run('no-expect-outside-a-test', asOxlintRule(noExpectOutsideATest), {
    invalid: [
        {
            code: `import { expect } from 'vitest';
export function expectBuilt(stdout: string): void {
    expect(stdout).toContain('Built.');
}`,
            errors: [{ line: 3, messageId: 'expectOutsideATest' }],
            filename: SETUP_MODULE,
        },
        {
            code: `import { expect as check } from 'vitest';
export async function settled(read: () => Promise<number>): Promise<void> {
    check.soft(await read()).toBe(0);
    await check.poll(read).toBe(0);
}`,
            errors: [
                { line: 3, messageId: 'expectOutsideATest' },
                { line: 4, messageId: 'expectOutsideATest' },
            ],
            filename: SETUP_MODULE,
        },
        {
            code: `import { expect } from 'vitest';
export const { cli } = await specification.cli('./bin/cli.js');
expect(cli).toBeDefined();`,
            errors: [{ line: 3, messageId: 'expectOutsideATest' }],
            filename: '/repo/specs/cli/cli.specification.ts',
        },
    ],
    valid: [
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
