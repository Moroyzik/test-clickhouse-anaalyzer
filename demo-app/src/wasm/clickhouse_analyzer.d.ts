/* tslint:disable */
/* eslint-disable */
export function main(): void;
export function get_tree(sql: string): string;
export function format_sql(sql: string): string;
export function get_diagnostics(sql: string): string;
/**
 * Parse SQL and return the full CST as JSON.
 *
 * Returns a JSON object: `{ tree: SyntaxTree, errors: SyntaxError[], source: string }`
 * where SyntaxTree nodes have `{ kind: string, start: number, end: number, children: SyntaxChild[] }`
 * and SyntaxChild is either `{ Token: { kind, start, end } }` or `{ Tree: { ... } }`.
 */
export function parse_sql(sql: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly main: () => void;
  readonly get_tree: (a: number, b: number) => [number, number];
  readonly format_sql: (a: number, b: number) => [number, number];
  readonly get_diagnostics: (a: number, b: number) => [number, number];
  readonly parse_sql: (a: number, b: number) => [number, number];
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export_3: WebAssembly.Table;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
