import { component, content } from '@jterrazz/test';
import { expect, test } from 'vitest';

test('builds a node in the browser that will run it', async () => {
    // Given - the rendered kind, beside the component it renders
    const result = await component.render(
        (container) => {
            container.append(document.createElement('div'));
        },
        async (visitor) => {
            await visitor.see(content(''));
        },
    );

    // Then - a document is exactly what this kind of test has
    expect(result.html).toContain('div');
});
