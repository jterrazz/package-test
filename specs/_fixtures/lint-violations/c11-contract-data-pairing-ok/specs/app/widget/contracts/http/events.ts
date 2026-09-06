import { defineContract, http } from '@jterrazz/test';

import payload from './events.response.json' with { type: 'json' };

export default defineContract({
    request: http.get('/events'),
    response: http.json(payload),
});
