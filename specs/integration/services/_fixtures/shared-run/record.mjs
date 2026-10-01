import { writeFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';

export async function recordWorker(name) {
    const start = Date.now();
    await setTimeout(400);
    writeFileSync(`${name}.run`, `${process.env.VITEST_POOL_ID} ${start} ${Date.now()}`);
}
