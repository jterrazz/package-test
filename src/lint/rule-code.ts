/**
 * The convention code a checker pass id carries: `d4b-spec-shape` → `d4b`.
 *
 * It lives alone because BOTH sides need it — the passes that build a finding
 * and the entry that publishes one as `jterrazz-check(<code>)` — and a copy in
 * either would be a second answer to what a finding is called.
 */
export function codeOf(passId: string): string {
    return passId.split('-')[0] ?? passId;
}
