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
        <label for="channel">Channel</label>
        <select id="channel">
            <option value="x">X</option>
            <option value="linkedin">LinkedIn</option>
        </select>
        <label class="field"><span>Topic</span>
            <select id="topic">
                <option value="news">News</option>
                <option value="opinion">Opinion</option>
            </select>
        </label>
        <button type="button" id="subscribe">Subscribe</button>
        <button type="button" id="clear" disabled>Clear</button>
    </form>
    <p id="confirmation" hidden>Thanks for subscribing</p>
    <script>
        document.getElementById('subscribe').addEventListener('click', () => {
            document.getElementById('confirmation').hidden = false;
            document.getElementById('clear').disabled = false;
        });
    </script>
    </body></html>`,
    '/articles': `<!doctype html><html lang="en"><head>${head('Fixture — Articles', '/articles')}
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Blog","name":"All articles"}</script>
    </head><body><h1>All articles</h1><a href="/">Home</a></body></html>`,
    // The page whose content IS the moment it was opened: a site's own script
    // Reading `Date` is what `.clock()` pins, and only the page's clock can.
    '/clock': `<!doctype html><html lang="en"><head>${head('Fixture — Clock', '/clock')}
    </head><body><h1>Clock</h1><p id="now">unset</p>
    <script>document.getElementById('now').textContent = new Date().toISOString();</script>
    </body></html>`,
    // What the site was STARTED with: the URL of the process declared beside
    // It, and the run id the facet minted — neither of them sampled here.
    '/services': `<!doctype html><html lang="en"><head>${head('Fixture — Services', '/services')}
    </head><body><h1>Services</h1>
    <p id="api">${process.env.API_URL ?? 'unset'}</p>
    <p id="run">${process.env.TEST_RUN_ID ?? 'unset'}</p>
    </body></html>`,
    // The FRAMEWORK's own page: the two metas a view-transitions router writes
    // Into every head, which no spec ever asked for and no token can name — the
    // Runner's `transform` is the door that drops them before a comparison.
    '/framework': `<!doctype html><html lang="en"><head>${head('Fixture — Framework', '/framework')}
    <meta name="framework-transitions-enabled" content="">
    <meta name="framework-transitions-fallback" content="animate">
    </head><body><h1>Framework</h1></body></html>`,
    // The transitional window's own page. The button's accessible name is NOT
    // Its text content: the two block children glue to "Experiments9" when read
    // As text and join as "Experiments 9" when the browser computes the name —
    // And the name is what a descriptor matches. The field is named by its
    // Label alone, which is nowhere in its text at all. The `<h2>` carries the
    // NEXT page's heading as a substring, so a verb asked while the slow
    // Navigation is still in flight has something to widen to on the page it
    // Is leaving — which is the straddle the window must not fall for.
    '/window': `<!doctype html><html lang="en"><head>${head('Fixture — Window', '/window')}
    </head><body><h1>Window</h1><main>
    <button type="button"><span style="display:block">Experiments</span><span style="display:block">9</span></button>
    <label for="journal">Journal entry</label><input id="journal" type="text">
    <h2>All articles, in one place</h2>
    <a href="/window/list">Open the list</a>
    </main></body></html>`,
    // The destination of that link, whose `<h1>` is the heading exactly, served
    // Late on purpose (see the handler).
    '/window/list': `<!doctype html><html lang="en"><head>${head('Fixture — Window list', '/window/list')}
    </head><body><h1>All articles</h1></body></html>`,
    '/noisy': `<!doctype html><html lang="en"><head><title>Fixture — Noisy</title></head>
    <body><h1>Noisy</h1><script>console.log('hello'); console.error('boom');</script></body></html>`,
    // The ambiguity fixture: "Articles" appears three times — twice as the
    // WHOLE accessible name in two landmarks, once only as a substring ("Read
    // Articles"). The first pair is what W3 refuses to guess between; the third
    // Is what the pre-16.0 substring default used to fold in silently.
    '/ambiguous': `<!doctype html><html lang="en"><head>${head('Fixture — Ambiguous', '/ambiguous')}
    </head><body>
    <nav aria-label="Main"><a href="/articles">Articles</a></nav>
    <main>
        <h1>Ambiguous</h1>
        <a href="/articles">Read Articles</a>
        <section aria-label="Series"><a href="/articles/2">Part 2</a></section>
        <button type="button" aria-label="Delete post">Delete</button>
    </main>
    <dialog open><button type="button">Delete post</button></dialog>
    <footer><a href="/articles">Articles</a></footer>
    </body></html>`,
};

/** How late `/window/list` answers — long enough for a verb to be asked on the page being left. */
const SLOW_MS = 300;

const server = createServer((request, response) => {
    // The one slow route: a destination that arrives AFTER the verb following
    // The click is asked, which is the navigation a probe used to straddle.
    if (request.url === '/window/list') {
        setTimeout(() => {
            response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
            response.end(pages['/window/list']);
        }, SLOW_MS);
        return;
    }
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
