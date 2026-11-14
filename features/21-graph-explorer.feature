# SPDX-License-Identifier: Apache-2.0
Feature: Graph explorer tab
  On a site that publishes a knowledge linkset with a graph, the card says how many items the
  graph holds. One press opens a full tab with the 2D graph explorer of the AgenticSystemCore
  site, drawn from the node's published files. Everything it reads is untrusted text; other
  nodes are read only after the user ticks them and presses a button.

  # req: R4-7
  # test: test/ui/panel-graph-chip.test.ts, test/core/site-graph-facts.test.ts
  @unit
  Scenario: The chip adds up the node's counts and is built in code
    Given a node whose linkset says clusters=3, concepts=13, procedures=1
    Then the card shows the button "Graph: 17 items" and the page file has no such button

  @smoke
  Scenario: An allowed node page shows the Graph chip and one press opens the explorer
    Given a node page that publishes a linkset with counts, a graph and its chunks
    And the side panel is open on that page
    When I press the Graph chip
    Then a tab of the extension opens with the graph of that node drawn, with its nodes listed as buttons

  @smoke
  Scenario: With only the toolbar click as access, the explorer still reads the node through the tab
    Given a node page at a site that WebAIAssist may script only after the toolbar click
    And I click the toolbar button on it
    When I press the Graph chip in the side panel
    Then the explorer tab draws the node's graph

  # req: R4-8
  # test: test/adapters/graph-fetch-guard.test.ts, test/core/graph-files.test.ts, test/adapters/graph-fetch-shim.test.ts
  @unit
  Scenario: The explorer can ask only for the fixed files of the node and of ticked peers
    Given the explorer asks for another path of the node, another site, an IP address or an address with a query
    Then nothing is sent and the explorer shows a plain sentence

  # req: ASI07-2
  # test: test/adapters/graph-files.test.ts, test/protocol/graph-file-message.test.ts
  @unit
  Scenario: The message that carries a graph file has its own schema, ids and size cap
    Given a graph file message with an unknown id, an extra field or text over 4 MiB
    Then it is rejected

  @smoke
  Scenario: A graph that does not match the digest in the linkset is not drawn
    Given a node whose linkset declares another digest for its graph
    When I open the explorer
    Then the explorer says the graph does not match the digest and draws nothing

  @smoke
  Scenario: A graph over the size cap is refused with a plain message
    Given a node whose graph is larger than 2 MiB
    When I open the explorer
    Then the explorer says the file is larger than WebAIAssist reads and draws nothing

  # req: LLM01-2, ASI07-1
  @smoke
  Scenario: Nothing from the graph becomes markup, a script or a link that runs
    Given a node whose graph has a label with an img tag, a script text and a javascript address
    When I open the explorer and select that node
    Then the texts appear as text, no image or script exists and no dialog opens

  # req: LLM01-2
  # test: test/security/explorer-no-html-sink.test.ts
  @unit
  Scenario: The copied explorer code and the new code have no HTML or code sink
    Given the files of third_party/agsc-explorer and src/ui/explorer
    Then none uses innerHTML, outerHTML, insertAdjacentHTML, document.write, eval or new Function

  # test: test/ui/agsc-explorer-pins.test.ts
  @unit
  Scenario: A copied explorer file that differs from its pin fails a test and stops the build
    Given a file in third_party/agsc-explorer or force-graph whose bytes differ from PINS.json
    Then the pin test fails and the build stops

  # test: test/ui/agsc-explorer-graph.test.ts
  @unit
  Scenario: The Patterns node comes out as one connected piece without vocabulary terms
    Given the recorded graph of the Patterns node
    Then the explorer's data code gives one connected piece with no owl or rdfs term drawn

  # req: R4-8
  @smoke
  Scenario: Other nodes are read only after they are ticked and the button is pressed
    Given a node that names a public peer, a plain http peer and an IP address as peers
    When I open the explorer
    Then the three peers are listed, only the public one can be ticked, and nothing was requested from it
    And after I tick it and press "Read the ticked nodes" only its fixed files are requested

  # test: test/adapters/peers.test.ts, test/ui/explorer-peers-block.test.ts
  @unit
  Scenario: Only an https origin with a public name qualifies as a peer
    Given peers with http, an IP address, localhost, a local name, another port or user info
    Then they are listed with the reason and cannot be ticked

  # req: R4-8
  @smoke
  Scenario: A tab that left the site is not read again
    Given the explorer is open for a node page
    When the page's tab moves to another site and the explorer asks for a file
    Then the explorer says the tab left the site and no request reaches that site

  @smoke
  Scenario: The explorer page is accessible in the light and the dark theme
    Given the explorer is open with peers listed
    Then axe finds no WCAG 2.2 A or AA violation in either theme

  # test: test/security-review/dist-review.test.ts
  @unit
  Scenario: The manifest gains no permission, no host and no web_accessible_resources
    Given the built extension
    Then the permissions are unchanged and web pages cannot open the explorer page

  @manual
  Scenario: On the two live nodes the explorer draws their graphs
    Given the live nodes agenticsystemcore.com and patterns.agenticsystemcore.com are allowed
    When I press the Graph chip on each and, on the first, tick the peer and press the button
    Then the picture equals the one at https://agenticsystemcore.com/graph/
