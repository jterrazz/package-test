import { button, component } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { RemovalRegions } from './removal-regions.js';

describe('RemovalRegions', () => {
    test('offers a named `<section>` as the region it is, by its name', async () => {
        // Given - a "Remove" button in a section named by its label, one named by its heading, one in an unnamed section
        const refusal = await component
            .render(<RemovalRegions />, async (visitor) => {
                await visitor.click(button('Remove'));
            })
            .then(() => '')
            .catch((error: unknown) => (error instanceof Error ? error.message : ''));

        // Then - each named section is a region() rewrite, and the unnamed one is evidence only
        expect(refusal).toContain('in <section>');
        expect(refusal).toContain(
            'within(region("Orders"), button("Remove"))   [leaves 1 of 3]   [also here: region("Returns")]',
        );
    });
});
