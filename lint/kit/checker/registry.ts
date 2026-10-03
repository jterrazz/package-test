import type { Chapter, Manifest, Teaching } from '@jterrazz/typescript/rules';

import type { Row } from '../catalogue/row.js';
import type { DocumentFinding } from '../project/document-model.js';
import type { SpecFile } from '../project/spec-grammar.js';

export type Spotted<Rule extends string = string> = Teaching & {
    column?: number;
    line: number;
    path: string;
    rule: Rule;
};

export type GroundEntry = { name: string; path: string; rel: string };

export type GroundFile = GroundEntry & { atTop: boolean; text: string };

export type FoundDocument = { name: string; rel: string; text: null | string };

export type ReadDocument = {
    dir: string;
    file: SpecFile;
    rel: string;
};

export type MemberRead = {
    anchored: (findings: Spotted[]) => Spotted[];
    config: null | string;
    label: string;
    manifest: Manifest;
    memberDir: string;
    rootDir: string;
    subject: string;
};

type Judge<Read> = (read: Read) => Spotted[];

export type GroundPasses = {
    document: Judge<FoundDocument>;
    expected: Judge<GroundFile>;
    read: (read: ReadDocument) => DocumentFinding[];
    request: Judge<GroundFile>;
    seed: Judge<GroundEntry>;
};

export type CheckerRegistry = {
    chapter: Chapter;
    fixes: readonly ((root: string) => string[])[];
    member: Judge<MemberRead>;
    memberPassIds: readonly string[];
    rows: readonly Row[];
    tree: readonly ((specsRoot: string) => Spotted[])[];
    treePassIds: readonly string[];
};

export type SelfRegistry = {
    chapter: Chapter;
    passIds: readonly string[];
    rows: readonly Row[];
    source: readonly ((root: string) => Spotted[])[];
    specs: readonly ((specsRoot: string) => Spotted[])[];
};
