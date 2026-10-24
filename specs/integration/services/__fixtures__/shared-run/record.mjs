import { readdirSync, writeFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';

const RENDEZVOUS_MS = 10_000;

// invariant: a file waits until a file of the other project has started, so two projects that can run at once are seen at once however loaded the machine; two that cannot are seen apart once the wait runs out.
export async function recordWorker(name) {
    const start = Date.now();
    const [project] = name.split('-');
    writeFileSync(`${name}.started`, '');
    const other = (file) => file.endsWith('.started') && !file.startsWith(`${project}-`);
    while (!readdirSync('.').some(other) && Date.now() - start < RENDEZVOUS_MS) {
        await setTimeout(25);
    }
    await setTimeout(400);
    writeFileSync(`${name}.run`, `${process.env.VITEST_POOL_ID} ${start} ${Date.now()}`);
}
