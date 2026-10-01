import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { portReaders } from './port-readers.js';

const ROOT = resolve(import.meta.dirname, '../../..');

function tree(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'port-readers-'));
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), content);
    }
    return root;
}

describe('portReaders', () => {
    test('`server-binds-port-zero` — a spec server binds port 0 (meta-test) — no spec, module test or fixture server of this package reads a port it was handed', () => {
        // Given - every file a spec or a module test is made of, on the host
        const readers = portReaders(ROOT);

        // Then - none of them reads `PORT`: each server binds 0 and announces it
        expect(readers).toStrictEqual([]);
    });

    test('`server-binds-port-zero` — a spec server binds port 0 (meta-test) — names a spec server and a module test reading a handed port, never a container nor the PORT form proof', () => {
        // Given - a fixture server and a module test reading PORT, a container app doing the same, a module, and the PORT form's own proof
        const root = tree({
            'src/services/process/serve.test.ts':
                'run(\'node -e "console.log(process.env.PORT)"\');\n',
            'specs/_fixtures/app/Dockerfile': 'FROM node\n',
            'specs/_fixtures/app/server.ts': 'listen(process.env.PORT);\n',
            'specs/_fixtures/site/server.mjs': 'server.listen(Number(process.env.PORT));\n',
            'src/serve.test.ts': "run('bin/serve --port $PORT');\n",
            'src/serve.ts': 'listen(process.env.PORT);\n',
        });

        // Then - the two host readers are named, the container, the module and the proof are not
        expect(portReaders(root)).toStrictEqual([
            'specs/_fixtures/site/server.mjs',
            'src/serve.test.ts',
        ]);
    });
});
