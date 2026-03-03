# Taaja News — Flutter Mobile App API

Base URL: `https://taajanews-api.onrender.com/api`

All request/response bodies are JSON. For private endpoints, pass header:
```
Authorization: Bearer <token>
```

---

# 1. Languages

---

## 1.1 Get Active Languages

### `GET /api/languages`

Call on app startup to populate language selector.

**Auth:** None

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
      "order": 0
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

## 1.2 Get Default Language

### `GET /api/languages/default`

**Auth:** None

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

# 2. Categories

---

## 2.1 Get All Categories

### `GET /api/categories`

**Auth:** None

| Parameter  | Type   | Default | Description                         |
|------------|--------|---------|-------------------------------------|
| `lang`     | string | `en`    | Language code for localized names   |
| `featured` | string | —       | `true` for featured categories only |

**Examples:**

```
GET /api/categories?lang=te
GET /api/categories?lang=en&featured=true
```

**Response:**

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
        "description": { "en": "Political news", "te": "రాజకీయ వార్తలు" }
      }
    }
  ]
}
```

---

# 3. Authentication

---

## 3.1 Google Sign-In

### `POST /api/auth/google`

Send the `idToken` obtained from Flutter `google_sign_in` package. Creates a new account on first login or links existing email.

**Auth:** None

**Request:**

```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "user"
}
```

| Field     | Type   | Required | Notes                                  |
|-----------|--------|----------|----------------------------------------|
| `idToken` | string | Yes      | Google ID token from `google_sign_in`  |
| `role`    | string | No       | `user` (default) or `reporter`         |

**Response (200):**

```json
{
  "message": "Google sign-in successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "a1b2c3d4e5f6...80-char-hex-string",
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

| Response field  | Description                                          |
|-----------------|------------------------------------------------------|
| `token`         | Long-lived JWT (7d) — used by web dashboard          |
| `accessToken`   | Short-lived JWT (15 min) — use this in Flutter app   |
| `refreshToken`  | Opaque token (30d) — use to get new `accessToken`    |

**Errors:**

| Status | Body                                                     |
|--------|----------------------------------------------------------|
| `400`  | `{ "error": "Google account has no email address" }`     |
| `401`  | `{ "error": "Invalid Google token" }`                    |
| `401`  | `{ "error": "Google token expired, please try again" }`  |
| `401`  | `{ "error": "Account is deactivated" }`                  |

---

## 3.2 Register (Manual)

### `POST /api/auth/register/app`

Register with email (mandatory) and optional phone number.

**Auth:** None

**Request:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+919876543210",
  "password": "securepass123",
  "role": "user"
}
```

| Field      | Type   | Required | Notes                                       |
|------------|--------|----------|---------------------------------------------|
| `name`     | string | Yes      | 2–100 characters                            |
| `email`    | string | Yes      | Valid email, must be unique                  |
| `phone`    | string | No       | International format (e.g. `+919876543210`) |
| `password` | string | Yes      | 6–100 characters                            |
| `role`     | string | No       | `user` (default) or `reporter`              |

**Response (201):**

```json
{
  "message": "Registration successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "a1b2c3d4e5f6...80-char-hex-string",
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

**Errors:**

| Status | Body                                                        |
|--------|-------------------------------------------------------------|
| `400`  | `{ "error": "Email already registered" }`                   |
| `400`  | `{ "error": "Phone number already registered" }`            |
| `400`  | `{ "error": "Validation Error", "details": [...] }`        |

---

## 3.3 Login (Email + Password)

### `POST /api/auth/login`

**Auth:** None

**Request:**

```json
{
  "email": "john@example.com",
  "password": "securepass123"
}
```

**Response (200):**

```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "a1b2c3d4e5f6...80-char-hex-string",
  "user": {
    "id": "697ba9f01b749e103d435718",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+919876543210",
    "authProvider": "local",
    "role": "user",
    "avatar": null,
    "preferences": { "language": "en" },
    "createdAt": "2026-01-15T10:00:00.000Z"
  }
}
```

**Errors:**

| Status | Body                                            |
|--------|-------------------------------------------------|
| `401`  | `{ "error": "Invalid email or password" }`      |
| `401`  | `{ "error": "Account is deactivated" }`         |

---

## 3.4 Check Email Existence

### `POST /api/auth/check-email`

Use before registration/login to determine the UX flow (show Google login vs password field).

**Auth:** None

**Request:**

```json
{
  "email": "john@example.com"
}
```

**Response — email exists:**

```json
{
  "exists": true,
  "authProvider": "google"
}
```

**Response — email not found:**

```json
{
  "exists": false,
  "authProvider": null
}
```

---

## 3.5 Get Current User Profile

### `GET /api/auth/me`

**Auth:** Required

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

## 3.6 Logout

### `POST /api/auth/logout`

Clears the refresh token from the database and the auth cookie.

**Auth:** Required

**Response:**

```json
{ "message": "Logged out successfully" }
```

---

## 3.7 Refresh Token

### `POST /api/auth/refresh-token`

Exchange a valid refresh token for a new access token + refresh token pair. Call this when `accessToken` expires (you get a `401` with `"Token expired"`).

**Auth:** None (the refresh token itself authenticates the request)

**Request:**

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

**Errors:**

| Status | Body                                        |
|--------|---------------------------------------------|
| `401`  | `{ "error": "Invalid refresh token" }`      |
| `401`  | `{ "error": "Account is deactivated" }`     |

**Important:**
- Each refresh token is **single-use** — after calling this endpoint, the old refresh token is invalidated and a new one is returned
- Store the new `refreshToken` immediately, replacing the old one
- If the refresh token is stolen/compromised, logging out invalidates it
- Refresh tokens have no built-in expiry — they are valid until used, revoked by logout, or replaced by a new login

---

# 4. Articles Feed

---

## 4.1 Personalized Feed

### `GET /api/articles/feed`

Main news feed with geospatial filtering, category tabs, trending sort, and seen-article exclusion.

**Auth:** Optional (enables seen-article exclusion when logged in)

| Parameter  | Type     | Default | Description                                              |
|------------|----------|---------|----------------------------------------------------------|
| `lat`      | number   | —       | User latitude (from device GPS)                          |
| `lng`      | number   | —       | User longitude (from device GPS)                         |
| `radiusKM` | number   | `50`    | Search radius in kilometers                              |
| `category` | string   | —       | Category `_id` to filter by tab                          |
| `lang`     | string   | `en`    | Language code (`en`, `te`, `hi`). Falls back to English  |
| `limit`    | number   | `20`    | Page size (max 100)                                      |
| `page`     | number   | `1`     | Page number                                              |

**Examples:**

```
GET /api/articles/feed?lang=te
GET /api/articles/feed?lat=16.807&lng=81.531&radiusKM=50&lang=te
GET /api/articles/feed?lat=16.807&lng=81.531&category=697ba9f11b749e103d435727&lang=en
GET /api/articles/feed?lang=te&page=2&limit=10
```

**Response:**

```json
{
  "articles": [
    {
      "_id": "6998535383b67e00f92fa64a",
      "articleId": "TJ-2af6472e",
      "shortId": "V1StGXR8_Z",
      "shortLinks": {
        "en": "abc123XyZ0",
        "te": "def456WvU1",
        "hi": "ghi789QrS2"
      },
      "slug": "leaving-governance-to-the-wind",
      "title": "పరిపాలన గాలికి వదిలేసి హెలికాప్టర్...",
      "summary": "కూటమి సర్కారు వల్ల ప్రజలకు...",
      "audioUrl": "https://taajanews.blob.core.windows.net/audio/...-te.wav",
      "featuredImage": {
        "url": "https://taajanews.blob.core.windows.net/images/...",
        "caption": {}
      },
      "tags": ["governance", "helicopters"],
      "location": {
        "type": "Point",
        "coordinates": [81.5316033, 16.8072523],
        "formattedAddress": "Tadepalligudem, Andhra Pradesh, India",
        "city": "Tadepalligudem",
        "state": "Andhra Pradesh",
        "country": "India"
      },
      "engagement": {
        "views": 120,
        "likes": 15,
        "dislikes": 2,
        "shares": 5,
        "commentsCount": 3
      },
      "trendingScore": 4.52,
      "readingTime": 3,
      "isFeatured": false,
      "isBreaking": false,
      "publishedAt": "2026-02-20T12:33:36.198Z",
      "createdAt": "2026-02-20T12:28:03.018Z",
      "distance": 0,
      "author": {
        "_id": "697ba9f01b749e103d435718",
        "name": "Reporter Name",
        "avatar": null
      },
      "category": {
        "_id": "697ba9f11b749e103d435727",
        "name": "రాజకీయాలు",
        "slug": "politics"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3,
    "hasMore": true
  },
  "meta": {
    "lang": "te",
    "radiusKM": 50,
    "seenExcluded": 5
  }
}
```

**Flutter integration notes:**
- Pass device GPS coordinates via `lat` and `lng` for nearby news
- Without coordinates, returns all published articles sorted by trending score
- Pass the user's selected language as `lang`
- Use `pagination.hasMore` to decide if more pages are available
- `audioUrl` is the TTS audio for the selected language (may be `null`)
- `distance` is in meters (only present when `lat`/`lng` provided)

---

## 4.2 Mark Articles as Seen

### `POST /api/articles/feed/seen`

Call this when the user scrolls past articles in the feed. Seen articles are excluded from future feed responses.

**Auth:** Required

**Request:**

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
- Duplicates are ignored
- Seen entries auto-expire after 30 days

---

## 4.3 Get Article by Short Link

### `GET /api/articles/s/:shortId?lang=te`

Fetch a single article using its `shortId` or a language-specific short link from `shortLinks`. Useful for deep linking and sharing.

**Auth:** None

| Parameter | Type   | Default | Description                           |
|-----------|--------|---------|---------------------------------------|
| `lang`    | string | `en`    | Language code for localized response  |

**Examples:**

```
GET /api/articles/s/V1StGXR8_Z
GET /api/articles/s/V1StGXR8_Z?lang=te
GET /api/articles/s/def456WvU1?lang=te
```

**Response:**

```json
{
  "article": {
    "_id": "6998535383b67e00f92fa64a",
    "articleId": "TJ-2af6472e",
    "shortId": "V1StGXR8_Z",
    "shortLinks": {
      "en": "abc123XyZ0",
      "te": "def456WvU1",
      "hi": "ghi789QrS2"
    },
    "slug": "leaving-governance-to-the-wind",
    "title": "పరిపాలన గాలికి వదిలేసి హెలికాప్టర్...",
    "summary": "కూటమి సర్కారు వల్ల ప్రజలకు...",
    "content": "కూటమి సర్కారు వల్ల ప్రజలకు ఎటువంటి...",
    "audioUrl": "https://taajanews.blob.core.windows.net/audio/...-te.wav",
    "featuredImage": { "url": "...", "caption": {} },
    "category": { "_id": "...", "name": "రాజకీయాలు", "slug": "politics" },
    "author": { "_id": "...", "name": "Reporter Name", "avatar": null }
  }
}
```

**Flutter integration notes:**
- Use `shortId` as the primary shareable ID — e.g. `https://yourdomain.com/s/V1StGXR8_Z`
- Use language-specific `shortLinks[lang]` to deep link to a specific language version
- Each language that has content gets its own unique 10-char nanoid
- `shortLinks` are auto-generated when an article is created or translated

---

# 5. Engagement

---

## 5.1 Record Article View

### `POST /api/engagement/view/:articleId`

Call when user opens an article. Deduplicated per user within 24 hours.

**Auth:** Optional (pass token if user is logged in)

**Request (optional body):**

```json
{
  "sessionId": "unique-device-session-id"
}
```

**Response:**

```json
{
  "recorded": true,
  "views": 121
}
```

| Field      | Type    | Description                                            |
|------------|---------|--------------------------------------------------------|
| `recorded` | boolean | `true` = new view counted, `false` = already viewed   |
| `views`    | number  | Updated total view count                               |

---

## 5.2 Like / Unlike Article

### `POST /api/engagement/like/:articleId`

Toggle like. Automatically removes any existing dislike.

**Auth:** Required

**Response:**

```json
{
  "action": "liked",
  "likes": 16,
  "dislikes": 2
}
```

| `action`   | Description      |
|------------|------------------|
| `liked`    | Like was added   |
| `unliked`  | Like was removed |

---

## 5.3 Dislike / Undislike Article

### `POST /api/engagement/dislike/:articleId`

Toggle dislike. Automatically removes any existing like.

**Auth:** Required

**Response:**

```json
{
  "action": "disliked",
  "likes": 15,
  "dislikes": 3
}
```

| `action`     | Description         |
|--------------|---------------------|
| `disliked`   | Dislike was added   |
| `undisliked` | Dislike was removed |

---

## 5.4 Record Article Share

### `POST /api/engagement/share/:articleId`

Call after the user shares an article.

**Auth:** Required

**Request (optional):**

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

## 5.5 Bookmark / Unbookmark Article

### `POST /api/engagement/bookmark/:articleId`

Toggle bookmark.

**Auth:** Required

**Response:**

```json
{ "action": "bookmarked" }
```

| `action`       | Description          |
|----------------|----------------------|
| `bookmarked`   | Bookmark was added   |
| `unbookmarked` | Bookmark was removed |

---

## 5.6 Get User's Bookmarked Articles

### `GET /api/engagement/bookmarks`

**Auth:** Required

| Parameter | Type   | Default | Description   |
|-----------|--------|---------|---------------|
| `page`    | number | `1`     | Page number   |
| `limit`   | number | `20`    | Page size     |
| `lang`    | string | `en`    | Language code |

**Example:**

```
GET /api/engagement/bookmarks?lang=te&page=1&limit=10
```

**Response:**

```json
{
  "articles": [
    {
      "_id": "6998535383b67e00f92fa64a",
      "title": "పరిపాలన గాలికి వదిలేసి...",
      "slug": "leaving-governance-to-the-wind",
      "featuredImage": { "url": "https://..." },
      "publishedAt": "2026-02-20T12:33:36.198Z",
      "category": {
        "_id": "697ba9f11b749e103d435727",
        "name": "రాజకీయాలు",
        "slug": "politics"
      }
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

## 5.7 Get Engagement Status for Article

### `GET /api/engagement/status/:articleId`

Call when opening article detail to show correct like/bookmark button states.

**Auth:** Required

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

# 6. Comments

---

## 6.1 Get Comments for Article

### `GET /api/engagement/comments/:articleId`

Returns threaded comments (top-level with nested `replies`).

**Auth:** None

| Parameter | Type   | Default | Description            |
|-----------|--------|---------|------------------------|
| `limit`   | number | `50`    | Max top-level comments |

**Example:**

```
GET /api/engagement/comments/6998535383b67e00f92fa64a
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
          "user": {
            "_id": "697ba9f01b749e103d435719",
            "name": "Jane",
            "avatar": null
          },
          "content": "I agree!",
          "parent": "69a1234567890abcdef12345",
          "status": "approved",
          "likes": 1,
          "isEdited": false,
          "createdAt": "2026-02-21T09:00:00.000Z"
        }
      ]
    }
  ]
}
```

---

## 6.2 Add Comment

### `POST /api/engagement/comments/:articleId`

**Auth:** Required

**Request:**

```json
{
  "content": "Great article, very informative!",
  "parent": null
}
```

| Field     | Type   | Required | Notes                                              |
|-----------|--------|----------|----------------------------------------------------|
| `content` | string | Yes      | 1–1000 characters                                  |
| `parent`  | string | No       | Parent comment `_id` for replies. `null` for top-level |

**Response (201):**

```json
{
  "message": "Comment submitted for moderation",
  "comment": {
    "_id": "69a1234567890abcdef12347",
    "article": "6998535383b67e00f92fa64a",
    "user": {
      "_id": "697ba9f01b749e103d435718",
      "name": "John Doe",
      "avatar": null
    },
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

## 6.3 Edit Comment

### `PUT /api/engagement/comments/:commentId`

Only allowed within 10 minutes of creation. Own comments only.

**Auth:** Required

**Request:**

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

**Errors:**

| Status | Body                                                       |
|--------|-----------------------------------------------------------|
| `404`  | `{ "error": "Comment not found" }`                        |
| `400`  | `{ "error": "Cannot edit comment after 10 minutes" }`     |

---

## 6.4 Delete Comment

### `DELETE /api/engagement/comments/:commentId`

Users can delete their own comments. Admins can delete any.

**Auth:** Required

**Response:**

```json
{ "message": "Comment deleted" }
```

---

## 6.5 Like / Unlike Comment

### `POST /api/engagement/comments/:commentId/like`

Toggle like on a comment.

**Auth:** Required

**Response:**

```json
{
  "action": "liked",
  "likes": 4
}
```

| `action`  | Description      |
|-----------|------------------|
| `liked`   | Like was added   |
| `unliked` | Like was removed |

---

# 7. Promotions / Banners

---

## 7.1 Get Advertisements

### `GET /api/promotions?type=advertisement`

Returns active advertisement banners. Supports optional geolocation filtering and category filtering.

**Auth:** None

| Parameter  | Type   | Default | Description                                          |
|------------|--------|---------|------------------------------------------------------|
| `type`     | string | **required** | Pass `advertisement` to get only ads            |
| `category` | string | —       | Category `_id` to filter by                          |
| `lat`      | number | —       | User latitude (for geo-targeted ads)                 |
| `lng`      | number | —       | User longitude                                       |
| `radiusKM` | number | `50`    | Search radius in kilometers                          |
| `limit`    | number | `20`    | Page size                                            |
| `page`     | number | `1`     | Page number                                          |

**Examples:**

```
GET /api/promotions?type=advertisement
GET /api/promotions?type=advertisement&limit=5
GET /api/promotions?type=advertisement&lat=16.807&lng=81.531&radiusKM=50
GET /api/promotions?type=advertisement&category=697ba9f11b749e103d435727
```

**Response:**

```json
{
  "promotions": [
    {
      "_id": "69b1234567890abcdef00001",
      "image": "https://taajanews.blob.core.windows.net/images/banner1.jpg",
      "title": "Special Offer - 50% Off",
      "description": "Limited time offer on all products",
      "type": "advertisement",
      "location": {
        "type": "Point",
        "coordinates": [81.5316033, 16.8072523],
        "formattedAddress": "Tadepalligudem, Andhra Pradesh, India",
        "city": "Tadepalligudem",
        "state": "Andhra Pradesh",
        "country": "India"
      },
      "status": "active",
      "link": "https://example.com/offer",
      "category": {
        "_id": "697ba9f11b749e103d435727",
        "name": "Business",
        "slug": "business"
      },
      "priority": 10,
      "startDate": "2026-01-01T00:00:00.000Z",
      "endDate": "2026-12-31T23:59:59.000Z",
      "createdBy": { "_id": "697ba9f01b749e103d435718", "name": "Admin User" },
      "createdAt": "2026-01-30T10:00:00.000Z",
      "updatedAt": "2026-01-30T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1,
    "hasMore": false
  }
}
```

**Flutter integration notes:**
- Always pass `type=advertisement` to fetch only ads
- Call on app startup or when the feed screen loads to display ad banners between articles
- If `link` is not null, make the banner tappable and open the URL (in-app browser or external)
- If `link` is null, the banner is display-only
- Use `image` as the banner background
- Ads are sorted by `priority` (highest first), then by newest
- Only active ads within their scheduled date range are returned
- Pass `lat` & `lng` from the user's device to get location-targeted ads

---

# Quick Reference — All Mobile App APIs

## Public (No Auth)

| # | Method | Endpoint                              | Description             |
|---|--------|---------------------------------------|-------------------------|
| 1 | GET    | `/api/languages`                      | Active languages        |
| 2 | GET    | `/api/languages/default`              | Default language        |
| 3 | GET    | `/api/categories`                     | All categories          |
| 4 | POST   | `/api/auth/google`                    | Google Sign-In          |
| 5 | POST   | `/api/auth/register/app`              | Manual registration     |
| 6 | POST   | `/api/auth/login`                     | Email + password login  |
| 7 | POST   | `/api/auth/check-email`               | Check email existence   |
| 8 | POST   | `/api/auth/refresh-token`             | Refresh access token    |
| 9 | GET    | `/api/articles/feed`                  | News feed               |
| 10| GET    | `/api/articles/s/:shortId`            | Article by short link   |
| 11| GET    | `/api/promotions?type=advertisement`  | Get advertisements      |
| 12| POST   | `/api/engagement/view/:articleId`     | Record view             |
| 13| GET    | `/api/engagement/comments/:articleId` | Get comments            |

## Private (Auth Required — pass `Authorization: Bearer <accessToken>`)

| # | Method | Endpoint                                   | Description              |
|---|--------|--------------------------------------------|--------------------------|
| 14| GET    | `/api/auth/me`                             | Current user profile     |
| 15| POST   | `/api/auth/logout`                         | Logout + revoke refresh  |
| 16| POST   | `/api/articles/feed/seen`                  | Mark articles as seen    |
| 17| POST   | `/api/engagement/like/:articleId`          | Like / unlike article    |
| 18| POST   | `/api/engagement/dislike/:articleId`       | Dislike / undislike      |
| 19| POST   | `/api/engagement/share/:articleId`         | Record share             |
| 20| POST   | `/api/engagement/bookmark/:articleId`      | Bookmark / unbookmark    |
| 21| GET    | `/api/engagement/bookmarks`                | User's bookmarks         |
| 22| GET    | `/api/engagement/status/:articleId`        | Engagement status        |
| 23| POST   | `/api/engagement/comments/:articleId`      | Add comment              |
| 24| PUT    | `/api/engagement/comments/:commentId`      | Edit comment (10 min)    |
| 25| DELETE | `/api/engagement/comments/:commentId`      | Delete comment           |
| 26| POST   | `/api/engagement/comments/:commentId/like` | Like / unlike comment    |

---

# Notes for Flutter Developer

### Authentication Flow
1. On app open → call `GET /api/languages` + `GET /api/categories` to cache locally
2. Show login screen → user picks **Google Sign-In** or **Email Register/Login**
3. For Google: get `idToken` from `google_sign_in` package → `POST /api/auth/google`
4. For email: first call `POST /api/auth/check-email` to decide flow, then register or login
5. Store the returned `accessToken` and `refreshToken` in secure storage (`flutter_secure_storage`)
6. Pass `Authorization: Bearer <accessToken>` on all private endpoints

### Token Lifecycle

```
┌─────────────┐     Login / Register / Google Sign-In
│   Backend    │ ──────────────────────────────────────►  { accessToken (15min), refreshToken }
└─────────────┘
       │
       │  accessToken expires (401 "Token expired")
       │
       ▼
┌─────────────┐     POST /api/auth/refresh-token
│   Backend    │ ◄──────────────────────────────────────  { refreshToken: "old-token" }
└─────────────┘ ──────────────────────────────────────►  { accessToken (new), refreshToken (new) }
       │
       │  refreshToken invalid (401 "Invalid refresh token")
       │
       ▼
    Redirect to Login Screen
```

**Flutter implementation pattern (Dio interceptor):**

```dart
dio.interceptors.add(InterceptorsWrapper(
  onError: (error, handler) async {
    if (error.response?.statusCode == 401 &&
        error.response?.data['error'] == 'Token expired') {
      // Try to refresh
      final refreshToken = await secureStorage.read(key: 'refreshToken');
      if (refreshToken != null) {
        try {
          final response = await dio.post('/api/auth/refresh-token',
            data: {'refreshToken': refreshToken});
          // Save new tokens
          await secureStorage.write(key: 'accessToken', value: response.data['accessToken']);
          await secureStorage.write(key: 'refreshToken', value: response.data['refreshToken']);
          // Retry original request with new access token
          error.requestOptions.headers['Authorization'] = 'Bearer ${response.data['accessToken']}';
          final retryResponse = await dio.fetch(error.requestOptions);
          return handler.resolve(retryResponse);
        } catch (e) {
          // Refresh failed → force logout
          await secureStorage.deleteAll();
          // Navigate to login
        }
      }
    }
    return handler.next(error);
  },
));
```

**Key rules:**
- `accessToken` expires in **15 minutes** — used for all API calls
- `refreshToken` is **single-use** — each refresh returns a new pair, old one is invalidated
- On logout, refresh token is deleted from the database
- If refresh fails with `401`, the user must log in again
- Store both tokens in `flutter_secure_storage`, never in SharedPreferences

### Feed Integration
1. Get device location via `geolocator` package
2. Call `GET /api/articles/feed?lat=...&lng=...&lang=te&limit=20`
3. As user scrolls, batch `POST /api/articles/feed/seen` with viewed article IDs
4. On pull-to-refresh, call feed again — seen articles will be excluded
5. Category tabs: pass `category=<_id>` from categories list

### Article Detail Screen
1. When user taps article → call `POST /api/engagement/view/:articleId`
2. If logged in → call `GET /api/engagement/status/:articleId` to show button states
3. Load comments → `GET /api/engagement/comments/:articleId`
4. Play audio if `audioUrl` is not null

### Error Handling
All errors follow this format:
```json
{
  "error": "Error message string"
}
```
Validation errors include a `details` array:
```json
{
  "error": "Validation Error",
  "details": [
    "\"email\" must be a valid email",
    "\"password\" length must be at least 6 characters long"
  ]
}
```

Special 401 errors to handle:
| `error` value          | Action                                           |
|------------------------|--------------------------------------------------|
| `Token expired`        | Call `POST /api/auth/refresh-token` to get new tokens |
| `Invalid token`        | Token is corrupt → redirect to login             |
| `Invalid refresh token`| Refresh token revoked/used → redirect to login   |
| `Not authorized, no token provided` | No token sent → redirect to login  |
