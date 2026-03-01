# IG User (node)

Represents an Instagram Business or Creator account.

## Login models & host

* **Instagram Login** – Host: `graph.instagram.com`
* **Facebook Login** – Host: `graph.facebook.com`

## Required permissions

* `instagram_basic`
* `pages_read_engagement`
* `ads_management` or `ads_read` if the app user was granted a role via Business Manager

## Fields

Public fields include:
`alt_text`, `biography`, `followers_count`, `follows_count`, `has_profile_pic`, `id`, `is_published`, `legacy_instagram_user_id`, `media_count`, `name`, `profile_picture_url`, `shopping_product_tag_eligibility`, `username`, `website`.

## Edges

Edges on IG User include `business_discovery`, `insights`, `agencies`, `authorized_adaccounts`, `live_media`, `content_publishing_limit` and others.
