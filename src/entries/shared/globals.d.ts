// SPDX-License-Identifier: Apache-2.0
// Set by scripts/build.mjs: true only in the smoke-test build (dist-smoke/).
declare const __WEBAIASSIST_SMOKE__: boolean;
// True only in the smoke-test build: the processor runtime uses the fake engine there, not
// llama.cpp (the eval build, which is also a development build, uses the real one).
declare const __WEBAIASSIST_FAKE_CPU__: boolean;
