// SPDX-License-Identifier: Apache-2.0
export interface Scenario {
  id: string;
  feature: string;
  name: string;
  file: string;
  tags: string[];
  tests: string[];
  reqs: string[];
}
export declare const BDD_TAG_EXPRESSION: string;
export declare function parseFeature(text: string, file: string): Scenario[];
export declare function runsInBdd(scenario: Scenario): boolean;
export declare function statusOf(scenario: Scenario): string;
export declare function checkScenarios(
  scenarios: readonly Scenario[],
  exists: (path: string) => boolean,
): string[];
export declare function countByTag(scenarios: readonly Scenario[]): Map<string, number>;
export declare function renderTable(scenarios: readonly Scenario[]): string;
export declare function fileExists(path: string): boolean;
export declare function loadScenarios(): Scenario[];
