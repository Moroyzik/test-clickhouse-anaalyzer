import type { SyntaxKind } from "./syntax-kind.js";
import type { RawParseResult } from "./types.js";
/**
 * A syntax node in the parsed tree. Wraps either a tree node or a token,
 * providing uniform navigation and text extraction.
 */
export declare class SyntaxNode {
    readonly kind: SyntaxKind;
    readonly start: number;
    readonly end: number;
    readonly children: SyntaxNode[];
    readonly isToken: boolean;
    private readonly _source;
    /** Parent reference, set during tree construction. */
    parent: SyntaxNode | null;
    constructor(kind: SyntaxKind, start: number, end: number, children: SyntaxNode[], isToken: boolean, source: string);
    /** Get the source text this node spans. */
    text(): string;
    /** Find all descendant nodes matching the given kind. */
    findAll(kind: SyntaxKind): SyntaxNode[];
    /** Find the first descendant node matching the given kind, or null. */
    findFirst(kind: SyntaxKind): SyntaxNode | null;
    /** Depth-first walk of this node and all descendants. */
    walk(callback: (node: SyntaxNode, depth: number) => void): void;
    /** Walk up to the root, returning all ancestors (nearest first). */
    ancestors(): SyntaxNode[];
    /** Get only tree children (skip tokens). */
    treeChildren(): SyntaxNode[];
    /** Get only token children (skip subtrees). */
    tokenChildren(): SyntaxNode[];
    private _collect;
    private _findFirst;
    private _walk;
}
/** Result of parsing a SQL string. */
export declare class ParseResult {
    readonly tree: SyntaxNode;
    readonly errors: SyntaxError[];
    readonly source: string;
    constructor(tree: SyntaxNode, errors: SyntaxError[], source: string);
    /** Shorthand: find all nodes of the given kind in the entire tree. */
    findAll(kind: SyntaxKind): SyntaxNode[];
    /** Shorthand: find the first node of the given kind in the entire tree. */
    findFirst(kind: SyntaxKind): SyntaxNode | null;
    /** Returns true if the parse produced no errors. */
    get ok(): boolean;
}
/** A parse error with message and byte range. */
export declare class SyntaxError {
    readonly message: string;
    readonly start: number;
    readonly end: number;
    constructor(message: string, start: number, end: number);
}
/** Convert raw JSON parse result into a typed ParseResult. */
export declare function buildParseResult(raw: RawParseResult): ParseResult;
//# sourceMappingURL=parse.d.ts.map