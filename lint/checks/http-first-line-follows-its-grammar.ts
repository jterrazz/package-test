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

export function requestLineFindings(file: string, name: string, text: string): Finding[] {
    return REQUEST_LINE.test(firstLine(text))
        ? []
        : [
              {
                  file,
                  line: 1,
                  fix: `start ${name} with its request line, \`GET /path\` or another method`,
                  found: `the first line of ${name} is no request line`,
                  rule: 'http-first-line-follows-its-grammar',
                  severity: 'error',
              },
          ];
}

export function statusLineFindings(file: string, name: string, text: string): Finding[] {
    return STATUS_LINE.test(firstLine(text))
        ? []
        : [
              {
                  file,
                  line: 1,
                  fix: `start ${name} with its status line, \`HTTP/1.1 200 OK\` or the status it expects`,
                  found: `the first line of ${name} is no status line`,
                  rule: 'http-first-line-follows-its-grammar',
                  severity: 'error',
              },
          ];
}
