// SPDX-License-Identifier: Apache-2.0
// Types of the copied query engine files (third_party/agsc-query, CommonJS, unchanged). Only what
// WebAIAssist calls is declared.
declare module '*/agsc-query/engine.js' {
  export interface QueryAnswer {
    readonly form: string | null;
    readonly json?: string;
    readonly csv?: string | null;
    readonly error?: string;
  }
  export function queryAnswer(ox: unknown, store: unknown, text: string): QueryAnswer;
}
declare module '*/agsc-query/view.js' {
  export type Prefixes = Readonly<Record<string, string>>;
  export type Tree = readonly [string, Readonly<Record<string, string>>, ...unknown[]];
  export function queryTermText(term: unknown, prefixes: Prefixes): string;
  export function queryTable(result: unknown, limit: number, prefixes: Prefixes): Tree;
}
declare module '*/agsc-query/tokens.js' {
  export interface QueryCheck {
    readonly form: string | null;
    readonly dataset?: boolean;
    readonly fresh?: boolean;
  }
  export function queryCheck(text: string): QueryCheck;
  export function queryRefusal(check: QueryCheck): string | null;
}
