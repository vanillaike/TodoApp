# Frontend - Todo App

A static website using vanilla web components and Tailwind CSS that interfaces with the Cloudflare Workers backend API.

## Technology Stack

- **Web Components**: Native Custom Elements (no framework)
- **Styling**: Tailwind CSS (via CDN)
- **Modules**: ES6 modules
- **Authentication**: JWT tokens stored in localStorage
- **Routing**: Hash-based routing (GitHub Pages compatible)
- **Deployment**: GitHub Pages (static hosting)

## Project Structure

```
frontend/
├── index.html          # Main HTML entry point
├── styles.css          # Custom CSS (animations, accessibility)
├── js/
│   ├── main.js        # Application bootstrap
│   ├── config.js      # Configuration constants
│   ├── router.js      # Client-side router (Phase 5)
│   ├── components/    # Web components (Phase 3)
│   ├── services/      # API clients (Phase 2)
│   └── utils/         # Utility functions (Phase 3+)
└── README.md          # This file
```

## Getting Started

### Development Setup

1. **Start the backend API**:
   ```bash
   cd ../backend
   npm run dev
   ```
   Backend will run on `http://localhost:8787`

2. **Open the frontend**:
   - Simply open `index.html` in a modern browser
   - Or use a local dev server:
     ```bash
     # Using Python
     python3 -m http.server 3000

     # Using Node.js
     npx serve .

     # Using VS Code Live Server extension
     # Right-click index.html → "Open with Live Server"
     ```

3. **Access the app**:
   - Navigate to `http://localhost:3000` (or appropriate port)

### Browser Requirements

- Chrome 67+
- Firefox 63+
- Safari 13+
- Edge 79+

(Native Custom Elements support required)

## Configuration

### API URL Configuration

Edit `js/config.js` to configure API endpoints:

```javascript
// Development (default)
const API_BASE_URL = 'http://localhost:8787';

// Production (update after backend deployment)
const API_BASE_URL = 'https://your-worker.workers.dev';
```

The app automatically detects environment based on hostname.

## Integration with Backend

### Backend API Endpoints

**Authentication (Public):**
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login and receive tokens
- `POST /auth/logout` - Logout and blacklist token
- `POST /auth/refresh` - Refresh access token

**Todos (Protected):**
- `GET /todos` - List todos with pagination
- `POST /todos` - Create new todo
- `GET /todos/:id` - Get single todo
- `PUT /todos/:id` - Update todo
- `DELETE /todos/:id` - Delete todo

See `../backend/CLAUDE.md` for complete API documentation.

### Authentication Flow

1. User registers or logs in via form components
2. Backend returns `{ user, accessToken, refreshToken }`
3. Frontend stores tokens in localStorage
4. Protected requests include: `Authorization: Bearer <accessToken>`
5. On 401 response, frontend attempts token refresh
6. On logout, tokens are cleared and blacklisted

### Token Storage

Tokens are stored in localStorage with keys:
- `todo_app_access_token` - JWT access token (7-day expiry)
- `todo_app_refresh_token` - Refresh token (30-day expiry)
- `todo_app_user_data` - User information

## Development Progress

### ✅ Phase 1: Project Setup (Complete)
- HTML structure with Tailwind CSS CDN
- Configuration system
- Error handling
- Accessibility features

### 🚧 Phase 2: API Client Service (Next)
- API client with fetch wrapper
- Token management
- Auto-refresh on 401
- Error handling

### 📋 Phase 3: Authentication Components (Planned)
- Login form component
- Register form component
- Logout button component
- Form validation

### 📋 Phase 4: Token Management (Planned)
- Auth state manager
- LocalStorage wrapper
- JWT decoder
- Observer pattern for auth state

### 📋 Phase 5: Protected Content (Planned)
- Protected route wrapper
- Todo list component
- Todo form component
- Hash-based router

### 📋 Phase 6: Deployment (Planned)
- GitHub Pages configuration
- Environment detection
- Production API URL setup

## CORS Configuration

### Development
Backend allows `localhost` origins by default.

### Production
Update backend `wrangler.jsonc`:
```jsonc
"vars": {
  "ALLOWED_ORIGINS": "https://yourusername.github.io"
}
```

Or use Cloudflare Dashboard to set environment variables.

## Deployment to GitHub Pages

### Prerequisites
1. Backend deployed to Cloudflare Workers
2. Frontend `config.js` updated with production API URL
3. Backend CORS configured for GitHub Pages domain

### Deployment Steps

1. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
   - Source: Deploy from branch
   - Branch: `main`, folder: `/frontend` (or configure as needed)

2. **Configure API URL**:
   ```javascript
   // In js/config.js
   const API_BASE_URL = 'https://your-worker.workers.dev';
   ```

3. **Push changes**:
   ```bash
   git add .
   git commit -m "Configure production API URL"
   git push origin main
   ```

4. **Access site**:
   - Your site will be at: `https://yourusername.github.io/repo-name/`

See Phase 6 documentation for detailed deployment instructions.

## Features

### Implemented
- ✅ Responsive design (mobile-first)
- ✅ Accessibility (WCAG AA)
- ✅ Error boundaries
- ✅ Loading states
- ✅ Custom animations
- ✅ Keyboard navigation support

### Coming Soon
- 🚧 User authentication UI
- 🚧 Todo management interface
- 🚧 Client-side routing
- 🚧 Form validation
- 🚧 Token refresh automation
- 🚧 Optimistic UI updates

## Security Features

- JWT token authentication
- Automatic token refresh
- Content Security Policy
- XSS prevention (no innerHTML with user data)
- Secure token storage
- Token expiration checking
- HTTPS enforcement (in production)

## Accessibility

- Semantic HTML5 elements
- ARIA labels and roles
- Keyboard navigation
- Screen reader support
- Skip navigation link
- Focus indicators
- Sufficient color contrast
- Reduced motion support

## Troubleshooting

### "Web Components not supported" error
- Upgrade to a modern browser
- Check browser version meets minimum requirements

### CORS errors in development
- Ensure backend is running on `http://localhost:8787`
- Check backend CORS configuration
- Verify `ALLOWED_ORIGINS` includes your frontend URL

### Tokens not persisting
- Check browser localStorage is enabled
- Clear localStorage and try logging in again
- Check browser console for storage errors

### API requests failing
- Verify backend is running
- Check API URL in `config.js`
- Inspect network tab for request details
- Check backend logs for errors

## Contributing

When adding new features:
1. Follow existing component patterns
2. Use Tailwind utilities for styling
3. Implement proper error handling
4. Add loading states for async operations
5. Ensure accessibility standards
6. Test on multiple browsers

## Resources

- [MDN Web Components](https://developer.mozilla.org/en-US/docs/Web/Web_Components)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Web Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Backend API Documentation](../backend/CLAUDE.md)
