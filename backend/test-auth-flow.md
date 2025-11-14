# Manual Testing Guide for Authentication Flow

This guide demonstrates how to test the complete authentication flow including the new logout and refresh endpoints.

## Prerequisites
Start the local development server:
```bash
npm run dev
```

## 1. Register a New User

```bash
curl -X POST http://localhost:8787/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234"
  }'
```

**Expected Response (201):**
```json
{
  "user": {
    "id": 1,
    "email": "test@example.com",
    "created_at": "2025-11-11T22:15:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "550e8400-e29b-41d4-a716-446655440000"
}
```

Save the `accessToken` and `refreshToken` for subsequent requests.

## 2. Login with Existing User

```bash
curl -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234"
  }'
```

**Expected Response (200):** Same structure as registration

## 3. Access Protected Endpoint (Create Todo)

```bash
curl -X POST http://localhost:8787/todos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "title": "My First Todo",
    "description": "Testing authenticated endpoint"
  }'
```

**Expected Response (201):**
```json
{
  "id": 1,
  "title": "My First Todo",
  "description": "Testing authenticated endpoint",
  "completed": 0,
  "user_id": 1,
  "created_at": "2025-11-11T22:16:00.000Z",
  "updated_at": "2025-11-11T22:16:00.000Z"
}
```

## 4. Refresh Access Token

```bash
curl -X POST http://localhost:8787/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

**Expected Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## 5. Logout (Blacklist Access Token)

### Logout without refresh token:
```bash
curl -X POST http://localhost:8787/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Logout with refresh token (recommended):
```bash
curl -X POST http://localhost:8787/auth/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

**Expected Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

## 6. Verify Token is Blacklisted

Try to access a protected endpoint with the blacklisted token:

```bash
curl -X GET http://localhost:8787/todos \
  -H "Authorization: Bearer YOUR_BLACKLISTED_ACCESS_TOKEN"
```

**Expected Response (401):**
```json
{
  "error": "Invalid or expired token"
}
```

## 7. Verify Refresh Token is Deleted (if provided during logout)

Try to use the refresh token after logout:

```bash
curl -X POST http://localhost:8787/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_DELETED_REFRESH_TOKEN"
  }'
```

**Expected Response (401):**
```json
{
  "error": "Invalid refresh token"
}
```

## Error Cases

### Logout without Authorization header:
```bash
curl -X POST http://localhost:8787/auth/logout
```

**Expected Response (401):**
```json
{
  "error": "Authorization header required"
}
```

### Refresh with expired token:
The system will automatically detect expired refresh tokens and return 401.

### Refresh with non-existent token:
```bash
curl -X POST http://localhost:8787/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "invalid-token-12345"
  }'
```

**Expected Response (401):**
```json
{
  "error": "Invalid refresh token"
}
```

## Complete Flow Test Script

Here's a bash script that tests the entire flow:

```bash
#!/bin/bash

# 1. Register
echo "1. Registering user..."
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234"}')

ACCESS_TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.accessToken')
REFRESH_TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.refreshToken')

echo "Access Token: $ACCESS_TOKEN"
echo "Refresh Token: $REFRESH_TOKEN"

# 2. Create a todo
echo -e "\n2. Creating a todo..."
curl -s -X POST http://localhost:8787/todos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"title":"Test Todo"}' | jq

# 3. Refresh token
echo -e "\n3. Refreshing access token..."
NEW_ACCESS_TOKEN=$(curl -s -X POST http://localhost:8787/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}" | jq -r '.accessToken')

echo "New Access Token: $NEW_ACCESS_TOKEN"

# 4. Logout
echo -e "\n4. Logging out..."
curl -s -X POST http://localhost:8787/auth/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $NEW_ACCESS_TOKEN" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}" | jq

# 5. Try to use blacklisted token
echo -e "\n5. Attempting to use blacklisted token..."
curl -s -X GET http://localhost:8787/todos \
  -H "Authorization: Bearer $NEW_ACCESS_TOKEN" | jq

# 6. Try to use deleted refresh token
echo -e "\n6. Attempting to use deleted refresh token..."
curl -s -X POST http://localhost:8787/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}" | jq
```

Save this as `test-auth-flow.sh` and run with:
```bash
chmod +x test-auth-flow.sh
./test-auth-flow.sh
```

## Notes

- Access tokens expire in 7 days
- Refresh tokens expire in 30 days
- Blacklisted tokens remain in the database until their natural expiration
- Consider implementing periodic cleanup of expired blacklisted tokens
- The authenticate() middleware checks the blacklist on every protected request
- Generic error messages prevent user enumeration attacks
