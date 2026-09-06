#!/usr/bin/env node
/**
 * The server a literate `serve:` line starts.
 *
 * It picks its OWN port (listen on 0) and announces it on stdout —
 * `listening on port <n>` — which is the readiness form a `serve:`
 * registration declares: a regex whose one capture group is the port. The
 * framework reads the banner, builds the URL, and binds it to the variable the
 * registration names.
 *
 * `LITERATE_GREETING` shows the per-line extra env of `serve: echo KEY=value`.
 */
import { createServer } from 'node:http';

const greeting = process.env.LITERATE_GREETING ?? 'hello';

const server = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ greeting, path: request.url }));
});

server.listen(0, '127.0.0.1', () => {
    process.stdout.write(`listening on port ${server.address().port}\n`);
});
