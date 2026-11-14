// SPDX-License-Identifier: Apache-2.0
// Vitest reads the copied engine files (CommonJS, unchanged) through Node's own require: see the alias
// in vitest.config.ts. The build bundles the same files with esbuild.
import { createRequire } from 'node:module';
import type * as Types from '../../../third_party/agsc-query/engine.js';

const loaded = createRequire(import.meta.url)(
  '../../../third_party/agsc-query/engine.js',
) as typeof Types;
export const queryAnswer = loaded.queryAnswer;
