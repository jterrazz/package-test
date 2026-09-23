import { describe, expect, test } from 'vitest';

import { website } from '../normalisation.specification.js';

describe('stamped', () => {
    test('the transform reaches the text, the tree, the markup and the title, and never the capture', async () => {
        // Given - a page stamping its build in its title, its text and its markup
        const result = await website.visit('/stamped');

        // Then - each reading a comparison uses is normalised; what the page said is still there to read
        expect(result.content.text).toContain('build <stamp>');
        expect(result.tree.text).toContain('build <stamp>');
        expect(result.html.text).toContain('<p>build <stamp></p>');
        expect(result.title.text).toBe('Stamped — build <stamp>');
        expect(result.html.raw).toMatch(/<p>build 7f3a<\/p>/u);
    });

    test('the transform reaches the console and the errors too', async () => {
        // Given - the same page, which logs its build and reports it as an error
        const result = await website.visit('/stamped');

        // Then - both streams are compared normalised, and captured as they were
        expect(result.console.text).toContain('build <stamp>');
        expect(result.errors.text).toContain('build <stamp> failed');
        expect(result.errors.raw).toMatch(/build 7f3a failed/u);
    });
});
