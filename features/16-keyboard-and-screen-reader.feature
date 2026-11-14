# SPDX-License-Identifier: Apache-2.0
Feature: Keyboard-only and screen-reader use
  Everything works with the keyboard. Status lines are announced politely, errors once, and a
  finished answer is read once.

  @smoke
  Scenario: The side panel has no accessibility violations at rest, with Help and in dark mode
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    Then the panel has no accessibility violations
    When I press "Help"
    Then the panel has no accessibility violations
    When the browser prefers a dark colour scheme
    Then the panel has no accessibility violations

  @smoke
  Scenario: The Options page has no accessibility violations
    Given WebAIAssist is installed
    And the Options page is open
    Then the panel has no accessibility violations

  @smoke
  Scenario: The panel fits 320 pixels without sideways scrolling
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    When the panel is 320 pixels wide
    Then the panel does not scroll sideways

  @smoke
  Scenario: Tab reaches every control in order, each with a visible focus ring
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    And the welcome screen was dismissed
    When I press Tab through the panel
    Then the focus visits "help-toggle, open-options, read-page, more-toggle, tools-toggle, model, start, conversation, question, send" in that order
    And every focused control shows a focus ring

  @smoke
  Scenario: The confirmation dialog is accessible, puts focus on Deny and keeps Tab inside
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    And the scripted model is ready
    When I ask '/tool add {"a": 1, "b": 2}'
    And I press "Allow for this session"
    Then the "Deny" button has focus
    And the panel has no accessibility violations
    When I press Tab twice
    Then the focus is still inside the dialog

  @smoke
  Scenario: The status lines are live regions and the conversation is a log
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    Then the page line, the model line and the page note are polite status regions
    And the conversation is a log region

  @smoke
  Scenario: Errors are announced once in an alert, and download progress every ten percent only
    Given an error is shown in the banner
    Then the banner has the role alert
    And the progress announcement changes only every ten percent

  @smoke
  Scenario: A finished answer is read once, and the streaming draft is hidden from screen readers
    Given an answer is streaming
    Then the draft is hidden from assistive technology
    And the finished answer enters the log once

  @smoke
  Scenario: Reduced motion turns off animation, and 200 percent zoom loses no text
    Given the browser prefers reduced motion
    Then no animation or transition runs
    When the text is zoomed to 200 percent
    Then no text is clipped

  @manual
  Scenario: A screen reader announces the page status, the model status and each answer once
    Given NVDA or VoiceOver is running
    When I switch tabs, start the model and ask a question
    Then the page status, the model status and the answer are each read once
