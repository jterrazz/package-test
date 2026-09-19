import {
    component,
    content,
    defineContract,
    heading,
    http,
    main,
    region,
    row,
    table,
    within,
} from '@jterrazz/test';
import { expect, test } from 'vitest';

import { PostTable } from './post-table.js';

const listing = defineContract({
    request: http.get('/api/posts'),
    response: http.json({
        posts: [
            { id: 1, title: 'A first post' },
            { id: 2, title: 'A second post' },
        ],
        total: 200,
    }),
});

test('says how much of the collection the table is showing', async () => {
    // Given - a page of two rows answering for a collection of two hundred
    const result = await component.intercept(listing).render(<PostTable />, async (visitor) => {
        await visitor.see(content('Showing 2 of 200 posts'));
    });

    // Then - the table is qualified by what it is not showing, and says nothing else
    await expect(result.tree).toMatch('posts-table.aria.yaml');
    await expect(result.console).toBeEmpty();
});

test('renders inside the frame the project wraps every render in', async () => {
    // Given - the same listing, read through the project's own providers
    const result = await component.intercept(listing).render(<PostTable />, async (visitor) => {
        const inPosts = within(region('Posts'), heading('Posts'));
        await visitor.see(within(main(), inPosts));
        await visitor.see(within(table('Showing 2 of 200 posts'), row('A first post')));
    });

    // Then - the rows are in the markup and in the rendered text
    expect(result.html).toContain('A second post');
    expect(result.content).toContain('Showing 2 of 200 posts');
});

test('fails the render when the component asks for what no contract declared', async () => {
    // Given - a contract for another path, so the table's own fetch is undeclared
    const elsewhere = defineContract({
        request: http.get('/api/articles'),
        response: http.json({ posts: [], total: 0 }),
    });
    const render = component.intercept(elsewhere).render(<PostTable />, async (visitor) => {
        await visitor.see(content('Could not load posts'));
    });

    // Then - strictness is total on this facet: the unmatched request IS the failure
    await expect(render).rejects.toThrow(/\/api\/posts/u);
});

test('fails the render when a component with no contract at all reaches the network', async () => {
    // Given - no `.intercept()` at all, and a table that asks for its rows
    const render = component.render(<PostTable />, async (visitor) => {
        await visitor.see(content('Could not load posts'));
    });

    // Then - D7 is TOTAL here: no contract means no network, not an open door
    await expect(render).rejects.toThrow(/\/api\/posts/u);
});

test('serves a transport failure the way a server that is not running does', async () => {
    // Given - the collection declared unreachable rather than answering a status
    const offline = defineContract({
        request: http.get('/api/posts'),
        response: http.unreachable(),
    });
    const result = await component.intercept(offline).render(<PostTable />, async (visitor) => {
        await visitor.see(content('Could not load posts'));
    });

    // Then - the component took its "nothing answered" branch, not an error status
    expect(result.content).toContain('Could not load posts');
});

test('replaces the first surface when one test renders twice', async () => {
    // Given - two renders in one test, the second the only one left standing
    await component.intercept(listing).render(<PostTable />);
    const result = await component.intercept(listing).render(<PostTable />, async (visitor) => {
        await visitor.see(heading('Posts'));
    });

    // Then - one document, one table: the first mount did not stay behind
    expect(result.content.text.match(/Showing 2 of 200 posts/gu)).toHaveLength(1);
});
