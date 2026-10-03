import { blankComments } from '@jterrazz/typescript/rules';

import { argumentsOf, closingOf, literalOf } from './source-scan.js';

const COMMAND_WORD = /^[a-z][a-z0-9-]*$/u;

/** Without the runner's declared list, the first word alone: a positional argument is never read as a subcommand. */
export function commandWords(line: string, commands?: readonly string[]): string[] {
    const words = line.trim().split(/\s+/u);
    if (commands === undefined) {
        const [first = ''] = words;
        return COMMAND_WORD.test(first) ? [first] : [];
    }
    const named: string[] = [];
    for (const word of words) {
        if (!commands.includes(word)) {
            break;
        }
        named.push(word);
    }
    return named;
}

const CLI_CONSTRUCTOR = /\bspecification\s*\.\s*cli\s*\(/u;

function wordsOf(text: string, open: number): string[] {
    return argumentsOf(text.slice(open + 1, closingOf(text, open))).flatMap((entry) => {
        const word = literalOf(entry);
        return word === undefined ? [] : [word];
    });
}

function constantWords(text: string, name: string): string[] | undefined {
    const escaped = name.replaceAll('$', String.raw`\$`);
    const binding = new RegExp(String.raw`\bconst\s+${escaped}\s*(?::[^=]+)?=\s*\[`, 'u').exec(
        text,
    );
    return binding === null ? undefined : wordsOf(text, binding.index + binding[0].length - 1);
}

/** Written as an array or bound to a `const` of the same file (`commands: COMMANDS`, `{ commands }`). */
export function declaredCommands(door: string): string[] | undefined {
    const text = blankComments(door);
    const call = CLI_CONSTRUCTOR.exec(text);
    if (call === null) {
        return undefined;
    }
    const open = call.index + call[0].length - 1;
    const [, options = ''] = argumentsOf(text.slice(open + 1, closingOf(text, open)));
    const list = /(?:^|[{,\s])commands\s*:\s*\[/u.exec(options);
    if (list !== null) {
        return wordsOf(options, list.index + list[0].length - 1);
    }
    const named =
        /(?:^|[{,\s])commands\s*:\s*(?<name>[A-Za-z_$][\w$]*)/u.exec(options)?.groups?.name ??
        (/(?:^|[{,\s])commands\s*(?=[,}])/u.test(options) ? 'commands' : undefined);
    return named === undefined ? undefined : constantWords(text, named);
}
