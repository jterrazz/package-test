import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { portReaders, portReleasers } from '../port-readers.js';

const ROOT = resolve(import.meta.dirname, '../../../..');

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
            'src/services/process/__tests__/serve.test.ts':
                'run(\'node -e "console.log(process.env.PORT)"\');\n',
            'specs/__fixtures__/app/Dockerfile': 'FROM node\n',
            'specs/__fixtures__/app/server.ts': 'listen(process.env.PORT);\n',
            'specs/__fixtures__/site/server.mjs': 'server.listen(Number(process.env.PORT));\n',
            'src/serve.test.ts': "run('bin/serve --port $PORT');\n",
            'src/serve.ts': 'listen(process.env.PORT);\n',
        });

        // Then - the two host readers are named, the container, the module and the proof are not
        expect(portReaders(root)).toStrictEqual([
            'specs/__fixtures__/site/server.mjs',
            'src/serve.test.ts',
        ]);
    });

    test('`server-binds-port-zero` — a spec server binds port 0 (meta-test) — no spec, module or fixture of this package reads a port off a server it then closes', () => {
        // Given - every file a spec or the source is made of, on the host
        const releasers = portReleasers(ROOT);

        // Then - none of them hands on a port the OS took back
        expect(releasers).toStrictEqual([]);
    });

    test('`server-binds-port-zero` — a spec server binds port 0 (meta-test) — names a port read off a server the next statement closes, never a server kept open, nor a container', () => {
        // Given - a module and a spec fixture each closing the server they read a port off, a test keeping it, and a container doing the same
        const root = tree({
            'specs/__fixtures__/app/Dockerfile': 'FROM node\n',
            'specs/__fixtures__/app/server.ts':
                'const port = await listening(vacated);\nawait closed(vacated);\n',
            'specs/__fixtures__/site/server.ts':
                'const refusedPort = await listening(vacated);\nawait closed(vacated);\n',
            'src/listening.ts': 'const port = await listenedPort(server);\nserver.close();\n',
            'src/served.test.ts':
                'const port = await listenedPort(server);\nawait fetch(port);\nserver.close();\n',
        });

        // Then - the two that release the port are named, the kept server and the container are not
        expect(portReleasers(root)).toStrictEqual([
            'specs/__fixtures__/site/server.ts',
            'src/listening.ts',
        ]);
    });
});
