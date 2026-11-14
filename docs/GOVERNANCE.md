# Governance

Who is responsible for what, and which uses are not offered.

## Roles

- **Provider.** The maintainer of this repository builds and publishes the extension. The provider
  is responsible for the code, the package, the model list, the documents in this repository and
  the fixes listed in [SECURITY.md](../SECURITY.md).
- **Deployer.** The person who installs and runs the extension is the deployer of the AI system on
  their own computer. They choose the model, allow each site, set the step limit, decide whether
  memory is on, and answer every confirmation question. The extension has no account, no server
  and no usage data, so the provider cannot see or change what a deployer does.
- **Model providers.** The weights come from the publishers named in [SOURCES.md](SOURCES.md)
  (Qwen, Meta, Google for Gemma 4, Chrome's own model). Their licences and limits apply to their models.
- **Site owners.** A site is responsible for its own WebMCP tools and files. The extension shows
  them and asks before it runs one; it cannot check what a tool does.

## Uses that are not offered

WebAIAssist is a general assistant for reading a web page and using its tools. It does not offer,
and is not built or tested for:

- biometric identification or categorisation of people;
- emotion recognition;
- scoring or ranking people, or deciding on access to jobs, credit, housing, education, benefits
  or law enforcement;
- other high-risk uses that need a conformity assessment, human oversight procedures or a record of
  decisions.

Do not use it for those. The model can be wrong and the page it reads can be hostile; nothing here
replaces a person's decision in a high-stakes case.

## What the extension tells the person

- The panel says that answers come from an AI model and can be wrong.
- An exported chat starts with a machine-readable block (`ai-generated: true`, the extension
  version, the model, where it ran) and says in a sentence whether a local AI model or an AI model
  at the endpoint host wrote it.
- Every tool call is shown with its site and arguments. It waits for the person's answer, with one
  exception: in the per-site mode, a tool that the page marks read-only runs without a question
  (a hint the page writes). The default mode asks before every call.

## Where the controls are

[THREAT-MODEL.md](THREAT-MODEL.md) lists the threats, the controls, the tests that prove them and
the residual risks. [PRIVACY.md](PRIVACY.md) lists what leaves the computer. [SCENARIOS.md](SCENARIOS.md)
links each requirement to the scenarios that check it.
