import { once } from 'node:events';
import { createServer } from 'node:http';
import { onTestFinished } from 'vitest';

/** The W3C calls an Appium server answers, enough for webdriverio to open, drive and end a session; each call logged as `METHOD path [script]`. */
export async function fakeAppium(source: string): Promise<{ calls: string[]; url: string }> {
    const calls: string[] = [];
    const server = createServer((request, response) => {
        const chunks: Buffer[] = [];
        request.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
        });
        request.on('end', () => {
            const body: unknown =
                chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString('utf8'));
            const path = String(request.url).replace(/^\/session\/[^/]+/u, '/session/:id');
            const script =
                typeof body === 'object' && body !== null && 'script' in body
                    ? ` ${String(body.script)}`
                    : '';
            calls.push(`${String(request.method)} ${path}${script}`);
            const capabilities =
                typeof body === 'object' && body !== null && 'capabilities' in body
                    ? body.capabilities
                    : {};
            const value =
                path === '/session'
                    ? { capabilities, sessionId: 'fake-session' }
                    : path === '/session/:id/source'
                      ? source
                      : null;
            response.writeHead(200, { 'content-type': 'application/json' });
            response.end(JSON.stringify({ value }));
        });
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    onTestFinished(() => {
        server.close();
    });
    const address = server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    return { calls, url: `http://127.0.0.1:${port}` };
}
