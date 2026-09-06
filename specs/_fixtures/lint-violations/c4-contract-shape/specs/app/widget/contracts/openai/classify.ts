import { defineContract, http } from '@jterrazz/test';

// The folder says openai, the request builder says http (C4).
export default defineContract({
    request: http.get('https://example.test/classify'),
    response: http.json({ category: 'APPAREL' }),
});
