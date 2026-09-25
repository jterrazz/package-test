import { component, heading, main, region, row, table, within } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

describe('Providers', () => {
    test('renders inside the frame the project wraps every render in', async () => {
        // Given - a listing rendered with no frame of its own, read through the project's providers
        const result = await component.render(
            <section aria-label="Posts">
                <h1>Posts</h1>
                <table>
                    <caption>Showing 2 of 200 posts</caption>
                    <tbody>
                        <tr>
                            <td>A first post</td>
                        </tr>
                        <tr>
                            <td>A second post</td>
                        </tr>
                    </tbody>
                </table>
            </section>,
            async (visitor) => {
                const inPosts = within(region('Posts'), heading('Posts'));
                await visitor.see(within(main(), inPosts));
                await visitor.see(within(table('Showing 2 of 200 posts'), row('A first post')));
            },
        );

        // Then - the rows are in the markup and in the rendered text
        expect(result.html.text).toContain('A second post');
        expect(result.content.text).toContain('Showing 2 of 200 posts');
    });
});
