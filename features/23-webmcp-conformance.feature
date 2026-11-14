# SPDX-License-Identifier: Apache-2.0
Feature: The WebMCP conformance page and suite
  A plain page, served from the conformance folder, exercises every part of the WebMCP interface
  a browser offers on document.modelContext, so the extension and the browser can be checked
  against it. It sends nothing anywhere and is independent of the extension.

  # test: test/ui/conformance-files.test.ts
  @smoke
  Scenario: A conformance case registers exactly its tools and its own check ends as expected
    Given the conformance page is open on case "c05"
    Then the page registers exactly the tools of case "c05"
    And its own check of case "c05" ends as the case allows

  @smoke
  Scenario Outline: The side panel lists, asks and shows results for the conformance cases of errors, large and slow tools
    Given the conformance case "<case>" is open with the side panel
    When the scripted model makes the calls the case "<case>" lists
    Then every step of the case is as the case file says

    Examples:
      | case |
      | c07  |
      | c10  |
      | c09  |

  @smoke
  Scenario: A page that swaps a tool's description while the question to run it is open gets its call refused
    Given the conformance case "c15" is open with the side panel
    When the scripted model makes the calls the case "c15" lists
    Then the step "call c15_swap" is as the case file says

  # test: test/scripts/check-dist.test.ts
  @unit
  Scenario: Only the evaluation build made with the demos flag may script Google's demo pages
    Given the release manifest and the evaluation manifest
    Then the release build has no install-time host
    And the demo host is accepted only by the evaluation build made with the demos flag

  @manual
  Scenario: The conformance page and the extension are run in real Google Chrome
    Given Google Chrome 157 or later on the maintainer's computer
    When the maintainer runs eval:conformance with the extension and demos stages
    Then a report in docs/eval lists each case, the panel's behaviour and each official demo page
