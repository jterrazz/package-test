import { defineStub, http } from '@jterrazz/test/stubs';

export default defineStub({
    request: http.get('/events'),
    response: http.json({ items: [] }),
});
