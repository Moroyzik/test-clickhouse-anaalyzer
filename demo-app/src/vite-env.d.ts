/// <reference types="vite/client" />

declare module '*.wasm?url' {
    const url: string;
    export default url;
}

declare module './wasm/clickhouse_analyzer.js' {
    export function initSync(opts: { module: WebAssembly.Module }): void;
    export function parse_sql(sql: string): string;
    export function format_sql(sql: string): string;
    export function get_diagnostics(sql: string): string;
    export function get_tree(sql: string): string;
}
