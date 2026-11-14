// SPDX-License-Identifier: Apache-2.0
// Whether the model gets its built-in graph tool (src/core/builtin-tools.ts) for one question: the site is an
// AgenticSystemCore node the panel may read (a node whose tools the user refused is not one here), it did not ask for no AI input (the graph is site
// content that becomes model input), the panel has a graph reader, and the node's own linkset names
// graph.nq with a digest. Nothing here reads the graph.
import type { GraphQuery } from '../core/ports/graph-query';
import type { PanelController } from './panel-controller';
import { aiBlocked } from './panel-page';

export interface GraphToolPart {
  /** Goes into the agent's dependencies. */
  readonly deps: { readonly builtin?: GraphQuery };
  /** Goes into the run's scope. */
  readonly scope: { readonly graphQuery?: true };
}

const NONE: GraphToolPart = { deps: {}, scope: {} };

export async function graphToolFor(
  ctx: PanelController,
  plan: { readonly origin: string; readonly node: boolean },
  tabId: number,
): Promise<GraphToolPart> {
  const graph = ctx.deps.graphQuery;
  if (!graph || !plan.node || aiBlocked(ctx)) return NONE;
  const offered = await graph.available({ tabId, origin: plan.origin }).catch(() => false);
  return offered ? { deps: { builtin: graph }, scope: { graphQuery: true } } : NONE;
}
