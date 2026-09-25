import { describe, expect, test } from 'vitest';

import { processService } from '../process/process.adapter.js';
import { startProcessServices } from './start-services.js';

/** A server that binds the port the OS hands it and announces it — no spec picks a port. */
const SERVER = `node -e "const s=require('node:http').createServer((q,r)=>r.end('ok'));s.listen(0,'127.0.0.1',()=>console.log('listening on port '+s.address().port))"`;
const READY = /listening on port (?<port>\d+)/u;

describe('startProcessServices', () => {
    test('stops the processes already started when a later one never comes up', async () => {
        // Given - a record whose second process fails its build step
        const first = processService({ command: SERVER, ready: READY });
        const broken = processService({
            before: `node -e "process.exit(1)"`,
            command: SERVER,
            ready: READY,
        });
        const services = { api: first, broken };

        // When - the record is started
        const starting = startProcessServices(services, process.cwd(), 'run-1');

        // Then - the start is refused, and the first server, which did come up, no longer answers
        await expect(starting).rejects.toThrow();
        expect(first.connectionString).toMatch(/^http:/u);
        expect(first.started).toBe(false);
        await expect(fetch(first.connectionString)).rejects.toThrow();
    });
});
