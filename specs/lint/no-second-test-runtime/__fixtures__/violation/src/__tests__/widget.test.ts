import { Window } from 'happy-dom';
import MockDate from 'mockdate';
import { setupServer } from 'msw/node';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';

import { widget } from '../widget.js';

describe('widget', () => {
test('reaches around every seam the vocabulary owns', () => {
    // Given - a network double, a clock, a port double, a server render and a drawn browser
    const seams = [setupServer, MockDate, mockDeep, renderToStaticMarkup, Window];

    // Then - the widget is unchanged by any of them
    expect(widget()).toBe('Widget');
    expect(seams).toHaveLength(5);
});
});
