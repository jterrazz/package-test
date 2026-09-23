import { defineContract, http } from '../../../../../src/index.js';

export default defineContract({
    request: http.get('https://enrich.example.test/label'),
    response: http.json({ label: 'enriched' }),
});
