import { defineContract, http } from '../../../../src/index.js';

export default defineContract({
    response: http.json({ headline: 'Contract headline' }),
    trigger: http.get('https://news.spec.test/api/latest'),
});
