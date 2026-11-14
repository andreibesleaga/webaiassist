# SPDX-License-Identifier: Apache-2.0
Feature: Install and first run
  A person installs WebAIAssist, opens it on a page and learns in a few seconds what it does,
  which model it picked and why, and that nothing leaves the computer.

  # req: CWS-10
  @smoke
  Scenario: The toolbar button opens the side panel and lets WebAIAssist use that page
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open on a site that is not allowed yet
    When I click the toolbar button
    Then the side panel is open
    And the page line says "{host} — 2 WebMCP tools"
    And the "Allow WebAIAssist on this site" button is hidden

  # req: EU-1, EU-3
  @smoke
  Scenario: The first run shows a welcome screen with the steps, the model and the privacy line
    Given WebAIAssist is installed for the first time
    When I open the side panel
    Then the welcome screen shows what WebAIAssist does in three steps
    And the welcome screen names the model that was picked and why
    And the welcome screen says that chats and pages stay on this computer
    And the welcome screen says that the answers come from an AI model and can be wrong

  @smoke
  Scenario: "Got it" hides the welcome screen and it stays hidden after a restart
    Given the welcome screen is shown
    When I press "Got it"
    Then the welcome screen is hidden
    When I close and reopen the side panel
    Then the welcome screen is hidden

  @smoke
  Scenario: Help shows the welcome screen again
    Given the welcome screen was dismissed
    When I press "Help"
    Then the welcome screen is shown

  @smoke
  Scenario: Help opens and closes, and the focus goes back to the Help button
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    When I press "Help"
    Then the help text "How WebAIAssist works" is shown
    When I press "Close help"
    Then the help text is hidden
    And the "Help" button has focus

  @smoke
  Scenario: Before a model is started the panel says so, and a question gets the same hint
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    When I choose the model "Scripted test model"
    Then the model line says "No model loaded. Press Start."
    When I ask "What can I do here?"
    Then the conversation shows "Press Start to load a model first."

  # req: LLM09-1, NIST-600-CF, NIST-600-HAI
  @smoke
  Scenario: The panel says that answers come from an AI model and can be wrong
    Given WebAIAssist is installed
    And the scripted model is ready
    When I ask "Hello"
    Then the answer is labelled as written by an AI
    And the panel shows a permanent note that answers can be wrong

  @manual
  Scenario: Installing from the Chrome Web Store asks only for the permissions the listing names
    Given the listing in the Chrome Web Store
    When I press "Add to Chrome"
    Then Chrome shows the permissions listed in docs/STORE-LISTING.md and no others

  # test: test/scripts/check-zip.test.ts, test/security-review/dist-review.test.ts
  # req: CWS-2, CWS-3
  @unit
  Scenario: The package asks for no website access at install
    Given the release package
    Then the manifest lists no host permission that is granted at install
    And the optional host permissions are only https sites, localhost and 127.0.0.1
