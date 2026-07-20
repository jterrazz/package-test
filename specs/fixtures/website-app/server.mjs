// The website fixture — a deliberately representative mini-site for the
// Website specification specs: full head surface (canonical, hreflang, OG,
// JSON-LD), a form with client behavior, a permanent redirect, robots.txt,
// And a console-noisy page. Zero dependencies; PORT comes from the runner.
import { createServer } from 'node:http';

const head = (title, path) => `
    <title>${title}</title>
    <meta name="description" content="A tiny site the specs can trust.">
    <meta property="og:title" content="${title}">
    <meta property="og:image" content="https://site.test/assets/card.png">
    <link rel="canonical" href="https://site.test${path}">
    <link rel="alternate" hreflang="en" href="https://site.test${path}">
    <link rel="alternate" hreflang="fr" href="https://site.test/fr${path}">
    <link rel="alternate" hreflang="x-default" href="https://site.test${path}">`;

const pages = {
    '/': `<!doctype html><html lang="en"><head>${head('Fixture — Home', '/')}
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Fixture","url":"https://site.test"}</script>
    </head><body>
    <h1>Welcome</h1>
    <a href="/articles">Articles</a>
    <form>
        <label for="email">Email</label>
        <input id="email" type="email">
        <button type="button" id="subscribe">Subscribe</button>
    </form>
    <p id="confirmation" hidden>Thanks for subscribing</p>
    <script>
        document.getElementById('subscribe').addEventListener('click', () => {
            document.getElementById('confirmation').hidden = false;
        });
    </script>
    </body></html>`,
    '/articles': `<!doctype html><html lang="en"><head>${head('Fixture — Articles', '/articles')}
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Blog","name":"All articles"}</script>
    </head><body><h1>All articles</h1><a href="/">Home</a></body></html>`,
    '/noisy': `<!doctype html><html lang="en"><head><title>Fixture — Noisy</title></head>
    <body><h1>Noisy</h1><script>console.log('hello'); console.error('boom');</script></body></html>`,
};

const server = createServer((request, response) => {
    if (request.url === '/old') {
        response.writeHead(308, { location: '/' });
        response.end();
        return;
    }
    if (request.url === '/robots.txt') {
        response.writeHead(200, { 'content-type': 'text/plain' });
        response.end('User-Agent: *\nAllow: /\n\nSitemap: https://site.test/sitemap.xml\n');
        return;
    }
    const page = pages[request.url];
    if (!page) {
        response.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
        response.end(
            '<!doctype html><html><head><title>Not found</title></head><body>404</body></html>',
        );
        return;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(page);
});

server.listen(Number(process.env.PORT ?? 3000));
