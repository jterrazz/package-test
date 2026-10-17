import { component, content } from '@jterrazz/test';
import { defineStub, http } from '@jterrazz/test/stubs';
import { describe, expect, test } from 'vitest';

import { PostTable } from './post-table.js';

const listing = defineStub({
    request: http.get('/api/posts'),
    response: http.json({
        posts: [
            { id: 1, title: 'A first post' },
            { id: 2, title: 'A second post' },
        ],
        total: 200,
    }),
});

describe('PostTable', () => {
    test('says how much of the collection the table is showing', async () => {
        // Given - a page of two rows answering for a collection of two hundred
        const result = await component.intercept(listing).render(<PostTable />, async (visitor) => {
            await visitor.see(content('Showing 2 of 200 posts'));
        });

        // Then - the table is qualified by what it is not showing, and says nothing else
        await expect(result.tree).toMatch(`
        - main:
          - region "Posts":
            - heading "Posts" [level=1]
            - table "Showing 2 of 200 posts":
              - caption: Showing 2 of 200 posts
              - rowgroup:
                - row "Title":
                  - columnheader "Title"
              - rowgroup:
                - row "A first post":
                  - cell "A first post"
                - row "A second post":
                  - cell "A second post"`);
        expect(result.console.text).toBe('');
    });

    test('fails the render when the component asks for what no stub declared', async () => {
        // Given - a stub for another path, so the table's own fetch is undeclared
        const elsewhere = defineStub({
            request: http.get('/api/articles'),
            response: http.json({ posts: [], total: 0 }),
        });
        const render = component.intercept(elsewhere).render(<PostTable />, async (visitor) => {
            await visitor.see(content('Could not load posts'));
        });

        // Then - strictness is total on this specification: the unmatched request IS the failure
        await expect(render).rejects.toThrow(/\/api\/posts/u);
    });

    test('fails the render when a component with no stub at all reaches the network', async () => {
        // Given - no `.intercept()` at all, and a table that asks for its rows
        const render = component.render(<PostTable />, async (visitor) => {
            await visitor.see(content('Could not load posts'));
        });

        // Then - `network-strict-after-first-stub` is TOTAL here: no stub means no network, not an open door
        await expect(render).rejects.toThrow(/\/api\/posts/u);
    });

    test('reports the undeclared request, not the scenario it made fail', async () => {
        // Given - no stub, and a scenario that gives up once the table could not load
        const render = component.render(<PostTable />, async (visitor) => {
            await visitor.see(content('Could not load posts'));
            throw new Error('the scenario expected rows');
        });

        // Then - the cause is what the render reports: the request no stub declared
        await expect(render).rejects.toThrow(/\/api\/posts/u);
    });

    test('serves a transport failure the way a server that is not running does', async () => {
        // Given - the collection declared unreachable rather than answering a status
        const offline = defineStub({
            request: http.get('/api/posts'),
            response: http.unreachable(),
        });
        const result = await component.intercept(offline).render(<PostTable />, async (visitor) => {
            await visitor.see(content('Could not load posts'));
        });

        // Then - the component took its "nothing answered" branch, not an error status
        expect(result.content.text).toContain('Could not load posts');
    });
});
