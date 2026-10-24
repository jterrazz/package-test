import { describe, expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { api } from '../../setup/widget.specification.js';

describe('widget', () => {
    test('replays the recorded request', async () => {
        // Given - a recorded request fixture
        const result = await api.request(file('./__requests__/create.http')); // checker-disable-line ground-shared-or-inline -- an input tree of the checker spec: its file form is what the rule reads

        // Then - the response is defined
        expect(result.response).toMatch(file('./__expected__/created.http')); // checker-disable-line ground-shared-or-inline -- an input tree of the checker spec: its file form is what the rule reads
        expect(result).toBeDefined();
        expect(result.response).toMatch(file('./__expected__/created.http'));
    });

    test('probes the deployment at a url written whole, and it never answers', async () => {
        // Given - a request naming its url whole
        const result = await api.request(file('./__requests__/probe.http')); // checker-disable-line ground-shared-or-inline -- an input tree of the checker spec: its file form is what the rule reads

        // Then - the one line of an exchange that never answered
        expect(result.response).toMatch(file('./__expected__/refused.http')); // checker-disable-line ground-shared-or-inline -- an input tree of the checker spec: its file form is what the rule reads
    });
});
