export { SyntaxKind } from "./syntax-kind.js";
export type { SyntaxKind as SyntaxKindType } from "./syntax-kind.js";
export { SyntaxNode, ParseResult, SyntaxError, buildParseResult, } from "./parse.js";
export { extractTableNames, extractColumnReferences, extractFunctionCalls, getStatementType, } from "./helpers.js";
export type { RawToken, RawTree, RawChild, RawSyntaxError, RawParseResult, } from "./types.js";
import initWasm from "../pkg/clickhouse_analyzer.js";
import { type ParseResult } from "./parse.js";
/**
 * Initialize the WASM module. Must be called before any other function.
 * Can be called with a custom URL/path to the .wasm file, or will use
 * the default co-located file.
 */
export declare function init(wasmInput?: Parameters<typeof initWasm>[0]): Promise<void>;
/**
 * Parse a ClickHouse SQL string and return a structured ParseResult
 * with tree navigation capabilities.
 */
export declare function parse(sql: string): ParseResult;
/**
 * Format a ClickHouse SQL string.
 */
export declare function format(sql: string): string;
/**
 * Get a debug tree representation of parsed SQL.
 */
export declare function getTree(sql: string): string;
/**
 * Get diagnostics (errors, warnings) as a JSON string.
 */
export declare function getDiagnostics(sql: string): string;
//# sourceMappingURL=index.d.ts.map