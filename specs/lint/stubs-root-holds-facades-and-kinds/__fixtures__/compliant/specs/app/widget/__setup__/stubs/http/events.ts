import { defineStub, http } from '@jterrazz/test/stubs';

import payload from '../../../__fixtures__/events.json' with { type: 'json' };

export default defineStub({
    request: http.get('/events'),
    response: http.json(payload),
});
