import { describe, expect, test } from 'vitest';

import { commandWords, declaredCommands } from '../command-words.js';

describe('commandWords', () => {
    test.each([
        ['db migrate --dry-run', ['db']],
        ['spawn shop', ['spawn']],
        ['--help', []],
        ['.', []],
        ['check ./src', ['check']],
    ])('with no declared list, the command line %j names the command %j', (line, words) => {
        // Given - a command line a chain runs, its runner declaring no command list
        // Then - the first word alone names the command: a positional argument is no subcommand
        expect(commandWords(line)).toStrictEqual(words);
    });

    test.each([
        ['db migrate --dry-run', ['db', 'migrate']],
        ['spawn shop', ['spawn']],
        ['migrate db', ['migrate', 'db']],
        ['shop', []],
        ['--help', []],
        ['  db  migrate', ['db', 'migrate']],
    ])('with the list db, migrate, spawn, the command line %j names %j', (line, words) => {
        // Given - a runner declaring the words its commands are spelled with
        const commands = ['db', 'migrate', 'spawn'];

        // Then - the leading words the list holds name the command, the first other word ends it
        expect(commandWords(line, commands)).toStrictEqual(words);
    });

    test('the list a specification module declares is read from its cli constructor', () => {
        // Given - a door declaring its commands among other options, and one declaring none
        const declaring = [
            "import { specification } from '@jterrazz/test';",
            "// commands: ['ignored'] in a comment",
            "export const { cleanup, cli } = await specification.cli(BIN, { defaults: { TZ: 'UTC' }, commands: ['db', \"migrate\"] });",
        ].join('\n');
        const silent =
            'export const { cleanup, cli } = await specification.cli(BIN, { commands });';

        // Then - the literal words, and nothing where the list is bound to nothing or absent
        expect(declaredCommands(declaring)).toStrictEqual(['db', 'migrate']);
        expect(declaredCommands(silent)).toBeUndefined();
        expect(
            declaredCommands('export const { cli } = await specification.cli(BIN);'),
        ).toBeUndefined();
    });

    test.each([
        ['commands: COMMANDS', "const COMMANDS = ['db', 'migrate'] as const;"],
        ['commands', "const commands: readonly string[] = ['db', 'migrate'];"],
    ])('a list bound to a const of the runner file is followed (%s)', (option, binding) => {
        // Given - the runner naming its list by a const of its own file
        const door = [
            binding,
            `export const { cleanup, cli } = await specification.cli(BIN, { ${option} });`,
        ].join('\n');

        // Then - the words the const binds
        expect(declaredCommands(door)).toStrictEqual(['db', 'migrate']);
    });

    test.each([
        ["specification.cli(BIN, { commands: ['db', name] });", ['db']],
        ["specification.cli(BIN, { commands :['db'] });", ['db']],
        ["specification.cli(BIN, {commands:['db']});", ['db']],
        ["const $LIST = ['db'];\nspecification.cli(BIN, { commands: $LIST });", ['db']],
        ["const commands = ['db'];\nspecification.cli(BIN, {commands});", ['db']],
        ["const commands = ['db'];\nspecification.cli(BIN, { commands, defaults: {} });", ['db']],
        ["const LIST = ['db'];\nspecification.cli(BIN, { commands:LIST });", ['db']],
        ["const LIST = ['db'];\nspecification.cli(BIN, { commands : LIST });", ['db']],
        ['specification.cli(BIN, { commands: ELSEWHERE });', undefined],
        ['specification.api({});', undefined],
    ])('the door %j declares %j', (door, words) => {
        // Given - a runner module declaring its words that way
        // Then - the literal words it holds, or nothing
        expect(declaredCommands(door)).toStrictEqual(words);
    });
});
