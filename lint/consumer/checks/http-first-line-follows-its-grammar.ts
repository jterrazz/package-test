import type { Finding } from './checker.js';

function firstLine(text: string): string {
    for (const line of text.split('\n')) {
        if (line.trim().length > 0) {
            return line.trim();
        }
    }
    return '';
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
): Finding[] {
    const { line, teaching } = GRAMMAR[side];
    return line.test(firstLine(text))
        ? []
        : [
              {
                  file,
                  line: 1,
                  ...teaching(name),
                  rule: 'http-first-line-follows-its-grammar',
                  severity: 'error',
              },
          ];
}
