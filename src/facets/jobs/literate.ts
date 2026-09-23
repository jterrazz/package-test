import { documentFailure, tablesMismatch } from '../../model/literate/document-run.js';
import type { DocumentPlace } from '../../model/literate/document-run.js';
import type { SpecFile } from '../../model/literate/spec-document.js';
import { CaptureScope } from '../../model/matching/match.js';
import { textEquals } from '../../model/matching/structural.js';
import type { TableAccessor } from '../../model/result/table.js';

/**
 * Running a `kind: jobs` document: the job it names is triggered once, on the
 * ground the chain laid, and what it did is judged — the rejection it ended
 * on, or its success, then the tables it left.
 *
 * A job that throws is a reading here, as `result.error` is on the integration
 * facet: a document stating `error:` expects the rejection, and one that does
 * not expects none. The tables are judged either way, so a document can state
 * what a crashing job wrote before it crashed.
 */

/** What the chain hands the engine: the job to run, and the tables to read after. */
export type JobsDocumentRun = {
    /** Run the named job — the chain's own `.trigger()` action. */
    execute: () => Promise<void>;
    file: SpecFile;
    place: DocumentPlace;
    tableOf: (name: string, database: string | undefined) => TableAccessor;
    /** The job the document names, and the line it names it on. */
    trigger: { line: number; name: string };
};

/** A jobs document states its outcome by hand: nothing in it is rewritten. */
const HINT = 'A jobs document is not rewritten — its error: and its tables: are stated by hand.';

/** What a rejection reads as: its message, or the value thrown. */
function messageOf(thrown: unknown): string {
    return thrown instanceof Error ? thrown.message : String(thrown);
}

/** The disagreement between the error the document states and the job's outcome, if any. */
function errorMismatch(
    run: JobsDocumentRun,
    thrown: null | { error: unknown },
    scope: CaptureScope,
): null | { details: string; line: number } {
    const { error } = run.file.document;
    if (error === null) {
        return thrown === null
            ? null
            : {
                  details: `the job rejected, and the document states no error:\n  ${messageOf(thrown.error)}`,
                  line: run.trigger.line,
              };
    }
    if (thrown === null) {
        return {
            details: `the job succeeded, and the document states it rejects with:\n  ${error.text}`,
            line: error.line,
        };
    }
    const received = messageOf(thrown.error);
    return textEquals(error.text, received, scope)
        ? null
        : {
              details: `error mismatch\n  expected: ${error.text}\n  received: ${received}`,
              line: error.line,
          };
}

/** Trigger the document's job and judge what it did; the tables are judged on success and on rejection alike. */
export async function runJobsDocument(run: JobsDocumentRun): Promise<void> {
    const { document } = run.file;
    const scope = new CaptureScope();
    let thrown: null | { error: unknown } = null;
    try {
        await run.execute();
    } catch (error) {
        thrown = { error };
    }
    const failure =
        errorMismatch(run, thrown, scope) ??
        (await tablesMismatch(document.tables, run.tableOf, scope));
    if (failure !== null) {
        throw documentFailure({
            action: `trigger: ${run.trigger.name}`,
            description: document.description,
            details: failure.details,
            hint: HINT,
            line: failure.line,
            place: run.place,
        });
    }
}
