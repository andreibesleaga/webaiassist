# Chrome Web Store runbook

How to publish WebAIAssist 0.1.0 on the Chrome Web Store and how to ship updates.
Every step names the dashboard label the official page uses. All pages were read on 12 Nov 2026.
The store listing text is in [STORE-LISTING.md](STORE-LISTING.md). The privacy policy is
`docs/PRIVACY.md`, hosted at `<PRIVACY-POLICY-URL>`.

Plan: submit as Unlisted. Make it Public after one clean review and a week of testing.

## Before each submission

- [ ] `npm run verify:release` is green.
- [ ] The version is bumped in `package.json` and the build carries it into `manifest.json`.
- [ ] The zip is `webaiassist-<version>.zip` and `manifest.json` sits at the zip root.
- [ ] A store search for the name "WebAIAssist" was repeated today.
- [ ] The permission justifications pasted from [STORE-LISTING.md](STORE-LISTING.md) name the
      same permissions as `dist/manifest.json` (the build check fixes the manifest list).
- [ ] Screenshots follow [STORE-LISTING.md](STORE-LISTING.md) and come from a real run, not from
      `npm run screenshots` (those are headless stand-ins with a scripted model).
- [ ] The placeholders `<STORE-LINK>` (README, PITCH), `<PRIVACY-POLICY-URL>` and
      `<DEMO-NODE-URL>` (this runbook, the listing) are replaced by real addresses.
- [ ] The sentence "Chrome's built-in model test: not verified ..." in README.md and
      [STORE-LISTING.md](STORE-LISTING.md) says what the last hand test on real Chrome found
      ([MANUAL-CHECKS.md](MANUAL-CHECKS.md)); keep the words "built-in model test:" in it.
- [ ] The "Test instructions" text names a demo page that is live today.
- [ ] `docs/STORE-LISTING.md` describes what the zip does now: four model paths, the page card,
      site information, no AI input, and no new permission since the last upload.

## 1. Register a developer account (once)

Source: <https://developer.chrome.com/docs/webstore/register> (read 12 Nov 2026).

1. Open the developer dashboard at `chrome.google.com/webstore/devconsole`. The first visit shows
   the registration screen.
2. Agree to the developer agreement and policies, then pay the one-time registration fee.
3. Give a developer email. The page advises a new address used only for publishing, checked often.
   It cannot be changed later. A new account and an item transfer through the support form are the
   only way to change it.

The page names the fee but gives no amount. Read the amount on the payment screen.

## 2. Set up the account

Source: <https://developer.chrome.com/docs/webstore/set-up-account> (read 12 Nov 2026).

1. Set the publisher name. It is shown as "Offered by" in the listing Details.
2. On the account page click **Add email**, then **Verify email**. Open the link sent to that
   address. Verified emails show only as contact information on the items.
3. Turn on notifications on the **Account** page to get an email when an item is published or
   staged (see the publish page below).

Neither page mentions a trader declaration or account verification beyond email.

## 3. Prepare the zip

Source: <https://developer.chrome.com/docs/webstore/prepare> (read 12 Nov 2026).

- The manifest cannot be edited in the dashboard after upload. Check `name`, `version`, `icons`
  and `description` (at most 132 characters) first.
- Every upload needs a higher version than the last.
- The zip must hold `manifest.json` in the root, not in a folder.
- A manifest with comments fails with "Cannot parse the manifest".
- Run `npm run verify:release`. It builds `webaiassist-0.1.0.zip` from the contents of `dist/`.

## 4. Create the item and upload

Source: <https://developer.chrome.com/docs/webstore/publish> (read 12 Nov 2026).

1. Sign in to the Chrome Developer Dashboard and click **Add new item**.
2. Click **Choose file**, select the zip, click **Upload**. Packages over 2 GB are rejected.
3. New publishers may have up to two published extensions. A raise can be requested.
4. **Package** tab: check the details. They are not editable at first.
5. **Store listing** tab: enter the text and images from [STORE-LISTING.md](STORE-LISTING.md).

## 5. Privacy practices tab

Source: <https://developer.chrome.com/docs/webstore/cws-dashboard-privacy> (read 12 Nov 2026).
The publish page calls this tab "Privacy" (read 12 Nov 2026). The update page calls it
"Privacy practices". Use whichever label the dashboard shows.

- **Single purpose description:** one sentence on what the extension is for.
- **Permissions justification:** one justification per manifest permission, including the
  optional host permissions. Unused or unneeded permissions are a common rejection reason
  (see section 10).
- **Remote Code:** answer with the text in [STORE-LISTING.md](STORE-LISTING.md). The build check
  `scripts/check-remote-code.mjs` and the zip test confirm it for each build.
- **Data usage:** disclose what data is collected, then tick the certification boxes in the same
  group.
- **Set a privacy policy:** enter `<PRIVACY-POLICY-URL>`.

## 6. Distribution tab: Unlisted

Source: <https://developer.chrome.com/docs/webstore/cws-dashboard-distribution> (read 12 Nov 2026).

1. Under **Visibility** choose **Unlisted**. No listing page appears in the store, but anyone with
   the item's store URL can install it.
2. Under **Distribution** keep **All regions** or pick countries.
3. Declare whether the item is free or paid (publish page).

To go Public later, change **Visibility** to **Public** and submit again.

## 7. Submit for review

Source: <https://developer.chrome.com/docs/webstore/publish> (read 12 Nov 2026).

1. Fill the **Test instructions** tab only if reviewers need credentials or steps. Explain the
   first-Start model download and the per-site permission prompt there.
2. Click **Submit for Review** and confirm in the dialog.
3. To publish by hand after approval, uncheck the publish-after-review box in that dialog. If the
   item already auto-publishes, use **Defer publish** in the item menu. An approved submission can
   wait up to 30 days. After that it reverts to a draft.

## 8. Review time and long waits

Source: <https://developer.chrome.com/docs/webstore/review-process> (read 12 Nov 2026).

- Google says: "For most extensions, review is completed within a few days, but it can take up to
  a few weeks."
- New developers, new extensions, dangerous permissions and big code changes take longer.
- If an item is pending for more than three weeks, contact developer support. Support can take up
  to three days to answer. After that, reply to the first case email to ask for an update.
- Do not resubmit while pending. The pages do not forbid it. They offer **Cancel review**
  instead: <https://developer.chrome.com/docs/webstore/cancel-review> (read 12 Nov 2026).
  On the **Store listing** page open the menu **View more menu options**, choose **Cancel review**
  (shown only while the status is **Pending review**), and confirm. The item returns to draft.
  Use it only to fix a bug or typo. A publisher can cancel up to six times a day.

## 9. Updates

Source: <https://developer.chrome.com/docs/webstore/update> (read 12 Nov 2026).

1. Bump the version in `package.json`. It must be higher than the published one.
2. Run `npm run verify:release` to build the new zip.
3. In the dashboard open the **Package** tab, click **Upload New Package**, select the zip.
4. Update **Store listing**, **Privacy practices** and **Distribution** if anything changed.
5. Click **Submit for Review** and confirm. Existing users get the update only after publication.
6. Percentage rollout appears in **Distribution** only for items with over 10,000 seven-day
   active users, so it does not apply at first.

A change to permissions, remote code or data use needs the Privacy practices answers updated
before submitting.

## 10. Rejection and appeal

Sources: <https://developer.chrome.com/docs/webstore/review-process> and
<https://developer.chrome.com/docs/webstore/troubleshooting> (both read 12 Nov 2026).

- A rejection email goes to the publisher email and names the violated policy. The live listing
  stays unchanged. The pages do not say whether the dashboard also lists violations.
- The troubleshooting page maps each notice to a colour-and-element ID. Typical causes:
  unused permissions, remotely hosted code, missing or incomplete privacy policy, listing that does
  not match behaviour, obfuscated code.
- Fix the cause, test the exact files, bump the version, upload, and submit again.
- To appeal a takedown or warning, open the item detail page in the dashboard and click
  **Appeal**. For account suspension, use **Appeal** on the account page.
- If the email does not say what is wrong, use the Chrome Web Store support form.

## Not verified

- The registration fee amount. Neither the register page, the set-up page nor the FAQ states it.
- Any trader declaration or identity verification step. The pages read do not mention one.
  The dashboard may still ask for it. Follow its prompts and record the step here.
- Whether the dashboard itself lists violations after a rejection.
- The exact dashboard wording today, since the dashboard needs a signed-in account.
