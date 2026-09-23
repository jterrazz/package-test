import { expect, test } from 'vitest'; // checker-disable-line c30 -- an input of C28: this folder is the case the rule reads, not a subject's standard name

import { api } from '../api.specification.js';

test('creates a crowd', async () => {
    // Given - a body of 31 lines, past the requests cap
    const result = await api.post('/users', {
        "name": "Crowd",
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
            "role 25"
        ]
    });

    // Then - it answered
    expect(result.status).toBe(201);
});

test('creates thirty', async () => {
    // Given - a body of 30 lines, the requests cap exactly
    const result = await api.post('/users', {
        "name": "Crowd",
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
            "role 24"
        ]
    });

    // Then - it answered
    expect(result.status).toBe(201);
});

test('lists everyone', async () => {
    // Given - the users
    const result = await api.get('/users'); // checker-disable-line c29 -- an input of C28: its tests reach two subjects on purpose

    // Then - a response of 151 lines, past the expected cap
    expect(result.response).toMatch(`
        HTTP/1.1 200 OK
        content-type: text/plain

        user 0
        user 1
        user 2
        user 3
        user 4
        user 5
        user 6
        user 7
        user 8
        user 9
        user 10
        user 11
        user 12
        user 13
        user 14
        user 15
        user 16
        user 17
        user 18
        user 19
        user 20
        user 21
        user 22
        user 23
        user 24
        user 25
        user 26
        user 27
        user 28
        user 29
        user 30
        user 31
        user 32
        user 33
        user 34
        user 35
        user 36
        user 37
        user 38
        user 39
        user 40
        user 41
        user 42
        user 43
        user 44
        user 45
        user 46
        user 47
        user 48
        user 49
        user 50
        user 51
        user 52
        user 53
        user 54
        user 55
        user 56
        user 57
        user 58
        user 59
        user 60
        user 61
        user 62
        user 63
        user 64
        user 65
        user 66
        user 67
        user 68
        user 69
        user 70
        user 71
        user 72
        user 73
        user 74
        user 75
        user 76
        user 77
        user 78
        user 79
        user 80
        user 81
        user 82
        user 83
        user 84
        user 85
        user 86
        user 87
        user 88
        user 89
        user 90
        user 91
        user 92
        user 93
        user 94
        user 95
        user 96
        user 97
        user 98
        user 99
        user 100
        user 101
        user 102
        user 103
        user 104
        user 105
        user 106
        user 107
        user 108
        user 109
        user 110
        user 111
        user 112
        user 113
        user 114
        user 115
        user 116
        user 117
        user 118
        user 119
        user 120
        user 121
        user 122
        user 123
        user 124
        user 125
        user 126
        user 127
        user 128
        user 129
        user 130
        user 131
        user 132
        user 133
        user 134
        user 135
        user 136
        user 137
        user 138
        user 139
        user 140
        user 141
        user 142
        user 143
        user 144
        user 145
        user 146
        user 147
    `);
});
