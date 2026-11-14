# SPDX-License-Identifier: Apache-2.0
Feature: Security and governance requirements that can be observed
  The audit table of the security note (OWASP LLM and agentic lists, NIST AI RMF, EU AI Act
  Article 50, Chrome Web Store policy) has rows that the behaviour of the extension proves. Each
  scenario names its rows.

  # test: test/security/adversarial-core.test.ts, test/security/adversarial-bridge.test.ts
  # req: LLM06-1, ASI01-1, ASI02-1, NIST-ME-1
  @unit
  Scenario: The adversarial suites pass: injection, hint lies, oversize results, wrong senders
    Given the adversarial test suites
    Then every attempt is stopped or shown to the person

  # test: test/core/untrusted.test.ts, test/core/agent-loop.test.ts
  # req: LLM10-1
  @unit
  Scenario: Page text, tool results and replies are capped, and the run has a step cap
    Given very large page text and tool results
    Then the model receives them cut at their caps

  # test: test/security-review/endpoint-review.test.ts, test/adapters/endpoint-runtime.test.ts
  # req: LLM10-1, ASI03-1
  @unit
  Scenario: The endpoint reply is limited in size and time, refuses redirects, and sends the key only to its address
    Given an endpoint that sends too much, too slowly, or redirects
    Then the call ends with a plain error and the key is not sent elsewhere

  # req: LLM05-1
  # test: test/security-review/docs-review.test.ts
  @unit
  Scenario: No source file writes HTML into a page: no innerHTML, outerHTML or insertAdjacentHTML
    Given the source files of the extension
    Then none of them uses those calls

  # req: LLM06-2, CWS-2
  # test: test/security-review/docs-review.test.ts
  @unit
  Scenario: The manifest permissions equal the documented list
    Given the release manifest and docs/STORE-LISTING.md
    Then they name the same permissions

  # req: NIST-GV-1, NIST-MP-1, NIST-600-VC
  # test: test/security-review/docs-review.test.ts
  @unit
  Scenario: The governance documents exist and the docs name every dependency and model
    Given the repository
    Then SECURITY.md, the threat model and the sources list exist and are linked from the README
    And every runtime dependency and model is in the sources list

  # req: CWS-7, NIST-MP-2
  # test: test/security-review/docs-review.test.ts
  @unit
  Scenario: The store listing and the README state the limits
    Given the store listing and the README
    Then both say that WebMCP is a draft, that it needs a Chromium browser, and that answers can be wrong
    And both state the result of the built-in model test

  # req: EU-5
  # test: test/security-review/docs-review.test.ts
  @unit
  Scenario: A governance note states the roles and that high-risk uses are out of scope
    Given docs/GOVERNANCE.md or the threat model
    Then it names the provider and the deployer and says that biometric, emotion and high-risk uses are not offered

  # req: ASI07-2
  # test: test/protocol/site-messages.test.ts
  @unit
  Scenario: The message that carries a site file has a schema and the same checks as the others
    Given a site file message with an extra field, an oversize text or a "__proto__" key
    Then it is rejected

  # req: ASI10-1
  # test: test/core/agent-loop-closed.test.ts, test/ui/panel-switch.test.ts
  @unit
  Scenario: Closing the panel ends any run
    Given an answer is running
    When the panel closes
    Then no tool call is made afterwards

  # req: NIST-MG-1
  # test: test/security-review/docs-review.test.ts
  @unit
  Scenario: The threat model lists the residual risks and SECURITY.md says how to report a problem
    Given the repository documents
    Then the threat model has a "Residual risks" section and SECURITY.md names the reporting path

  # req: CWS-9
  # test: test/security-review/docs-review.test.ts
  @unit
  Scenario: Every host an extension page may contact is in the privacy page, and the policy decision is recorded
    Given the built extension and docs/PRIVACY.md
    Then each web address in the code is in the privacy page
    And the threat model records why the manifest has no connect-src list

  # req: LLM06-1, ASI07-1, NIST-600-IS
  # test: test/adapters/page-bridge-main.test.ts, test/security/adversarial-bridge.test.ts
  @unit
  Scenario: A frame inside the page cannot make the page bridge run a tool
    Given a frame of the page posts a tool call to the top window
    Then no tool runs, nothing is answered, and a panel request on its own channel still gets its reply

  # req: R4-10, NIST-600-IS
  # test: test/ui/panel-policy.test.ts
  @unit
  Scenario: "Use on this tab anyway" does not carry over to a remote endpoint
    Given a site that asks for no AI input and the person chose to use it with a local model
    When the person starts a remote endpoint on the same tab
    Then the site's text and files are held back again and the card says so

  # req: ASI09-2
  # test: test/core/node-mode.test.ts, test/ui/panel-site.test.ts, test/ui/page-status.test.ts
  @unit
  Scenario: A site that says it is a node is shown as saying so, and no hint vouches for its tools
    Given a page with the ten node tool names
    Then the badge and the status line say the site says it is a node
    And the node hints name roles only

  # req: LLM01-3
  # test: test/core/sanitize.test.ts, test/core/compact-prompt.test.ts
  @unit
  Scenario: A tool name with a line break is not listed, so it cannot write a line of the prompt
    Given a tool whose name holds a line break and a rule-like sentence
    Then the compact prompt has no line made from it

  # req: NIST-600-IP, R4-10
  # test: test/ui/panel-policy.test.ts, test/security-review/docs-review.test.ts
  @unit
  Scenario: For a site that asks for no AI input the panel says which parts are held back
    Given a site that asks for no AI input
    Then the status line says its text and files are not read and results of its own tools still go to the model

  # req: EU-2
  # test: test/core/export.test.ts, test/ui/panel-export.test.ts
  @unit
  Scenario: The export is marked as AI-generated in a front-matter block and names the endpoint host when one wrote it
    Given an exported conversation
    Then it starts with ai-generated: true, the generator, the model and where it ran
    And its sentence names the endpoint host and not "local" when an endpoint wrote the answers

  # req: NIST-600-DP, CWS-4
  # test: test/security-review/docs-review.test.ts
  @unit
  Scenario: The privacy and governance texts state the saved tool results, the toolbar reads and the per-site exception
    Given docs/PRIVACY.md and docs/GOVERNANCE.md
    Then the storage table names tool results and read page text
    And the site-files row names the toolbar click
    And the governance text names the per-site read-only exception
