import { expect, test } from 'vitest';

import { api } from '../../api.specification.js';

const ROLE = 'admin';

test('creates a crowd around its role', async () => {
    // Given - a body of 31 lines past the requests cap, one value a name the fixer cannot read
    const result = await api.post('/users', {
        "name": ROLE,
        "roles": [
            "role 0",
            "role 1",
            "role 2",
            "role 3",
            "role 4",
            "role 5",
            "role 6",
            "role 7",
            "role 8",
            "role 9",
            "role 10",
            "role 11",
            "role 12",
            "role 13",
            "role 14",
            "role 15",
            "role 16",
            "role 17",
            "role 18",
            "role 19",
            "role 20",
            "role 21",
            "role 22",
            "role 23",
            "role 24",
            "role 25",
        ]
    });

    // Then - it answered
    expect(result.status).toBe(201);
});

test('creates a crowd by its request', async () => {
    // Given - a request of 32 lines past the requests cap, a hole in each header
    const result = await api.request(`
        POST /users HTTP/1.1
        x-role-0: ${ROLE}
        x-role-1: ${ROLE}
        x-role-2: ${ROLE}
        x-role-3: ${ROLE}
        x-role-4: ${ROLE}
        x-role-5: ${ROLE}
        x-role-6: ${ROLE}
        x-role-7: ${ROLE}
        x-role-8: ${ROLE}
        x-role-9: ${ROLE}
        x-role-10: ${ROLE}
        x-role-11: ${ROLE}
        x-role-12: ${ROLE}
        x-role-13: ${ROLE}
        x-role-14: ${ROLE}
        x-role-15: ${ROLE}
        x-role-16: ${ROLE}
        x-role-17: ${ROLE}
        x-role-18: ${ROLE}
        x-role-19: ${ROLE}
        x-role-20: ${ROLE}
        x-role-21: ${ROLE}
        x-role-22: ${ROLE}
        x-role-23: ${ROLE}
        x-role-24: ${ROLE}
        x-role-25: ${ROLE}
        x-role-26: ${ROLE}
        x-role-27: ${ROLE}
        x-role-28: ${ROLE}
        x-role-29: ${ROLE}
    `);

    // Then - it answered
    expect(result.status).toBe(201);
});
