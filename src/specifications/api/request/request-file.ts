import { refusal } from '../../../chain/refusals/refusal.js';
import { parseHeaders, splitSections } from '../../../expectations/http/http-file.js';

export type ParsedRequestFile = {
    body?: string | undefined;
    headers: Record<string, string>;
    method: string;
    path: string;
};

export function parseRequestFile(content: string, fileName: string): ParsedRequestFile {
    const { body, headerLines, startLine } = splitSections(content);

    const start = /^(?<method>[A-Z]+)\s+(?<path>\S+)$/u.exec(startLine.trim());
    if (start === null) {
        throw new Error(
            refusal({
                fix: 'start the request file with its request line: "POST /users"',
                found: `${fileName}: the first line is "${startLine}"`,
                read: 'docs/guides/api-specs.md#http-request-files-full-format',
                why: 'A request file opens on `METHOD /path`.',
            }),
        );
    }
    // Stryker disable next-line StringLiteral: a match always carries its named groups, so no default is ever taken
    const { method = '', path = '' } = start.groups ?? {};

    return {
        body: body.length > 0 ? body : undefined,
        headers: parseHeaders(headerLines, fileName),
        method,
        path,
    };
}
