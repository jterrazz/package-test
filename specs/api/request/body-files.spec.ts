import { describe, expect, test } from 'vitest';

import { file } from '../../../src/index.js';
import { api } from '../api.specification.js';

describe('body-files', () => {
    test('a JSON body file is sent as its value, not as the layout of the file', async () => {
        // Given - a body named by its path
        // checker-disable-next-line ground-shared-or-inline -- the file form is the subject: a JSON body read from its file
        const result = await api.post('/echo-raw', file('./requests/erin.json'));

        // Then - the app received the compact JSON of the value
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "raw": "{\\"email\\":\\"erin@test.com\\",\\"name\\":\\"Erin\\"}"
            }
        `);
    });

    test('a body file that is not JSON is sent as its bytes are written', async () => {
        // Given - a plain-text body named by its path
        // checker-disable-next-line ground-shared-or-inline -- the file form is the subject: a text body read from its file
        const result = await api.post('/echo-raw', file('./requests/note.txt'));

        // Then - the app received the text verbatim, whitespace kept
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "raw": "kept  as\\n    written\\n"
            }
        `);
    });

    test('a request file whose body is plain text sends it verbatim, whitespace kept', async () => {
        // Given - a request file carrying a text body
        // checker-disable-next-line ground-shared-or-inline -- the file form is the subject: a complete request read from its .http file
        const result = await api.request(file('./requests/echo-raw.http'));

        // Then - the body arrived as written
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "raw": "first  line\\n    indented line"
            }
        `);
    });
});
