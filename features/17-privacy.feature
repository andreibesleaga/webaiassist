# SPDX-License-Identifier: Apache-2.0
Feature: Privacy: which hosts are contacted
  Nothing leaves the computer unless the person chose an endpoint. The hosts WebAIAssist may
  contact are a short, public list.

  # req: LLM02-1, CWS-6, NIST-600-DP
  @smoke
  Scenario: A whole session with the scripted model contacts no host except the page's own
    Given WebAIAssist is installed
    And network requests are recorded
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    And the scripted model is ready
    When I ask '/tool add {"a": 2, "b": 3}'
    And I press "Allow for this session"
    And I press "Allow once"
    Then the conversation shows "The tool said: 5"
    And the only hosts contacted are the page's own host and the extension

  # req: LLM03-4, CWS-4
  # test: test/security-review/docs-review.test.ts
  @unit
  Scenario: Every host named in the code is in the privacy page
    Given the built extension
    Then each web address it can contact is listed in docs/PRIVACY.md

  # test: test/ui/panel-privacy.test.ts
  # req: LLM02-3
  @unit
  Scenario: Before page text goes to a remote endpoint the panel says so
    Given an endpoint model is ready and a question is about to be sent
    Then the panel shows that the chat goes to that host

  # req: CWS-1
  @smoke
  Scenario: No script or model library comes from the web
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    Then the bundled model library has the recorded SHA-256

  # test: test/scripts/check-remote-code.test.ts, test/security-review/dist-review.test.ts
  # req: LLM03-1, ASI04-1, ASI05-1, CWS-8
  @unit
  Scenario: The package has no remote code, no eval, and the policy allows only its own scripts and wasm
    Given the release package
    Then every script is inside it and the content security policy is "script-src 'self' 'wasm-unsafe-eval'"

  @manual
  Scenario: A network log of a full session on the maintainer's computer shows only the recorded model hosts
    Given Chrome's network log is on for the extension
    When I download a model, ask three questions and remove the model
    Then only the hosts in docs/PRIVACY.md appear

  # test: test/scripts/workflows.test.ts
  # req: LLM03-2
  @unit
  Scenario: Dependencies are pinned and the workflows pin every action to a commit
    Given the repository workflows and lock file
    Then every action is pinned to a full commit SHA and the workflows hold least privilege
