# SPDX-License-Identifier: Apache-2.0
Feature: Tool security review, tool details, forms, running a tool by hand and the toolbar number
  Every tool of the open page is read against written rules when it arrives. A tool with a finding
  is marked "check" with its reason and is always asked about. The tools list opens a detail
  view for each tool, a tool can be run by hand through the same question, and a form tool says
  that the page waits for you to press Submit.

  # req: LLM01
  # test: test/core/tool-review.test.ts
  @unit
  Scenario Outline: Each rule of the review flags what it names and leaves a harmless tool alone
    Given a tool whose definition shows "<finding>"
    Then the review marks it with the rule "<rule>"
    And a plain tool with none of these is not marked

    Examples:
      | finding                                      | rule                   |
      | hidden characters in the description         | hidden-characters      |
      | an order to the AI to ignore its rules       | instructions           |
      | a call to another tool of the page by name   | names-other-tool       |
      | a name that imitates a sensitive word        | look-alike             |
      | a web address in the description             | link                   |
      | a long run of encoded text                   | encoded                |
      | a read-only mark on a name that deletes      | read-only-contradicted |
      | a description over 2,000 characters          | oversized              |
      | a description changed since it was first seen | changed                |

  # req: LLM01
  # test: test/core/agent-loop-review.test.ts
  @unit
  Scenario: A flagged tool is asked about in every confirmation mode
    Given a read-only tool with a finding and the mode "ask only for tools that change something"
    When the model calls it
    Then the question to run the tool is asked first

  # req: LLM01
  # test: test/core/agent-loop-review.test.ts
  @unit
  Scenario: A tool whose definition changed while the question was open is refused
    Given the question to run a tool is open
    When the page changes the tool's description and you press Allow
    Then the tool is not run and the transcript says the page changed it

  # req: LLM06
  # test: test/core/agent-loop-review.test.ts
  @unit
  Scenario: A tool marked for developers is listed for you but never offered to the model
    Given a page tool with the debugging hint
    Then the list shows it with the mark "for developers"
    And the model's request does not contain it
    And a call by name for it is answered "unknown tool"

  # test: test/ui/panel-tool-marks.test.ts
  @unit
  Scenario: A tool opens a detail view with every hint, its fields and the reasons it was marked
    Given the tools list is open
    When you open a tool
    Then you see its name, title, full description, the four hints, its fields and its reasons
    And everything the page wrote is text, with hidden characters shown as [U+XXXX]

  # test: test/ui/panel-manual-run.test.ts
  @unit
  Scenario: A tool is run by hand through the same questions
    Given the detail view of a tool is open
    When you press "Run…" with arguments that fit its fields
    Then the question about the site comes first if the site is not allowed yet
    And then "Run the tool" is asked even for a read-only tool
    And the result is shown as the page's

  # test: test/ui/panel-manual-run.test.ts
  @unit
  Scenario: Arguments that are not JSON, not an object or not fitting the fields are not run
    Given the detail view of a tool is open
    When you press "Run…" with such arguments
    Then one plain sentence says what is wrong and nothing is asked

  # test: test/ui/panel-confirm-review.test.ts
  @unit
  Scenario: A form tool says the page waits for you to press Submit
    Given a form tool without automatic submit
    When the question to run it is shown and you allow it
    Then the question says "The page waits for you to press Submit"
    And the transcript says the same

  # test: test/ui/panel-confirm-review.test.ts
  @unit
  Scenario: A form with a password, payment or personal field carries a warning
    Given a form tool with a password field
    Then the question warns about password fields

  # req: LLM06
  # test: test/ui/panel-confirm-review.test.ts
  @unit
  Scenario: A tool the page marks as consequential is asked about a second time
    Given a tool with the consequential hint
    When you allow the first question
    Then a second question "Are you sure about" the tool is asked and a Deny there runs nothing

  # test: test/core/builtin-loop.test.ts
  @unit
  Scenario: The built-in graph tool asks before each call only in "ask for every call"
    Given a node page and the model calls the built-in graph tool
    Then the question to run it is asked in the mode "ask for every call"
    And no per-call question is asked in the other modes

  # test: test/adapters/tool-badge.test.ts
  @unit
  Scenario: The toolbar number counts the tools of a site you allowed, and nothing else
    Given a site that is allowed and a site that is not
    Then the number shows the tools the assistant is offered on the first, up to 99+
    And the number is empty on the second, on an address that is not http or https, and when the page does not answer

  # test: test/adapters/parity-bridge.test.ts
  @unit
  Scenario: Stop reaches the tool that runs on the page
    Given a tool that is running on the page
    When you press Stop
    Then the page's tool sees its abort signal

  # test: test/adapters/parity-bridge.test.ts
  @unit
  Scenario: A tool that returns nothing, or the page navigates, is shown as one plain sentence
    Given a tool that returns null
    Then the result reads "The tool returned no result"

  # test: test/adapters/parity-bridge.test.ts
  @unit
  Scenario: A tool of a same-origin frame is neither listed nor run
    Given a same-origin frame that registers a tool
    Then the panel lists only the tools of the top window

  # test: test/adapters/tool-router-closed.test.ts
  @unit
  Scenario: A call whose page navigated is not sent again to the page that follows
    Given a call is running and the page closes the connection
    Then the call is not sent a second time and the user reads that the page navigated

  @smoke
  Scenario: The review page marks each hostile tool "check" with its reason and not the clean one
    Given the review page is open with the side panel
    When you open the tools list
    Then every tool of the page except the clean one is marked "check" with its reason

  @smoke
  Scenario: A tool is run by hand from its detail view in the browser
    Given the review page is open with the side panel
    When you open the tool "review_fine" and press "Run…" and allow the question
    Then the transcript shows "ran review_fine"

  @smoke
  Scenario: The toolbar number is the tool count on an allowed site and empty on one that is not
    Given the review page is open with the side panel
    Then the toolbar number of the page's tab is the count of its tools
    And the toolbar number of the same page at localhost is empty
