import { defineStub, http } from '@jterrazz/test';

export default defineStub({
    request: http.get('https://news.spec.test/api/latest'),
    response: http.json({ headline: 'Stub headline' }),
});
