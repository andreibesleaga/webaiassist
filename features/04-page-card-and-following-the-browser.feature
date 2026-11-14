# SPDX-License-Identifier: Apache-2.0
Feature: The page card and following the browser
  The top of the panel says which page it works on and what the page offers. It follows the
  tab, the window and the address by itself, and never reads a site the person has not allowed.

  @smoke
  Scenario: The page line names the site and counts its WebMCP tools
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    Then the page line says "{host} — 2 WebMCP tools"

  @smoke
  Scenario: A page without WebMCP tools is a plain state with a next step
    Given WebAIAssist is installed
    And a page without WebMCP tools is open
    And the side panel is open on that page
    Then the page line says "{host} — no WebMCP tools (use Read this page or Add WebMCP to this site)"
    And the page line is not shown as an error

  @smoke
  Scenario: A browser page cannot be used and says so
    Given WebAIAssist is installed
    And a browser page is open
    And the side panel is open on that page
    Then the page line says "This page — WebAIAssist cannot run here (chrome:// pages, the store)"
    And the "Allow WebAIAssist on this site" button is hidden

  # test: test/ui/page-status.test.ts
  @unit
  Scenario: With no page the panel says to open one
    Given there is no open tab
    Then the page line says "No page yet."

  # test: test/ui/page-status.test.ts
  @unit
  Scenario: A page that cannot list its tools shows why, in one line
    Given a page whose tool listing fails with "timed out"
    Then the page line says "{host} — the page did not list its tools: timed out"

  # req: CWS-11
  @smoke
  Scenario: Switching to another tab updates the card within a moment
    Given a page with two WebMCP tools is open in one tab
    And a page without WebMCP tools is open in another tab
    And the side panel follows the tab in front
    When I switch to the first tab
    Then the card shows the first page's site and "2 WebMCP tools"
    When I switch to the second tab
    Then the card shows the second page's site and that it has no WebMCP tools

  # req: CWS-11
  @smoke
  Scenario: Switching to a site that is not allowed shows only its name and the Allow button
    Given the side panel is open on an allowed page
    When I switch to a tab on a site that is not allowed yet
    Then the page line says "This page — not allowed yet" and the Allow button is shown
    And nothing was fetched from that site

  @smoke
  Scenario: The card refreshes when the page finishes loading or its address changes in place
    Given the side panel is open on an allowed page
    When the page navigates to another path of the same site
    Then the card shows "Looking at {host}…" and then the new page's tools
    When the page changes only its title
    Then the title row changes and the tools are not listed again

  @smoke
  Scenario: The card follows the focused window
    Given two browser windows with different allowed pages
    When I focus the second window
    Then the card shows the second window's active page

  @smoke
  Scenario: A tool the page registers later raises the count
    Given the side panel is open on a page with two WebMCP tools
    When the page registers a third tool
    Then the card shows 3 tools within a moment

  # req: LLM10-3
  # test: test/ui/panel-follow.test.ts
  @unit
  Scenario: A page that changes in a loop causes one refresh and no repeated file reads
    Given a thousand navigation events in one second
    Then the card refreshes once
    And no site file is requested twice
