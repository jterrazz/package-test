// Serves `--port <n>` by forwarding every request to the protocol double the
// Run's global setup names in APPIUM_DOUBLE_URL. It writes the simulator each
// New session asks for to `udid`, and `stopped` when it is terminated. It
// Exits when the run that spawned it is gone.
import { appendFileSync, writeFileSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { join } from 'node:path';

const port = Number(process.argv[process.argv.indexOf('--port') + 1]);
const target = new URL(process.env.APPIUM_DOUBLE_URL);

process.on('SIGTERM', () => {
    writeFileSync(join(import.meta.dirname, 'stopped'), '');
    process.exit(0);
});

// A run killed before its teardown never stops this server: it goes with the run.
const run = process.ppid;
setInterval(() => {
    if (process.ppid !== run) {
        process.exit(0);
    }
}, 200).unref();

createServer((incoming, outgoing) => {
    const chunks = [];
    incoming.on('data', (chunk) => chunks.push(chunk));
    incoming.on('end', () => {
        const body = Buffer.concat(chunks);
        if (incoming.method === 'POST' && incoming.url === '/session') {
            const asked = JSON.parse(body.toString()).capabilities.alwaysMatch['appium:udid'];
            appendFileSync(join(import.meta.dirname, 'udid'), `${asked}\n`);
        }
        const forwarded = request(
            { headers: incoming.headers, host: target.hostname, method: incoming.method, path: incoming.url, port: target.port },
            (answer) => {
                outgoing.writeHead(answer.statusCode ?? 502, answer.headers);
                answer.pipe(outgoing);
            },
        );
        forwarded.end(body);
    });
}).listen(port, '127.0.0.1');
