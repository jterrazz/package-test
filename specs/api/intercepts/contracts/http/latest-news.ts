import { defineContract, http } from '../../../../../src/index.js';

export default defineContract({
    request: http.get('https://news.spec.test/api/latest'),
    response: http.json({ headline: 'Contract headline' }),
});
