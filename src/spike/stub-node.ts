// SPDX-License-Identifier: Apache-2.0
// A stub node for the spike page: registers the ten tools of an AgenticSystemCore node
// the way the node's own script does (src/distribution/webmcp.js in the engine), with
// the same names, schemas and annotations, but an execute() that returns a fixed envelope.
import type { ModelContextLike } from '../adapters/webmcp-reader';
import { errorText } from '../adapters/webmcp-reader';
import type { ToolInfo } from '../core/types';

export interface RegisterOutcome {
  registered: string[];
  rejected: { name: string; error: string }[];
}

/** The envelope shape a node's tools return; `trust` is always "untrusted". */
export function stubResult(name: string, args: unknown): object {
  return {
    body: { args, note: 'stub result from the spike page' },
    source: name,
    trust: 'untrusted',
    type: 'stub',
  };
}

async function registerOne(
  context: Required<Pick<ModelContextLike, 'registerTool'>>,
  tool: ToolInfo,
  signal: AbortSignal,
): Promise<string | undefined> {
  try {
    await context.registerTool(
      {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
        execute: (args: unknown) => Promise.resolve(stubResult(tool.name, args)),
      },
      { signal },
    );
    return undefined;
  } catch (error) {
    return errorText(error);
  }
}

export async function registerStubTools(
  context: ModelContextLike,
  tools: readonly ToolInfo[],
  signal: AbortSignal,
): Promise<RegisterOutcome> {
  const outcome: RegisterOutcome = { registered: [], rejected: [] };
  if (typeof context.registerTool !== 'function') {
    outcome.rejected.push({ name: '*', error: 'registerTool() is not available' });
    return outcome;
  }
  const target = { registerTool: context.registerTool.bind(context) };
  for (const tool of tools) {
    const error = await registerOne(target, tool, signal);
    if (error === undefined) outcome.registered.push(tool.name);
    else outcome.rejected.push({ name: tool.name, error });
  }
  return outcome;
}
