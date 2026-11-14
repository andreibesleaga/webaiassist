# SPDX-License-Identifier: Apache-2.0
Feature: Compatibility mode
  "Add WebMCP to this site" loads the WebMCP polyfill into one site so a page that has not
  adopted WebMCP can register tools. It is one exact site, from the person's click.

  # test: test/adapters/compat-mode.test.ts, test/ui/panel-controller.test.ts
  @unit
  Scenario: The click asks for the site, registers the polyfill at document start, then reloads the page
    Given an allowed page
    When I press "Add WebMCP to this site"
    Then the site is asked for first, the polyfill is registered, and the page reloads
    And the page note says "Compat mode is on for {origin}. The page reloads so it can register its tools."

  # test: test/adapters/compat-mode.test.ts
  @unit
  Scenario: Compat mode is not turned on twice, and a refused site changes nothing
    Given compat mode is already on, or the site is refused
    Then the page note says so and nothing is registered twice

  # test: test/adapters/compat-mode.test.ts, test/security-review/host-review.test.ts
  # req: ASI03-2
  @unit
  Scenario: Compat mode accepts one exact http or https site and nothing wider
    Given an address that is not a plain http or https origin, or a wildcard
    Then it is refused

  @smoke
  Scenario: Without a web page, compat mode says to open one
    Given WebAIAssist is installed
    And a browser page is open
    And the side panel is open on that page
    When I press "Add WebMCP to this site"
    Then the page note says "Open a web page first; compat mode works on http and https pages."

  @manual
  Scenario: After compat mode a page without WebMCP shows tools registered by the polyfill
    Given a page that registers tools only when WebMCP exists
    When I press "Add WebMCP to this site" and the page reloads
    Then the card lists the tools

  # test: test/adapters/compat-mode.test.ts
  @unit
  Scenario: Forgetting the site removes the polyfill registration and the site access
    Given compat mode is on for a site
    When I press "Forget this site"
    Then the registration and the access are removed
