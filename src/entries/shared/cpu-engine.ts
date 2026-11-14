// SPDX-License-Identifier: Apache-2.0
// Which engine the processor runtime uses in this build: llama.cpp in the release and the eval
// build, and in the smoke-test build a fake with test models (the browser test needs no 400 MB
// download). The flag is folded at build time, so the release bundle holds nothing of the fake.
import type { CpuModel } from '../../adapters/cpu-models';
import type { WllamaEngineLike } from '../../adapters/wllama-runtime';
import { createFakeEngine, smokeCpuModels } from '../../fakes/fake-wllama-engine';
import { createWllamaEngine, createWllamaStorage } from './wllama-engine';

export const cpuEngine: () => WllamaEngineLike = __WEBAIASSIST_FAKE_CPU__
  ? createFakeEngine
  : createWllamaEngine;

export const cpuTestModels: readonly CpuModel[] = __WEBAIASSIST_FAKE_CPU__ ? smokeCpuModels() : [];

/** The stored model files, for the model list: the fake engine's disk in the smoke build. */
export const cpuStorage: () => Pick<WllamaEngineLike, 'storedBytes' | 'remove'> =
  __WEBAIASSIST_FAKE_CPU__ ? createFakeEngine : createWllamaStorage;
