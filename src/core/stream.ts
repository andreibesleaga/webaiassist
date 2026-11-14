// SPDX-License-Identifier: Apache-2.0
// While a model streams a reply of the shape {"answer": "..."}, this reads the answer
// text so far, so the chat can show it before the reply ends. Tool calls show nothing.

const START = /^\s*\{\s*"answer"\s*:\s*"/;

const SIMPLE_ESCAPES: Readonly<Record<string, string>> = {
  n: '\n',
  t: '\t',
  r: '\r',
  b: '\b',
  f: '\f',
};

/** One escape at `body[i]` (after the backslash): the text and how many characters it used. */
function readEscape(body: string, i: number): { text: string; used: number } | undefined {
  const code = body[i];
  if (code === undefined) return undefined;
  if (code !== 'u') return { text: SIMPLE_ESCAPES[code] ?? code, used: 1 };
  const hex = body.slice(i + 1, i + 5);
  if (!/^[0-9a-fA-F]{4}$/.test(hex)) return undefined;
  return { text: String.fromCharCode(parseInt(hex, 16)), used: 5 };
}

function decodeUntilQuote(body: string): string {
  let out = '';
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    if (char === '"') break;
    if (char !== '\\') {
      out += char;
      continue;
    }
    const escape = readEscape(body, i + 1);
    if (!escape) break;
    out += escape.text;
    i += escape.used;
  }
  return out;
}

export function partialAnswer(buffer: string): string | undefined {
  const match = START.exec(buffer);
  if (!match) return undefined;
  return decodeUntilQuote(buffer.slice(match[0].length));
}
