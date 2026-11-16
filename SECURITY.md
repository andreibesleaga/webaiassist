# Security policy

> **In short**
>
> - To report a vulnerability, open the repository's Security tab and choose Report a vulnerability. Do not open a public issue.
> - Say what you found, how to reproduce it, the Chrome version and the extension version.
> - Security fixes go to the newest release.
> - In scope: a page making the extension call a tool without a required confirmation, page or chat content leaving the computer, or code loaded from outside the package.
> - Problems in a website's own WebMCP tools belong to that website.

## Reporting a vulnerability

Report it privately through GitHub: open the repository's **Security** tab and choose
**Report a vulnerability**. This creates a private security advisory that only the maintainer
can see. Please do not open a public issue for a security problem.

Include what you found, the steps to reproduce it, the Chrome version, and the extension version
(shown on `chrome://extensions`).

## Supported versions

Only the newest release receives security fixes. The first release is 0.1.0.

## What counts

The extension handles text from web pages it does not control. These are in scope:

- a page making the extension call a tool without the user's confirmation when one is required;
- a page reading or changing messages between the extension's parts;
- text from a page or a tool result being treated as instructions;
- page or chat content leaving the computer;
- a permission broader than the documented list;
- code that the extension loads from outside its package.

[docs/THREAT-MODEL.md](docs/THREAT-MODEL.md) lists the known threats, the controls and the
residual risks.

Problems in a website's own WebMCP tools belong to that website.
