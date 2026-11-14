# SPDX-License-Identifier: Apache-2.0
Feature: AgenticSystemCore node mode
  A page published with the AgenticSystemCore engine offers ten WebMCP tools and a knowledge
  linkset. WebAIAssist shows a node badge and gives the model a short hint about the node's tools.

  # test: test/core/node-mode.test.ts, test/ui/page-status.test.ts
  @unit
  Scenario: A page that registers the ten node tools, or links its linkset, is a node
    Given a page with the ten node tool names, or a link to its knowledge linkset
    Then the page line says "AgenticSystemCore node"

  # test: test/core/node-mode.test.ts
  @unit
  Scenario: A page with only some of the names and no linkset is not a node
    Given a page with three of the node tool names and no linkset
    Then the page is not treated as a node

  # test: test/core/agent-loop.test.ts, test/core/prompt.test.ts
  @unit
  Scenario: The node hint is added to the model's instructions only in node mode
    Given a node page and an ordinary page
    Then only the node page's instructions carry the node hint

  # test: test/replay/agsc-replay.test.ts
  @unit
  Scenario: Questions recorded on a real node replay with the same tool calls
    Given the recorded tool list and answers of a node
    Then the replay produces the recorded calls

  # req: R4-8
  # test: test/core/site-facts.test.ts, test/ui/panel-site.test.ts
  @unit
  Scenario: A linkset whose anchor is another site does not make the page a node
    Given a page whose linkset names another host as its anchor
    Then the node badge is not shown

  # req: R4-7
  @smoke
  Scenario: A node page shows the node badge and chips for its knowledge files
    Given an allowed node page with a knowledge linkset and llms.txt
    Then the card shows the node badge
    And the card shows chips for the linkset and llms.txt

  @smoke
  Scenario: A node page with no tools on this page says where to look
    Given an allowed node page that registers no tools
    Then the page line says that this page has no WebMCP tools and to open an item page or press Read this page

  @manual
  Scenario: On the live node a question is answered with its tools and knowledge links
    Given the open site is agenticsystemcore.com and it is allowed
    When I ask "What can I do here?"
    Then the answer names tools of the node and links from its knowledge
