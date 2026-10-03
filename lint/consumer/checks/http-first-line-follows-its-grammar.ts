import type { Spotted } from './checker.js';

function firstLine(text: string): string | undefined {
    return text
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.length > 0);
}

const REQUEST_LINE = /^(?<method>GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \/\S*/u;
const STATUS_LINE = /^HTTP\/\d(?:\.\d)? \d{3}\b/u;

const GRAMMAR = {
    request: {
        line: REQUEST_LINE,
        teaching: (name: string) => ({
            fix: `start ${name} with its request line, \`GET /path\` or another method`,
            found: `the first line of ${name} is no request line`,
        }),
    },
    response: {
        line: STATUS_LINE,
        teaching: (name: string) => ({
            fix: `start ${name} with its status line, \`HTTP/1.1 200 OK\` or the status it expects`,
            found: `the first line of ${name} is no status line`,
        }),
    },
};

export function checkHttpFirstLineFollowsItsGrammar(
    file: string,
    name: string,
    text: string,
    side: keyof typeof GRAMMAR,
): Spotted[] {
    const { line, teaching } = GRAMMAR[side];
    return line.test(String(firstLine(text)))
        ? []
        : [
              {
                  path: file,
                  line: 1,
                  ...teaching(name),
                  rule: 'http-first-line-follows-its-grammar',
              },
          ];
}
