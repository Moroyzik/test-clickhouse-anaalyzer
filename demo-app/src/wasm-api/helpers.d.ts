import type { ParseResult } from "./parse.js";
/**
 * Extract all table names from a parse result.
 * Returns fully qualified names (e.g. "db.users") when a database prefix is present.
 */
export declare function extractTableNames(result: ParseResult): string[];
/**
 * Extract all column references from a parse result.
 */
export declare function extractColumnReferences(result: ParseResult): string[];
/**
 * Extract all function calls from a parse result.
 */
export declare function extractFunctionCalls(result: ParseResult): {
    name: string;
    args: string[];
}[];
/**
 * Determine the top-level statement type from a parse result.
 * Returns strings like "SELECT", "INSERT", "CREATE TABLE", "ALTER", etc.
 */
export declare function getStatementType(result: ParseResult): string | null;
//# sourceMappingURL=helpers.d.ts.map