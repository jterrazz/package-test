import type { Row } from '../catalogue/row.js';
import type { DocumentFinding } from '../project/document-model.js';
import type { Manifest } from '../project/member-manifest.js';
import type { SpecFile } from '../project/spec-document.js';
import type { Finding } from './finding.js';

export type GroundEntry = { name: string; path: string; rel: string };

export type GroundFile = GroundEntry & { atTop: boolean; text: string };

export type FoundDocument = { name: string; rel: string; text: null | string };

export type ReadDocument = {
    dir: string;
    file: SpecFile;
    rel: string;
};

export type MemberRead = {
    anchored: (findings: Finding[]) => Finding[];
    config: null | string;
    label: string;
    manifest: Manifest;
    memberDir: string;
    rootDir: string;
    subject: string;
};

type Judge<Read> = (read: Read) => Finding[];

export type GroundPasses = {
    document: Judge<FoundDocument>;
    expected: Judge<GroundFile>;
    read: (read: ReadDocument) => DocumentFinding[];
    request: Judge<GroundFile>;
    seed: Judge<GroundEntry>;
};

export type CheckerRegistry = {
    chapter: string;
    fixes: readonly ((root: string) => string[])[];
    member: Judge<MemberRead>;
    memberPassIds: readonly string[];
    rows: readonly Row[];
    tree: readonly ((specsRoot: string) => Finding[])[];
    treePassIds: readonly string[];
};

export type AtZeroRegistry = {
    chapter: string;
    label: string;
    passIds: readonly string[];
    rows: readonly Row[];
    source: readonly ((root: string) => Finding[])[];
    specs: readonly ((specsRoot: string) => Finding[])[];
};
