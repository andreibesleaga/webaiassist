# SPDX-License-Identifier: Apache-2.0
Feature: Query and semantic tools
  On a node that publishes its graph as N-Quads, the explorer tab has a Query tab: the user writes
  a read-only SPARQL query and sees the rows as a table. The query runs in the browser on the files
  the node published; nothing is sent anywhere and nothing is changed. A Vocabulary tab and a Page
  data tab show what the node and the open page say about themselves, as text.

  # req: R4-7
  # test: test/query/worker-core.test.ts, test/ui/explorer-query-tabs.test.ts
  @smoke
  Scenario: The Query tab runs the first query and shows the node's items as a table
    Given a node page that publishes its graph as N-Quads and its vocabulary
    When I open the Query tab of the explorer and press Run
    Then the status says SELECT answered with 17 rows and the table has 17 rows

  # req: R4-8
  # test: test/query/worker-core.test.ts
  @smoke
  Scenario: An update is refused with a plain sentence and the graph is unchanged
    Given a node page that publishes its graph as N-Quads and its vocabulary
    When I open the Query tab of the explorer and run an INSERT query
    Then the status says that an update is refused
    And asking whether the inserted statement exists answers no

  @smoke
  Scenario: Stop ends a query that would run for minutes
    Given a node page that publishes its graph as N-Quads and its vocabulary
    When I open the Query tab of the explorer and run a query with four unconnected patterns
    And I press Stop
    Then the status says Stopped within one second
    And the next query is answered

  @smoke
  Scenario: A query that names a remote graph with FROM sends no request
    Given a node page that publishes its graph as N-Quads and its vocabulary
    When I open the Query tab of the explorer and run a query with FROM and a remote address
    Then the status says SELECT answered with 0 rows
    And no request went to any address but the extension and the node

  @smoke
  Scenario: Put in editor writes an example question into the box and does not run it
    Given a node page that publishes its graph as N-Quads and its vocabulary
    When I open the Query tab of the explorer and press Put in editor on the eighth question
    Then the box holds that question's query and the status still says to press Run

  @smoke
  Scenario: The Vocabulary tab and the Page data tab show text only
    Given a node page that publishes its graph as N-Quads and its vocabulary
    And the page has structured data with a bold tag in a name
    When I open the Vocabulary tab and the Page data tab of the explorer
    Then the vocabulary lists the class asc:Concept and the page data shows the tag as text

  # req: R4-8
  # test: test/query/worker-core.test.ts
  @unit
  Scenario: Only reading queries are answered
    Given queries that insert, delete, load, clear, drop, copy or call SERVICE, in any letter case
    Then the engine file's own refusal sentence is the answer and the store is unchanged
    And a query that only holds such words in a string, a name or a comment runs

  # req: ASI07-2
  # test: test/query/worker-core.test.ts
  @unit
  Scenario: The query engine has limits on the graph, the query and the rows
    Given a graph over 200,000 statements, a query over 4,000 characters, or a result over the row cap
    Then the graph is refused whole, the query is not run, and the rows are cut with their number kept

  # req: ASI07-2
  # test: test/adapters/graph-query.test.ts
  @unit
  Scenario: The graph is used only when its digest in the node's linkset matches
    Given a node whose linkset does not name graph.nq, or declares another digest for it
    Then no query is run and the answer is one plain sentence

  # req: ASI07-2
  # test: test/ui/explorer-query-tabs.test.ts
  @unit
  Scenario: Every cell of a result is text
    Given a graph value with an img tag, a script text and a link
    Then the table shows it as text and holds no such element

  # req: ASI07-2
  # test: test/third-party/agsc-query-pins.test.ts
  @unit
  Scenario: The query engine files are the published ones, byte for byte
    Given the copies of tokens.js, engine.js, view.js and the question list, and the oxigraph files
    Then each equals its size and SHA-256 in the pin file, and a changed byte is reported

  # req: R4-7
  # test: test/core/builtin-loop.test.ts
  @smoke
  Scenario: The model asks the node's graph with its built-in tool and, in the default mode, you are asked first
    Given a node page that publishes its graph as N-Quads and its vocabulary
    And the side panel is open on that page with the scripted model
    When the model calls the built-in graph tool with a count of the concepts
    Then a question to run the built-in graph tool was asked
    And the transcript shows the call and the count 13

  # req: R4-7
  # test: test/core/builtin-loop.test.ts
  @smoke
  Scenario: When you chose to be asked only about tools that change something, the built-in graph tool runs without a question
    Given a node page that publishes its graph as N-Quads and its vocabulary
    And the side panel is open on that page with the scripted model
    And the confirmation setting is "per-site"
    When the model calls the built-in graph tool with a count of the concepts
    Then no question to run a tool was asked
    And the transcript shows the call and the count 13

  # req: R4-8
  # test: test/core/builtin-loop.test.ts
  @smoke
  Scenario: An update asked by the model through the built-in tool is refused
    Given a node page that publishes its graph as N-Quads and its vocabulary
    And the side panel is open on that page with the scripted model
    When the model calls the built-in graph tool with the query DROP ALL
    Then the transcript says that an update is refused

  # req: ASI07-2
  # test: test/core/builtin-tools.test.ts, test/core/builtin-loop.test.ts
  @smoke
  Scenario: A page tool with the built-in tool's name is marked on the card and never answers
    Given a node page that also registers a tool named like the built-in graph tool
    And the side panel is open on that page with the scripted model
    When the model calls the built-in graph tool with a count of the concepts
    Then the card marks the page's tool as built-in and not offered
    And the transcript shows the count 13 and nothing from the page's tool

  # req: ASI07-2
  # test: test/core/builtin-tools.test.ts
  @unit
  Scenario: A name that is or reads like a WebAIAssist name is reserved
    Given page tool names with other letter case, hyphens, full-width letters, a zero-width space, Cyrillic or Greek look-alikes
    Then each is reserved, and an ordinary name is not

  # req: ASI07-2
  # test: test/core/builtin-loop.test.ts
  @unit
  Scenario: The built-in tool is listed apart and its results are fenced as untrusted data
    Given the model has the built-in graph tool and a graph value that holds an instruction
    Then the prompt lists the tool under its own heading and the rows stay inside the untrusted fence

  # req: R4-8
  # test: test/core/builtin-loop.test.ts
  @unit
  Scenario: After a failed query the model may fix it once, and after two failures it queries no more
    Given the model sends a query that fails, then another that fails, then a third
    Then the first failure carries a repair line, and the third query is not run

  # req: ASI07-2
  # test: test/ui/panel-graph-tool.test.ts
  @unit
  Scenario: The panel offers the built-in tool only on a node that publishes its graph and allows AI input
    Given a page that is not a node, a node that asks for no AI input, and a node that does not name graph.nq
    Then none of them is given the built-in tool

  # test: test/ui/panel-graph-tool.test.ts
  @unit
  Scenario: A model in the browser gets the page's own tools first
    Given a node page that offers its own WebMCP tools
    And a model in the browser, on the graphics card or the processor
    When a question is asked
    Then the model's tool list has the page's tools and not the built-in graph tool
    And Chrome's built-in model and a chat endpoint still get the built-in tool
