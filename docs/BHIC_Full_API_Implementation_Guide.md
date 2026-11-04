# BHIC Full API Implementation Guide

This document describes the currently implemented backend APIs for Flutter integration.

## 1. Backend status

Implemented modules:

- Splash/bootstrap.
- Manager OTP authentication and sessions.
- Manager profile.
- Manager subscription order, development payment verification, and subscription status.
- Groups and group rules.
- Members.
- Cycle schedule generation and cycle start.
- Cycle participants.
- Cash/offline collections and correction records.
- Winner eligibility, winner selection, and winner correction.
- Winner cash/offline settlement.
- Distribution draft, update, validation, publication, and completion.
- Manager notifications.
- Push-device registration record.
- WhatsApp message queue records.
- Audit records for important mutations.

Provider-dependent behavior:

- Local subscription payment uses a debug adapter when `PAYMENT_DEBUG_MODE=true`.
- Production Razorpay verification requires real Razorpay credentials and provider integration.
- WhatsApp endpoints create durable queued message records. A provider worker is required to send them externally.

## 2. Base URL and authentication

Development base URL:

```text
http://localhost:5000/api/v1
```

Android emulator:

```text
http://10.0.2.2:5000/api/v1
```

Protected endpoints require:

```http
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json
Accept: application/json
```

The backend accepts an optional `X-Request-Id` header. If omitted, it generates one.

## 3. Response envelope

Success:

```json
{
  "success": true,
  "data": {},
  "serverTimestamp": "2026-11-04T10:00:00.000Z",
  "requestId": "request-id"
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "amount must be a non-negative amount with up to 2 decimals"
  },
  "requestId": "request-id"
}
```

## 4. Financial values

Request amounts are sent in rupees and may contain a maximum of two decimal places:

```json
{
  "amount": 999.50
}
```

The backend stores financial values as integer paise to avoid floating-point errors. Financial values in low-level database records are therefore integer paise.

Use these rules in Flutter:

- Send JSON amounts as numbers, not formatted currency strings.
- Never calculate authoritative totals in Flutter.
- Display values using the currency formatting layer only.
- Treat backend validation errors as authoritative.

## 5. Endpoint index

| Method | Endpoint | Auth |
|---|---|---|
| GET | `/app/bootstrap` | Public |
| POST | `/auth/login/request-otp` | Public |
| POST | `/auth/login/verify-otp` | Public |
| POST | `/auth/refresh` | Refresh token |
| POST | `/auth/logout` | Access token |
| GET | `/users/me` | Access token |
| PATCH | `/users/me` | Access token |
| POST | `/subscriptions/orders` | Access token |
| POST | `/subscriptions/payments/verify` | Access token |
| POST | `/subscriptions/webhooks/razorpay` | Provider/debug |
| GET | `/subscriptions/me` | Access token |
| POST | `/groups` | Access token |
| GET | `/groups` | Access token |
| GET | `/groups/{groupId}` | Access token |
| PATCH | `/groups/{groupId}` | Access token |
| GET | `/groups/{groupId}/dashboard` | Access token |
| POST | `/groups/{groupId}/close` | Access token |
| POST | `/groups/{groupId}/members` | Access token |
| POST | `/groups/{groupId}/members/{memberId}/whatsapp-information` | Access token |
| GET | `/groups/{groupId}/members` | Access token |
| GET | `/groups/{groupId}/members/{memberId}` | Access token |
| PATCH | `/groups/{groupId}/members/{memberId}` | Access token |
| POST | `/groups/{groupId}/members/{memberId}/remove` | Access token |
| GET | `/groups/{groupId}/cycles` | Access token |
| POST | `/groups/{groupId}/schedule/generate` | Access token |
| GET | `/cycles/{cycleId}` | Access token |
| POST | `/cycles/{cycleId}/start` | Access token |
| GET | `/cycles/{cycleId}/participants` | Access token |
| POST | `/cycles/{cycleId}/collections` | Access token |
| GET | `/cycles/{cycleId}/collections` | Access token |
| GET | `/cycles/{cycleId}/collections/summary` | Access token |
| POST | `/cycles/{cycleId}/collections/{collectionId}/correct` | Access token |
| GET | `/cycles/{cycleId}/winner/eligible-members` | Access token |
| POST | `/cycles/{cycleId}/winner` | Access token |
| POST | `/cycles/{cycleId}/winner/correct` | Access token |
| POST | `/cycles/{cycleId}/settlement` | Access token |
| POST | `/cycles/{cycleId}/distribution/draft` | Access token |
| GET | `/cycles/{cycleId}/distribution` | Access token |
| PATCH | `/cycles/{cycleId}/distribution` | Access token |
| POST | `/cycles/{cycleId}/distribution/validate` | Access token |
| POST | `/cycles/{cycleId}/distribution/publish` | Access token |
| POST | `/cycles/{cycleId}/complete` | Access token |
| GET | `/notifications` | Access token |
| PATCH | `/notifications/{notificationId}/read` | Access token |
| POST | `/notifications/read-all` | Access token |
| POST | `/notifications/devices` | Access token |
| POST | `/messages/whatsapp/group-information` | Access token |
| POST | `/messages/whatsapp/cycle-reminder` | Access token |
| POST | `/messages/whatsapp/cycle-completed` | Access token |

## 6. Authentication API

### GET `/app/bootstrap`

Returns backend availability and feature flags for the splash screen.

Response data:

```json
{
  "service": "bhic-backend",
  "apiVersion": "v1",
  "environment": "development",
  "authentication": {
    "managerOtp": true,
    "debugOtp": true
  },
  "serverTime": "2026-11-04T10:00:00.000Z"
}
```

### POST `/auth/login/request-otp`

Request:

```json
{
  "managerName": "Rahul Kumar",
  "mobileNumber": "+919876543210",
  "deviceId": "android-device-id"
}
```

Validation:

- `managerName`: required string, 2–100 characters.
- `mobileNumber`: required international number, such as `+919876543210`.
- `deviceId`: optional string, maximum 255 characters.

Response data:

```json
{
  "challengeId": "challenge-id",
  "expiresAt": "2026-11-04T10:05:00.000Z",
  "debugOtp": "123456"
}
```

`debugOtp` appears only in local debug mode.

For a Render development deployment, configure these environment variables:

```ini
AUTH_DEBUG_OTP=true
DEBUG_OTP=123456
```

With debug mode enabled, the request-OTP response includes `debugOtp`, and the Render logs contain:

```text
[OTP DEBUG] otp=123456
```

This is an explicit development/testing bypass. Disable `AUTH_DEBUG_OTP` before production use.

### POST `/auth/login/verify-otp`

Request:

```json
{
  "challengeId": "challenge-id",
  "otp": "123456",
  "deviceId": "android-device-id"
}
```

Validation:

- `challengeId`: required string, 10–100 characters.
- `otp`: exactly six digits.
- The challenge must be active, unexpired, and under the attempt limit.

Response data:

```json
{
  "accessToken": "access-token",
  "refreshToken": "refresh-token",
  "expiresIn": 900,
  "user": {
    "id": "user-id",
    "managerName": "Rahul Kumar",
    "mobileNumber": "+919876543210",
    "role": "MANAGER",
    "status": "ACTIVE"
  }
}
```

### POST `/auth/refresh`

Request:

```json
{
  "refreshToken": "refresh-token"
}
```

The backend rotates both tokens. Replace the stored token pair together.

### POST `/auth/logout`

Requires the access token. No body is required.

Response data:

```json
{
  "loggedOut": true
}
```

### GET `/users/me`

Returns the authenticated Manager profile.

### PATCH `/users/me`

Request example:

```json
{
  "managerName": "Rahul Kumar",
  "preferences": {
    "language": "en",
    "notificationsEnabled": true
  }
}
```

Validation:

- `managerName`: optional, 2–100 characters.
- `preferences`: optional JSON object.
- At least one field is required.
- Mobile-number changes require a separate verification flow and are not accepted here.

## 7. Subscription API

The default development plan is:

```text
planId: monthly-999
amount: INR 999.00
billing period: MONTH
```

### POST `/subscriptions/orders`

Headers:

```http
Idempotency-Key: unique-order-key
```

Request:

```json
{
  "planId": "monthly-999"
}
```

Validation:

- `planId` must refer to an active plan.
- `Idempotency-Key` is required.
- The price is loaded from the backend plan, never trusted from Flutter.

In debug payment mode, the response contains a mock provider order ID.

### POST `/subscriptions/payments/verify`

Request in debug mode:

```json
{
  "localOrderId": "order-id",
  "paymentId": "debug_payment_001",
  "signature": "debug_signature"
}
```

Successful verification activates the Manager subscription for one month.

Production mode must verify the Razorpay signature server-side before activation.

### GET `/subscriptions/me`

Returns the Manager subscription or `null` when no subscription exists.

### POST `/subscriptions/webhooks/razorpay`

The endpoint exists for provider integration. In production it must verify the Razorpay webhook signature and event ID before changing subscription state.

## 8. Group API

### POST `/groups`

Request:

```json
{
  "name": "BHIC January Group",
  "description": "Monthly BHIC group",
  "startDate": "2026-12-01",
  "startTime": "10:00",
  "timezone": "Asia/Kolkata",
  "frequency": "MONTHLY",
  "contributionAmount": 1000,
  "totalBhicAmount": 10000,
  "controlledAmount": 5000,
  "memberLimit": 10,
  "rules": {
    "defaultInterestRate": 0
  }
}
```

Validation:

- `name`: 2–150 characters.
- `description`: maximum 1000 characters.
- `startDate`: `YYYY-MM-DD`.
- `startTime`: `HH:mm`.
- `timezone`: required IANA timezone string.
- `frequency`: currently `MONTHLY` only.
- Amounts: non-negative, maximum two decimal places.
- `contributionAmount` and `totalBhicAmount` must be greater than zero.
- `controlledAmount` cannot exceed `totalBhicAmount`.
- `totalBhicAmount` must be at least `contributionAmount × memberLimit`.
- `memberLimit`: integer from 1 to 1000.
- `rules`: optional JSON object.

Behavior:

1. Creates the group for the authenticated Manager.
2. Creates rule version 1.
3. Generates one scheduled cycle for each member-limit position.
4. Writes an audit record.

### GET `/groups`

Query parameters:

```text
status=ACTIVE
search=January
page=1
limit=20
```

Default page size is 20 and maximum page size is 100.

### GET `/groups/{groupId}`

Returns the group only when it belongs to the authenticated Manager.

### PATCH `/groups/{groupId}`

Permitted fields:

```json
{
  "name": "Updated name",
  "description": "Updated description",
  "startTime": "11:00",
  "timezone": "Asia/Kolkata",
  "rules": {
    "defaultInterestRate": 2
  }
}
```

Closed groups cannot be updated. Rule changes create a new rule version.

### GET `/groups/{groupId}/dashboard`

Returns group details, active member count, current cycle, and recent Manager notifications.

### POST `/groups/{groupId}/close`

Request:

```json
{
  "reason": "All planned cycles completed"
}
```

A reason is required when unfinished cycles remain.

## 9. Member API

### POST `/groups/{groupId}/members`

Request:

```json
{
  "fullName": "Member One",
  "primaryContactNumber": "+919876543210",
  "optionalContactNumber": "+919812345678",
  "address": "Member address",
  "description": "Optional notes"
}
```

Validation:

- `fullName`: 2–150 characters.
- `primaryContactNumber`: required international number.
- `optionalContactNumber`: optional international number.
- `address`: 5–1000 characters.
- `description`: maximum 1000 characters.
- Active member count cannot exceed the group member limit.
- Duplicate active primary contacts are rejected.

The endpoint also creates a `GROUP_INFORMATION` WhatsApp queue record.

### GET `/groups/{groupId}/members`

Query parameters:

```text
status=ACTIVE
page=1
limit=50
```

Supported statuses include `ACTIVE`, `INACTIVE`, and `REMOVED`.

### GET `/groups/{groupId}/members/{memberId}`

Returns profile fields and a collection summary.

### PATCH `/groups/{groupId}/members/{memberId}`

Permitted fields:

```json
{
  "fullName": "Updated name",
  "primaryContactNumber": "+919876543210",
  "optionalContactNumber": null,
  "address": "Updated address",
  "description": "Updated notes"
}
```

### POST `/groups/{groupId}/members/{memberId}/remove`

Request:

```json
{
  "reason": "Member requested removal"
}
```

Members with financial records become `INACTIVE` rather than being physically deleted.

### POST `/groups/{groupId}/members/{memberId}/whatsapp-information`

Queues a group-information message again. No member acceptance action is included.

## 10. Cycle and schedule API

### GET `/groups/{groupId}/cycles`

Returns cycles ordered by `bhicNumber`.

### POST `/groups/{groupId}/schedule/generate`

Creates missing scheduled cycles. It never duplicates an existing group cycle number.

### POST `/cycles/{cycleId}/start`

Starts a cycle only when:

- The cycle is `SCHEDULED`.
- Server time has reached `scheduledStart`.
- The group has active members.
- The authenticated Manager owns the group.

Repeated calls after a cycle has started return the current cycle instead of creating participants again.

### GET `/cycles/{cycleId}`

Returns cycle state and financial totals.

### GET `/cycles/{cycleId}/participants`

Returns expected contribution, collected amount, outstanding amount, collection state, eligibility, and previous-winner flag for each participant.

## 11. Cash/offline collection API

### POST `/cycles/{cycleId}/collections`

Request:

```json
{
  "memberId": "member-id",
  "amount": 1000,
  "collectedAt": "2026-12-01T10:30:00.000Z",
  "method": "CASH",
  "reference": "receipt-001",
  "note": "Received in cash"
}
```

Validation:

- `memberId`: valid cycle participant.
- `amount`: positive, non-negative, maximum two decimals.
- Amount cannot exceed the participant outstanding amount.
- `method`: `CASH` or `OFFLINE`; online methods are rejected.
- `collectedAt`: valid timestamp when provided.
- `reference`: maximum 150 characters.
- `note`: maximum 1000 characters.

The participant and cycle totals are recalculated. When all contributions are collected, the cycle changes to `READY_FOR_WINNER_SELECTION`.

### GET `/cycles/{cycleId}/collections`

Returns collection records and expected, collected, and outstanding totals.

### GET `/cycles/{cycleId}/collections/summary`

Returns:

```json
{
  "expectedTotal": 10000,
  "collectedTotal": 8000,
  "outstandingTotal": 2000,
  "paidMemberCount": 8,
  "partialMemberCount": 0,
  "unpaidMemberCount": 2
}
```

### POST `/cycles/{cycleId}/collections/{collectionId}/correct`

Request:

```json
{
  "reason": "Receipt was entered against the wrong member"
}
```

A correction reason of at least five characters is required. The original collection remains stored and is marked `CORRECTED`.

## 12. Winner API

### GET `/cycles/{cycleId}/winner/eligible-members`

Returns active participants who have not won a prior cycle and are not disqualified. Flutter must use this response for the winner dropdown.

### POST `/cycles/{cycleId}/winner`

Request:

```json
{
  "winnerMemberId": "member-id",
  "winnerAmount": 9000,
  "receivedAmount": 9000,
  "note": "Winner selected"
}
```

Validation:

- Cycle must be `READY_FOR_WINNER_SELECTION`.
- Winner must be in the backend-generated eligible list.
- A cycle can have only one active winner.
- Amounts must be positive and have at most two decimals.
- `receivedAmount` cannot exceed `winnerAmount`.

The cycle changes to `SETTLEMENT_PENDING`.

### POST `/cycles/{cycleId}/winner/correct`

Request:

```json
{
  "reason": "Manager selected the wrong member"
}
```

The winner is retained as a correction record and the cycle returns to `READY_FOR_WINNER_SELECTION`.

## 13. Settlement API

### POST `/cycles/{cycleId}/settlement`

Request:

```json
{
  "expectedAmount": 9000,
  "actualAmount": 9000,
  "method": "CASH",
  "reference": "payout-001",
  "settledAt": "2026-12-01T12:00:00.000Z",
  "note": "Paid in cash"
}
```

Validation:

- Winner must already exist.
- Only one settlement is allowed per cycle.
- `expectedAmount` must match the stored winner amount interpretation.
- `actualAmount` must equal `expectedAmount`.
- `method` must be `CASH` or `OFFLINE`.

The cycle changes to `SETTLED`.

## 14. Distribution API

### POST `/cycles/{cycleId}/distribution/draft`

Requires a settled cycle. Creates distribution items for eligible non-winner members.

The default source amount is the group controlled amount. The default interest rate is `rules.defaultInterestRate`, or zero when omitted.

### GET `/cycles/{cycleId}/distribution`

Returns the draft and distribution items.

### PATCH `/cycles/{cycleId}/distribution`

Request:

```json
{
  "sourceAmount": 5000,
  "interestRate": 2
}
```

Validation:

- Distribution must still be `DRAFT`.
- `sourceAmount` must be non-negative with at most two decimals.
- `interestRate` must be between 0 and 100.
- All item values are recalculated by the backend.

### POST `/cycles/{cycleId}/distribution/validate`

Returns `valid`, source total, calculated total, and validation errors.

### POST `/cycles/{cycleId}/distribution/publish`

Recalculates and validates one final time, locks the distribution, creates a Manager notification, and changes the cycle to `DISTRIBUTION_PUBLISHED`.

Repeated publish calls return the existing published distribution.

## 15. Complete cycle

### POST `/cycles/{cycleId}/complete`

The cycle must have:

- Completed collections.
- A winner.
- A settled winner payout.
- A published distribution.

On success:

- Cycle becomes `COMPLETED`.
- Winner member becomes `ALLOCATED`.
- Completion notification is created.
- Audit record is created.

## 16. Notification API

### GET `/notifications`

Query parameters:

```text
page=1
limit=20
```

### PATCH `/notifications/{notificationId}/read`

Marks one notification read.

### POST `/notifications/read-all`

Marks all unread Manager notifications read.

### POST `/notifications/devices`

Request:

```json
{
  "pushProvider": "FCM",
  "token": "device-push-token",
  "platform": "android",
  "appVersion": "1.0.0"
}
```

Required fields: `pushProvider`, `token`, and `platform`.

## 17. WhatsApp queue API

These endpoints create durable queue records. They do not send an external WhatsApp message until a provider worker is configured.

### POST `/messages/whatsapp/group-information`

Request:

```json
{
  "groupId": "group-id",
  "memberId": "member-id",
  "recipientNumber": "+919876543210",
  "templateId": "group-information",
  "content": {
    "groupName": "BHIC January Group"
  }
}
```

Required fields: `groupId`, `memberId`, and a valid `recipientNumber`.

The same structure is used for:

- `POST /messages/whatsapp/cycle-reminder`
- `POST /messages/whatsapp/cycle-completed`

The backend records message type, recipient, template, queue time, status, attempts, and content.

## 18. Cycle state machine

```text
SCHEDULED
    -> COLLECTING_CONTRIBUTIONS
    -> READY_FOR_WINNER_SELECTION
    -> SETTLEMENT_PENDING
    -> SETTLED
    -> DISTRIBUTION_DRAFT
    -> DISTRIBUTION_PUBLISHED
    -> COMPLETED
```

Invalid transitions return:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_STATE",
    "message": "..."
  }
}
```

## 19. Flutter integration order

Implement the Flutter screens in this order:

1. Splash: call `/app/bootstrap`.
2. Login: call `/auth/login/request-otp`.
3. OTP screen: call `/auth/login/verify-otp`.
4. Securely store both tokens.
5. Load Manager profile with `/users/me`.
6. Create and list groups.
7. Add and list members.
8. Display scheduled cycles.
9. Record cash collections.
10. Load eligible winners.
11. Save winner and settlement.
12. Create, validate, and publish distribution.
13. Complete the cycle.
14. Display notifications and message queue status.

## 20. Local test sequence

Start the backend:

```powershell
npm run server
```

Request OTP:

```http
POST http://localhost:5000/api/v1/auth/login/request-otp
```

```json
{
  "managerName": "Rahul Kumar",
  "mobileNumber": "+919876543210",
  "deviceId": "postman-dev"
}
```

Verify using debug OTP `123456`, then use the returned access token for all protected requests.

## 21. Production checklist

- Disable `AUTH_DEBUG_OTP`.
- Remove `DEBUG_OTP`.
- Configure a real OTP provider.
- Configure Razorpay and verify signatures server-side.
- Configure a WhatsApp Business provider and worker.
- Add HTTPS.
- Restrict CORS.
- Use a secrets manager.
- Add automated integration tests for every state transition.
- Add MongoDB transactions for multi-record financial mutations in production.
- Add rate limiting to OTP, member creation, resend, and mutation endpoints.
- Add idempotency persistence for every financial mutation.
