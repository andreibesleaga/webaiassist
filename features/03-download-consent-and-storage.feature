# SPDX-License-Identifier: Apache-2.0
Feature: Download, consent, progress, cancel, cache and removal
  Model weights are data and download once, from a fixed address, after the person agrees.
  Nothing is downloaded before consent; every download can be cancelled, resumed and removed.

  # req: LLM03-3, CWS-5
  @smoke
  Scenario: Before any weights download the panel shows the size and the source and waits
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    And the CPU model is not on this computer
    When I press "Start"
    Then a consent block says the model must download once, with its size in MB and its source host
    And no download has started
    And "Start" is disabled until I answer

  @smoke
  Scenario: "Not now" changes nothing
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    And the consent block is shown
    When I press "Not now"
    Then the consent block is hidden
    And the focus is back on "Start"
    And nothing was downloaded or stored

  @smoke
  Scenario: Agreeing starts the download and shows progress
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    And the consent block is shown
    When I press "Download 1 MB"
    Then the progress bar shows how much of the model has arrived
    And the model line says "Downloading" with the megabytes done and the percent
    And "Cancel download" is shown

  # test: test/adapters/prompt-api-runtime.test.ts, test/ui/panel-safety.test.ts, test/ui/panel-controller.test.ts
  @unit
  Scenario: Cancel stops a download at once and Start continues it
    Given a model is downloading
    When I press "Cancel download"
    Then the model line says that the download was cancelled
    And "Start" is enabled again
    And a model that finished loading after the cancel is released

  # req: LLM03-3
  @smoke
  Scenario: A downloaded file that does not match its checksum is deleted and not used
    Given a page with two WebMCP tools is open
    And the side panel is open on that page
    And the model host serves a file with the wrong SHA-256
    When the download finishes
    Then the panel says the file did not match its checksum and was deleted
    And the file is not in the browser's storage
    And "Start" downloads it again

  @smoke
  Scenario: A download that stops half way keeps no partial file as a model
    Given a page with two WebMCP tools is open
    And the side panel is open on that page
    And the connection drops during the download
    Then the panel says the download stopped and why
    And no partial file is used as a model
    When the connection is back and I press "Start"
    Then the download continues or starts again and the model becomes ready

  @smoke
  Scenario: A model on this computer starts without a new download
    Given a page with two WebMCP tools is open
    And the side panel is open on that page
    And the CPU model was downloaded earlier
    When I restart the browser and press "Start"
    Then no download is made and the model becomes ready from the stored copy

  # req: NIST-MG-2
  @smoke
  Scenario: Options lists the downloaded models with their sizes and removes one or all
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    And the CPU model was downloaded earlier
    When I open the Options page again
    Then the list of downloaded models shows "Smoke CPU model: 1 MB"
    When I press "Remove all downloaded models"
    Then the removal question says "Remove 1 model and free 1 MB?"
    When I press "Remove"
    Then the list of downloaded models is empty and says "Removed 1 model; 1 MB freed."
    And the next Start asks for consent again

  @smoke
  Scenario: Storage refused or disk full gives a plain message and a way out
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    And the browser has no space to store the model
    When the download finishes
    Then the panel says the browser has no space, with the size needed
    And it points to "Remove downloaded models" in Options

  @smoke
  Scenario: Out of memory on the CPU model names the next step
    Given a page with two WebMCP tools is open
    And the side panel is open on that page
    And the computer cannot give the CPU model enough memory
    When I press "Start"
    And I agree to the download
    Then the panel says how much free memory is needed
    And it suggests closing other tabs or choosing a smaller model

  # test: test/security-review/dist-review.test.ts
  @unit
  Scenario: Model libraries are inside the package and match their recorded checksums
    Given the release package
    Then every wasm file is inside the package with its SHA-256 recorded
    And no script or wasm file is fetched from the web

  @smoke
  Scenario: The model library inside the package loads and matches its pin
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    Then the bundled model library has the recorded SHA-256

  # test: test/security-review/dist-review.test.ts, test/adapters/cpu-models.test.ts
  @unit
  Scenario: The WebGPU model downloads only from its fixed address
    Given the WebGPU model is started
    Then its weights come from the one recorded revision, with the recorded size and SHA-256

  # test: test/adapters/wllama-runtime.test.ts
  @unit
  Scenario: Cancel ends the download of a processor model at once and keeps no partial file
    Given a processor model is downloading
    When I press "Cancel download"
    Then the download ends and the partial file is deleted

  # test: test/adapters/wllama-runtime.test.ts, test/adapters/cpu-models.test.ts
  @unit
  Scenario: The processor runtime loads only the models in its list, each from a fixed address with a recorded SHA-256
    Given a request to load a model that is not in the list
    Then it is refused before anything is downloaded
    And every listed model has a pinned address, size and SHA-256

  # test: test/adapters/wllama-runtime.test.ts
  @unit
  Scenario: A stored copy that was checked once starts without a download and without a new hash
    Given a processor model was downloaded and checked
    When it is started again
    Then no download is made and the file is not hashed again
