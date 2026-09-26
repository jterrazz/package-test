import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification.js';

const ROLE = 'admin';

describe('created', () => {
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

test('creates a crowd and answers with its id', async () => {
    // Given - a user posted
    const result = await api.post('/users', { "name": "Ada" });

    // Then - a body of 156 lines past the expected cap, its id an asymmetric matcher the fixer cannot read
    expect(result.json).toMatch({
        "id": expect.any(String),
        "name": "Ada",
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
            "role 26",
            "role 27",
            "role 28",
            "role 29",
            "role 30",
            "role 31",
            "role 32",
            "role 33",
            "role 34",
            "role 35",
            "role 36",
            "role 37",
            "role 38",
            "role 39",
            "role 40",
            "role 41",
            "role 42",
            "role 43",
            "role 44",
            "role 45",
            "role 46",
            "role 47",
            "role 48",
            "role 49",
            "role 50",
            "role 51",
            "role 52",
            "role 53",
            "role 54",
            "role 55",
            "role 56",
            "role 57",
            "role 58",
            "role 59",
            "role 60",
            "role 61",
            "role 62",
            "role 63",
            "role 64",
            "role 65",
            "role 66",
            "role 67",
            "role 68",
            "role 69",
            "role 70",
            "role 71",
            "role 72",
            "role 73",
            "role 74",
            "role 75",
            "role 76",
            "role 77",
            "role 78",
            "role 79",
            "role 80",
            "role 81",
            "role 82",
            "role 83",
            "role 84",
            "role 85",
            "role 86",
            "role 87",
            "role 88",
            "role 89",
            "role 90",
            "role 91",
            "role 92",
            "role 93",
            "role 94",
            "role 95",
            "role 96",
            "role 97",
            "role 98",
            "role 99",
            "role 100",
            "role 101",
            "role 102",
            "role 103",
            "role 104",
            "role 105",
            "role 106",
            "role 107",
            "role 108",
            "role 109",
            "role 110",
            "role 111",
            "role 112",
            "role 113",
            "role 114",
            "role 115",
            "role 116",
            "role 117",
            "role 118",
            "role 119",
            "role 120",
            "role 121",
            "role 122",
            "role 123",
            "role 124",
            "role 125",
            "role 126",
            "role 127",
            "role 128",
            "role 129",
            "role 130",
            "role 131",
            "role 132",
            "role 133",
            "role 134",
            "role 135",
            "role 136",
            "role 137",
            "role 138",
            "role 139",
            "role 140",
            "role 141",
            "role 142",
            "role 143",
            "role 144",
            "role 145",
            "role 146",
            "role 147",
            "role 148",
            "role 149",
        ]
    });
});
});
