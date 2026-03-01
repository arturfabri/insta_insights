# IG Media (node)

Represents an Instagram album, photo, or video (including reels and stories).

## Login models & host

* **Instagram Login** – Host: `graph.instagram.com`
* **Facebook Login** – Host: `graph.facebook.com`

## Required permissions

* `instagram_basic`
* `pages_read_engagement`
* `ads_management` or `ads_read` if the Page role is granted via Business Manager

## Limitations

* Aggregated fields do not include ads-driven data.
* Captions exclude the `@` symbol unless the app user has admin-equivalent tasks on the connected Page.
* Some fields, such as `permalink`, are unavailable on album children.
* Only media owned by professional accounts can be read.

## Fields

Available fields include `alt_text`, `caption`, `comments_count`, `media_type`, `media_url`, `permalink`, `timestamp`, `username`, `like_count`, and others. Some fields like `boost_ads_list` and `boost_eligibility_info` are only available via Facebook Login.

## Request syntax

```
GET https://<HOST_URL>/<API_VERSION>/<IG_MEDIA_ID>
  ?fields=<LIST_OF_FIELDS>
  &access_token=<ACCESS_TOKEN>
```
