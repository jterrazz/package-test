import { defineStub, http } from '@jterrazz/test';

import payload from '../../../_fixtures/events.json' with { type: 'json' };

export default defineStub({
    request: http.get('/events'),
    response: http.json(payload),
});
