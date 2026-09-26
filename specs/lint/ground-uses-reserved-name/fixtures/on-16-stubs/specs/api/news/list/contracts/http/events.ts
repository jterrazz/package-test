import { defineContract, http } from '@jterrazz/test';

// oxlint-disable-next-line jterrazz/c4-contract-shape -- a 16 id that no longer exists
export default defineContract({
    request: http.get('https://news.test/events'),
    response: http.json({ items: [] }),
});
