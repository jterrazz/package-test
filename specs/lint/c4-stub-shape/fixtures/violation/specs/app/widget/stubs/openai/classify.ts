import { defineStub, http } from '@jterrazz/test';

// The folder says openai, every builder the unit calls says http (C4).
export default defineStub({
    request: http.get('https://example.test/classify'),
    response: http.json({ category: 'APPAREL' }),
});
