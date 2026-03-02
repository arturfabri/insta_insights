# Instagram Insights & API Metric Guide

This guide outlines key Instagram metrics (including core algorithmic signals, business‑objective metrics, vanity metrics, new crossposted metrics, and account‑level signals), explains what each measures and how, identifies which media types support them, and notes whether they are available via the Instagram Graph API.  It also provides guidance on retrieving metrics and using breakdowns.

## Metrics Summary

| Metric | Group | What it measures | How it’s measured | Available via Graph API? | Media type (Posts/Reels/Stories) | Graph API metric / parameter | Calculation or notes if not available |
|---|---|---|---|---|---|---|---|
| **Sends/Shares per Reach** | Core | Organic amplification – how often the content is shared relative to its audience size. | Count the number of shares and divide by reach. The `shares` metric counts the number of times a media is shared; `reach` counts unique accounts that saw the media. | Yes | Posts, Reels & Stories | `shares`, `reach` (media insights) | Compute `(shares ÷ reach) × 100%`; DM shares are not distinguished. |
| **Watch Time / Completion Rate** | Core | Viewer attention and retention on reels. | `ig_reels_avg_watch_time` measures the average viewing time; `ig_reels_video_view_total_time` measures total watch time. | Yes (watch time) | Reels | `ig_reels_avg_watch_time`, `ig_reels_video_view_total_time` (media insights) | Completion rate is not provided; approximate by dividing average watch time by the reel’s duration. |
| **Save Rate (Saves per Reach)** | Core/Authority | Future value – how often users save content relative to its reach. | `saved` counts the number of saves; divide by `reach`. | Yes | Posts & Reels | `saved`, `reach` | Compute `(saved ÷ reach) × 100%`.  Stories do not support saves. |
| **Follows per Profile Visit** | Core | Conversion efficiency – followers gained per profile visit. | `follows` counts new followers; `profile_visits` counts profile visits. | Yes | Posts & Stories | `follows`, `profile_visits` | Compute `(follows ÷ profile_visits) × 100%`.  Not available for reels. |
| **Likes per Reach** | Core | Active reactions relative to audience size. | `likes` counts likes; divide by `reach`. | Yes | Posts & Reels | `likes`, `reach` | Compute `(likes ÷ reach) × 100%`.  Stories do not support likes. |
| **Comments per Reach** | Authority | Depth of engagement – comments relative to reach. | `comments` counts comments; divide by `reach`. | Yes | Posts & Reels | `comments`, `reach` | Compute `(comments ÷ reach) × 100%`. |
| **Profile actions (link taps, call, email, etc.)** | Leads/Sale | Actions taken on your profile after viewing content. | The `profile_activity` metric counts actions such as link taps, calls and emails; it can be broken down by action type (`BIO_LINK_CLICKED`, `CALL`, etc.). | Yes | Posts & Stories | `profile_activity` (optionally `breakdown=action_type`) | Use the metric directly; you can compute ratios relative to reach or profile visits. |
| **DM reply/initiations** | Leads/Sale | Direct message replies or new conversations triggered by the content. | The Graph API does not expose DM replies or initiations. | No | N/A | – | This data is only available within the Instagram app and cannot be inferred. |
| **On‑site conversion rate** | Leads/Sale | Purchases or sign‑ups attributable to a post. | Requires external analytics; the API does not track conversions. | No | N/A | – | Use UTM parameters and your own analytics to track visits and conversions; compute conversion rate as `conversions ÷ clicks`. |
| **Raw Views (Plays)** | Vanity/Caution | Total plays (not unique viewers). | `views` counts total video plays. | Yes | Posts, Reels & Stories | `views` | Use directly; note that auto‑plays can inflate the count. |
| **Raw Reach** | Vanity/Caution | Unique accounts that saw the content. | `reach` counts unique accounts that have seen the media. | Yes | Posts, Reels & Stories | `reach` | Use directly. |
| **Raw Follower Growth** | Vanity/Caution | New followers over a period – a lagging indicator. | Compute the difference between followers and unfollows from account‑level metrics. | Yes | Account‑level / Posts & Stories | `follows_and_unfollows` (account insights) | Net follower growth = `follows – unfollows`. |
| **Generic Engagement Rate** | Vanity/Caution | Combined interactions relative to audience size. | Sum likes, comments, saves and shares and divide by reach.  The `total_interactions` metric aggregates likes, comments, saves and shares. | Components available, not as a single rate | Posts & Reels; stories only support shares | `likes`, `comments`, `saved`, `shares`, `reach` (or `total_interactions`, `reach`) | Compute `(likes + comments + saves + shares) ÷ reach × 100%` or `total_interactions ÷ reach`. |
| **Reels Skip Rate** | Growth/Core | Percentage of viewers who skip a reel within the first 3 seconds – a retention signal. | Calculated by Meta; returns a percentage value representing the proportion of viewers who skipped quickly. | Yes | Reels only | `reels_skip_rate` (media insights) | Cannot be derived independently. |
| **Repost Counts** (media & account) | Growth/Core | Counts how often a post or reel is reposted; the account‑level version aggregates reposts across content. | Meta counts public reposts; story and DM shares are excluded. | Yes | Posts & Reels | For media: `repost_count`/`reposts`; for account: `reposts` (account insights) | Cannot be inferred from shares. |
| **Crossposted Views** (`crossposted_views`, `facebook_views`) | Core | Cross‑platform reach when a reel is crossposted to both Instagram and Facebook. `crossposted_views` returns total views across both platforms, while `facebook_views` returns the portion from Facebook. | Automatically calculated; subtracting `facebook_views` from `crossposted_views` yields Instagram‑only views. | Yes | Reels (only for crossposted reels) | `crossposted_views`, `facebook_views` (media insights) | For crossposted reels, `Instagram‑only views = crossposted_views – facebook_views`.  Metrics do not appear for non‑crossposted reels. |
| **Accounts Engaged** | Account | Unique accounts that interacted with any of your content. | Meta counts unique accounts that performed at least one interaction (likes, saves, comments, shares or replies) across posts, stories, reels, videos and live. | Yes | Account‑level (aggregates all media) | `accounts_engaged` (account insights) | Cannot be derived from post‑level data. |
| **Follows & Unfollows** | Account | Number of accounts that followed you and number of accounts that unfollowed or left Instagram. | The metric returns both counts and can be broken down by follow status. | Yes | Account‑level | `follows_and_unfollows` (account insights) | Net follower growth = `follows – unfollows`. |
| **Follower Demographics** | Account | Age, gender, country and city distribution of followers. | Meta aggregates follower demographics; requires a timeframe and breakdown. | Yes | Account‑level | `follower_demographics` (account insights, specify `timeframe` and `breakdown`) | Cannot be derived from other data. |
| **Engaged Audience Demographics** | Account | Demographics (age, gender, location) of accounts that interacted with your content. | Meta aggregates engaged audience demographics; requires timeframe and breakdown. | Yes | Account‑level | `engaged_audience_demographics` (account insights, specify `timeframe` and `breakdown`) | Not derivable without API. |
| **Profile Links Taps** | Account | Number of taps on your business address, call, email or text buttons. | Meta counts taps on contact buttons. | Yes | Account‑level | `profile_links_taps` (account insights); optional `breakdown=contact_button_type` | The API is required to obtain these counts; you can compute conversion rates relative to reach or visits. |
| **Reach (account‑level)** | Account | Unique accounts that have seen any of your content. | Meta counts unique viewers across posts, stories, reels, videos and live. | Yes | Account‑level | `reach` (account insights); optional `breakdown=media_product_type` or `follow_type` | Unique reach cannot be derived by summing post‑level reach. |
| **Views (account‑level)** | Account | Total number of times your content was displayed or played. | Meta aggregates views across all content types. | Yes | Account‑level | `views` (account insights); optional `breakdown=media_product_type` or `follow_type` | Cannot be accurately computed from post‑level views due to duplication. |
| **Total Interactions (account‑level)** | Account | Total interactions (likes, comments, saves, shares, replies) across all content. | Meta sums interactions across posts, stories, reels, videos and live. | Yes | Account‑level | `total_interactions` (account insights) | While you could approximate by summing individual metrics, using the API metric is more accurate. |
| **Reposts (account‑level)** | Account | Number of public reposts of your posts, stories, reels and videos. | Meta counts public reposts across all content types. | Yes | Account‑level | `reposts` (account insights) | Cannot be derived from shares. |
| **Saves (account‑level)** | Account | Number of saves of your posts, reels and videos. | Meta counts saves across content types. | Yes | Account‑level (posts, reels & videos) | `saves` (account insights) | Cannot be derived from other data. |
| **Shares (account‑level)** | Account | Number of shares of your posts, stories, reels, videos and live videos. | Meta counts shares across content types. | Yes | Account‑level | `shares` (account insights) | Total shares cannot be fully reconstructed from media-level data due to cross‑media overlap. |
| **Comments (account‑level)** | Account | Total comments on posts, reels and videos. | Meta counts comments across content types. | Yes | Account‑level | `comments` (account insights); optional `breakdown=media_product_type` | Summing media-level comments is possible but less accurate. |
| **Likes (account‑level)** | Account | Total likes on posts, reels and videos. | Meta counts likes across content types. | Yes | Account‑level | `likes` (account insights); optional `breakdown=media_product_type` | Summing media-level likes is possible but not exact. |

## Retrieving these metrics

1. **Media‑level metrics**:  
   
   To retrieve insights for a specific post, reel or story, use the **media insights** endpoint.  Send a `GET` request to  
   
   ```
   https://<HOST_URL>/<API_VERSION>/<INSTAGRAM_MEDIA_ID>/insights?metric=<METRIC_LIST>&access_token=<ACCESS_TOKEN>
   ```

   where `<METRIC_LIST>` is a comma‑separated list of metrics (e.g., `likes,reach,saves`).  If you request multiple metrics at once, ensure all are valid for the media type.


2. **Account‑level metrics**:  
   
   To retrieve insights on the overall Instagram business or creator account, use the **account insights** endpoint.  Send a `GET` request to  

   ```
   https://<HOST_URL>/<API_VERSION>/<APP_USER_INSTAGRAM_ACCOUNT_ID>/insights?metric=<METRIC_LIST>&period=<PERIOD>&metric_type=<METRIC_TYPE>&timeframe=<TIMEFRAME>&breakdown=<BREAKDOWN>&access_token=<ACCESS_TOKEN>
   ```

    * `metric` is a comma‑separated list of account‑level metrics such as `accounts_engaged,follows_and_unfollows,follower_demographics`.  
    * `period` applies to interaction metrics (e.g., `day`).  
    * `metric_type` can be `total_value` to get aggregated totals or `time_series` to get data broken down by day.  
    * For demographic metrics you must also specify a `timeframe` (e.g., `this_month`).  

    See the metrics table above for the appropriate metric names and parameters.


3. **Business Discovery metrics**:  
   
   For business discovery metrics (profile views, website taps, etc.), use the **business discovery insights** endpoint.  Send a `GET` request to  
   
   ```
   GET /{ig-user-id}/business_discovery_insights
   ```

   - Replace `{ig-user-id}` with the Instagram Business or Creator account ID.  
   - Use `metric` and `period` parameters as needed.  
   - Example:  
     ```
     GET /1234567890/business_discovery_insights?metric=profile_views,website_taps&period=day
     ```

3. **Breakdown**
    When requesting account‑level metrics with `metric_type=total_value`, you can include one or more breakdown parameters to segment results by dimension.  The API will break the results into smaller sets based on the specified breakdown(s):

    * **`contact_button_type`** – Break down by profile UI component that viewers tapped or clicked.  Response values can be `BOOK_NOW`, `CALL`, `DIRECTION`, `EMAIL`, `INSTANT_EXPERIENCE`, `TEXT` or `UNDEFINED`.
    * **`follow_type`** – Break down by followers versus non‑followers.  Response values are `FOLLOWER`, `NON_FOLLOWER` and `UNKNOWN`.
    * **`media_product_type`** – Break down by the surface where viewers viewed or interacted with your media.  Response values are `AD`, `FEED`, `REELS` and `STORY`.

    Refer to the metrics table above to determine which metrics support a breakdown.  If you request a metric that doesn’t support the specified breakdown, the API will return an error (“An unknown error has occurred.”).  Also note that **breakdowns are only included for `metric_type=total_value`; if you request `metric_type=time_series`, breakdowns will not appear in the response**.

    This guide should help you decide which metrics to track, understand what they mean and how they are calculated, and construct the correct Graph API calls to retrieve them for your dashboard or analytics pipeline.  


## Important considerations

- **Permissions**: Ensure your app has the necessary permissions (e.g., `instagram_basic`, `instagram_manage_insights`) to access these metrics.  
- **Timeframes**: Some metrics are only available for specific timeframes (e.g., `day`, `week`, `lifetime`).  
- **Breakdowns**: Certain metrics support breakdowns (e.g., `media_product_type`, `follow_type`, `contact_button_type`) that provide more granular data.  
- **Data availability**: Not all metrics are available for all account types or content.  
- **Rate limits**: Be mindful of API rate limits and implement proper error handling and retry logic.  
- **Privacy**: Respect user privacy and only access data you're authorized to use.  
- **Data freshness**: Metrics are typically updated daily, so there may be a delay in data availability.
   