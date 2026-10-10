import { refusal } from '../../chain/refusals/refusal.js';
import { CaptureScope } from '../tokens/capture-scope.js';
import { stripAnsiCodes } from './ansi.js';

/** Read-only accessor for a JSON payload; parsed lazily, so the raw text stays readable when it is not JSON. */
export class JsonAccessor<Value = unknown> {
    /** @internal */
    readonly captures: CaptureScope;
    /** @internal */
    private readonly rawText: string;
    /** The stream the text was read from, as a refusal names it ("stdout", "body"). */
    private readonly streamName: string;
    /** @internal */
    readonly testDir: string;
    /** @internal */
    private readonly transform?: ((text: string) => string) | undefined;
    /** What the producer threw when it left no value: update mode records nothing over it. @internal */
    readonly thrown: string | undefined;

    constructor(
        rawText: string,
        streamName: string,
        testDir: string,
        options: {
            captures?: CaptureScope | undefined;
            thrown?: string | undefined;
            transform?: ((text: string) => string) | undefined;
        } = {},
    ) {
        this.rawText = rawText;
        this.streamName = streamName;
        this.testDir = testDir;
        this.transform = options.transform;
        this.thrown = options.thrown;
        this.captures = options.captures ?? new CaptureScope();
    }

    /** The parsed JSON value; throws when the text is not valid JSON. */
    get value(): Value {
        const stripped = stripAnsiCodes(this.rawText);
        const source = this.transform ? this.transform(stripped) : stripped;
        try {
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse answers `any`; `Value` is the producer's claim about its own subject, `unknown` wherever nothing claims
            return JSON.parse(source) as Value;
        } catch {
            const preview = source.slice(0, 200);
            throw new Error(
                refusal({
                    fix: `read ${this.streamName} as text, or have it hold JSON`,
                    found: `${this.streamName} is not valid JSON: ${preview}`,
                    read: 'docs/reference/assertions.md#resultjson--parsed-stdout-cli',
                    why: '`.json` parses a stream that holds one JSON document.',
                }),
            );
        }
    }
}
