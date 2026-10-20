import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('a process the test spawns is handed the compile cache', () => {
    const cache = execFileSync(process.execPath, ['-p', 'process.env.NODE_COMPILE_CACHE'], {
        cwd: '/',
        encoding: 'utf8',
    });

    expect(cache.trim()).toBe(`${process.cwd()}/.artifacts/node-compile-cache`);
});
