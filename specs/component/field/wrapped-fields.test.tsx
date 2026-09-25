import { component, field, status } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { WrappedFields } from './wrapped-fields.js';

test('names a field by its accessible name, whatever its label wraps', async () => {
    // Given - a select and a text input whose labels WRAP them: the label element's own text carries the control's text too, and the accessible name does not
    const result = await component.render(<WrappedFields />, async (visitor) => {
        await visitor.select(field('Channel'), 'newsletter');
        await visitor.fill(field('Title'), 'hexagonal');
        await visitor.see(status());
    });

    // Then - both fields answered to the name the screen reader reads
    expect(result.tree.text).toContain('combobox "Channel"');
    expect(result.content.text).toContain('newsletter · hexagonal');
});
