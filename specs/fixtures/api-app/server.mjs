// A second process the website fixture is started BESIDE — the shape
// `services: { api: process(...) }` declares. Answers a health path the
// runner polls, and one JSON route the site reads at render time.
import { createServer } from 'node:http';

const server = createServer((request, response) => {
    if (request.url === '/health') {
        response.writeHead(200, { 'content-type': 'text/plain' });
        response.end('ok');
        return;
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ service: 'api', runId: process.env.TEST_RUN_ID ?? 'unset' }));
});

// It binds the port the OS hands it and announces it, which is how the runner
// Reads it (`ready: /listening on port (\d+)/`).
server.listen(0, '127.0.0.1', () => {
    process.stdout.write(`listening on port ${server.address().port}\n`);
});
