# Taaja News — Complete API Documentation

Base URL: `http://localhost:5001/api`

All request/response bodies are JSON. Pass `Authorization: Bearer <token>` header for private endpoints.

---

# Languages

## 1. Get Active Languages

### `GET /api/languages`

Returns all active languages sorted by display order. Use this on app startup to populate language selectors.

**Access:** Public

**Response:**

```json
{
  "languages": [
    {
      "_id": "697ba9f11b749e103d435720",
      "code": "en",
      "name": "English",
      "nativeName": "English",
      "isActive": true,
      "isDefault": true,
      "isRTL": false,
      "order": 0,
      "createdAt": "2026-01-15T10:00:00.000Z",
      "updatedAt": "2026-01-15T10:00:00.000Z"
    },
    {
      "_id": "697ba9f11b749e103d435721",
      "code": "te",
      "name": "Telugu",
      "nativeName": "తెలుగు",
      "isActive": true,
      "isDefault": false,
      "isRTL": false,
      "order": 1
    },
    {
      "_id": "697ba9f11b749e103d435722",
      "code": "hi",
      "name": "Hindi",
      "nativeName": "हिन्दी",
      "isActive": true,
      "isDefault": false,
      "isRTL": false,
      "order": 2
    }
  ]
}
```

---

## 2. Get Default Language

### `GET /api/languages/default`

Returns the default language. Falls back to first active language or English.

**Access:** Public

**Response:**

```json
{
  "language": {
    "_id": "697ba9f11b749e103d435720",
    "code": "en",
    "name": "English",
    "nativeName": "English",
    "isActive": true,
    "isDefault": true,
    "isRTL": false,
    "order": 0
  }
}
```

---

# Categories

## 3. Get All Categories

### `GET /api/categories`

Returns all active categories as a flat list. Pass `raw=true` for full multilingual data (admin use).

**Access:** Public

| Parameter  | Type    | Default  | Description                                    |
|------------|---------|----------|------------------------------------------------|
| `lang`     | string  | default  | Language code for localized names               |
| `active`   | string  | `true`   | Filter active only (`true`/`false`)            |
| `parent`   | string  | —        | Filter by parent ID. `null` for root categories |
| `featured` | string  | —        | `true` for featured categories only            |
| `raw`      | string  | —        | `true` to return full multilingual data        |

**Example queries:**

```
GET /api/categories
GET /api/categories?lang=te
GET /api/categories?lang=en&featured=true
GET /api/categories?raw=true
GET /api/categories?parent=null&lang=hi
```

**Response (localized):**

```json
{
  "categories": [
    {
      "_id": "697ba9f11b749e103d435727",
      "name": "Politics",
      "description": "Political news and updates",
      "slug": "politics",
      "icon": "politics",
      "color": "#FF5722",
      "image": null,
      "order": 0,
      "isActive": true,
      "isFeatured": true,
      "parent": null,
      "_multilingual": {
        "name": { "en": "Politics", "te": "రాజకీయాలు", "hi": "राजनीति" },
        "description": { "en": "Political news", "te": "రాజకీయ వార్తలు", "hi": "राजनीतिक समाचार" }
      }
    }
  ]
}
```

**Response (raw=true):**

```json
{
  "categories": [
    {
      "_id": "697ba9f11b749e103d435727",
      "name": { "en": "Politics", "te": "రాజకీయాలు", "hi": "राजनीति" },
      "description": { "en": "Political news", "te": "రాజకీయ వార్తలు", "hi": "राजनीतिक समाचार" },
      "slug": "politics",
      "icon": "politics",
      "color": "#FF5722",
      "order": 0,
      "isActive": true,
      "isFeatured": true,
      "parent": null
    }
  ]
}
```

---

## 4. Get Category Tree

### `GET /api/categories/tree`

Returns categories as a nested tree structure with children.

**Access:** Public

| Parameter | Type   | Default | Description   |
|-----------|--------|---------|---------------|
| `lang`    | string | default | Language code |

```
GET /api/categories/tree?lang=en
```

**Response:**

```json
{
  "categories": [
    {
      "_id": "697ba9f11b749e103d435727",
      "name": "Politics",
      "slug": "politics",
      "children": [
        {
          "_id": "697ba9f11b749e103d435728",
          "name": "State Politics",
          "slug": "state-politics",
          "children": []
        }
      ]
    }
  ]
}
```

---

## 5. Get Category by ID

### `GET /api/categories/:id`

Returns a single category with its children and breadcrumb trail.

**Access:** Public

| Parameter | Type   | Default | Description                            |
|-----------|--------|---------|----------------------------------------|
| `lang`    | string | default | Language code                          |
| `raw`     | string | —       | `true` for full multilingual data      |

```
GET /api/categories/697ba9f11b749e103d435727?lang=te
```

**Response:**

```json
{
  "category": {
    "_id": "697ba9f11b749e103d435727",
    "name": "రాజకీయాలు",
    "description": "రాజకీయ వార్తలు",
    "slug": "politics",
    "parent": null
  },
  "children": [],
  "breadcrumb": [
    { "_id": "697ba9f11b749e103d435727", "name": "రాజకీయాలు", "slug": "politics" }
  ]
}
```

---

## 6. Get Category by Slug

### `GET /api/categories/slug/:slug`

Same as Get Category by ID but uses slug instead.

**Access:** Public

| Parameter | Type   | Default | Description   |
|-----------|--------|---------|---------------|
| `lang`    | string | default | Language code |

```
GET /api/categories/slug/politics?lang=en
```

---

# Authentication

## 7. Login

### `POST /api/auth/login`

Email + password login. Works for both web dashboard and Flutter app.

**Access:** Public

**Request body:**

```json
{
  "email": "user@example.com",
  "password": "securepass123"
}
```

**Response (200):**

```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "697ba9f01b749e103d435718",
    "name": "John Doe",
    "email": "user@example.com",
    "phone": "+919876543210",
    "authProvider": "local",
    "role": "user",
    "avatar": null,
    "preferences": { "language": "en" },
    "createdAt": "2026-01-15T10:00:00.000Z"
  }
}
```

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| `401` | `{ "error": "Invalid email or password" }` | Wrong credentials |
| `401` | `{ "error": "Account is deactivated" }` | `isActive` is false |

---

## 8. Google Sign-In (Flutter / Web)

### `POST /api/auth/google`

Authenticate using a Google `idToken` obtained from the Flutter `google_sign_in` package. Creates a new user on first login, or links the Google account if the email already exists.

**Access:** Public

**Request body:**

```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "user"
}
```

| Field     | Type   | Required | Notes                                       |
|-----------|--------|----------|---------------------------------------------|
| `idToken` | string | Yes      | Google ID token from `google_sign_in`       |
| `role`    | string | No       | `user` (default) or `reporter`              |

**Response (200):**

```json
{
  "message": "Google sign-in successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "697ba9f01b749e103d435718",
    "name": "John Doe",
    "email": "john@gmail.com",
    "phone": null,
    "authProvider": "google",
    "role": "user",
    "avatar": "https://lh3.googleusercontent.com/...",
    "preferences": { "language": "en" },
    "createdAt": "2026-01-30T10:00:00.000Z"
  }
}
```

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| `400` | `{ "error": "Google account has no email address" }` | Token has no email claim |
| `401` | `{ "error": "Invalid Google token" }` | Token verification failed |
| `401` | `{ "error": "Google token expired, please try again" }` | Token is expired |
| `401` | `{ "error": "Account is deactivated" }` | User `isActive` is false |

**Notes:**
- Requires `GOOGLE_CLIENT_ID` env variable
- If user already exists with the same email, their Google account is linked automatically
- New users are created with `authProvider: 'google'` and no password

---

## 9. App Registration (Manual)

### `POST /api/auth/register/app`

Register a new user from the Flutter app using email (mandatory) and optional phone number.

**Access:** Public

**Request body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+919876543210",
  "password": "securepass123",
  "role": "user"
}
```

| Field      | Type   | Required | Notes                                        |
|------------|--------|----------|----------------------------------------------|
| `name`     | string | Yes      | 2–100 characters                             |
| `email`    | string | Yes      | Valid email, must be unique                   |
| `phone`    | string | No       | International format (e.g. `+919876543210`)  |
| `password` | string | Yes      | 6–100 characters                             |
| `role`     | string | No       | `user` (default) or `reporter`               |

**Response (201):**

```json
{
  "message": "Registration successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "697ba9f01b749e103d435719",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+919876543210",
    "authProvider": "local",
    "role": "user",
    "avatar": null,
    "preferences": { "language": "en" },
    "createdAt": "2026-01-30T10:00:00.000Z"
  }
}
```

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| `400` | `{ "error": "Email already registered" }` | Duplicate email |
| `400` | `{ "error": "Phone number already registered" }` | Duplicate phone |
| `400` | `{ "error": "Validation Error", "details": [...] }` | Invalid input |

---

## 10. Check Email Existence

### `POST /api/auth/check-email`

Check if an email is already registered and return the auth provider. Useful for Flutter UX to decide whether to show "Login with Google" or "Enter password" flow.

**Access:** Public

**Request body:**

```json
{
  "email": "john@example.com"
}
```

**Response (200) — email exists:**

```json
{
  "exists": true,
  "authProvider": "google"
}
```

**Response (200) — email not found:**

```json
{
  "exists": false,
  "authProvider": null
}
```

---

## 11. Get Current User

### `GET /api/auth/me`

Returns the profile of the currently authenticated user.

**Access:** Private (requires `Authorization: Bearer <token>`)

**Response:**

```json
{
  "user": {
    "id": "697ba9f01b749e103d435718",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+919876543210",
    "authProvider": "local",
    "role": "user",
    "avatar": null,
    "preferences": {
      "language": "en",
      "city": null,
      "area": null,
      "categories": []
    },
    "createdAt": "2026-01-15T10:00:00.000Z"
  }
}
```

---

## 12. Logout

### `POST /api/auth/logout`

Clears the auth cookie and revokes the refresh token.

**Access:** Private

**Response:**

```json
{ "message": "Logged out successfully" }
```

---

## 12b. Refresh Token

### `POST /api/auth/refresh-token`

Exchange a valid refresh token for a new access token + refresh token pair. The old refresh token is invalidated (single-use rotation).

**Access:** Public

**Request body:**

```json
{
  "refreshToken": "a1b2c3d4e5f6...80-char-hex-string"
}
```

**Response (200):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "x9y8z7w6v5u4...new-80-char-hex-string"
}
```

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| `401` | `{ "error": "Invalid refresh token" }` | Token not found in DB |
| `401` | `{ "error": "Account is deactivated" }` | User disabled |

**Token architecture:**
- `accessToken`: short-lived JWT (15 min) — used for all API calls
- `refreshToken`: opaque hex string stored in DB — single-use, rotated on each refresh
- `token`: long-lived JWT (7d) — used by web dashboard via cookie (backward compatible)
- All login/register endpoints now return all three: `token`, `accessToken`, `refreshToken`

---

# Articles

## 13. Personalized Feed

### `GET /api/articles/feed`

Geospatial + personalized news feed with trending prioritization and seen-article exclusion.

**Access:** Public (optional auth for seen exclusion)

**Pipeline:** `$geoNear → $match (category + $nin seen) → $sort (trendingScore, createdAt) → $project (localized)`

| Parameter  | Type     | Default | Description                                       |
|------------|----------|---------|---------------------------------------------------|
| `lat`      | number   | —       | User latitude                                     |
| `lng`      | number   | —       | User longitude                                    |
| `radiusKM` | number   | `50`    | Max radius in kilometers                          |
| `category` | ObjectId | —       | Category tab filter                               |
| `lang`     | string   | `en`    | Language code (`te`, `en`, `hi`). Falls back to English |
| `userId`   | ObjectId | —       | User ID for seen exclusion (auto from auth token) |
| `limit`    | number   | `20`    | Page size (max 100)                               |
| `page`     | number   | `1`     | Page number                                       |

**Example queries:**

```
GET /api/articles/feed
GET /api/articles/feed?lang=te
GET /api/articles/feed?lat=16.8072523&lng=81.5316033&radiusKM=50&lang=te
GET /api/articles/feed?lat=16.8072523&lng=81.5316033&category=697ba9f11b749e103d435727&lang=en
GET /api/articles/feed?lat=16.8072523&lng=81.5316033&lang=te&page=2&limit=10
```

**Response:**

```json
{
  "articles": [
    {
      "_id": "6998535383b67e00f92fa64a",
      "articleId": "TJ-2af6472e",
      "slug": "leaving-governance-to-the-wind...",
      "title": "పరిపాలన గాలికి వదిలేసి హెలికాప్టర్...",
      "summary": "కూటమి సర్కారు వల్ల ప్రజలకు...",
      "content": "కూటమి సర్కారు వల్ల ప్రజలకు ఎటువంటి...",
      "audioUrl": "https://taajanews.blob.core.windows.net/audio/...-te.wav",
      "featuredImage": { "url": "...", "caption": {} },
      "tags": ["governance", "helicopters"],
      "location": {
        "type": "Point",
        "coordinates": [81.5316033, 16.8072523],
        "formattedAddress": "Tadepalligudem, Andhra Pradesh, India",
        "city": "Tadepalligudem",
        "state": "Andhra Pradesh",
        "country": "India"
      },
      "engagement": { "views": 0, "likes": 0, "dislikes": 0, "shares": 0, "commentsCount": 0 },
      "trendingScore": 0,
      "readingTime": 1,
      "isFeatured": false,
      "isBreaking": false,
      "publishedAt": "2026-02-20T12:33:36.198Z",
      "createdAt": "2026-02-20T12:28:03.018Z",
      "distance": 0,
      "author": { "_id": "697ba9f01b749e103d435718", "name": "Reporter Name", "avatar": null },
      "category": { "_id": "697ba9f11b749e103d435727", "name": "రాజకీయాలు", "slug": "politics" }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1,
    "hasMore": false
  },
  "meta": {
    "lang": "te",
    "radiusKM": 50,
    "seenExcluded": 0
  }
}
```

---

## 14. Mark Articles as Seen

### `POST /api/articles/feed/seen`

Mark articles as seen by the authenticated user. Seen articles are excluded from future feed requests.

**Access:** Private (requires auth token)

**Request body:**

```json
{
  "articleIds": [
    "6998535383b67e00f92fa64a",
    "699854ab83b67e00f92fa65b"
  ]
}
```

**Response:**

```json
{
  "message": "Articles marked as seen",
  "added": 2
}
```

**Notes:**
- Duplicate IDs are ignored (won't be added twice)
- Entries older than 30 days are automatically cleaned up (rolling window)

---

## 15. Public Articles List (Legacy)

### `GET /api/articles`

Simple published articles list with offset pagination.

**Access:** Public

| Parameter  | Type     | Default | Description                          |
|------------|----------|---------|--------------------------------------|
| `page`     | number   | `1`     | Page number                          |
| `limit`    | number   | `20`    | Page size                            |
| `category` | ObjectId | —       | Filter by category                   |
| `city`     | string   | —       | Filter by location city              |
| `featured` | boolean  | —       | `true` for featured only             |
| `breaking` | boolean  | —       | `true` for breaking only             |
| `search`   | string   | —       | Text search                          |
| `lang`     | string   | `en`    | Language code                        |

```
GET /api/articles?page=1&limit=10&lang=te
GET /api/articles?category=697ba9f11b749e103d435727&lang=en
GET /api/articles?featured=true&lang=hi
GET /api/articles?search=governance&lang=en
GET /api/articles?city=Tadepalligudem&lang=te
```

---

## 16. Nearby Articles

### `GET /api/articles/nearby`

Get published articles near a location using `$geoNear`.

**Access:** Public

| Parameter  | Type   | Default | Description              |
|------------|--------|---------|--------------------------|
| `lat`      | number | —       | Latitude (**required**)  |
| `lng`      | number | —       | Longitude (**required**) |
| `distance` | number | `10000` | Max distance in meters   |
| `limit`    | number | `20`    | Max articles             |
| `lang`     | string | `en`    | Language code            |

```
GET /api/articles/nearby?lat=16.8072523&lng=81.5316033&distance=50000&lang=te
```

---

## 17. Trending Articles

### `GET /api/articles/trending`

Get trending articles sorted by trending score.

**Access:** Public

| Parameter | Type   | Default | Description   |
|-----------|--------|---------|---------------|
| `limit`   | number | `10`    | Max articles  |
| `lang`    | string | `en`    | Language code |

```
GET /api/articles/trending?lang=te&limit=5
```

**Trending Score Formula:** `Score = (views + likes × 2) / (hoursSinceCreation + 1)^1.8`

Recalculated every 15 minutes by background cron job.

---

## 18. Get Article by Reference ID

### `GET /api/articles/ref/:articleId`

Get full article by its unique `articleId` (e.g., `TJ-2af6472e`).

**Access:** Public

```
GET /api/articles/ref/TJ-2af6472e
```

---

## 19. Get Article by Slug

### `GET /api/articles/slug/:slug`

Get published article by slug. Includes breadcrumb and related articles.

**Access:** Public

| Parameter | Type   | Default | Description   |
|-----------|--------|---------|---------------|
| `lang`    | string | `en`    | Language code |

```
GET /api/articles/slug/leaving-governance-to-the-wind?lang=te
```

---

## 20. Get Article by ID

### `GET /api/articles/:id`

Get full article with all multilingual data (for editing).

**Access:** Private (Reporter/Admin)

```
GET /api/articles/6998535383b67e00f92fa64a
Authorization: Bearer <token>
```

---

## 21. Create Article

### `POST /api/articles`

Create a new article.

**Access:** Private (Reporter/Admin)

**Request body:**

```json
{
  "title": { "te": "...", "en": "...", "hi": "..." },
  "summary": { "te": "...", "en": "...", "hi": "..." },
  "content": { "te": "...", "en": "...", "hi": "..." },
  "category": "697ba9f11b749e103d435727",
  "location": {
    "type": "Point",
    "coordinates": [81.5316033, 16.8072523],
    "formattedAddress": "Tadepalligudem, Andhra Pradesh, India",
    "city": "Tadepalligudem",
    "state": "Andhra Pradesh",
    "country": "India",
    "placeId": "ChIJsyvJu7C0NzoRCgI1dytnJx8"
  },
  "tags": ["governance", "helicopters"],
  "status": "draft",
  "featuredImage": { "url": "https://...", "alt": "image" },
  "audio": {
    "te": "https://taajanews.blob.core.windows.net/audio/...-te.wav",
    "en": "https://taajanews.blob.core.windows.net/audio/...-en.wav",
    "hi": "https://taajanews.blob.core.windows.net/audio/...-hi.wav"
  }
}
```

| Field           | Type   | Required | Notes                              |
|-----------------|--------|----------|------------------------------------|
| `title`         | object | Yes      | `{ langCode: string }` max 200 chars |
| `content`       | object | Yes      | `{ langCode: string }` max 10000 chars |
| `summary`       | object | No       | `{ langCode: string }` max 500 chars |
| `category`      | string | No       | Category ObjectId                  |
| `location`      | object | No       | GeoJSON Point with address fields  |
| `tags`          | array  | No       | Array of tag strings               |
| `status`        | string | No       | `draft`, `pending`, `published`, `archived` |
| `featuredImage` | object | No       | `{ url, caption, alt }`           |
| `audio`         | object | No       | `{ langCode: audioUrl }`          |

---

## 22. Update Article

### `PUT /api/articles/:id`

Update an existing article. Same body fields as Create.

**Access:** Private (Reporter/Admin — reporters can only update own articles)

```
PUT /api/articles/6998535383b67e00f92fa64a
Authorization: Bearer <token>
```

---

## 23. Update Article Status

### `PUT /api/articles/:id/status`

Change article status.

**Access:** Private (Admin only)

**Request body:**

```json
{ "status": "published" }
```

---

## 24. Delete Article (Archive)

### `DELETE /api/articles/:id`

Soft-delete an article by setting status to archived.

**Access:** Private (Admin only)

```
DELETE /api/articles/6998535383b67e00f92fa64a
Authorization: Bearer <token>
```

---

## 25. Manage Articles List (Dashboard)

### `GET /api/articles/manage/list`

Get articles for the reporter/admin dashboard with date filters.

**Access:** Private (Reporter/Admin)

| Parameter  | Type     | Default | Description                                  |
|------------|----------|---------|----------------------------------------------|
| `page`     | number   | `1`     | Page number                                  |
| `limit`    | number   | `20`    | Page size                                    |
| `status`   | string   | —       | Filter: `draft`/`pending`/`published`/`archived` |
| `category` | ObjectId | —       | Filter by category                           |
| `fromDate` | date     | —       | Start date (YYYY-MM-DD)                      |
| `toDate`   | date     | —       | End date (YYYY-MM-DD)                        |
| `lang`     | string   | `en`    | Language code                                |

```
GET /api/articles/manage/list?status=published&lang=te
GET /api/articles/manage/list?fromDate=2026-02-01&toDate=2026-02-28&lang=en
Authorization: Bearer <token>
```

---

# Engagement — Likes, Views, Bookmarks

## 26. Record Article View

### `POST /api/engagement/view/:articleId`

Record a view for an article. Deduplicated per user/session/IP within 24 hours.

**Access:** Public (optional auth)

**Request body (optional):**

```json
{
  "sessionId": "unique-session-id-from-app"
}
```

**Response:**

```json
{
  "recorded": true,
  "views": 42
}
```

| Field      | Type    | Description                                  |
|------------|---------|----------------------------------------------|
| `recorded` | boolean | `true` if this was a new view, `false` if duplicate |
| `views`    | number  | Updated total view count for the article     |

---

## 27. Like / Unlike Article

### `POST /api/engagement/like/:articleId`

Toggle like on an article. If already liked, removes the like. If a dislike exists, it is removed first.

**Access:** Private

```
POST /api/engagement/like/6998535383b67e00f92fa64a
Authorization: Bearer <token>
```

**Response:**

```json
{
  "action": "liked",
  "likes": 5,
  "dislikes": 1
}
```

| `action` values | Description     |
|-----------------|-----------------|
| `liked`         | Like was added  |
| `unliked`       | Like was removed |

---

## 28. Dislike / Undislike Article

### `POST /api/engagement/dislike/:articleId`

Toggle dislike on an article. If already disliked, removes the dislike. If a like exists, it is removed first.

**Access:** Private

```
POST /api/engagement/dislike/6998535383b67e00f92fa64a
Authorization: Bearer <token>
```

**Response:**

```json
{
  "action": "disliked",
  "likes": 5,
  "dislikes": 2
}
```

| `action` values | Description         |
|-----------------|---------------------|
| `disliked`      | Dislike was added   |
| `undisliked`    | Dislike was removed |

---

## 29. Record Article Share

### `POST /api/engagement/share/:articleId`

Record that the user shared an article.

**Access:** Private

**Request body (optional):**

```json
{
  "platform": "whatsapp"
}
```

**Response:**

```json
{ "message": "Share recorded" }
```

---

## 30. Bookmark / Unbookmark Article

### `POST /api/engagement/bookmark/:articleId`

Toggle bookmark on an article.

**Access:** Private

```
POST /api/engagement/bookmark/6998535383b67e00f92fa64a
Authorization: Bearer <token>
```

**Response:**

```json
{ "action": "bookmarked" }
```

| `action` values | Description          |
|-----------------|----------------------|
| `bookmarked`    | Bookmark was added   |
| `unbookmarked`  | Bookmark was removed |

---

## 31. Get User's Bookmarked Articles

### `GET /api/engagement/bookmarks`

Returns all bookmarked articles for the current user.

**Access:** Private

| Parameter | Type   | Default | Description   |
|-----------|--------|---------|---------------|
| `page`    | number | `1`     | Page number   |
| `limit`   | number | `20`    | Page size     |
| `lang`    | string | `en`    | Language code |

```
GET /api/engagement/bookmarks?lang=te&page=1&limit=10
Authorization: Bearer <token>
```

**Response:**

```json
{
  "articles": [
    {
      "_id": "6998535383b67e00f92fa64a",
      "title": "పరిపాలన గాలికి వదిలేసి...",
      "slug": "leaving-governance-to-the-wind...",
      "featuredImage": { "url": "..." },
      "publishedAt": "2026-02-20T12:33:36.198Z",
      "category": { "_id": "...", "name": "రాజకీయాలు", "slug": "politics" }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 3,
    "pages": 1
  }
}
```

---

## 32. Get Engagement Status for Article

### `GET /api/engagement/status/:articleId`

Returns the current user's engagement state for a specific article (liked, disliked, bookmarked, etc.).

**Access:** Private

```
GET /api/engagement/status/6998535383b67e00f92fa64a
Authorization: Bearer <token>
```

**Response:**

```json
{
  "status": {
    "liked": true,
    "disliked": false,
    "bookmarked": false,
    "shared": true,
    "viewed": true
  }
}
```

---

# Comments

## 33. Get Comments for Article

### `GET /api/engagement/comments/:articleId`

Returns threaded comments for an article. Top-level comments include nested `replies`.

**Access:** Public

| Parameter | Type   | Default | Description          |
|-----------|--------|---------|----------------------|
| `limit`   | number | `50`    | Max top-level comments |

```
GET /api/engagement/comments/6998535383b67e00f92fa64a
GET /api/engagement/comments/6998535383b67e00f92fa64a?limit=20
```

**Response:**

```json
{
  "comments": [
    {
      "_id": "69a1234567890abcdef12345",
      "article": "6998535383b67e00f92fa64a",
      "user": {
        "_id": "697ba9f01b749e103d435718",
        "name": "John Doe",
        "avatar": null
      },
      "content": "Great article!",
      "parent": null,
      "status": "approved",
      "likes": 3,
      "isEdited": false,
      "createdAt": "2026-02-21T08:30:00.000Z",
      "updatedAt": "2026-02-21T08:30:00.000Z",
      "replies": [
        {
          "_id": "69a1234567890abcdef12346",
          "user": { "_id": "...", "name": "Jane", "avatar": null },
          "content": "I agree!",
          "parent": "69a1234567890abcdef12345",
          "status": "approved",
          "likes": 1,
          "isEdited": false,
          "createdAt": "2026-02-21T09:00:00.000Z",
          "replies": []
        }
      ]
    }
  ]
}
```

---

## 34. Add Comment to Article

### `POST /api/engagement/comments/:articleId`

Add a new comment or reply to an article.

**Access:** Private

**Request body:**

```json
{
  "content": "Great article, very informative!",
  "parent": null
}
```

| Field     | Type   | Required | Notes                                       |
|-----------|--------|----------|---------------------------------------------|
| `content` | string | Yes      | 1–1000 characters                           |
| `parent`  | string | No       | Parent comment ID for replies. `null` for top-level |

**Response (201):**

```json
{
  "message": "Comment submitted for moderation",
  "comment": {
    "_id": "69a1234567890abcdef12347",
    "article": "6998535383b67e00f92fa64a",
    "user": { "_id": "697ba9f01b749e103d435718", "name": "John Doe", "avatar": null },
    "content": "Great article, very informative!",
    "parent": null,
    "status": "approved",
    "likes": 0,
    "isEdited": false,
    "createdAt": "2026-02-21T10:00:00.000Z"
  }
}
```

---

## 35. Edit Comment

### `PUT /api/engagement/comments/:commentId`

Edit your own comment. Only allowed within 10 minutes of creation.

**Access:** Private (own comments only)

**Request body:**

```json
{
  "content": "Updated comment text"
}
```

**Response:**

```json
{
  "message": "Comment updated",
  "comment": {
    "_id": "69a1234567890abcdef12347",
    "content": "Updated comment text",
    "isEdited": true,
    "editedAt": "2026-02-21T10:05:00.000Z"
  }
}
```

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| `404` | `{ "error": "Comment not found" }` | Not your comment or doesn't exist |
| `400` | `{ "error": "Cannot edit comment after 10 minutes" }` | Edit window expired |

---

## 36. Delete Comment

### `DELETE /api/engagement/comments/:commentId`

Delete a comment. Regular users can only delete their own. Admins/reporters can delete any.

**Access:** Private

```
DELETE /api/engagement/comments/69a1234567890abcdef12347
Authorization: Bearer <token>
```

**Response:**

```json
{ "message": "Comment deleted" }
```

---

## 37. Like / Unlike Comment

### `POST /api/engagement/comments/:commentId/like`

Toggle like on a comment.

**Access:** Private

```
POST /api/engagement/comments/69a1234567890abcdef12345/like
Authorization: Bearer <token>
```

**Response:**

```json
{
  "action": "liked",
  "likes": 4
}
```

| `action` values | Description     |
|-----------------|-----------------|
| `liked`         | Like was added  |
| `unliked`       | Like was removed |

---

## 38. Moderate Comment

### `PUT /api/engagement/comments/:commentId/moderate`

Approve or flag a comment. Reporter and Admin only.

**Access:** Private (Reporter/Admin)

**Request body:**

```json
{
  "status": "approved",
  "reason": "Looks good"
}
```

| Field    | Type   | Required | Notes                                |
|----------|--------|----------|--------------------------------------|
| `status` | string | Yes      | `approved`, `flagged`, or `deleted` |
| `reason` | string | No       | Moderation reason                    |

**Response:**

```json
{
  "message": "Comment approved",
  "comment": { ... }
}
```

---

## 39. Get Pending Comments (Moderation Queue)

### `GET /api/engagement/comments/pending/list`

Returns comments awaiting moderation.

**Access:** Private (Reporter/Admin)

| Parameter | Type   | Default | Description |
|-----------|--------|---------|-------------|
| `page`    | number | `1`     | Page number |
| `limit`   | number | `20`    | Page size   |

```
GET /api/engagement/comments/pending/list?page=1&limit=10
Authorization: Bearer <token>
```

**Response:**

```json
{
  "comments": [
    {
      "_id": "69a1234567890abcdef12348",
      "user": { "_id": "...", "name": "User Name", "avatar": null },
      "article": { "_id": "...", "title": { "en": "Article Title" }, "slug": "article-slug" },
      "content": "Pending comment text...",
      "status": "pending",
      "createdAt": "2026-02-21T11:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "pages": 1
  }
}
```

---

# API Quick Reference

## Public Endpoints (No Auth Required)

| #  | Method | Endpoint                               | Description                    |
|----|--------|----------------------------------------|--------------------------------|
| 1  | GET    | `/api/languages`                       | Active languages               |
| 2  | GET    | `/api/languages/default`               | Default language               |
| 3  | GET    | `/api/categories`                      | All categories                 |
| 4  | GET    | `/api/categories/tree`                 | Category tree                  |
| 5  | GET    | `/api/categories/:id`                  | Category by ID                 |
| 6  | GET    | `/api/categories/slug/:slug`           | Category by slug               |
| 7  | POST   | `/api/auth/login`                      | Email + password login         |
| 8  | POST   | `/api/auth/google`                     | Google Sign-In                 |
| 9  | POST   | `/api/auth/register/app`               | Manual registration            |
| 10 | POST   | `/api/auth/check-email`                | Check if email exists          |
| 11 | GET    | `/api/articles/feed`                   | Personalized feed              |
| 12 | GET    | `/api/articles`                        | Public articles list           |
| 13 | GET    | `/api/articles/nearby`                 | Nearby articles                |
| 14 | GET    | `/api/articles/trending`               | Trending articles              |
| 15 | GET    | `/api/articles/ref/:articleId`         | Article by reference ID        |
| 16 | GET    | `/api/articles/slug/:slug`             | Article by slug                |
| 17 | POST   | `/api/engagement/view/:articleId`      | Record view                    |
| 18 | GET    | `/api/engagement/comments/:articleId`  | Get comments                   |

## Private Endpoints (Auth Required)

| #  | Method | Endpoint                                     | Role            | Description              |
|----|--------|----------------------------------------------|-----------------|--------------------------|
| 19 | GET    | `/api/auth/me`                               | Any             | Current user profile     |
| 20 | POST   | `/api/auth/logout`                           | Any             | Logout                   |
| 21 | POST   | `/api/articles/feed/seen`                    | Any             | Mark articles as seen    |
| 22 | POST   | `/api/engagement/like/:articleId`            | Any             | Like/unlike article      |
| 23 | POST   | `/api/engagement/dislike/:articleId`         | Any             | Dislike/undislike article |
| 24 | POST   | `/api/engagement/share/:articleId`           | Any             | Record share             |
| 25 | POST   | `/api/engagement/bookmark/:articleId`        | Any             | Bookmark/unbookmark      |
| 26 | GET    | `/api/engagement/bookmarks`                  | Any             | User's bookmarks         |
| 27 | GET    | `/api/engagement/status/:articleId`          | Any             | Engagement status        |
| 28 | POST   | `/api/engagement/comments/:articleId`        | Any             | Add comment              |
| 29 | PUT    | `/api/engagement/comments/:commentId`        | Own comment     | Edit comment             |
| 30 | DELETE | `/api/engagement/comments/:commentId`        | Own / Admin     | Delete comment           |
| 31 | POST   | `/api/engagement/comments/:commentId/like`   | Any             | Like/unlike comment      |
| 32 | GET    | `/api/articles/:id`                          | Reporter/Admin  | Get article for editing  |
| 33 | POST   | `/api/articles`                              | Reporter/Admin  | Create article           |
| 34 | PUT    | `/api/articles/:id`                          | Reporter/Admin  | Update article           |
| 35 | PUT    | `/api/articles/:id/status`                   | Admin           | Change article status    |
| 36 | DELETE | `/api/articles/:id`                          | Admin           | Archive article          |
| 37 | GET    | `/api/articles/manage/list`                  | Reporter/Admin  | Dashboard articles list  |
| 38 | PUT    | `/api/engagement/comments/:commentId/moderate` | Reporter/Admin | Moderate comment       |
| 39 | GET    | `/api/engagement/comments/pending/list`      | Reporter/Admin  | Moderation queue         |

---

# Architecture Notes

### Trending Score Cron Job
- Runs every **15 minutes** on server startup
- Formula: `(views + likes × 2) / (hoursSinceCreation + 1)^1.8`
- Pre-calculates `trendingScore` field so feed uses simple index-based sort

### Seen Articles Rolling Window
- Stored in `user.seenArticles[{ articleId, seenAt }]`
- Entries older than **30 days** are auto-pruned
- Excluded via `$nin` in the feed pipeline

### Indexes
| Index | Purpose |
|-------|---------|
| `{ location: "2dsphere" }` | Geospatial queries |
| `{ category: 1, trendingScore: -1, createdAt: -1 }` | Feed: category tab + trending sort |
| `{ status: 1, trendingScore: -1, createdAt: -1 }` | Feed: published + trending sort |
| `{ status: 1, publishedAt: -1 }` | Chronological feed |
| `{ category: 1, status: 1, publishedAt: -1 }` | Category + chronological |
| `{ tags: 1 }` | Tag-based queries |

### Language Fallback
All localized fields use `$ifNull` with English fallback:
```
$ifNull: [$title.te, $ifNull: [$title.en, ""]]
```

### Authentication
- JWT tokens passed via `Authorization: Bearer <token>` header or `token` cookie
- Token expiry: 7 days
- `authProvider`: `local` (email/password) or `google` (Google Sign-In)
- `role`: `user`, `reporter`, or `admin`
