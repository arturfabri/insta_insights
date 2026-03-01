# Instagram Account Insights

Returns social interaction metrics on your app user's Instagram business or
creator account.

## Request

```
GET /<INSTAGRAM_ACCOUNT_ID>/insights?metric=<METRIC>&period=<PERIOD>[&other parameters]
```

## Login models & host

Available for both **Instagram Login** (host `graph.instagram.com`) and **Facebook Login**
(host `graph.facebook.com`).

## Required permissions

* `instagram_basic`
* `instagram_manage_insights`
* `pages_read_engagement`
* `ads_management` or `ads_read` if the app user was granted a role via Business Manager

## Metrics & periods

* Some metrics (e.g., `follower_count`, `online_followers`) are only available for accounts with at least 100 followers.
* The `impressions` metric is deprecated in v22.0 and will be removed on April 21 2025. A new `views` metric is introduced.
* Specify `period` values such as `day`, `week`, `days_28`, `month`, `lifetime`, `total_over_range`, etc. Additional parameters like `timeframe`, `metric_type`, and `breakdown` refine the results.

## Limitations

* User metrics data is stored for up to 90 days.
* You can only query insights for one Instagram user at a time.
* If data is unavailable, the API returns an empty data set instead of zero.
* Demographic metrics return only the top performers and may not sum to the total follower count.
