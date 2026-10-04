import { once } from 'node:events';
import { createServer } from 'node:http';
import type { Server } from 'node:http';

import type { ProcessOptions } from './process.adapter.js';

/** Binds the port the OS hands it and answers its own pid: no spec picks a port. */
export const SERVER = `node -e "const s=require('node:http').createServer((q,r)=>r.end(String(process.pid)));s.listen(0,'127.0.0.1',()=>console.log('listening on port '+s.address().port))"`;
export const READY = /listening on port (?<port>\d+)/u;

/** Never binds what it is handed: reports the port it got and stays up. */
export const CALLS_HANDED = `node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/handed').catch(()=>{});setInterval(()=>{},1000)"`;
export const PRINTS_HANDED = `node -e "console.log('handed '+process.env.PORT);setInterval(()=>{},1000)"`;

export async function held(): Promise<{ paths: string[]; port: number; server: Server }> {
    const paths: string[] = [];
    const server = createServer((request, response) => {
        paths.push(request.url ?? '');
        response.end();
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (address === null || typeof address === 'string') {
        throw new Error('the held server has no port');
    }
    return { paths, port: address.port, server };
}

export function alive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

const READ = 'docs/reference/services.md#process--the-one-shape-an-external-process-takes';

/** A refusal of a process, its four parts as the facet named writes them. */
export function refused(found: string, why: string, fix: string): string {
    return `found: specification.api(): ${found}\nwhy: ${why}\nfix: ${fix}\nread: ${READ}`;
}

export const SILENT = `node -e "setInterval(() => {}, 1000)"`;

/** Each process shape refused before it is ready, and the refusal it gets, whole. */
export const REFUSALS: [string, ProcessOptions, string][] = [
    [
        'a before step that fails',
        {
            before: `node -e "console.log(process.argv.length); console.error(2); process.exit(4)"`,
            command: 'true',
        },
        refused(
            '`before` exited 4.\nCommand: node -e "console.log(process.argv.length); console.error(2); process.exit(4)"\nOutput:\n1\n2\n',
            'A process’s `before` must exit 0 before the process starts.',
            'run the command by hand and correct what its output names',
        ),
    ],
    [
        'a server that exits before it is ready',
        { command: `node -e "console.log('printed')"`, ready: /never (?<port>\d+)/u },
        refused(
            `the server command exited before it was ready.\nCommand: node -e "console.log('printed')"\nOutput:\nprinted\n`,
            'A process is handed to the chain once it is ready, and one that exits never is.',
            'run the command by hand and correct what its output names',
        ),
    ],
    [
        'a ready pattern whose capture is no port',
        {
            command: `node -e "console.log('listening on x'); setInterval(() => {}, 1000)"`,
            ready: /listening on (?<port>\w+)/u,
        },
        refused(
            `the ready pattern /listening on (?<port>\\w+)/u matched, and its capture group is not a port ("x").\nCommand: node -e "console.log('listening on x'); setInterval(() => {}, 1000)"\nOutput:\nlistening on x\n`,
            'A RegExp `ready` is read over the output, and its one capture group is the port.',
            String.raw`capture the port alone in the pattern’s one group, e.g. /listening on (\d+)/`,
        ),
    ],
    [
        'a ready pattern never printed',
        { command: SILENT, ready: /listening on (?<port>\d+)/u, timeout: 600 },
        refused(
            `the server did not print /listening on (?<port>\\d+)/u within 600ms.\nCommand: ${SILENT}\nOutput:\n`,
            'A process is ready once its output matches `ready`, within `timeout`.',
            'correct the pattern to what the server prints, or raise `timeout`',
        ),
    ],
    [
        'a stated port never answered',
        { command: SILENT, port: 9, ready: '/health', timeout: 600 },
        refused(
            `the server did not answer on http://127.0.0.1:9/health within 600ms.\nCommand: ${SILENT}\nOutput:\n`,
            'A process is ready once its `ready` path answers, within `timeout`.',
            'correct `ready` to a path the server answers, have it listen on `PORT`, or raise `timeout`',
        ),
    ],
];
