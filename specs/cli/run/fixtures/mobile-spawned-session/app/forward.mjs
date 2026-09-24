// Serves `--port <n>` by forwarding every request to the protocol double the
// Run's global setup names in APPIUM_DOUBLE_URL.
import { createServer, request } from 'node:http';

const port = Number(process.argv[process.argv.indexOf('--port') + 1]);
const target = new URL(process.env.APPIUM_DOUBLE_URL);

createServer((incoming, outgoing) => {
    const forwarded = request(
        { headers: incoming.headers, host: target.hostname, method: incoming.method, path: incoming.url, port: target.port },
        (answer) => {
            outgoing.writeHead(answer.statusCode ?? 502, answer.headers);
            answer.pipe(outgoing);
        },
    );
    incoming.pipe(forwarded);
}).listen(port, '127.0.0.1');
