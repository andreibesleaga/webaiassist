# SPDX-License-Identifier: Apache-2.0
Feature: The node's own list, more site facts, the shortcut, diagnostics and storage
  A node lists a digest for its files. The card compares them, shows more of what the node and
  the page publish, and gives a plain reason when a page has no tools. A keyboard shortcut opens
  the panel, "Copy diagnostics" shows what it copies first, and downloads are asked to be kept.

  # test: test/ui/panel-node-extras.test.ts, test/core/site-node-extras.test.ts
  @unit
  Scenario: Files that match the node's own list get the chip "matches the node's own list"
    Given a node whose llms.txt matches the digest in its knowledge links
    Then the card shows the chip "matches the node's own list" with the bundle version and date in its title
    And the chip never says "trusted" or "verified"

  # test: test/ui/panel-node-extras.test.ts, test/core/site-node-extras.test.ts
  @unit
  Scenario: A file that does not match the node's own list is marked and not given to the model
    Given a node whose llms.txt differs from the digest in its knowledge links
    Then the card says "llms.txt does not match the node's own list; it is not given to the model."
    And the site facts for the model do not contain the guide

  # test: test/adapters/site-page-scripts.test.ts
  @unit
  Scenario: The digest is computed over the raw bytes of a body that was read whole
    Given a site file that was read without being cut
    Then the page script returns the base64 SHA-256 of its bytes
    And a body that was cut, or a page without WebCrypto, returns none

  # test: test/ui/panel-node-extras.test.ts
  @unit
  Scenario: The card shows the node's bundle, item counts and ledger head
    Given a node with a knowledge link set
    Then the card shows the bundle version, date and hash, the item counts and the ledger head as text

  # test: test/ui/panel-node-extras.test.ts, test/core/site-node-extras.test.ts
  @unit
  Scenario: The page's own link rows and richer JSON-LD are shown as text, same site only
    Given a page with link rows and a Dataset in its JSON-LD
    Then the card shows same-origin link rows, the number of distributions, the licence, the creator and the date

  # test: test/ui/panel-node-extras.test.ts, test/core/site-node-extras.test.ts, test/core/site-files.test.ts
  @unit
  Scenario: The sustainability file is the ninth site file and its signature is only "present"
    Given a site that publishes /.well-known/sustainability-data
    Then the card shows energy, carbon, period, method and provider
    And the signature is shown as "signature present, not checked"

  # test: test/ui/panel-node-extras.test.ts, test/core/site-node-extras.test.ts
  @unit
  Scenario: Every Content-Signal value and group of robots.txt is shown, and only the "*" group decides
    Given a robots.txt with a "*" group and a named crawler group
    Then the card shows both groups with their values
    And a named crawler group never turns AI input off or on

  # test: test/ui/panel-node-extras.test.ts
  @unit
  Scenario: A node shows three starter questions that fill the box and send nothing
    Given the open page is a node whose tools are named brief, search and explain
    When I press a starter question
    Then the question box holds that text and nothing was sent

  # test: test/ui/panel-node-extras.test.ts
  @unit
  Scenario: The node's declared peer is shown as a text chip and is not fetched
    Given a node whose knowledge links name a peer on another site
    Then the card shows the chip "peer: patterns.agenticsystemcore.com" and nothing is requested from it

  # test: test/ui/page-status.test.ts, test/adapters/page-bridge-main.test.ts
  @unit
  Scenario: The status line says why a page has no tools
    Given a page with no tools
    Then the line says "this browser has no WebMCP" with the flag to turn on when the browser offers none
    And it says "no WebMCP tools: this page registers none" when the browser has WebMCP

  # test: test/scripts/manifest-shortcut.test.ts, test/scripts/check-dist.test.ts
  @unit
  Scenario: The manifest declares one shortcut, for the toolbar button, and no permission
    Given the manifest
    Then it has the command _execute_action with Alt+Shift+A suggested and no other command

  @manual
  Scenario: The shortcut opens the side panel like the toolbar button
    Given the extension is installed in Chrome
    When I press Alt+Shift+A on a web page
    Then the side panel opens and the card reads the page as after a toolbar click

  # test: test/ui/diagnostics.test.ts, test/core/diagnostics.test.ts
  @unit
  Scenario: Copy diagnostics shows what it copies, then copies exactly that on a second click
    Given the panel or the Options page
    When I press "Copy diagnostics"
    Then a preview shows the versions, the model, the adapter, the built-in model state, WebMCP and the last error
    And nothing is copied until I press the button again

  # test: test/ui/diagnostics.test.ts, test/core/diagnostics.test.ts
  @unit
  Scenario: Diagnostics hold no page text, no address and no key
    Given a page was read and an error named the endpoint key and an address
    Then the preview holds none of them, and the site host only when I tick the box

  # test: test/ui/storage-p2.test.ts
  @unit
  Scenario: Persistent storage is asked once, after the first successful download
    Given a model that has to be downloaded
    When the download succeeds
    Then the panel asks the browser once to keep the downloads, and never at install or on a later download

  # test: test/ui/storage-p2.test.ts
  @unit
  Scenario: Options shows the total size of the downloaded models
    Given models are stored in this browser
    Then Options shows "Total on this computer: N MB" beside the list
