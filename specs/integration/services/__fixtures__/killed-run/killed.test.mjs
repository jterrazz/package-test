import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';

const { specification } = await import(process.env.IN_PLACE_ENTRY);
const { process: processService } = await import(
    process.env.IN_PLACE_ENTRY.replace(/index\.js$/u, 'services.js')
);

const api = processService({
    command: `node -e "require('node:fs').writeFileSync(process.env.PID_FILE, String(process.pid)); const s = require('node:http').createServer((q, r) => r.end(String(process.pid))); s.listen(0, '127.0.0.1', () => console.log('listening on port ' + s.address().port))"`,
    env: { PID_FILE: resolve('served.pid') },
    ready: /listening on port (\d+)/u,
});

const { integration } = await specification.integration({ services: { api } });

test('the run is killed with its server up', async () => {
    await integration.call(() => undefined);
    const answer = await fetch(api.url);
    writeFileSync(resolve('answered.pid'), await answer.text());
    process.kill(process.ppid, 'SIGKILL');
    process.kill(process.pid, 'SIGKILL');
});
