// SPDX-License-Identifier: Apache-2.0
// The conformance server of the browser tests: the implementation is shared with the real-Chrome
// run (scripts/eval/conformance.ts), and test/smoke/harness.ts is not touched.
export {
  CONFORMANCE_DIR,
  fileFor,
  startConformanceServer,
  type ConformanceServer,
} from '../../scripts/eval/conformance-server.ts';
