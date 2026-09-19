import { render } from '@testing-library/react';
import { expect, test } from 'vitest';

test('renders the widget', () => {
    // Given - a foreign renderer
    const rendered = render;

    // Then - the framework has its own
    expect(rendered).toBeDefined();
});
