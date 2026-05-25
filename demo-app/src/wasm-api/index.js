export { SyntaxKind } from "./syntax-kind.js";
export { SyntaxNode, ParseResult, SyntaxError, buildParseResult, } from "./parse.js";
export { extractTableNames, extractColumnReferences, extractFunctionCalls, getStatementType, } from "./helpers.js";
import initWasm, { parse_sql as wasmParseSql, format_sql as wasmFormatSql, get_tree as wasmGetTree, get_diagnostics as wasmGetDiagnostics, } from "../pkg/clickhouse_analyzer.js";
import { buildParseResult } from "./parse.js";
const MAX_INPUT_SIZE = 1048576; // 1MB
function checkInputSize(sql) {
    if (sql.length > MAX_INPUT_SIZE) {
        throw new Error(`Input exceeds maximum size of ${MAX_INPUT_SIZE} bytes`);
    }
}
let initialized = false;
/**
 * Initialize the WASM module. Must be called before any other function.
 * Can be called with a custom URL/path to the .wasm file, or will use
 * the default co-located file.
 */
export async function init(wasmInput) {
    if (initialized)
        return;
    await initWasm(wasmInput);
    initialized = true;
}
function ensureInit() {
    if (!initialized) {
        throw new Error("clickhouse-analyzer WASM not initialized. Call init() first.");
    }
}
/**
 * Parse a ClickHouse SQL string and return a structured ParseResult
 * with tree navigation capabilities.
 */
export function parse(sql) {
    ensureInit();
    checkInputSize(sql);
    const json = wasmParseSql(sql);
    let raw;
    try {
        raw = JSON.parse(json);
    }
    catch (e) {
        throw new Error(`Failed to parse WASM output as JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    return buildParseResult(raw);
}
/**
 * Format a ClickHouse SQL string.
 */
export function format(sql) {
    ensureInit();
    checkInputSize(sql);
    return wasmFormatSql(sql);
}
/**
 * Get a debug tree representation of parsed SQL.
 */
export function getTree(sql) {
    ensureInit();
    checkInputSize(sql);
    return wasmGetTree(sql);
}
/**
 * Get diagnostics (errors, warnings) as a JSON string.
 */
export function getDiagnostics(sql) {
    ensureInit();
    checkInputSize(sql);
    return wasmGetDiagnostics(sql);
}
//# sourceMappingURL=index.js.map