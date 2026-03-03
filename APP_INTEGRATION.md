# Taaja News — Complete App Integration Guide

> **Base URL:** `https://taajanews-api.onrender.com/api`
>
> All request / response bodies are **JSON**.
> For protected endpoints send the header:
> ```
> Authorization: Bearer <accessToken>
> ```

---

## Table of Contents

1. [Environment & Setup](#1-environment--setup)
2. [Authentication](#2-authentication)
3. [Token Lifecycle](#3-token-lifecycle)
4. [Languages](#4-languages)
5. [Categories](#5-categories)
6. [Articles Feed](#6-articles-feed)
7. [Article Engagement](#7-article-engagement)
8. [Comments](#8-comments)
9. [Promotions / Advertisements](#9-promotions--advertisements)
10. [User Profile](#10-user-profile)
11. [Yellow Pages](#11-yellow-pages)
12. [FCM Tokens](#12-fcm-tokens)
13. [Error Handling](#13-error-handling)
14. [Quick Reference Table](#14-quick-reference-table)
15. [App Startup Sequence](#15-app-startup-sequence)

---

## 1. Environment & Setup

| Key | Value |
|---|---|
| Base URL (Production) | `https://taajanews-api.onrender.com/api` |
| Content-Type | `application/json` |
| Access Token Expiry | 15 minutes |
| Refresh Token | Single-use, no expiry (until used or revoked) |
| Rate Limit | 100 requests / 15 min (production) |

### Recommended Flutter Packages

| Package | Purpose |
|---|---|
| `dio` | HTTP client with interceptor support |
| `flutter_secure_storage` | Store access & refresh tokens |
| `google_sign_in` | Google OAuth |
| `geolocator` | Device GPS coordinates |

---

## 2. Authentication

### 2.1 Google Sign-In

**`POST /api/auth/google`** — Public

Get the `idToken` from the `google_sign_in` Flutter package and send it here. Creates account on first login, links existing account if email matches.

**Request Body:**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIs...",
  "role": "user"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `idToken` | string | ✅ | Google ID token from `google_sign_in` |
| `role` | string | ❌ | `user` (default) or `reporter` |

**Response `200`:**
```json
{
  "message": "Google sign-in successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "a1b2c3d4e5f6...80-char-hex",
  "user": {
    "id": "697ba9f01b749e103d435718",
    "name": "John Doe",
    "email": "john@gmail.com",
    "phone": null,
    "authProvider": "google",
    "role": "user",
    "avatar": "https://lh3.googleusercontent.com/...",
    "bio": null,
    "preferences": { "language": "en", "city": null, "area": null, "categories": [] },
    "isEnableYelloPage": false,
    "workingProfessional": null,
    "location": null,
    "createdAt": "2026-01-30T10:00:00.000Z"
  }
}
```

**Errors:**
| Status | Error |
|---|---|
| `400` | `Google account has no email address` |
| `401` | `Invalid Google token` |
| `401` | `Google token expired, please try again` |
| `401` | `Account is deactivated` |

---

### 2.2 Register (Email + Password)

**`POST /api/auth/register/app`** — Public

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+919876543210",
  "password": "securepass123",
  "role": "user"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | ✅ | 2–100 characters |
| `email` | string | ✅ | Must be unique |
| `phone` | string | ❌ | International format e.g. `+919876543210` |
| `password` | string | ✅ | Min 6 characters |
| `role` | string | ❌ | `user` (default) or `reporter` |

**Response `201`:**
```json
{
  "message": "Registration successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "a1b2c3d4e5f6...80-char-hex",
  "user": { "id": "...", "name": "John Doe", "email": "john@example.com", "..." }
}
```

**Errors:**
| Status | Error |
|---|---|
| `400` | `Email already registered` |
| `400` | `Phone number already registered` |
| `400` | `Validation Error` + `details[]` |

---

### 2.3 Login (Email + Password)

**`POST /api/auth/login`** — Public

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securepass123"
}
```

**Response `200`:**
```json
{
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "a1b2c3d4e5f6...80-char-hex",
  "user": { "id": "...", "name": "John Doe", "..." }
}
```

**Errors:**
| Status | Error |
|---|---|
| `401` | `Invalid email or password` |
| `401` | `Account is deactivated` |

---

### 2.4 Check Email Existence

**`POST /api/auth/check-email`** — Public

Call before showing registration/login form to determine which UX flow to show.

**Request Body:**
```json
{ "email": "john@example.com" }
```

**Response — email exists:**
```json
{ "exists": true, "authProvider": "google" }
```

**Response — not found:**
```json
{ "exists": false, "authProvider": null }
```

`authProvider` values: `"local"` (email+password), `"google"`

---

### 2.5 Get Current User Profile

**`GET /api/auth/me`** — 🔒 Private

**Response `200`:**
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
    "bio": null,
    "preferences": {
      "language": "en",
      "city": null,
      "area": null,
      "categories": []
    },
    "isEnableYelloPage": false,
    "workingProfessional": null,
    "location": null,
    "createdAt": "2026-01-15T10:00:00.000Z"
  }
}
```

---

### 2.6 Logout

**`POST /api/auth/logout`** — 🔒 Private

Invalidates the refresh token in the database.

**Response `200`:**
```json
{ "message": "Logged out successfully" }
```

---

### 2.7 Refresh Access Token

**`POST /api/auth/refresh-token`** — Public

Call when `accessToken` expires (you receive `401` with `"Token expired"`).

**Request Body:**
```json
{ "refreshToken": "a1b2c3d4e5f6...80-char-hex" }
```

**Response `200`:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "x9y8z7w6v5u4...new-80-char-hex"
}
```

> ⚠️ **Each refresh token is single-use.** After calling this, the old token is invalid. Store the new pair immediately.

**Errors:**
| Status | Error |
|---|---|
| `401` | `Invalid refresh token` → redirect to login |
| `401` | `Account is deactivated` |

---

## 3. Token Lifecycle

```
Login / Register / Google Sign-In
        │
        ▼
{ accessToken (15 min), refreshToken (single-use) }
        │
        │  accessToken expires → API returns 401 "Token expired"
        │
        ▼
POST /api/auth/refresh-token  { refreshToken: "old" }
        │
        ▼
{ accessToken (new 15 min), refreshToken (new single-use) }
        │
        │  refreshToken invalid → 401 "Invalid refresh token"
        │
        ▼
     Redirect to Login
```

### Dio Interceptor Pattern (Flutter)

```dart
dio.interceptors.add(InterceptorsWrapper(
  onError: (error, handler) async {
    if (error.response?.statusCode == 401 &&
        error.response?.data['error'] == 'Token expired') {
      final refreshToken = await secureStorage.read(key: 'refreshToken');
      if (refreshToken != null) {
        try {
          final res = await dio.post('/api/auth/refresh-token',
              data: {'refreshToken': refreshToken});
          // Save new tokens
          await secureStorage.write(key: 'accessToken', value: res.data['accessToken']);
          await secureStorage.write(key: 'refreshToken', value: res.data['refreshToken']);
          // Retry the original request
          error.requestOptions.headers['Authorization'] =
              'Bearer ${res.data['accessToken']}';
          return handler.resolve(await dio.fetch(error.requestOptions));
        } catch (_) {
          await secureStorage.deleteAll();
          // Navigate to login screen
        }
      }
    }
    return handler.next(error);
  },
));
```

---

## 4. Languages

### 4.1 Get All Active Languages

**`GET /api/languages`** — Public

Call on app startup to populate language selector.

**Response `200`:**
```json
{
  "languages": [
    { "_id": "...", "code": "en", "name": "English", "nativeName": "English", "isDefault": true, "isRTL": false, "order": 0 },
    { "_id": "...", "code": "te", "name": "Telugu",  "nativeName": "తెలుగు",   "isDefault": false, "isRTL": false, "order": 1 },
    { "_id": "...", "code": "hi", "name": "Hindi",   "nativeName": "हिन्दी",   "isDefault": false, "isRTL": false, "order": 2 }
  ]
}
```

---

### 4.2 Get Default Language

**`GET /api/languages/default`** — Public

**Response `200`:**
```json
{
  "language": { "_id": "...", "code": "en", "name": "English", "isDefault": true }
}
```

---

## 5. Categories

### 5.1 Get All Categories

**`GET /api/categories`** — Public

| Query Param | Type | Default | Description |
|---|---|---|---|
| `lang` | string | `en` | Language code for localized names |
| `featured` | boolean | — | `true` for featured only |

**Examples:**
```
GET /api/categories?lang=te
GET /api/categories?lang=en&featured=true
```

**Response `200`:**
```json
{
  "categories": [
    {
      "_id": "697ba9f11b749e103d435727",
      "name": "రాజకీయాలు",
      "slug": "politics",
      "icon": "politics",
      "color": "#FF5722",
      "image": null,
      "order": 0,
      "isActive": true,
      "isFeatured": true,
      "parent": null
    }
  ]
}
```

---

## 6. Articles Feed

### 6.1 Get Personalized Feed

**`GET /api/articles/feed`** — Public (Auth optional — enables seen-exclusion when logged in)

| Query Param | Type | Default | Description |
|---|---|---|---|
| `lat` | number | — | Device latitude (GPS) |
| `lng` | number | — | Device longitude (GPS) |
| `radiusKM` | number | `50` | Search radius in km |
| `category` | string | — | Category `_id` to filter |
| `lang` | string | `en` | Language code |
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Page size (max 100) |

**Examples:**
```
GET /api/articles/feed?lang=te
GET /api/articles/feed?lat=17.3850&lng=78.4867&radiusKM=50&lang=te
GET /api/articles/feed?lat=17.3850&lng=78.4867&category=697ba9f11b749e103d435727&lang=en&page=2
```

**Response `200`:**
```json
{
  "articles": [
    {
      "_id": "6998535383b67e00f92fa64a",
      "articleId": "TJ-2af6472e",
      "shortId": "V1StGXR8_Z",
      "shortLinks": { "en": "abc123XyZ0", "te": "def456WvU1", "hi": "ghi789QrS2" },
      "slug": "leaving-governance-to-the-wind",
      "title": "పరిపాలన గాలికి వదిలేసి హెలికాప్టర్...",
      "summary": "కూటమి సర్కారు వల్ల ప్రజలకు...",
      "audioUrl": "https://taajanews.blob.core.windows.net/audio/...-te.wav",
      "featuredImage": { "url": "https://...", "caption": {} },
      "tags": ["governance"],
      "location": {
        "type": "Point",
        "coordinates": [78.4867, 17.3850],
        "formattedAddress": "Hyderabad, Telangana, India"
      },
      "engagement": { "views": 120, "likes": 15, "dislikes": 2, "shares": 5, "commentsCount": 3 },
      "trendingScore": 4.52,
      "readingTime": 3,
      "isFeatured": false,
      "isBreaking": false,
      "publishedAt": "2026-02-20T12:33:36.198Z",
      "distance": 1200,
      "author": { "_id": "...", "name": "Reporter Name", "avatar": null },
      "category": { "_id": "...", "name": "రాజకీయాలు", "slug": "politics" }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 45, "pages": 3, "hasMore": true },
  "meta": { "lang": "te", "radiusKM": 50, "seenExcluded": 5 }
}
```

> `distance` is in **metres** and only present when `lat`/`lng` are provided.
> `audioUrl` may be `null` if TTS is not generated for that language.

---

### 6.2 Mark Articles as Seen

**`POST /api/articles/feed/seen`** — 🔒 Private

Call after the user scrolls past articles. Seen articles are excluded from future feed responses.

**Request Body:**
```json
{ "articleIds": ["6998535383b67e00f92fa64a", "699854ab83b67e00f92fa65b"] }
```

**Response `200`:**
```json
{ "message": "Articles marked as seen", "added": 2 }
```

---

### 6.3 Get Article by Short Link

**`GET /api/articles/s/:shortId`** — Public

Fetch a single article for deep linking / sharing.

| Query Param | Type | Default | Description |
|---|---|---|---|
| `lang` | string | `en` | Language code for localized response |

**Examples:**
```
GET /api/articles/s/V1StGXR8_Z?lang=te
GET /api/articles/s/def456WvU1?lang=te
```

**Response `200`:**
```json
{
  "article": {
    "_id": "...",
    "shortId": "V1StGXR8_Z",
    "title": "పరిపాలన గాలికి వదిలేసి హెలికాప్టర్...",
    "summary": "...",
    "content": "...",
    "audioUrl": "https://...",
    "featuredImage": { "url": "..." },
    "category": { "_id": "...", "name": "రాజకీయాలు", "slug": "politics" },
    "author": { "_id": "...", "name": "Reporter Name", "avatar": null }
  }
}
```

---

## 7. Article Engagement

### 7.1 Record View

**`POST /api/engagement/view/:articleId`** — Public (Auth optional)

Deduplicated per user/session within 24 hours.

**Request Body (optional):**
```json
{ "sessionId": "unique-device-session-id" }
```

**Response `200`:**
```json
{ "recorded": true, "views": 121 }
```

---

### 7.2 Like / Unlike

**`POST /api/engagement/like/:articleId`** — 🔒 Private

Toggle like. Removes any existing dislike automatically.

**Response `200`:**
```json
{ "action": "liked", "likes": 16, "dislikes": 2 }
```
`action` is `"liked"` or `"unliked"`.

---

### 7.3 Dislike / Undislike

**`POST /api/engagement/dislike/:articleId`** — 🔒 Private

Toggle dislike. Removes any existing like automatically.

**Response `200`:**
```json
{ "action": "disliked", "likes": 15, "dislikes": 3 }
```

---

### 7.4 Record Share

**`POST /api/engagement/share/:articleId`** — 🔒 Private

**Request Body (optional):**
```json
{ "platform": "whatsapp" }
```

**Response `200`:**
```json
{ "message": "Share recorded" }
```

---

### 7.5 Bookmark / Unbookmark

**`POST /api/engagement/bookmark/:articleId`** — 🔒 Private

**Response `200`:**
```json
{ "action": "bookmarked" }
```
`action` is `"bookmarked"` or `"unbookmarked"`.

---

### 7.6 Get Bookmarks

**`GET /api/engagement/bookmarks`** — 🔒 Private

| Query Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Page size |
| `lang` | string | `en` | Language code |

**Response `200`:**
```json
{
  "articles": [
    {
      "_id": "...",
      "title": "...",
      "slug": "...",
      "featuredImage": { "url": "https://..." },
      "publishedAt": "2026-02-20T12:33:36.198Z",
      "category": { "_id": "...", "name": "రాజకీయాలు", "slug": "politics" }
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 3, "pages": 1 }
}
```

---

### 7.7 Get Engagement Status

**`GET /api/engagement/status/:articleId`** — 🔒 Private

Call when opening article detail to show correct button states (liked, bookmarked etc.).

**Response `200`:**
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

## 8. Comments

### 8.1 Get Comments

**`GET /api/engagement/comments/:articleId`** — Public

Returns threaded comments (top-level with nested `replies`).

| Query Param | Type | Default | Description |
|---|---|---|---|
| `limit` | number | `50` | Max top-level comments |

**Response `200`:**
```json
{
  "comments": [
    {
      "_id": "69a1234567890abcdef12345",
      "user": { "_id": "...", "name": "John Doe", "avatar": null },
      "content": "Great article!",
      "parent": null,
      "status": "approved",
      "likes": 3,
      "isEdited": false,
      "createdAt": "2026-02-21T08:30:00.000Z",
      "replies": [
        {
          "_id": "69a1234567890abcdef12346",
          "user": { "_id": "...", "name": "Jane", "avatar": null },
          "content": "I agree!",
          "parent": "69a1234567890abcdef12345",
          "likes": 1,
          "createdAt": "2026-02-21T09:00:00.000Z"
        }
      ]
    }
  ]
}
```

---

### 8.2 Add Comment

**`POST /api/engagement/comments/:articleId`** — 🔒 Private

**Request Body:**
```json
{
  "content": "Great article, very informative!",
  "parent": null
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `content` | string | ✅ | 1–1000 characters |
| `parent` | string | ❌ | Parent comment `_id` for replies; `null` for top-level |

**Response `201`:**
```json
{
  "message": "Comment submitted for moderation",
  "comment": { "_id": "...", "content": "...", "status": "approved", "createdAt": "..." }
}
```

---

### 8.3 Edit Comment

**`PUT /api/engagement/comments/:commentId`** — 🔒 Private

Own comments only. Allowed within **10 minutes** of creation.

**Request Body:**
```json
{ "content": "Updated comment text" }
```

**Response `200`:**
```json
{ "message": "Comment updated", "comment": { "_id": "...", "content": "...", "isEdited": true } }
```

**Errors:**
| Status | Error |
|---|---|
| `400` | `Cannot edit comment after 10 minutes` |
| `404` | `Comment not found` |

---

### 8.4 Delete Comment

**`DELETE /api/engagement/comments/:commentId`** — 🔒 Private

Users can delete their own; admins can delete any.

**Response `200`:**
```json
{ "message": "Comment deleted" }
```

---

### 8.5 Like / Unlike Comment

**`POST /api/engagement/comments/:commentId/like`** — 🔒 Private

**Response `200`:**
```json
{ "action": "liked", "likes": 4 }
```

---

## 9. Promotions / Advertisements

### 9.1 Get Advertisements

**`GET /api/promotions`** — Public

| Query Param | Type | Required | Description |
|---|---|---|---|
| `type` | string | ✅ | Pass `advertisement` |
| `lat` | number | ❌ | User latitude (geo-targeted ads) |
| `lng` | number | ❌ | User longitude |
| `radiusKM` | number | ❌ | Radius in km (default `50`) |
| `category` | string | ❌ | Filter by category `_id` |
| `page` | number | ❌ | Page number (default `1`) |
| `limit` | number | ❌ | Page size (default `20`) |

**Examples:**
```
GET /api/promotions?type=advertisement
GET /api/promotions?type=advertisement&lat=17.3850&lng=78.4867&radiusKM=50
GET /api/promotions?type=advertisement&category=697ba9f11b749e103d435727&limit=5
```

**Response `200`:**
```json
{
  "promotions": [
    {
      "_id": "69b1234567890abcdef00001",
      "image": "https://taajanews.blob.core.windows.net/images/banner1.jpg",
      "title": "Special Offer - 50% Off",
      "description": "Limited time offer",
      "type": "advertisement",
      "link": "https://example.com/offer",
      "priority": 10,
      "startDate": "2026-01-01T00:00:00.000Z",
      "endDate": "2026-12-31T23:59:59.000Z",
      "category": { "_id": "...", "name": "Business", "slug": "business" },
      "location": { "type": "Point", "coordinates": [78.4867, 17.3850], "city": "Hyderabad" }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "pages": 1, "hasMore": false }
}
```

> If `link` is not `null`, make the banner tappable (open URL in in-app browser).
> Ads are sorted by `priority` (highest first), then newest.

---

## 10. User Profile

### 10.1 Get User by ID

**`GET /api/users/:id`** — 🔒 Private (self or admin)

Returns all user fields **except** `password` and `refreshToken`.

**Response `200`:**
```json
{
  "user": {
    "_id": "697ba9f01b749e103d435718",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+919876543210",
    "role": "user",
    "avatar": null,
    "bio": null,
    "isActive": true,
    "authProvider": "local",
    "preferences": {
      "language": "en",
      "city": { "_id": "...", "name": "Hyderabad", "slug": "hyderabad" },
      "area": null,
      "categories": []
    },
    "isEnableYelloPage": false,
    "workingProfessional": null,
    "location": null,
    "articlesCount": 0,
    "lastLogin": "2026-03-01T10:00:00.000Z",
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-03-01T10:00:00.000Z"
  }
}
```

**Errors:**
| Status | Error |
|---|---|
| `403` | `Access denied` — trying to view another user without admin role |
| `404` | `User not found` |

---

### 10.2 Update Profile (name, avatar, bio)

**`PUT /api/users/profile`** — 🔒 Private (current user only)

**Request Body (all fields optional):**
```json
{
  "name": "John Updated",
  "avatar": "https://cdn.example.com/avatar.jpg",
  "bio": "Senior journalist at Taaja News"
}
```

| Field | Type | Validation |
|---|---|---|
| `name` | string | 2–100 characters |
| `avatar` | string | Valid URI or `null` |
| `bio` | string | Max 500 characters or `null` |

**Response `200`:**
```json
{
  "user": {
    "id": "...", "name": "John Updated", "bio": "Senior journalist at Taaja News", "..."
  }
}
```

---

### 10.3 Update Preferences (language, city, area, categories)

**`PUT /api/users/preferences`** — 🔒 Private (current user only)

**Request Body (all fields optional):**
```json
{
  "language": "te",
  "city": "697ba9f11b749e103d435730",
  "area": "697ba9f11b749e103d435731",
  "categories": ["697ba9f11b749e103d435727", "697ba9f11b749e103d435728"]
}
```

| Field | Type | Notes |
|---|---|---|
| `language` | string | Language code e.g. `en`, `te`, `hi` |
| `city` | string | City `_id` (24-char hex) or `null` |
| `area` | string | Area `_id` (24-char hex) or `null` |
| `categories` | array | Array of Category `_id`s |

**Response `200`:**
```json
{
  "message": "Preferences updated",
  "preferences": {
    "language": "te",
    "city": { "_id": "...", "name": "Hyderabad", "slug": "hyderabad" },
    "area": null,
    "categories": []
  }
}
```

---

## 11. Yellow Pages

Yellow Pages is a directory of users who have enabled their profile for discovery. Users can be found by others within a 50 km radius based on GPS location.

### 11.1 Update Yellow Page Details

**`PUT /api/users/:id/yellow-page`** — 🔒 Private (self or admin)

Update any combination of the three Yellow Page fields. Only send the fields you want to change.

**Request Body:**
```json
{
  "isEnableYelloPage": true,
  "workingProfessional": "Software Engineer",
  "location": {
    "latitude": 17.3850,
    "longitude": 78.4867,
    "formattedAddress": "Hyderabad, Telangana, India"
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `isEnableYelloPage` | boolean | ❌ | `true` = visible in Yellow Pages directory |
| `workingProfessional` | string | ❌ | Max 200 chars. Send `null` to clear |
| `location` | object | ❌ | GPS location object. Send `null` to remove location |
| `location.latitude` | number | ✅ if location | `-90` to `90` |
| `location.longitude` | number | ✅ if location | `-180` to `180` |
| `location.formattedAddress` | string | ❌ | Human-readable address, max 300 chars |

**Example — Enable Yellow Page with location:**
```json
{
  "isEnableYelloPage": true,
  "workingProfessional": "Doctor",
  "location": {
    "latitude": 17.3850,
    "longitude": 78.4867,
    "formattedAddress": "Banjara Hills, Hyderabad, Telangana"
  }
}
```

**Example — Disable Yellow Page only:**
```json
{ "isEnableYelloPage": false }
```

**Example — Clear location:**
```json
{ "location": null }
```

**Response `200`:**
```json
{
  "message": "Yellow page details updated",
  "user": {
    "id": "697ba9f01b749e103d435718",
    "name": "John Doe",
    "email": "john@example.com",
    "isEnableYelloPage": true,
    "workingProfessional": "Doctor",
    "location": {
      "type": "Point",
      "coordinates": [78.4867, 17.3850],
      "formattedAddress": "Banjara Hills, Hyderabad, Telangana"
    }
  }
}
```

> ⚠️ **Note:** `coordinates` are stored as `[longitude, latitude]` (GeoJSON standard).
> When reading `location.coordinates`, index `[0]` = longitude, index `[1]` = latitude.

**Errors:**
| Status | Error |
|---|---|
| `400` | `Validation Error` + `details[]` |
| `403` | `Access denied` |
| `404` | `User not found` |

---

### 11.2 Get Nearby Yellow Page Users

**`GET /api/users/yellow-pages/nearby`** — Public

Returns active users with `isEnableYelloPage: true` within the given radius of the provided coordinates. Results are sorted by distance (nearest first).

| Query Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `latitude` | number | ✅ | — | Current user latitude `-90` to `90` |
| `longitude` | number | ✅ | — | Current user longitude `-180` to `180` |
| `radius` | number | ❌ | `50` | Search radius in **km** (1–200) |
| `page` | number | ❌ | `1` | Page number |
| `limit` | number | ❌ | `20` | Page size (max 100) |

**Examples:**
```
GET /api/users/yellow-pages/nearby?latitude=17.3850&longitude=78.4867
GET /api/users/yellow-pages/nearby?latitude=17.3850&longitude=78.4867&radius=25&page=1&limit=10
```

**Response `200`:**
```json
{
  "users": [
    {
      "_id": "697ba9f01b749e103d435718",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+919876543210",
      "avatar": null,
      "bio": "Senior developer",
      "role": "user",
      "isEnableYelloPage": true,
      "workingProfessional": "Software Engineer",
      "location": {
        "type": "Point",
        "coordinates": [78.4867, 17.3850],
        "formattedAddress": "Banjara Hills, Hyderabad, Telangana"
      },
      "createdAt": "2026-01-15T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 8,
    "pages": 1
  },
  "query": {
    "latitude": 17.385,
    "longitude": 78.4867,
    "radiusKm": 50
  }
}
```

**Flutter integration tip:**
```dart
// Get device GPS
final position = await Geolocator.getCurrentPosition();

// Fetch nearby yellow page users
final response = await dio.get('/api/users/yellow-pages/nearby', queryParameters: {
  'latitude': position.latitude,
  'longitude': position.longitude,
  'radius': 50,
  'page': 1,
  'limit': 20,
});
```

---

## 12. FCM Tokens

FCM (Firebase Cloud Messaging) tokens identify a specific device for push notifications. Call the register endpoint right after login and whenever Firebase issues a refreshed token. The `fcmToken` string is the **unique key** — sending the same token again **updates** the record instead of creating a duplicate.

### 12.1 Register / Update FCM Token

**`POST /api/fcm-tokens`** — 🔒 Private

| Behaviour | HTTP Status |
|---|---|
| `fcmToken` **not found** → creates new document | `201 Created` |
| `fcmToken` **already exists** → updates `userId` + `location` | `200 OK` |

**Request Body:**
```json
{
  "fcmToken": "eXaMpLeFcMtOkEn_device123...",
  "location": {
    "latitude": 17.3850,
    "longitude": 78.4867
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `fcmToken` | string | ✅ | Firebase device token (min 10 chars) |
| `location` | object | ❌ | Device GPS at registration time. Omit if no permission. Send `null` to clear stored location |
| `location.latitude` | number | ✅ if location | `-90` to `90` |
| `location.longitude` | number | ✅ if location | `-180` to `180` |

**Response `201` (new token registered):**
```json
{
  "message": "FCM token registered",
  "fcmToken": {
    "id": "69c1234567890abcdef00001",
    "fcmToken": "eXaMpLeFcMtOkEn_device123...",
    "userId": "697ba9f01b749e103d435718",
    "location": {
      "latitude": 17.385,
      "longitude": 78.4867
    },
    "createdAt": "2026-03-03T10:00:00.000Z",
    "updatedAt": "2026-03-03T10:00:00.000Z"
  }
}
```

**Response `200` (existing token updated):**
```json
{
  "message": "FCM token updated",
  "fcmToken": {
    "id": "69c1234567890abcdef00001",
    "fcmToken": "eXaMpLeFcMtOkEn_device123...",
    "userId": "697ba9f01b749e103d435718",
    "location": {
      "latitude": 17.385,
      "longitude": 78.4867
    },
    "createdAt": "2026-03-01T08:00:00.000Z",
    "updatedAt": "2026-03-03T10:00:00.000Z"
  }
}
```

**Errors:**
| Status | Error |
|---|---|
| `400` | `Validation Error` + `details[]` |
| `401` | `Not authorized, no token provided` |
| `500` | `Failed to register FCM token` |

---

### 12.2 Remove FCM Token

**`DELETE /api/fcm-tokens/:fcmToken`** — 🔒 Private

Call on logout or when Firebase notifies that the token has been revoked. Users can only delete their own tokens.

**Example:**
```
DELETE /api/fcm-tokens/eXaMpLeFcMtOkEn_device123...
```

**Response `200`:**
```json
{ "message": "FCM token removed" }
```

**Errors:**
| Status | Error |
|---|---|
| `401` | `Not authorized, no token provided` |
| `404` | `FCM token not found` |

---

### 12.3 Flutter Integration

```dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:geolocator/geolocator.dart';

/// Call right after a successful login or Google Sign-In.
/// Safe to call on every app launch — it is an upsert.
Future<void> registerFcmToken(Dio dio) async {
  // 1. Get Firebase device token
  final fcmToken = await FirebaseMessaging.instance.getToken();
  if (fcmToken == null) return;

  // 2. Try to get device GPS (optional)
  Map<String, dynamic>? location;
  try {
    final position = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );
    location = {
      'latitude': position.latitude,
      'longitude': position.longitude,
    };
  } catch (_) {
    // Permission denied or unavailable — proceed without location
    location = null;
  }

  // 3. Upsert the token (creates if new, updates if exists)
  await dio.post('/api/fcm-tokens', data: {
    'fcmToken': fcmToken,
    if (location != null) 'location': location,
  });
}

/// Call on user logout
Future<void> removeFcmToken(Dio dio) async {
  final fcmToken = await FirebaseMessaging.instance.getToken();
  if (fcmToken == null) return;
  await dio.delete('/api/fcm-tokens/$fcmToken');
}

/// Firebase may issue a new token at any time — keep it in sync
void listenForTokenRefresh(Dio dio) {
  FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
    dio.post('/api/fcm-tokens', data: {'fcmToken': newToken});
  });
}
```

> ✅ **Best practice:** Call `registerFcmToken()` immediately after every successful login. Because the endpoint is an **upsert**, calling it multiple times with the same token is completely safe.

---

## 13. Error Handling

### Standard Error Format

All errors use this structure:

```json
{ "error": "Human-readable error message" }
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

### HTTP Status Codes

| Status | Meaning |
|---|---|
| `200` | Success |
| `201` | Created |
| `400` | Bad request / Validation error |
| `401` | Unauthorised (missing / expired / invalid token) |
| `403` | Forbidden (valid token but insufficient permission) |
| `404` | Resource not found |
| `429` | Too many requests (rate limit hit) |
| `500` | Internal server error |

### Auth 401 Error Matrix

| `error` value | Action |
|---|---|
| `Token expired` | Call `POST /api/auth/refresh-token` |
| `Invalid token` | Token is corrupt → redirect to login |
| `Invalid refresh token` | Refresh token used/revoked → redirect to login |
| `Not authorized, no token provided` | No header sent → redirect to login |
| `Account is deactivated` | Show deactivation message → redirect to login |

---

## 14. Quick Reference Table

### 🔓 Public Endpoints (No Auth)

| # | Method | Endpoint | Description |
|---|---|---|---|
| 1 | `GET` | `/api/languages` | Active languages |
| 2 | `GET` | `/api/languages/default` | Default language |
| 3 | `GET` | `/api/categories` | All categories |
| 4 | `POST` | `/api/auth/google` | Google Sign-In |
| 5 | `POST` | `/api/auth/register/app` | Email registration |
| 6 | `POST` | `/api/auth/login` | Email + password login |
| 7 | `POST` | `/api/auth/check-email` | Check email existence |
| 8 | `POST` | `/api/auth/refresh-token` | Refresh access token |
| 9 | `GET` | `/api/articles/feed` | Personalised news feed |
| 10 | `GET` | `/api/articles/s/:shortId` | Article by short link |
| 11 | `POST` | `/api/engagement/view/:articleId` | Record article view |
| 12 | `GET` | `/api/engagement/comments/:articleId` | Get comments |
| 13 | `GET` | `/api/promotions?type=advertisement` | Get advertisements |
| 14 | `GET` | `/api/users/yellow-pages/nearby` | Nearby Yellow Page users |

### 🔒 Private Endpoints (Auth Required)

| # | Method | Endpoint | Description |
|---|---|---|---|
| 15 | `GET` | `/api/auth/me` | Current user profile |
| 16 | `POST` | `/api/auth/logout` | Logout + revoke refresh token |
| 17 | `GET` | `/api/users/:id` | Get user by ID (self or admin) |
| 18 | `PUT` | `/api/users/profile` | Update profile (name, avatar, bio) |
| 19 | `PUT` | `/api/users/preferences` | Update language / city / categories |
| 20 | `PUT` | `/api/users/:id/yellow-page` | Update Yellow Page details |
| 21 | `POST` | `/api/articles/feed/seen` | Mark articles as seen |
| 22 | `POST` | `/api/engagement/like/:articleId` | Like / unlike article |
| 23 | `POST` | `/api/engagement/dislike/:articleId` | Dislike / undislike |
| 24 | `POST` | `/api/engagement/share/:articleId` | Record share |
| 25 | `POST` | `/api/engagement/bookmark/:articleId` | Bookmark / unbookmark |
| 26 | `GET` | `/api/engagement/bookmarks` | User's bookmarks |
| 27 | `GET` | `/api/engagement/status/:articleId` | Engagement status |
| 28 | `POST` | `/api/engagement/comments/:articleId` | Add comment |
| 29 | `PUT` | `/api/engagement/comments/:commentId` | Edit comment (within 10 min) |
| 30 | `DELETE` | `/api/engagement/comments/:commentId` | Delete comment |
| 31 | `POST` | `/api/engagement/comments/:commentId/like` | Like / unlike comment |
| 32 | `POST` | `/api/fcm-tokens` | Register / update FCM token (upsert) |
| 33 | `DELETE` | `/api/fcm-tokens/:fcmToken` | Remove FCM token |

---

## 15. App Startup Sequence

```
App Launch
    │
    ├─► GET /api/languages          → cache language list
    ├─► GET /api/languages/default  → set default language
    └─► GET /api/categories         → cache category list for tabs

    │
    ▼
Check secure storage for tokens
    │
    ├─ Tokens found ──► GET /api/auth/me → verify session
    │                       │
    │                       ├─ 200 → go to Home Feed
    │                       │         └─► POST /api/fcm-tokens  ← register/refresh FCM token
    │                       └─ 401 → refresh or login
    │
    └─ No tokens ────► Show Login / Onboarding Screen
                            │
                            └─ After login ──► POST /api/fcm-tokens

Home Feed
    │
    ├─► Get device GPS (geolocator)
    ├─► GET /api/articles/feed?lat=&lng=&lang=&limit=20
    ├─► GET /api/promotions?type=advertisement&lat=&lng=
    │
    ▼
User scrolls feed
    ├─► POST /api/articles/feed/seen  (batch, every ~5 articles)
    └─► Infinite scroll → increment page param

Article Opened
    ├─► POST /api/engagement/view/:id
    └─► GET  /api/engagement/status/:id  (if logged in)

Yellow Pages Screen
    ├─► Get device GPS
    └─► GET /api/users/yellow-pages/nearby?latitude=&longitude=&radius=50

User Profile / Settings
    ├─► GET  /api/users/:id
    ├─► PUT  /api/users/profile          (name, avatar, bio)
    ├─► PUT  /api/users/preferences      (language, city, area)
    └─► PUT  /api/users/:id/yellow-page  (enable listing + location)

Logout
    ├─► DELETE /api/fcm-tokens/:fcmToken  ← remove device token first
    └─► POST   /api/auth/logout           ← then revoke refresh token
```

---

*Last updated: March 2026 — Taaja News Backend v1*
