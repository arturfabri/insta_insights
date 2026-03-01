# Business Discovery (edge)

Allows you to get data about other Instagram Business or Creator accounts. Only available via the **Instagram API with Facebook Login**.

## Request

```
GET /<IG_USER_ID>?fields=business_discovery.username(<USERNAME>){<FIELDS>}
```
Perform this request on your app user's IG User ID and specify the username of the target account and the fields to return. You can request follower and media counts and expand nested edges like `media` to fetch media IDs and basic metrics.

## Permissions

Requires a Facebook User access token with the following scopes:

* `instagram_basic`
* `instagram_manage_insights`
* `pages_read_engagement`
* If the token is from a user whose Page role was granted via Business Manager, `ads_management` or `ads_read` is also required.

## Limitations

* Data about age‑gated accounts will not be returned.
* The `media` edge uses cursor‑based pagination but does not include `next`/`previous`; use the returned `before` and `after` cursors to navigate.