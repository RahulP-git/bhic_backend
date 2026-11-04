# BHIC Flutter Authentication API Integration

This document describes how the Flutter application integrates with the currently implemented BHIC backend authentication APIs.

## 1. Scope

This document covers:

- Splash/bootstrap configuration.
- Manager mobile-number login.
- Debug OTP verification for local development.
- Access and refresh tokens.
- Logout.
- Manager profile loading and updating.
- Request validation and error handling.

The current product has one operational role: `MANAGER`.

## 2. Base URL

### Local development

When Flutter runs on an Android emulator, use:

```text
http://10.0.2.2:5000/api/v1
```

When Flutter runs on an iOS simulator or desktop, use:

```text
http://localhost:5000/api/v1
```

When Flutter runs on a physical phone, use the computer's local network IP address:

```text
http://YOUR_COMPUTER_IP:5000/api/v1
```

The backend must listen on an address accessible to the device, and the computer firewall must allow port `5000`.

Example:

```dart
const baseUrl = 'http://10.0.2.2:5000/api/v1';
```

Do not hard-code a production URL in source code. Use a development, staging, and production configuration.

## 3. Common headers

Every JSON request should send:

```http
Content-Type: application/json
Accept: application/json
```

Protected requests must also send:

```http
Authorization: Bearer ACCESS_TOKEN
```

The frontend may send a request ID:

```http
X-Request-Id: unique-client-request-id
```

If it is not sent, the backend creates one and returns it in the response header and response body.

## 4. Common response format

### Successful response

```json
{
  "success": true,
  "data": {},
  "serverTimestamp": "2026-11-04T10:00:00.000Z",
  "requestId": "a-request-id"
}
```

### Error response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "managerName must contain between 2 and 100 characters",
    "details": {
      "field": "managerName"
    }
  },
  "requestId": "a-request-id"
}
```

The Flutter app should display `error.message` to the user only when it is safe and useful. Use `error.code` for application behavior.

## 5. API list

| Method | Endpoint | Authentication |
|---|---|---|
| GET | `/app/bootstrap` | Public |
| POST | `/auth/login/request-otp` | Public |
| POST | `/auth/login/verify-otp` | Public |
| POST | `/auth/refresh` | Public, refresh token required |
| POST | `/auth/logout` | Access token required |
| GET | `/users/me` | Access token required |
| PATCH | `/users/me` | Access token required |

## 6. Splash screen bootstrap

### Request

```http
GET /api/v1/app/bootstrap
```

No body or authentication is required.

### Successful response

```json
{
  "success": true,
  "data": {
    "service": "bhic-backend",
    "apiVersion": "v1",
    "environment": "development",
    "authentication": {
      "managerOtp": true,
      "debugOtp": true
    },
    "serverTime": "2026-11-04T10:00:00.000Z"
  },
  "serverTimestamp": "2026-11-04T10:00:00.000Z",
  "requestId": "a-request-id"
}
```

### Flutter behavior

The splash screen should:

1. Call this endpoint.
2. Confirm the backend is reachable.
3. Read whether Manager OTP login is available.
4. Check locally stored session tokens.
5. Navigate to the home screen when the access token is valid.
6. Navigate to the login screen when there is no valid session.

The `debugOtp` flag is for local development only. It must not be used to bypass production authentication.

## 7. Request login OTP

### Request

```http
POST /api/v1/auth/login/request-otp
```

Body:

```json
{
  "managerName": "Rahul Kumar",
  "mobileNumber": "+919876543210",
  "deviceId": "android-device-id"
}
```

`deviceId` is optional but recommended.

### Successful response

HTTP status: `201 Created`

```json
{
  "success": true,
  "data": {
    "challengeId": "2b7c8d2a-3b9c-4e2d-9f01-123456789abc",
    "expiresAt": "2026-11-04T10:05:00.000Z",
    "debugOtp": "123456"
  },
  "serverTimestamp": "2026-11-04T10:00:00.000Z",
  "requestId": "a-request-id"
}
```

`debugOtp` is returned only when debug OTP mode is enabled in a non-production environment. In a real provider flow, the OTP will not be returned in the response.

### Validation

| Field | Required | Rules |
|---|---:|---|
| `managerName` | Yes | String, trimmed, 2–100 characters. |
| `mobileNumber` | Yes | International format, for example `+919876543210`. Spaces, brackets, and hyphens are normalized. |
| `deviceId` | No | String, 1–255 characters when present. |

### Flutter state after success

Store only the `challengeId` and expiration time temporarily. Do not store the OTP as a permanent credential.

Navigate to the OTP verification screen and pass:

```dart
OtpArguments(
  challengeId: data['challengeId'],
  mobileNumber: mobileNumber,
  deviceId: deviceId,
)
```

## 8. Verify OTP

### Request

```http
POST /api/v1/auth/login/verify-otp
```

Body:

```json
{
  "challengeId": "2b7c8d2a-3b9c-4e2d-9f01-123456789abc",
  "otp": "123456",
  "deviceId": "android-device-id"
}
```

### Successful response

```json
{
  "success": true,
  "data": {
    "accessToken": "access-token-value",
    "refreshToken": "refresh-token-value",
    "expiresIn": 900,
    "user": {
      "id": "665abc123456789012345678",
      "managerName": "Rahul Kumar",
      "mobileNumber": "+919876543210",
      "role": "MANAGER",
      "status": "ACTIVE"
    }
  },
  "serverTimestamp": "2026-11-04T10:01:00.000Z",
  "requestId": "a-request-id"
}
```

### Validation

| Field | Required | Rules |
|---|---:|---|
| `challengeId` | Yes | String, 10–100 characters. Must be an active challenge. |
| `otp` | Yes | Exactly 6 digits. |
| `deviceId` | No | String, 1–255 characters when present. |

### Verification rules

- The challenge must exist.
- The challenge must not be expired.
- The challenge must not already be used.
- The OTP has a maximum number of attempts.
- A successful verification creates or updates the Manager user.
- A successful verification creates access and refresh sessions.
- A login audit record is written.

### Local debug OTP

When local debug mode is enabled, use:

```text
123456
```

The Flutter app should still use the OTP field exactly as it will in production.

## 9. Refresh session

### Request

```http
POST /api/v1/auth/refresh
```

Body:

```json
{
  "refreshToken": "refresh-token-value"
}
```

### Successful response

```json
{
  "success": true,
  "data": {
    "accessToken": "new-access-token-value",
    "refreshToken": "new-refresh-token-value",
    "expiresIn": 900,
    "requestId": "a-request-id"
  },
  "serverTimestamp": "2026-11-04T10:10:00.000Z",
  "requestId": "a-request-id"
}
```

The backend rotates both tokens. Replace the stored access and refresh tokens together.

### Refresh behavior

1. If an API request returns `401 AUTH_EXPIRED`, call refresh once.
2. Store the new token pair.
3. Retry the original request once.
4. If refresh fails, clear local tokens and navigate to login.
5. Do not retry indefinitely.

## 10. Logout

### Request

```http
POST /api/v1/auth/logout
Authorization: Bearer ACCESS_TOKEN
```

No body is required.

### Successful response

```json
{
  "success": true,
  "data": {
    "loggedOut": true
  },
  "serverTimestamp": "2026-11-04T10:15:00.000Z",
  "requestId": "a-request-id"
}
```

The Flutter app must clear both access and refresh tokens after a successful logout. It should also clear them when the server returns an expired or invalid session error.

## 11. Current Manager profile

### Request

```http
GET /api/v1/users/me
Authorization: Bearer ACCESS_TOKEN
```

### Successful response

```json
{
  "success": true,
  "data": {
    "id": "665abc123456789012345678",
    "managerName": "Rahul Kumar",
    "mobileNumber": "+919876543210",
    "mobileVerifiedAt": "2026-11-04T10:01:00.000Z",
    "role": "MANAGER",
    "status": "ACTIVE",
    "preferences": {},
    "createdAt": "2026-11-04T10:01:00.000Z"
  },
  "serverTimestamp": "2026-11-04T10:02:00.000Z",
  "requestId": "a-request-id"
}
```

## 12. Update Manager profile

### Request

```http
PATCH /api/v1/users/me
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json
```

Body example:

```json
{
  "managerName": "Rahul Kumar",
  "preferences": {
    "language": "en",
    "notificationsEnabled": true
  }
}
```

### Successful response

```json
{
  "success": true,
  "data": {
    "id": "665abc123456789012345678",
    "managerName": "Rahul Kumar",
    "mobileNumber": "+919876543210",
    "role": "MANAGER",
    "status": "ACTIVE",
    "preferences": {
      "language": "en",
      "notificationsEnabled": true
    },
    "updatedAt": "2026-11-04T10:20:00.000Z"
  },
  "serverTimestamp": "2026-11-04T10:20:00.000Z",
  "requestId": "a-request-id"
}
```

### Validation

At least one permitted field must be included.

| Field | Rules |
|---|---|
| `managerName` | String, trimmed, 2–100 characters. |
| `preferences` | JSON object, not an array or string. |

Mobile-number changes are not supported through this endpoint because changing a verified mobile number requires a new OTP verification flow.

## 13. Flutter data models

The following models are illustrative. Keep them in a frontend API layer, for example:

```text
lib/core/network/
lib/features/auth/data/
lib/features/auth/domain/
```

Example token model:

```dart
class AuthSession {
  final String accessToken;
  final String refreshToken;
  final int expiresIn;
  final ManagerProfile user;

  AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
    required this.user,
  });

  factory AuthSession.fromJson(Map<String, dynamic> json) {
    return AuthSession(
      accessToken: json['accessToken'] as String,
      refreshToken: json['refreshToken'] as String,
      expiresIn: json['expiresIn'] as int,
      user: ManagerProfile.fromJson(json['user'] as Map<String, dynamic>),
    );
  }
}
```

Example profile model:

```dart
class ManagerProfile {
  final String id;
  final String managerName;
  final String mobileNumber;
  final String role;
  final String status;

  ManagerProfile({
    required this.id,
    required this.managerName,
    required this.mobileNumber,
    required this.role,
    required this.status,
  });

  factory ManagerProfile.fromJson(Map<String, dynamic> json) {
    return ManagerProfile(
      id: json['id'] as String,
      managerName: json['managerName'] as String,
      mobileNumber: json['mobileNumber'] as String,
      role: json['role'] as String,
      status: json['status'] as String,
    );
  }
}
```

## 14. Recommended Flutter authentication workflow

```text
Splash screen
    |
    | GET /app/bootstrap
    v
Check locally stored tokens
    |
    | access token exists
    v
GET /users/me
    |
    | success ----------------------> Home screen
    |
    | AUTH_EXPIRED
    v
POST /auth/refresh
    |
    | success ----------------------> Retry /users/me
    |
    | failure ----------------------> Login screen

Login screen
    |
    | POST /auth/login/request-otp
    v
OTP screen
    |
    | POST /auth/login/verify-otp
    v
Store accessToken + refreshToken
    |
    v
Home screen
```

## 15. Secure token storage

Use `flutter_secure_storage` for access and refresh tokens.

Do not store tokens in:

- Plain `SharedPreferences`.
- Logs.
- Screen state that is persisted without encryption.
- URL query parameters.

Recommended keys:

```text
bhic_access_token
bhic_refresh_token
bhic_manager_id
```

## 16. HTTP client interceptor behavior

The HTTP client should:

1. Add the access token to protected requests.
2. Add `Content-Type` and `Accept` headers.
3. Convert the response envelope into typed data.
4. On `401 AUTH_EXPIRED`, refresh once.
5. Retry the original request once after refresh.
6. Clear the session when refresh fails.
7. Never retry validation, forbidden, or not-found errors.

## 17. Error handling table

| HTTP status | Error code | Flutter behavior |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | Show field or form validation message. |
| 401 | `AUTH_REQUIRED` | Login or show invalid OTP message. |
| 401 | `AUTH_EXPIRED` | Refresh once, then login if refresh fails. |
| 403 | `FORBIDDEN` | Show access denied and stop the action. |
| 404 | `NOT_FOUND` | Show that the requested item was not found. |
| 429 | `RATE_LIMITED` | Show retry-later message and disable repeated attempts. |
| 500 | `INTERNAL_ERROR` | Show generic server error and preserve request ID for support. |
| 501 | `PROVIDER_ERROR` | Show that the service is temporarily unavailable. |

## 18. Local API test sequence

### 1. Bootstrap

```text
GET http://localhost:5000/api/v1/app/bootstrap
```

### 2. Request OTP

```text
POST http://localhost:5000/api/v1/auth/login/request-otp
```

```json
{
  "managerName": "Rahul Kumar",
  "mobileNumber": "+919876543210",
  "deviceId": "postman-dev"
}
```

### 3. Verify OTP

Use the returned `challengeId` and OTP `123456`:

```text
POST http://localhost:5000/api/v1/auth/login/verify-otp
```

```json
{
  "challengeId": "RETURNED_CHALLENGE_ID",
  "otp": "123456",
  "deviceId": "postman-dev"
}
```

### 4. Load profile

```text
GET http://localhost:5000/api/v1/users/me
Authorization: Bearer RETURNED_ACCESS_TOKEN
```

## 19. Production restrictions

Before production:

- Set `AUTH_DEBUG_OTP=false` or remove it.
- Remove `DEBUG_OTP` from production environment variables.
- Integrate a real OTP provider.
- Use HTTPS.
- Use a production MongoDB database and secret manager.
- Restrict CORS origins.
- Do not log OTP values.
- Do not expose database credentials to Flutter.

The Flutter app must never connect directly to MongoDB. It must communicate only with the backend API.
