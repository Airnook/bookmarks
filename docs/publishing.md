# Publishing to the Chrome Web Store

Releases are deployed by `.github/workflows/release.yml` on every `v*` tag: after the GitHub release, `scripts/deploy-cws.mjs` uploads `dist/*.zip` to the store item and submits it for review ([Chrome Web Store API v2](https://developer.chrome.com/docs/webstore/using-api)). Without the secrets below the step is skipped with a notice and the job stays green.

**The very first publish is manual**: the API updates an existing item, it cannot create one. Do the checklist, then the automation setup.

Publisher account: `airnookteam@gmail.com`.

## 1. First manual publish

Everything here is done in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole/).

### Account
- [ ] [Register a developer account](https://developer.chrome.com/docs/webstore/register) (one-time US$5 fee).
- [ ] Turn on 2-step verification for the Google account; publishing is blocked without it.
- [ ] Trader declaration (Account tab), see the [trader FAQ](https://developer.chrome.com/docs/webstore/program-policies/trader-verification-faq). Non-trader for a non-commercial project; trader (name, address, verified phone, shown publicly) if you earn money from it.

### Package
- [ ] `npm run package`, then upload `dist/airnook-bookmarks-<version>.zip` as a new item.

### Store listing
Details: [Supplying images](https://developer.chrome.com/docs/webstore/images).

| Field | Requirement |
| --- | --- |
| Icon | 128×128 PNG (the 96×96 artwork inside 16 px transparent padding); comes from the package |
| Screenshots | at least 1, up to 5; 1280×800 (or 640×400) PNG/JPEG |
| Small promo tile | 440×280, optional but recommended |
| Marquee promo tile | 1400×560, optional (only for being featured) |
| Name, summary (≤132 chars), description, category | from `_locales`; category e.g. Productivity |

### Store images
Files in `docs/store/` (generated: real screenshots of the extension framed in an HTML browser mockup; regenerate with `node scripts/store-images/capture.mjs . /tmp/shots && node scripts/store-images/compose.mjs /tmp/shots docs/store`; needs `npx playwright install chromium`). They are not part of the release zip.

| File | Store field |
| --- | --- |
| `screenshot-1-panel.png` | Screenshots, 1st (panel beside a page, light) |
| `screenshot-2-dark.png` | Screenshots, 2nd (dark theme) |
| `screenshot-3-custom-theme.png` | Screenshots, 3rd (custom colors) |
| `screenshot-4-theme-settings.png` | Screenshots, 4th (theme settings with live preview) |
| `screenshot-5-hotkeys.png` | Screenshots, 5th (hotkey presets) |
| `promo-small-440x280.png` | Small promo tile |
| `promo-marquee-1400x560.png` | Marquee promo tile |

`docs/panel-light.png` and `docs/panel-dark.png` are for the READMEs, not the store.

### Privacy practices
Details: [Fill out the privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy).

- Single purpose: keyboard-driven bookmark manager in Chrome's side panel.
- Permission justifications:
  - `bookmarks`: read, show, search and organise the user's bookmarks in the panel.
  - `sidePanel`: the panel UI lives in Chrome's side panel.
  - `favicon`: show each bookmark's site icon from Chrome's favicon cache.
  - `storage`: keep settings (hotkeys, layout, theme) on the device.
  - `tabs`: read the active tab's URL and title when adding a bookmark, open bookmarks in new or existing tabs.
  - `tabGroups`: open a set of bookmarks as a named tab group.
- Remote code: **No** (not allowed in Manifest V3).
- Data usage: nothing is collected; data stays on the device, is not sold or shared.
- Privacy policy: a public HTTPS URL is required because of the `bookmarks` and `tabs` permissions (for example a GitHub Pages page).

### Distribution
- [ ] Visibility: **Unlisted** (hidden from search, installable by direct link). Free, no in-app purchases; choose regions.
- [ ] Submit for review. First review usually takes days, sometimes weeks, for a new account with powerful permissions ([review process](https://developer.chrome.com/docs/webstore/review-process)).
- [ ] Install from the unlisted link and smoke-test the store build.

## 2. Automation setup

Run `scripts/setup-cws.sh` to be walked through this and set the GitHub secrets (needs `gh` logged in), or do it by hand:

1. In [Google Cloud Console](https://console.cloud.google.com/) create a project and enable the **Chrome Web Store API**.
2. Create a service account (no IAM roles needed) and a JSON key for it ([official guide](https://developer.chrome.com/docs/webstore/service-accounts)).
3. Dashboard > Account > **Service accounts**: add the service account email. Only one can be linked at a time.
4. Collect the publisher ID (Dashboard > Account) and the item ID (the 32-letter part of the item's dashboard URL).
5. Add repository secrets (Settings > Secrets and variables > Actions):

   | Secret | Value |
   | --- | --- |
   | `CWS_SERVICE_ACCOUNT_JSON` | the whole JSON key file |
   | `CWS_PUBLISHER_ID` | publisher ID |
   | `CWS_ITEM_ID` | item ID |

6. Delete the downloaded key file.

On the next `v*` tag the job uploads the zip, waits until the upload is processed, and submits it. An API error fails the job with the API's message.

## 3. Going Public and rollout

- **Unlisted to Public**: Dashboard > item > Store listing > Visibility > Public, then save. No new package is needed. Do it after the smoke test passes.
- **Percentage rollout** (`deployPercentage` below 100) is available only to items with more than 10,000 seven-day active users ([update docs](https://developer.chrome.com/docs/webstore/update)); until then every release goes to 100% of existing users. It applies to existing users only and can only be raised. The deploy script publishes at 100%; extend it with `deployInfos` in the `:publish` request ([reference](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/publish)) once the item qualifies.
