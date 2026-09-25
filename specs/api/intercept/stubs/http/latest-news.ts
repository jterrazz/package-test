import { defineStub, http } from '../../../../../src/index.js';

export default defineStub({
    request: http.get('https://news.spec.test/api/latest'),
    response: http.json({ headline: 'Stub headline' }),
});
