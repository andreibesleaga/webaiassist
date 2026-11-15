# SPDX-License-Identifier: Apache-2.0
Feature: Activity log
  Every question asked in the panel adds one entry to a log that stays in this browser: site, model,
  where it ran, tokens, price when the service reports one, times, the tool calls with the user's
  answer to each, and context numbers. The question, the tool arguments and the tool results are
  kept only when "Include content" is on (off at the start). The Activity view of the explorer page
  shows it, on any page; it exports, clears and can run a past tool call again through the usual question.

  # test: test/ui/panel-activity.test.ts, test/core/activity-trace.test.ts
  @unit
  Scenario: A question adds an entry, also when it stops or fails
    Given a question was asked in the panel
    When it ends, by an answer, by Stop or by an error
    Then one entry with the site, the model, the tokens and the times is written

  # test: test/core/activity-trace.test.ts, test/security/activity-key-leaks.test.ts
  @unit
  Scenario: Without "Include content" no question text, argument or result is kept
    Given "Include content" is off
    When a question runs a tool
    Then the entry holds the tool's name, the argument names and the sizes, and no text

  # test: test/security/activity-key-leaks.test.ts
  @unit
  Scenario: The API key is never in the log, with or without "Include content"
    Given an endpoint API key is saved and "Include content" is on
    When the question or a tool argument contains the key
    Then the key is removed from every string that is kept

  # test: test/core/activity-builtin-loop.test.ts
  @unit
  Scenario: The built-in graph tool is logged as a built-in call with the query as its argument
    Given the model asks the built-in graph tool a query
    When the answer ends
    Then the entry has a built-in call that asked no question, and the query text only with "Include content"

  # test: test/core/activity-cap.test.ts, test/adapters/indexeddb-activity.test.ts
  @unit
  Scenario: The log is capped at 8 MiB and the oldest entries go first
    Given the log is full
    When a new entry is written
    Then the oldest entries are removed and the new one stays

  # test: test/ui/explorer-activity-tab.test.ts, test/core/activity-summary.test.ts
  @unit
  Scenario: The Activity view shows totals and filters by site, model and day
    Given a log with questions on two days and two sites
    When I choose a site, a model or a day
    Then the list and the totals show only those questions

  # test: test/ui/explorer-activity-tab.test.ts, test/core/activity-export.test.ts
  @unit
  Scenario: Export JSON follows the published schema and Export CSV guards formulas
    Given a log with entries
    When I press Export JSON and Export CSV
    Then the JSON validates against the schema and a cell that starts with "=" gets an apostrophe

  # test: test/ui/explorer-activity-tab.test.ts
  @unit
  Scenario: Clear asks inside the page and never uses the browser's confirm
    Given a log with entries
    When I press Clear and then Keep
    Then nothing is removed
    And pressing Clear and then Remove all empties the log

  # test: test/ui/explorer-activity-tab.test.ts, test/core/activity-rerun.test.ts
  @unit
  Scenario: A past tool call runs again only after the usual question
    Given an entry with a tool call whose arguments were saved
    When I press Run again and then Deny
    Then the tool is not run
    And after Allow it runs once in the tab the view was opened for

  # test: test/ui/explorer-activity-tab.test.ts
  @unit
  Scenario: Text from a page or a service stays text in the Activity view
    Given an entry whose model name is markup
    When the Activity view shows it
    Then the markup is shown as text and no element is made from it

  # test: test/adapters/forget-activity.test.ts
  @unit
  Scenario: Forget this site and Forget all sites remove the entries
    Given entries of two sites
    When I forget one site
    Then only the entries of the other site remain

  # test: test/ui/panel-activity-button.test.ts, test/ui/explorer-activity-url.test.ts
  @unit
  Scenario: The Activity log button is in the More area and opens the Activity address
    Given the side panel is open on any page
    When I press Activity log in the More area
    Then the extension opens explorer.html on the Activity view

  @smoke
  Scenario: A question adds an entry that the Activity view lists
    Given a page with two WebMCP tools is open
    And the side panel is open on that page
    And the scripted model is ready
    When I ask '/tool echo {"text": "hi"}'
    And I allow what is asked until the answer ends
    And I open the Activity log from the More area
    Then the Activity view lists a question that used the tool "echo"

  @smoke
  Scenario: The Activity view opens on a page that is not a node, with only its own tab
    Given a page without WebMCP tools is open
    And the side panel is open on that page
    When I open the Activity log from the More area
    Then the Activity view has the Activity tab and no other tab
