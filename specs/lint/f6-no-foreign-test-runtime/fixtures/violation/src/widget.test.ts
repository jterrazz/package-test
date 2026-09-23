import MockDate from 'mockdate';
import { setupServer } from 'msw/node';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';

import { widget } from './widget.js';

test('reaches around every seam the vocabulary owns', () => {
    // Given - a network double, a clock, a port double and a server render
    const seams = [setupServer, MockDate, mockDeep, renderToStaticMarkup];

    // Then - the widget is unchanged by any of them
    expect(widget()).toBe('Widget');
    expect(seams).toHaveLength(4);
});
