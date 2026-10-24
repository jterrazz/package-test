import { once } from 'node:events';
import { mkdirSync, mkdtempSync, symlinkSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { findFreePort } from '../listening.js';
import type { ProcessOptions } from '../process.adapter.js';

/** Binds the port the OS hands it and answers its own pid: no spec picks a port. */
export const SERVER = `node -e "const s=require('node:http').createServer((q,r)=>r.end(String(process.pid)));s.listen(0,'127.0.0.1',()=>console.log('listening on port '+s.address().port))"`;
export const READY = /listening on port (?<port>\d+)/u;

/** Listens on the `PORT` it is handed, and reports each path it is asked to the `REPORT` address before it answers `status`. */
export function serving(status: number): string {
    return `node -e "require('node:http').createServer(async(q,r)=>{await fetch(process.env.REPORT+q.url).catch(()=>{});r.writeHead(${String(status)},{location:'http://127.0.0.1:9/'}).end()}).listen(Number(process.env.PORT),'127.0.0.1')"`;
}

/** Listens on the `PORT` it is handed, after `DELAY` milliseconds, and answers the `ID` it is handed. */
export const ANSWERS_ID = `node -e "setTimeout(()=>require('node:http').createServer((q,r)=>r.end(process.env.ID)).listen(Number(process.env.PORT),'127.0.0.1'),Number(process.env.DELAY))"`;

/** Hands the `PORT` it is handed to a server in a process group of its own, which exits within 20 s whoever reaps it, prints that server's pid, and stays up. */
export const HANDS_PORT_AWAY = `node -e "const c=require('node:child_process').spawn(process.execPath,['-e','require(\\'node:http\\').createServer((q,r)=>r.end()).listen(Number(process.env.PORT),\\'127.0.0.1\\');setTimeout(()=>process.exit(),20000)'],{detached:true,stdio:'ignore'});c.unref();console.log('away '+c.pid+' '+process.env.PORT);setInterval(()=>{},1000)"`;

/** Never binds what it is handed: reports the port it got and stays up. */
export const PRINTS_HANDED = `node -e "console.log('handed '+process.env.PORT);setInterval(()=>{},1000)"`;

export async function held(
    host = '127.0.0.1',
): Promise<{ paths: string[]; port: number; server: Server; url: string }> {
    const paths: string[] = [];
    const server = createServer((request, response) => {
        paths.push(request.url ?? '');
        response.end();
    });
    server.listen(0, host);
    await once(server, 'listening');
    const address = server.address();
    if (address === null || typeof address === 'string') {
        throw new Error('the held server has no port');
    }
    return {
        paths,
        port: address.port,
        server,
        url: `http://${host.includes(':') ? `[${host}]` : host}:${address.port}`,
    };
}

export function alive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

const READ = 'docs/reference/services.md#process-the-one-shape-an-external-process-takes';

/** A refusal of a process, its four parts as the specification named writes them. */
export function refused(found: string, why: string, fix: string): string {
    return `found: specification.api(): ${found}\nwhy: ${why}\nfix: ${fix}\nread: ${READ}`;
}

export const SILENT = `node -e "setInterval(() => {}, 1000)"`;

/** Node under another executable's path, `name` below a fresh folder: a process whose program is that path, and whose script is its `-e` argument. */
export function programNamed(name: string): string {
    const folder = mkdtempSync(join(tmpdir(), 'program-'));
    const program = join(folder, name);
    mkdirSync(dirname(program), { recursive: true });
    symlinkSync(process.execPath, program);
    return program;
}

// hazard: a fixed port may be a developer's own server (Astro's 4321) answering in the refused server's place.
const PINNED = await findFreePort();

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
            "A process's `before` must exit 0 before the process starts.",
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
        'a server that cannot bind the port `port` pins',
        {
            command: `node -e "console.error('Error: listen EADDRINUSE: address already in use 127.0.0.1:${PINNED}')"`,
            port: PINNED,
        },
        refused(
            `the server could not bind its port, which another process already holds.\nCommand: node -e "console.error('Error: listen EADDRINUSE: address already in use 127.0.0.1:${PINNED}')"\nOutput:\nError: listen EADDRINUSE: address already in use 127.0.0.1:${PINNED}\n`,
            'A process is handed a free port unless `port` pins one, and a port another process holds is not free.',
            `stop the process holding port ${PINNED}, or drop the \`port\` option so a free one is picked`,
        ),
    ],
    [
        'a server that cannot bind the port it is handed',
        {
            command: `node -e "console.error('listen EADDRINUSE');setTimeout(()=>{},4000)"`,
            timeout: 800,
        },
        refused(
            `the server could not bind its port, which another process already holds.\nCommand: node -e "console.error('listen EADDRINUSE');setTimeout(()=>{},4000)"\nOutput:\nlisten EADDRINUSE\n`,
            'A process is handed a free port unless `port` pins one, and a port another process holds is not free.',
            'have the command listen on the `PORT` it is handed, a free one, or stop the process holding the port it binds',
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
            String.raw`capture the port alone in the pattern's one group, e.g. /listening on (\d+)/`,
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
            `the server did not answer on http://127.0.0.1:9/health or http://[::1]:9/health within 600ms, whatever address it printed above.\nCommand: ${SILENT}\nOutput:\n`,
            'A process is ready once its `ready` path answers, within `timeout`.',
            'correct `ready` to a path the server answers, have it listen on `PORT`, or raise `timeout`',
        ),
    ],
];
