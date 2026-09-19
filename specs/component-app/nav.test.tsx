import { component, content, link, navigation, within } from '@jterrazz/test';
import { createRoutesStub } from 'react-router';
import { expect, test } from 'vitest';

import { Nav } from './nav.js';

test('renders under the router stub the test gives it', async () => {
    // Given - the router the component cannot render without, as a test-local Given
    const Routed = createRoutesStub([{ Component: Nav, path: '/read/:slug' }]);
    const result = await component
        .wrap(() => <Routed initialEntries={['/read/the-post']} />)
        .render(<Nav />, async (visitor) => {
            await visitor.see(within(navigation('Reader'), link('Posts')));
            await visitor.see(content('Reading: the-post'));
        });

    // Then - the route parameter reached the component, and nothing complained
    expect(result.content).toContain('Reading: the-post');
    await expect(result.errors).toBeEmpty();
});
