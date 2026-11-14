// SPDX-License-Identifier: Apache-2.0
// Independent security review, 12 Nov 2026 (not a test; run by hand: node
// test/security-review/redos-probe.mjs). A page's tool schema can carry a `pattern` that the
// side panel compiles and runs on the model's arguments (@cfworker/json-schema, on the panel's
// main thread). This prints how long one validation takes as the argument grows.
import { Validator } from '@cfworker/json-schema';

const schema = { type: 'object', properties: { q: { type: 'string', pattern: '^(a+)+$' } } };
const validator = new Validator(schema, '2020-12', false);
for (const length of [16, 20, 22, 24, 26]) {
  const start = performance.now();
  validator.validate({ q: `${'a'.repeat(length)}!` });
  console.log(`${length + 1} characters: ${Math.round(performance.now() - start)} ms`);
}
