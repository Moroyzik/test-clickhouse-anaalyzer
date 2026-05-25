import wasmUrl from './wasm/clickhouse_analyzer_bg.wasm?url';

interface WasmExports {
    parse_sql(sql: string): string;
    format_sql(sql: string): string;
    get_diagnostics(sql: string): string;
}

interface Diagnostic {
    message: string;
    range: [number, number];
    severity: 'Error' | 'Warning' | 'Hint';
    code: string | null;
    suggestion: string | null;
    related: unknown[];
}

let wasm: WasmExports | null = null;

export async function initAnalyzer(): Promise<void> {
    if (wasm) return;

    const [response, jsModule] = await Promise.all([
        fetch(wasmUrl),
        import('./wasm/clickhouse_analyzer.js'),
    ]);

    const bytes = await response.arrayBuffer();
    jsModule.initSync({ module: new WebAssembly.Module(bytes) });
    wasm = jsModule;
}

export function parseSql(sql: string) {
    if (!wasm) throw new Error('Analyzer not initialized');
    return JSON.parse(wasm.parse_sql(sql));
}

export function formatSql(sql: string) {
    if (!wasm) throw new Error('Analyzer not initialized');
    return wasm.format_sql(sql);
}

export function getDiagnostics(sql: string): Diagnostic[] {
    if (!wasm) throw new Error('Analyzer not initialized');
    return JSON.parse(wasm.get_diagnostics(sql));
}
