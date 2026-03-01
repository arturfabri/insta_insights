# IG Media Insights

Returns metrics on an IG Media object.

## Request

```
GET /<IG_MEDIA_ID>/insights?metric=<METRICS>&period=<PERIOD>
```

## Metrics and periods

* Metrics include: `reach`, `saves`, `likes`, `comments`, and the new `views` metric.
* Deprecated metrics (`impressions`, `plays`, `clips_replays_count`, `video_views`) are removed after April 21, 2025.
* Supported periods: `day`, `week`, `days_28`, `month`, `lifetime`, `total_over_range`.

## Permissions

Requires `instagram_manage_insights`【853405341558465†L125-L132】.

## Limitations

* Story metrics are available only for 24 hours.
* Media insights are stored for up to two years.
* An error may occur if a media item has fewer than five viewers (`(#10) Not enough viewers for the media to show insights`).
