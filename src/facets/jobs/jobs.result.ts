/**
 * What `.trigger(name)` hands back — a base result minus the two accessors a
 * job cannot answer: it writes no file and produces no directory of its own.
 *
 * A re-export, so the jobs folder carries the same four files every facet
 * does. The shape itself is stated with the chain that returns it.
 */
export type { JobsResult } from '../../core/chain/builder.js';
