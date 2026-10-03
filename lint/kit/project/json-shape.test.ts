import { describe, expect, test } from 'vitest';

import { packedFilenames, recordAt, stringListAt, stringsAt } from './json-shape.js';

describe('json-shape', () => {
    test('a field of another shape reads as absent', () => {
        // Given - a manifest whose blocks are partly of the wrong shape
        const manifest: unknown = JSON.parse(
            '{"dependencies":{"a":"1","b":2},"exports":["x"],"files":["dist",3]}',
        );

        // Then - the strings a block holds, an empty record for a list, the strings of a list
        expect({
            dependencies: stringsAt(manifest, 'dependencies'),
            exports: recordAt(manifest, 'exports'),
            files: stringListAt(manifest, 'files'),
            missing: stringsAt(manifest, 'peerDependencies'),
        }).toStrictEqual({ dependencies: { a: '1' }, exports: {}, files: ['dist'], missing: {} });
    });

    test.each([
        ['{"@jterrazz/test":{"filename":"jterrazz-test-17.0.0.tgz"}}'],
        ['[{"filename":"jterrazz-test-17.0.0.tgz"}]'],
    ])('the tarball npm pack reports is read from %s', (report) => {
        // Given - a report in the shape one npm version prints
        // Then - its one filename
        expect(packedFilenames(report)).toStrictEqual(['jterrazz-test-17.0.0.tgz']);
    });
});
