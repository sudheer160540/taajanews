# Taaja News - ताज़ा खबर

A comprehensive full-stack news application built with the MERN stack, featuring a unique page-flip reading experience, multilingual support (English/Hindi), and localized news delivery.

## Features

- **Page-Flip Reader**: Immersive skeuomorphic newspaper-like reading experience using react-pageflip
- **Multilingual Support**: Full English and Hindi language support with i18next
- **Localized News**: Geospatial filtering by city and area using MongoDB GeoJSON
- **Mobile-First Design**: Responsive Material UI components optimized for all devices
- **RBAC Authentication**: Role-based access control (Admin, Reporter, User)
- **Azure Blob Storage**: Direct image uploads with SAS tokens
- **Atomic Engagement**: Race-condition-free likes, views, and comments
- **Admin Dashboard**: Complete content management system

## Tech Stack

### Backend
- Node.js + Express.js
- MongoDB + Mongoose
- JWT Authentication
- Azure Blob Storage SDK
- Joi Validation

### Frontend
- React 18 + Vite
- Material UI (MUI) v5
- React Router v6
- react-pageflip
- react-i18next
- Axios

## Project Structure

```
taaja_news/
├── backend/
│   ├── src/
│   │   ├── config/         # DB and Azure configuration
│   │   ├── middleware/     # Auth, validation middleware
│   │   ├── models/         # Mongoose schemas
│   │   ├── routes/         # API routes
│   │   ├── scripts/        # Seeding scripts
│   │   ├── utils/          # Helper utilities
│   │   └── server.js       # Express server entry
│   ├── .env                # Environment variables
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── contexts/       # React contexts (Auth, Location)
│   │   ├── layouts/        # Page layouts
│   │   ├── pages/          # Route pages
│   │   ├── services/       # API services
│   │   ├── App.jsx         # Main app with routing
│   │   ├── i18n.js         # Internationalization config
│   │   ├── theme.js        # MUI theme customization
│   │   └── main.jsx        # React entry point
│   └── package.json
│
├── package.json            # Root package.json (workspaces)
└── README.md
```

## Getting Started

### Prerequisites
- Node.js >= 18.0.0
- MongoDB (Atlas or local)
- Azure Storage Account (for media uploads)

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd taaja_news
```

2. Install dependencies
```bash
npm run install:all
# or manually:
npm install
cd backend && npm install
cd ../frontend && npm install
```

3. Configure environment variables

Create `backend/.env` file:
```env
# Database
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/taajanews

# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=your_connection_string
AZURE_STORAGE_CONTAINER=your_container
AZURE_STORAGE_URL=https://your_account.blob.core.windows.net

# JWT
JWT_SECRET=your_secure_jwt_secret
JWT_EXPIRES_IN=7d

# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

4. Seed the database
```bash
npm run seed
```

This creates:
- Admin user: `admin@taajanews.com` / `admin123`
- Reporter user: `reporter@taajanews.com` / `reporter123`
- Categories, cities, areas, and sample articles

5. Start development servers
```bash
npm run dev
```

The backend runs on `http://localhost:5000` and frontend on `http://localhost:5173`.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Articles
- `GET /api/articles` - Get published articles (with filtering)
- `GET /api/articles/slug/:slug` - Get article by slug
- `GET /api/articles/trending` - Get trending articles
- `GET /api/articles/nearby` - Get articles near location
- `POST /api/articles` - Create article (Reporter+)
- `PUT /api/articles/:id` - Update article (Reporter+)

### Categories
- `GET /api/categories` - Get all categories
- `GET /api/categories/tree` - Get category hierarchy

### Locations
- `GET /api/locations/cities` - Get all cities
- `GET /api/locations/areas` - Get areas (by city)
- `GET /api/locations/cities/nearby` - Find nearby cities

### Engagement
- `POST /api/engagement/view/:articleId` - Record view
- `POST /api/engagement/like/:articleId` - Like/unlike
- `POST /api/engagement/bookmark/:articleId` - Bookmark
- `GET /api/engagement/comments/:articleId` - Get comments
- `POST /api/engagement/comments/:articleId` - Add comment

### Upload
- `POST /api/upload/sas-token` - Get SAS token for upload
- `POST /api/upload/sas-tokens` - Batch SAS tokens

## Key Features Explained

### Page-Flip Reader
The application uses `react-pageflip` to create an immersive newspaper-like reading experience. Articles are split into pages with realistic 3D page-turn animations.

### Multilingual Content
All content (articles, categories, locations) is stored with both English and Hindi translations:
```javascript
{
  title: {
    en: "Article Title",
    hi: "लेख शीर्षक"
  }
}
```

### Geospatial Queries
MongoDB 2dsphere indexes enable location-based news filtering:
```javascript
Article.findNearby([longitude, latitude], maxDistanceMeters)
```

### Atomic Engagement
View counts and likes use MongoDB's atomic `$inc` operator to prevent race conditions:
```javascript
Article.findByIdAndUpdate(id, { $inc: { 'engagement.likes': 1 } })
```

## Deployment

### Azure Deployment (Recommended)
1. Create Azure Container Apps for frontend and backend
2. Set up MongoDB Atlas cluster
3. Configure Azure Blob Storage
4. Set environment variables in Container Apps
5. Deploy using Azure Developer CLI (`azd`)

### Manual Deployment
1. Build frontend: `cd frontend && npm run build`
2. Serve static files from `frontend/dist`
3. Run backend: `cd backend && npm start`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push to the branch
5. Open a Pull Request

## License

MIT License - See LICENSE file for details.

---

Built with ❤️ for delivering fresh news in an immersive reading experience.
