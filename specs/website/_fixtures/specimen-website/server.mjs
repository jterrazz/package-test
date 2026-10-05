// The website fixture — a deliberately representative mini-site for the
// Website specification specs: full head surface (canonical, hreflang, OG,
// JSON-LD), a form with client behavior, a permanent redirect, robots.txt,
// And a console-noisy page. Zero dependencies; it binds port 0 and prints the
// Port it got.
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
    // It, and the run id the specification minted — neither of them sampled here.
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
    '/noisy': `<!doctype html><html lang="en"><head><title>Fixture — Noisy</title></head>
    <body><h1>Noisy</h1><script>console.log('hello'); console.error('boom');</script></body></html>`,
    // The ambiguity fixture: "Articles" appears three times — twice as the
    // WHOLE accessible name in two landmarks, once only as a substring ("Read
    // Articles"). The first pair is what target-matches-one-element refuses to guess between; the third
    // Is what a substring match would fold in silently.
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
    // Every landmark and container the element vocabulary names, and the
    // Controls the four remaining verbs drive: a checkbox, a field answered
    // By a key, a button that explains itself on hover.
    '/landmarks': `<!doctype html><html lang="en"><head>${head('Fixture — Landmarks', '/landmarks')}
    </head><body>
    <header><h1>Landmarks</h1></header>
    <main>
        <h2>Scores</h2>
        <table aria-label="Scores">
            <tr><th>Player</th><th>Score</th></tr>
            <tr><td>Alice</td><td>3</td></tr>
        </table>
        <ul aria-label="Tags"><li>news</li><li>opinion</li></ul>
        <p role="status">Saved</p>
        <form aria-label="Subscribe">
            <label><input type="checkbox" id="terms"> Accept terms</label>
            <label for="name">Name</label>
            <input id="name">
        </form>
        <p id="accepted" hidden>Terms accepted</p>
        <p id="greeting" hidden></p>
        <div role="search"><label for="query">Query</label><input id="query" type="search"></div>
        <button type="button" id="help">Help</button>
        <p id="tooltip" hidden>Help is on its way</p>
        <div data-testid="chart"><canvas width="10" height="10"></canvas></div>
    </main>
    <aside aria-label="Related"><a href="/articles">Articles</a></aside>
    <dialog open aria-label="Cookies"><p>We keep none</p></dialog>
    <footer><p>Fixture footer</p></footer>
    <script>
        document.getElementById('terms').addEventListener('change', (event) => {
            document.getElementById('accepted').hidden = !event.target.checked;
        });
        document.querySelector('form').addEventListener('submit', (event) => {
            event.preventDefault();
        });
        document.getElementById('name').addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                const greeting = document.getElementById('greeting');
                greeting.textContent = 'Hello, ' + event.target.value;
                greeting.hidden = false;
            }
        });
        document.getElementById('help').addEventListener('mouseenter', () => {
            document.getElementById('tooltip').hidden = false;
        });
    </script>
    </body></html>`,
    // A search landmark the HTML `<search>` element carries, with no `role`
    // Attribute to spell it — and a "Go" button inside it and outside it.
    '/search': `<!doctype html><html lang="en"><head>${head('Fixture — Search', '/search')}
    </head><body>
    <h1>Search</h1>
    <search aria-label="Site"><label for="site-query">Query</label><input id="site-query" type="search"><button type="button">Go</button></search>
    <main><button type="button">Go</button></main>
    </body></html>`,
    // Three "Remove" buttons, each in a `<section>`: one named by its label,
    // One by the heading it points at, one unnamed — no region at all.
    '/regions': `<!doctype html><html lang="en"><head>${head('Fixture — Regions', '/regions')}
    </head><body>
    <main>
        <h1>Regions</h1>
        <section aria-label="Orders"><button type="button">Remove</button></section>
        <section aria-labelledby="returns-title"><h2 id="returns-title">Returns</h2><button type="button">Remove</button></section>
        <section><button type="button">Remove</button></section>
    </main>
    </body></html>`,
    // A "Home" link in a list the nav holds, the list carrying a role of its
    // Own, and another "Home" in the footer.
    '/listed': `<!doctype html><html lang="en"><head>${head('Fixture — Listed', '/listed')}
    </head><body>
    <nav><ul role="list"><li><a href="/">Home</a></li></ul></nav>
    <main><h1>Listed</h1></main>
    <footer><a href="/">Home</a></footer>
    </body></html>`,
    // A page whose script throws, with nothing to catch it and nothing logged.
    '/thrown': `<!doctype html><html lang="en"><head><title>Fixture — Thrown</title></head>
    <body><h1>Thrown</h1><script>throw new Error('the page broke');</script></body></html>`,
    // A page that stamps its build in every surface a result reads — the text,
    // The markup, the title, the console and its errors — for a runner's
    // `transform` to normalise before any comparison.
    '/stamped': `<!doctype html><html lang="en"><head><title>Stamped — build 7f3a</title></head>
    <body><h1>Stamped</h1><p>build 7f3a</p>
    <script>console.log('build 7f3a'); console.error('build 7f3a failed');</script>
    </body></html>`,
    // A page asking for a resource on ANOTHER origin — the same server, named
    // By its other host — and saying whether the request left the site.
    '/external': `<!doctype html><html lang="en"><head><title>Fixture — External</title></head>
    <body><h1>External</h1><p id="external">pending</p>
    <script>
        const other = location.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
        fetch('http://' + other + ':' + location.port + '/robots.txt', { mode: 'no-cors' }).then(
            () => { document.getElementById('external').textContent = 'Cross-origin reached'; },
            () => { document.getElementById('external').textContent = 'Cross-origin blocked'; },
        );
    </script>
    </body></html>`,
};

/** A page rendered on the SERVER from what the declared backend answered. */
async function greetingPage() {
    const answer = await fetch(`${process.env.API_URL}/greeting`);
    const { message } = await answer.json();
    return `<!doctype html><html lang="en"><head><title>Fixture — Greeting</title></head>
    <body><h1>Greeting</h1><p>${message}</p></body></html>`;
}

const server = createServer(async (request, response) => {
    if (request.url === '/greeting') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(await greetingPage());
        return;
    }
    if (request.url === '/tenant') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(
            `<!doctype html><html lang="en"><head><title>Fixture — Tenant</title></head><body><h1>Tenant</h1><p>${request.headers['x-tenant'] ?? 'none'}</p></body></html>`,
        );
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

// It binds the port the OS hands it and announces it: the spec reads it off
// That line (`ready: /listening on port (\d+)/`) and never picks one.
server.listen(0, '127.0.0.1', () => {
    process.stdout.write(`listening on port ${server.address().port}\n`);
});
