# Frontend

This directory is ready for your frontend application.

## Getting Started

You can set up any frontend framework here that you prefer:

- React
- Vue
- Svelte
- Vanilla JavaScript
- Or any other frontend framework

## Integration with Backend

The backend API is available at:
- Development: `http://localhost:8787`
- Production: Your deployed Cloudflare Workers URL

### API Endpoints

See the main README.md or `backend/CLAUDE.md` for complete API documentation.

### Authentication Flow

1. Register or login to receive an access token
2. Include the access token in the Authorization header:
   ```
   Authorization: Bearer <access_token>
   ```
3. Use the refresh token to get a new access token when it expires

## CORS Configuration

The backend API is configured to allow CORS from localhost during development. For production, you'll need to configure `ALLOWED_ORIGINS` in the backend's `wrangler.jsonc`.

## Next Steps

1. Initialize your frontend framework of choice
2. Set up API client to connect to the backend
3. Implement authentication UI (login/register)
4. Implement todo management UI (list, create, update, delete)
5. Add responsive design and styling
