// Serves `--port <n>` by forwarding every request to the protocol double the
// Run's global setup names in APPIUM_DOUBLE_URL. It writes the simulator each
// New session asks for to `udid`, and `stopped` when it is terminated. It
// Exits when the run that spawned it is gone. Each new session starts a
// WebDriverAgent as the XCUITest driver does — an xcodebuild in a group of
// Its own, and the runner app on the simulator — which outlive this server,
// Their pids written to `webdriveragent`.
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { dirname, join } from 'node:path';

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

/** Node under the program's name, exiting on its own two minutes on: a run that fails to reap it leaves it no longer. */
function webDriverAgent(program, ...named) {
    mkdirSync(dirname(program), { recursive: true });
    if (!existsSync(program)) {
        symlinkSync(process.execPath, program);
    }
    const started = spawn(program, ['-e', 'setTimeout(() => {}, 120000)', ...named], {
        detached: true,
        stdio: 'ignore',
    });
    started.unref();
    appendFileSync(join(import.meta.dirname, 'webdriveragent'), `${started.pid}\n`);
}

createServer((incoming, outgoing) => {
    const chunks = [];
    incoming.on('data', (chunk) => chunks.push(chunk));
    incoming.on('end', () => {
        const body = Buffer.concat(chunks);
        if (incoming.method === 'POST' && incoming.url === '/session') {
            const asked = JSON.parse(body.toString()).capabilities.alwaysMatch['appium:udid'];
            appendFileSync(join(import.meta.dirname, 'udid'), `${asked}\n`);
            webDriverAgent(join(import.meta.dirname, 'bin/xcodebuild'), 'build-for-testing', 'test-without-building', '-project', 'WebDriverAgent.xcodeproj', '-destination', `id=${asked}`);
            webDriverAgent(join(import.meta.dirname, `Devices/${asked}/data/WebDriverAgentRunner-Runner.app/WebDriverAgentRunner-Runner`));
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
