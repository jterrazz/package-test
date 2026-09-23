import { describe, expect, test } from 'vitest';

import { website } from '../website.specification.js';

describe('document', () => {
    test('reads the title, the rendered markup and the head links of the page it visited', async () => {
        // Given - a visit to the landmarks page, scripts run
        const result = await website.visit('/landmarks');

        // Then - the title as text, the DOM as the browser serialised it, and every <link> of the head in order
        expect(result.title.text).toBe('Fixture — Landmarks');
        expect(result.html).toMatch(`
        <html lang="en"><head>
            <title>Fixture — Landmarks</title>
            <meta name="description" content="A tiny site the specs can trust.">
            <meta property="og:title" content="Fixture — Landmarks">
            <meta property="og:image" content="https://site.test/assets/card.png">
            <link rel="canonical" href="https://site.test/landmarks">
            <link rel="alternate" hreflang="en" href="https://site.test/landmarks">
            <link rel="alternate" hreflang="fr" href="https://site.test/fr/landmarks">
            <link rel="alternate" hreflang="x-default" href="https://site.test/landmarks">
            </head><body>
            <header><h1>Landmarks</h1></header>
            <main>
                <h2>Scores</h2>
                <table aria-label="Scores">
                    <tbody><tr><th>Player</th><th>Score</th></tr>
                    <tr><td>Alice</td><td>3</td></tr>
                </tbody></table>
                <ul aria-label="Tags"><li>news</li><li>opinion</li></ul>
                <p role="status">Saved</p>
                <form aria-label="Subscribe">
                    <label><input type="checkbox" id="terms"> Accept terms</label>
                    <label for="name">Name</label>
                    <input id="name">
                </form>
                <p id="accepted" hidden="">Terms accepted</p>
                <p id="greeting" hidden=""></p>
                <div role="search"><label for="query">Query</label><input id="query" type="search"></div>
                <button type="button" id="help">Help</button>
                <p id="tooltip" hidden="">Help is on its way</p>
                <div data-testid="chart"><canvas width="10" height="10"></canvas></div>
            </main>
            <aside aria-label="Related"><a href="/articles">Articles</a></aside>
            <dialog open="" aria-label="Cookies"><p>We keep none</p></dialog>
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
            </body></html>`);
        expect(result.links).toMatchObject([
            { href: 'https://site.test/landmarks', rel: 'canonical' },
            { href: 'https://site.test/landmarks', hreflang: 'en', rel: 'alternate' },
            { href: 'https://site.test/fr/landmarks', hreflang: 'fr', rel: 'alternate' },
            { href: 'https://site.test/landmarks', hreflang: 'x-default', rel: 'alternate' },
        ]);
    });
});
