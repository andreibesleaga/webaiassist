// SPDX-License-Identifier: Apache-2.0
// The real model store of the side panel and the Options page: the model files in the
// extension's file storage. Both pages are on the extension's own origin, so they see the same
// storage the offscreen document writes.
import { LOCAL_FILES } from '../../adapters/cpu-models';
import { cpuBackend, ModelStore } from '../../adapters/model-store';
import { cpuStorage, cpuTestModels } from './cpu-engine';

export function createModelStore(): ModelStore {
  return new ModelStore([cpuBackend(cpuStorage(), [...LOCAL_FILES, ...cpuTestModels])]);
}
