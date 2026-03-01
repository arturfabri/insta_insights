---
name: insta-api-guardian
description: >
  Provides step‑by‑step guidance for using Meta’s Instagram Graph API via the
  Instagram Login flow. It ensures developers call the correct endpoints,
  parameters and permissions when listing media, reading media objects and
  fetching media and account insights for the connected professional account.
  When a task requires Business Discovery or public hashtag search, the skill
  instructs you to switch to the Instagram API with Facebook Login and notes
  the additional permissions and host.
---

## Introduction

This skill equips Codex agents with the knowledge to safely and correctly
interact with **Meta’s Instagram Platform**.  It supports tasks like syncing
Instagram data for influencers and generating analytics without leaving Codex.
The skill focuses on the **Instagram Login** flow (tokens issued by
`graph.instagram.com`) but highlights when certain features—such as Business
Discovery and hashtag search—require the **Facebook Login** flow.  It avoids
scraping, marketing data, and any endpoints not documented by Meta.

### When to trigger this skill

Use this skill when you need to:

* List media objects for an Instagram Business or Creator account.
* Read fields on an individual media object.
* Fetch insights for media or the account itself (reach, impressions, etc.).
* Diagnose errors related to Instagram Graph API requests (e.g., missing
  permissions, invalid parameters).

Do **not** use this skill for publishing content or managing comments (see
future extensions) or for any personal accounts or ad data.

## Decision workflow

Follow these steps to build or debug an API call:

1. **Identify the task** – Determine whether you need to list media, read a
   media object, fetch media insights, fetch account insights, perform
   business discovery, search hashtags, manage comments, or publish media.

2. **Select login model and host** – Use the **Instagram Login** (host
   `graph.instagram.com`) for operations on the authenticated account.  If the
   task involves Business Discovery, hashtag search, or public content, switch
   to **Facebook Login** and call `graph.facebook.com`.
   Note the additional permissions (`instagram_manage_insights` and
   `pages_read_engagement`) needed for Business Discovery.

3. **Validate token and permissions** – Ensure your access token belongs to the
   connected IG user (`/me`) and includes all required scopes.  For read‑only
   operations, the project-standard scopes are:
   * `instagram_basic`
   * `instagram_manage_insights` for insights endpoints
   * `pages_read_engagement` if the IG account is linked via a Facebook Page
   For Business Discovery, you may also need `ads_management` or `ads_read` if
   the Page role is granted through Business Manager.

4. **Compose the request** – Choose the correct HTTP method (GET for reads).
   Specify the API version (e.g., `v25.0`), access token, and `fields` or
   `metric` parameters.  Avoid deprecated metrics (e.g., `impressions` and
   `video_views` are removed after April 21 2025).

5. **Handle pagination** – Use `after` and `before` cursors from the response
   to paginate through lists.  Note that some edges (e.g., nested media in
   Business Discovery) do not return `next`/`previous` fields—you must
   construct the query using the returned cursors.

6. **Process and store the response** – Extract `id` fields for future
   requests.  Check for empty data sets (some metrics may not be available
   depending on follower count or retention windows).

7. **Debug on failure** – Record the request path, query parameters and error
   payload (code/subcode, message).  Classify the failure: invalid/expired
   token, missing permission, incorrect object ID, unsupported metric/field,
   data unavailable, or rate limit.  Propose the fix accordingly (refresh
   token, add missing scopes, correct ID, remove deprecated metric, wait/back
   off).

## Endpoint summaries

The following are key endpoints used in this skill.  See the `references/`
directory for detailed documentation on each endpoint.

### IG User (node)

* **Path:** `GET /<IG_USER_ID>?fields=...`
* **Description:** Returns profile fields for a Business or Creator account
  (e.g., `username`, `followers_count`, `media_count`, `biography`).
* **Permissions:** `instagram_basic`; `pages_read_engagement` if account linked
  via FB Page.

### Media list (edge)

* **Path:** `GET /<IG_USER_ID>/media?fields=...`
* **Description:** Lists media objects (photos, videos, reels, stories) for the
  connected account.  Supports cursor‑based pagination.
* **Permissions:** Same as IG User.

### Media (node)

* **Path:** `GET /<IG_MEDIA_ID>?fields=...`
* **Description:** Reads a media object.  Fields include `caption`,
  `media_type`, `media_url`, `permalink`, `comments_count`, `like_count` and
  edges like `children` and `insights`.
* **Permissions:** Same as IG User; children have limited fields.

### Media insights (edge)

* **Path:** `GET /<IG_MEDIA_ID>/insights?metric=<metrics>&period=<period>`
* **Description:** Fetches metrics such as reach, saves, likes and the new
  `views` metric.  Use `period` values like `day`,
  `week`, `days_28`, `month`, `lifetime`, or `total_over_range`.
* **Permissions:** Requires `instagram_manage_insights`.

### Account insights (edge)

* **Path:** `GET /<IG_USER_ID>/insights?metric=<metrics>&period=<period>`
* **Description:** Returns account‑level metrics (followers, impressions,
  reach, profile views, website clicks).
* **Permissions:** Same as media insights; some metrics require the account to
  have at least 100 followers.

### Business Discovery (edge)

* **Path:** `GET /<IG_USER_ID>?fields=business_discovery.username(<target>)`
* **Description:** Returns follower and media counts for another professional
  account and can expand to include media metrics.
* **Host/Login:** Only available via **Facebook Login** (`graph.facebook.com`).
* **Permissions:** `instagram_basic` + `instagram_manage_insights` +
  `pages_read_engagement`; `ads_management` or `ads_read` if Page role via
  Business Manager.

### Hashtag search (root)

* **Path:** `GET /ig_hashtag_search?user_id=<IG_USER_ID>&q=<hashtag>`
* **Description:** Returns an IG Hashtag ID for a given query.
* **Host/Login:** Only via **Facebook Login** (`graph.facebook.com`).
* **Permissions:** Requires the **Instagram Public Content Access** feature and
  `instagram_basic` permission.

## Future extensions

* **Publishing & comment management** – Posting media and replying or moderating
  comments require `instagram_content_publish` and
  `instagram_manage_comments` scopes, respectively.  Publishing involves
  creating a **container** (`POST /<IG_USER_ID>/media`) and then publishing
  it (`POST /<IG_USER_ID>/media_publish`).

* **Mentions & tags** – To retrieve media where the account is tagged or
  mentioned (`/tags`, `/mentioned_media`, `/mentioned_comment`), you need
  comment‑management permissions and, for some cases, must use the Facebook
  login flow.

* **Messaging & story features** – Other features like Messenger integration or
  story sharing have additional endpoints and scopes not covered here.

## Safety notes

* **No scraping** – Only call documented Instagram Graph API endpoints.
* **Respect privacy** – Access only data for accounts that grant permission via
  OAuth.  Do not expose tokens on the client.
* **No ads or marketing data** – Ad comments and metrics are excluded; use
  the Marketing API separately if needed.
* **Check retention windows** – Some metrics are available only within certain
  timeframes (e.g., story metrics last 24 hours).

---

### Contributors

This skill was assembled by ChatGPT for the **Insta Insights** project (March 2026).
