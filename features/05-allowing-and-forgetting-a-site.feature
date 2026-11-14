# SPDX-License-Identifier: Apache-2.0
Feature: Allowing and forgetting a site
  WebAIAssist reads nothing from a site until the person allows it. Allowing is one site at a
  time, from the person's own click. Forgetting takes everything back.

  # req: CWS-10, ASI03-1
  @smoke
  Scenario: A page that is not allowed yet shows one line and an Allow button, and nothing is read
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open on a site that is not allowed yet
    And the side panel is open on that page
    Then the page line says "This page — not allowed yet"
    And the "Allow WebAIAssist on this site" button is shown
    When I press "Read this page"
    Then the page note contains "not allowed on this page yet"
    And the conversation is empty

  @smoke
  Scenario: Allow asks Chrome, and the toolbar button is the other way in
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open on a site that is not allowed yet
    And the side panel is open on that page
    When I press "Allow WebAIAssist on this site"
    Then the page note contains "next to the address bar"
    When I click the toolbar button
    Then the page line says "{host} — 2 WebMCP tools"
    And the "Allow WebAIAssist on this site" button is hidden
    And the page note is empty

  # test: test/ui/panel-access.test.ts, test/adapters/site-access.test.ts
  @unit
  Scenario: Allow names the site in Chrome's request and refuses a site that is not a plain web address
    Given a page on a known site
    When I press "Allow WebAIAssist on this site"
    Then the request names that one site
    And an address that is not http or https is refused

  # test: test/ui/panel-access.test.ts
  @unit
  Scenario: Denying the site request gives a plain message and keeps the chat usable
    Given Chrome's site request is declined
    Then the page note says that the site was not allowed and points to the toolbar button

  # req: LLM06-1
  @smoke
  Scenario: The first tool use on a site asks once for its tools, per session
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    And the scripted model is ready
    When I ask '/tool add {"a": 1, "b": 1}'
    Then a dialog titled "Use the tools of {origin}?" is open
    When I press "Allow for this session"
    Then a dialog titled "Run the tool add?" is open
    When I press "Allow once"
    Then the conversation shows "The tool said: 2"
    When I ask '/tool add {"a": 2, "b": 2}'
    Then a dialog titled "Run the tool add?" is open

  @smoke
  Scenario: Denying the site at the first tool means the answer uses no tools
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    And the scripted model is ready
    When I ask '/tool add {"a": 1, "b": 1}'
    And I press "Deny"
    Then the page note says "You did not allow this site’s tools, so the answer uses none."
    And no tool dialog is shown

  # req: NIST-MG-2
  @smoke
  Scenario: Forgetting a site takes back its tool permission, and the next tool use asks again
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open on a site that is not allowed yet
    And the side panel is open on that page
    And the scripted model is ready
    Then the page line says "This page — not allowed yet"
    When I click the toolbar button
    Then the page line says "{host} — 2 WebMCP tools"
    When I ask '/tool echo {"text": "one"}'
    And I press "Allow for this session"
    And I press "Allow once"
    Then the conversation shows "The tool said: one"
    When I press "Forget this site"
    Then the page note contains "WebAIAssist forgot {origin}"
    When I ask '/tool echo {"text": "two"}'
    Then a dialog titled "Use the tools of {origin}?" is open

  # test: test/adapters/forget-site.test.ts, test/ui/panel-privacy.test.ts
  @unit
  Scenario: Forgetting a site removes its memory, its permission and its compatibility mode
    Given a site with saved chat, an allowance and compatibility mode
    When I press "Forget this site"
    Then the saved chat is gone and the site is not allowed any more and compatibility mode is off

  # test: test/adapters/forget-site.test.ts, test/ui/panel-privacy.test.ts
  @unit
  Scenario: Forgetting needs a plain web address and changes nothing otherwise
    Given the open page is not an http or https page
    When I press "Forget this site"
    Then the page note says that WebAIAssist forgets one http or https site at a time

  # req: NIST-MG-2
  # Two sites at once are proved by test/adapters/forget-site.test.ts (forgetAllSites); the
  # browser has one test origin that needs no click, so this scenario uses one site.
  @smoke
  Scenario: Options can forget all sites at once
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    And the scripted model is ready
    When I ask '/tool echo {"text": "one"}'
    And I press "Allow for this session"
    And I press "Allow once"
    Then the conversation shows "The tool said: one"
    And a chat is saved for the site
    When I open the Options page again
    And I press "Forget all sites"
    Then the options status says "Forgot all sites: their chats, their tool permissions and their access."
    And no chat is saved
    When I ask '/tool echo {"text": "two"}' 
    Then a dialog titled "Use the tools of {origin}?" is open
