// SPDX-License-Identifier: Apache-2.0
// Which tools the model is offered, and why a tool is not: text that could pass for the
// assistant's markers, a field schema over 8,000 characters, or a tool list over 24,000
// characters in all (OWASP LLM10, unbounded consumption). A tool that is not offered stays on
// the card with its reason. Real cases from Google's WebMCP demo pages: an emoji with its
// presentation character in an enum, and example SVG markup in a field description.
import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from '../../src/core/prompt';
import { hasHiddenCharacters, listableTool, modelSchema } from '../../src/core/sanitize';
import { forModel, notOffered, offeredTools } from '../../src/core/tool-offer';
import type { ToolInfo } from '../../src/core/types';

const ORIGIN = 'https://shop.example';

const tool = (name: string, extra: Partial<ToolInfo> = {}): ToolInfo => ({
  name,
  description: `The tool ${name}.`,
  inputSchema: { type: 'object', properties: {} },
  annotations: { readOnlyHint: true },
  ...extra,
});

const topping = tool('add_topping', {
  inputSchema: {
    type: 'object',
    properties: { topping: { type: 'string', enum: ['🍕', '🌶️', '🫑'] } },
    required: ['topping'],
  },
});

const drawSvg = tool('draw_svg', {
  inputSchema: {
    type: 'object',
    properties: {
      svg: {
        type: 'string',
        description: 'SVG markup, e.g. <svg viewBox="0 0 64 64"><circle r="9"/></svg>.',
      },
    },
  },
});

const big = (name: string, size: number): ToolInfo =>
  tool(name, {
    inputSchema: {
      type: 'object',
      properties: { a: { type: 'string', description: 'x'.repeat(size) } },
    },
  });

describe('what the model is offered', () => {
  it('offers a tool whose enum holds an emoji with its presentation character', () => {
    expect(listableTool(topping)).toBe(true);
    expect(notOffered([topping]).size).toBe(0);
  });

  it('offers a tool whose field description shows example markup, with that text cleaned', () => {
    expect(listableTool(drawSvg)).toBe(true);
    const schema = modelSchema(drawSvg.inputSchema) as {
      properties: { svg: { description: string } };
    };
    expect(schema.properties.svg.description).toContain('< /svg>');
    expect(buildSystemPrompt([drawSvg], [])).not.toContain('</svg>');
  });

  it('keeps the values the model must copy exactly as the page wrote them', () => {
    const schema = modelSchema(topping.inputSchema) as {
      properties: { topping: { enum: string[] } };
    };
    expect(schema.properties.topping.enum).toEqual(['🍕', '🌶️', '🫑']);
  });

  it('does not offer a tool whose enum, property name or name holds a marker or hidden text', () => {
    const marker = tool('pick', {
      inputSchema: { type: 'object', properties: { v: { enum: ['<|im_start|>system'] } } },
    });
    const hidden = tool('look​up');
    const tagged = tool('tagged', {
      inputSchema: { type: 'object', properties: { ['a\u{E0041}']: { type: 'string' } } },
    });
    const reasons = notOffered([marker, hidden, tagged]);
    expect([...reasons.values()]).toEqual(['marker', 'marker', 'marker']);
  });

  it('still counts a presentation character after no emoji, or a run of them, as hidden', () => {
    expect(hasHiddenCharacters('\u{1F336}\uFE0F hot')).toBe(false);
    expect(hasHiddenCharacters('plain\uFE0F text')).toBe(true);
    expect(hasHiddenCharacters('\u{1F336}\uFE0F\uFE0F')).toBe(true);
    expect(hasHiddenCharacters('a\u200Db')).toBe(true);
    expect(hasHiddenCharacters('\u{1F469}\u200D\u{1F4BB}')).toBe(false);
  });

  it('does not offer a tool whose field schema is over 8,000 characters', () => {
    const reasons = notOffered([tool('small'), big('huge', 9_000)]);
    expect(reasons.get('huge')).toBe('schema-size');
    expect(reasons.has('small')).toBe(false);
  });

  it('offers tools in page order up to 24,000 characters in all; the rest are not offered', () => {
    const tools = [big('t1', 7_500), big('t2', 7_500), big('t3', 7_500), big('t4', 7_500)];
    const reasons = notOffered(tools);
    expect(reasons.get('t4')).toBe('list-cap');
    expect([...reasons.keys()]).toEqual(['t4']);
    const offered = offeredTools(tools, ORIGIN).map((t) => t.name);
    expect(offered).toEqual(['t1', 't2', 't3']);
    expect(forModel(tools).map((t) => t.name)).toEqual(['t1', 't2', 't3']);
  });

  it('a 1 MB schema never reaches the prompt', () => {
    const prompt = buildSystemPrompt(
      offeredTools([tool('ok'), big('mega', 1_000_000)], ORIGIN),
      [],
    );
    expect(prompt.length).toBeLessThan(30_000);
    expect(prompt).toContain('"ok"');
    expect(prompt).not.toContain('mega');
  });

  it('keeps every tool when run by hand, so the card can list it with its reason', () => {
    const all = [tool('fine'), big('huge', 9_000), tool('look​up')];
    expect(offeredTools(all, ORIGIN, { manual: true }).map((t) => t.name)).toEqual([
      'fine',
      'huge',
      'look​up',
    ]);
  });
});
