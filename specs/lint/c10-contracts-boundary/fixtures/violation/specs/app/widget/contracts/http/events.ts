import { defineContract, http } from '@jterrazz/test';

export default defineContract({
    request: http.get('/events'),
    response: http.json({ items: [] }),
});
