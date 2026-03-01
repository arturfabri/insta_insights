# IG Hashtag Search (root edge)

Returns the ID of an Instagram Hashtag for a given query. This endpoint is a **root edge**, not tied to a node.

## Request

```
GET /ig_hashtag_search?user_id=<IG_USER_ID>&q=<HASHTAG>
```

## Host & login

Available only via **Facebook Login** (`graph.facebook.com`). Not supported through Instagram Login.

## Permissions

Requires the **Instagram Public Content Access** feature and the `instagram_basic` permission.

## Limitations

You may search up to 30 unique hashtags within a rolling 7-day period.