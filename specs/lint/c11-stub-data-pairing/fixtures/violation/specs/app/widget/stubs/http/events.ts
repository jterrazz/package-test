import { defineStub, http } from '@jterrazz/test';

export default defineStub({
    request: http.get('/events'),
    response: http.json({ items: [] }),
});
