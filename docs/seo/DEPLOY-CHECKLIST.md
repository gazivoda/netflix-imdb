# Post-deploy SEO checklist

Run after every production deploy of `https://rating.watch`. Each step names the command or URL and the expected result. Commands assume the repo root; `S=https://rating.watch`.

## 1. Confirm live == repo

- [ ] Build the local sitemap and diff it against production (`lastmod` comes from `updated` in `lib/pages.ts`, so a stale deploy shows up as an old date):
  ```bash
  npm run build
  diff <(grep -E '<loc>|<lastmod>' .next/server/app/sitemap.xml.body) \
       <(curl -s $S/sitemap.xml | grep -E '<loc>|<lastmod>')
  ```
  Expected: no output. Any diff means the deploy is stale or built from a different commit.
- [ ] Every page in the registry is live: `for p in / /install /compare/imdb-vs-rotten-tomatoes /camera-vision /privacy; do curl -s -o /dev/null -w "%{http_code} $p\n" $S$p; done` (all `200`; update the list if `lib/pages.ts` changed).
- [ ] Canonical on each page is the page's own URL, not the home page: `curl -s $S/install | grep -o '<link rel="canonical"[^>]*>'`.
- [ ] The install download is live and current (`bash scripts/package-extension.sh` refreshes it before you build): `curl -s $S/downloads/rating-watch-extension.zip | cmp - extension.zip && echo same`. Expected: `same`. A diff means the deploy ships an older extension than `extension/manifest.json`.

## 2. Crawl-control routes

- [ ] `curl -s $S/robots.txt` lists `Allow: /` for `*` and the AI crawlers (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, ...) and ends with `Sitemap: https://rating.watch/sitemap.xml`.
- [ ] `curl -sI $S/sitemap.xml` returns `200` with an XML content type.
- [ ] `curl -s $S/llms.txt` returns the plain-text file from `public/llms.txt`, and each page it links to returns `200`.
- [ ] IndexNow key file is public and exact: `curl -s $S/682b64e6a0f625f3b476439b6c6f1d81.txt` returns exactly `682b64e6a0f625f3b476439b6c6f1d81`.

## 3. Host and protocol redirects

Redirects are not defined in this repo (no `vercel.json`, empty `next.config.js`); they come from the hosting/DNS config, so verify live.

- [ ] `curl -sI http://rating.watch/` returns a `301`/`308` to `https://rating.watch/`.
- [ ] `curl -sI https://www.rating.watch/` returns a `301`/`308` to `https://rating.watch/` (or the `www` host does not resolve). It must not serve a duplicate `200`.
- [ ] `curl -sI http://www.rating.watch/` ends on `https://rating.watch/` within one or two hops.

## 4. IndexNow (Bing, Yandex, Seznam, Naver; Google does not use it)

- [ ] Preview the payload without sending: `npm run seo:indexnow:dry` (reads `.next/server/app/sitemap.xml.body`, needs a build; sends nothing). Check the URL count matches the sitemap.
- [ ] Submit from the live sitemap: `npm run seo:indexnow`. Expected: `submitted N URLs ... (HTTP 200)` or `202`. `422` means the key file in step 2 is not reachable at `keyLocation`.
- [ ] Set `NEXT_PUBLIC_SITE_URL` only if you need a different origin; the default is production.

## 5. Search console submissions

- [ ] Google Search Console: Sitemaps, submit `sitemap.xml`; status should read "Success" and the discovered-page count should match the sitemap. For a new or heavily changed page, URL Inspection, then "Request indexing".
- [ ] Bing Webmaster Tools: Sitemaps, submit `https://rating.watch/sitemap.xml`. Optionally import the property from Google Search Console.

## 6. Structured data

- [ ] Google Rich Results Test on `https://rating.watch/install`: expect `HowTo`, `FAQPage` and `BreadcrumbList` detected with no errors (the `Article` node is also in the graph). Warnings on optional fields are acceptable. Google no longer shows HowTo rich results, so a valid parse is the goal, not a SERP feature.
- [ ] Rich Results Test on `/` and `/compare/imdb-vs-rotten-tomatoes`: each reports exactly one `FAQPage` (the root layout must not emit one; `tests/lib/seo.test.ts` enforces this) and no errors. Compare detected types against `/install` to spot a page missing its schema.
- [ ] Schema.org validator (validator.schema.org) on the same URLs: no errors, and the `@id` references (`/#org`, `/#author`) resolve to nodes in the same graph.
- [ ] Spot check the raw HTML: `curl -s $S/install | grep -c 'application/ld+json'` is at least `1`.

## 7. Social previews

- [ ] `og:image` and `twitter:image` resolve to a real PNG: `curl -s $S/install | grep -o '<meta property="og:image"[^>]*>'`, then `curl -sI <that URL>` returns `200` with `content-type: image/png`.
- [ ] Facebook Sharing Debugger (developers.facebook.com/tools/debug): enter `$S/` and `$S/install`, click "Scrape Again"; the preview shows the generated card with no image warnings.
- [ ] LinkedIn Post Inspector (linkedin.com/post-inspector) and the X/Twitter card preview in a draft post show the same image. These caches are sticky: re-scrape after any change to `lib/og.tsx`.

## 8. Wrap-up

- [ ] Search `site:rating.watch` in Google and Bing a day or two later; new pages should start appearing. If not, re-run step 5 for those URLs.
