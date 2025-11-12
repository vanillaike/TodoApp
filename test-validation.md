# Phase 7 Validation Test Cases

This document provides manual test cases to verify the comprehensive input validation implemented in Phase 7.

## Test Environment Setup

Start the development server:
```bash
npm run dev
```

## Test Cases

### 1. Test Wrong Content-Type (Should return 415)

```bash
curl -X POST http://localhost:8787/auth/register \
  -H "Content-Type: text/plain" \
  -d '{"email": "test@test.com", "password": "Test1234"}'
```

Expected Response:
- Status: 415
- Body: `{"error": "Unsupported Media Type", "message": "Content-Type must be application/json"}`

### 2. Test Invalid JSON (Should return 400)

```bash
curl -X POST http://localhost:8787/auth/register \
  -H "Content-Type: application/json" \
  -d 'not valid json'
```

Expected Response:
- Status: 400
- Body: `{"error": "Invalid JSON", "message": "Request body must be valid JSON"}`

### 3. Test Unknown Fields (Should return 400)

```bash
curl -X POST http://localhost:8787/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "Test1234", "extraField": "bad"}'
```

Expected Response:
- Status: 400
- Body: `{"error": "Validation failed", "message": "Unknown fields: extraField. Only email and password are allowed."}`

### 4. Test Email Too Long (Should return 400)

```bash
curl -X POST http://localhost:8787/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@test.com", "password": "Test1234"}'
```

Expected Response:
- Status: 400
- Body: `{"error": "Validation failed", "message": "Email must be 255 characters or less"}`

### 5. Test Password Too Long (Should return 400)

```bash
curl -X POST http://localhost:8787/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1"}'
```

Expected Response:
- Status: 400
- Body: `{"error": "Validation failed", "message": "Password must be 128 characters or less"}`

### 6. Test Invalid Email Format (Should return 400)

```bash
curl -X POST http://localhost:8787/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "not-an-email", "password": "Test1234"}'
```

Expected Response:
- Status: 400
- Body: `{"error": "Validation failed", "message": "Invalid email format"}`

### 7. Test Email with Consecutive Dots (Should return 400)

```bash
curl -X POST http://localhost:8787/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test..name@test.com", "password": "Test1234"}'
```

Expected Response:
- Status: 400
- Body: `{"error": "Validation failed", "message": "Invalid email format"}`

### 8. Test Password Missing Number (Should return 400)

```bash
curl -X POST http://localhost:8787/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "TestTest"}'
```

Expected Response:
- Status: 400
- Body: `{"error": "Validation failed", "message": "Password must contain at least one number"}`

### 9. Test Password Missing Letter (Should return 400)

```bash
curl -X POST http://localhost:8787/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "12345678"}'
```

Expected Response:
- Status: 400
- Body: `{"error": "Validation failed", "message": "Password must contain at least one letter"}`

### 10. Test Password Too Short (Should return 400)

```bash
curl -X POST http://localhost:8787/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "Test12"}'
```

Expected Response:
- Status: 400
- Body: `{"error": "Validation failed", "message": "Password must be at least 8 characters long"}`

### 11. Test Login with Unknown Fields (Should return 400)

```bash
curl -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "Test1234", "remember": true}'
```

Expected Response:
- Status: 400
- Body: `{"error": "Validation failed", "message": "Unknown fields: remember. Only email and password are allowed."}`

### 12. Test Refresh with Invalid UUID (Should return 400)

```bash
curl -X POST http://localhost:8787/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "not-a-uuid"}'
```

Expected Response:
- Status: 400
- Body: `{"error": "Validation failed", "message": "refreshToken must be a valid UUID format"}`

### 13. Test Refresh with Empty Token (Should return 400)

```bash
curl -X POST http://localhost:8787/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": ""}'
```

Expected Response:
- Status: 400
- Body: `{"error": "Validation failed", "message": "refreshToken cannot be empty"}`

### 14. Test Refresh with Unknown Fields (Should return 400)

```bash
curl -X POST http://localhost:8787/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "550e8400-e29b-41d4-a716-446655440000", "extraField": "bad"}'
```

Expected Response:
- Status: 400
- Body: `{"error": "Validation failed", "message": "Unknown fields: extraField. Only refreshToken is allowed."}`

### 15. Test Logout with Invalid RefreshToken Type (Should return 400)

```bash
curl -X POST http://localhost:8787/auth/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer valid-jwt-token-here" \
  -d '{"refreshToken": 12345}'
```

Expected Response:
- Status: 400
- Body: `{"error": "Validation failed", "message": "refreshToken must be a string"}`

### 16. Test Valid Registration (Should return 201)

```bash
curl -X POST http://localhost:8787/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@test.com", "password": "Test1234"}'
```

Expected Response:
- Status: 201
- Body: Contains user object, accessToken, and refreshToken

### 17. Test Email Normalization (Should work with uppercase)

```bash
curl -X POST http://localhost:8787/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "UPPERCASE@TEST.COM", "password": "Test1234"}'
```

Expected Response:
- Status: 201
- Email should be stored as lowercase: "uppercase@test.com"

## Validation Features Implemented

1. **Content-Type Validation**: All auth endpoints require `application/json`
2. **Request Size Limits**: 10KB maximum payload size
3. **Type Validation**: All fields must be correct types (strings, objects, etc.)
4. **Length Limits**:
   - Email: max 255 characters
   - Password: min 8, max 128 characters
5. **Email Format**: Enhanced regex with RFC compliance
6. **Password Strength**: At least 1 letter and 1 number
7. **Unknown Field Rejection**: Only expected fields are allowed
8. **UUID Format Validation**: Refresh tokens must be valid UUIDs
9. **Email Normalization**: Emails trimmed and converted to lowercase
10. **Comprehensive Error Messages**: Clear, actionable feedback

## Security Benefits

- Prevents injection attacks via unknown fields
- Mitigates DoS attacks via length limits
- Reduces attack surface with strict type checking
- Provides clear error messages without exposing system details
- Validates data before database operations
