# BHIC Backend API and Database Specification

## 1. Document purpose

This document converts the BHIC product workflow into a backend implementation specification. It defines the API modules, request fields, response expectations, database collections, authorization model, scheduling behavior, cash collection flow, WhatsApp notifications, and acceptance tests.

The backend is responsible for the authoritative state of the application. Flutter is a client of this backend and must not be trusted with final financial calculations, permissions, cycle transitions, or winner eligibility.

## 2. Recommended architecture

### Primary components

| Component | Responsibility |
|---|---|
| Flutter application | Screens, input validation, navigation, display, and user actions. |
| Backend API | Authentication, authorization, business rules, calculations, state transitions, and persistence. |
| MongoDB Atlas | Users, groups, members, cycles, cash collections, winners, distributions, notifications, messages, and audit records. |
| Scheduler/worker | Cycle generation, start-time processing, reminders, retries, and message delivery jobs. |
| WhatsApp Business provider | Sends group details, reminders, completion messages, and distribution information. |
| Push provider | Sends in-app push notifications, preferably Firebase Cloud Messaging. |
| Object storage | Optional storage for receipts, documents, or exported reports. |

### Source of truth

MongoDB is the source of truth for:

- Manager identity and permissions.
- Groups and group rules.
- Members and contact numbers.
- BHIC cycles and cycle numbers.
- Contributions and cash collections.
- Winner selection.
- Winner payout settlement.
- Interest and distribution calculations.
- Ledger entries.
- Message and notification delivery records.
- Audit history.

The client may display calculated previews, but all important values must be recalculated and validated by the backend before saving.

## 3. User and permission model

### 3.1 BHIC Manager

The logged-in BHIC Manager is the only operational user in the current product scope. The Manager can:

- Create and update groups.
- Add members.
- Send group details through WhatsApp.
- Start a BHIC cycle when allowed by the schedule.
- Record cash/offline collections.
- Select the winner.
- Enter winner amount and received amount.
- Record winner cash payout.
- Configure distribution amount and interest rate.
- Publish distribution.
- View history, reports, notifications, and audit records.

### 3.2 Members

Members are recipients of group information and notifications. They do not control the BHIC workflow in the current scope.

Members do not:

- Create groups.
- Accept an app invitation.
- Start a cycle.
- Record collections.
- Select a winner.
- Edit distribution values.
- Publish a result.

Members receive:

- Group details through WhatsApp.
- BHIC date and time reminders.
- Contribution reminders.
- Winner and distribution information.
- Completion messages.
- Optional in-app notifications if member login is introduced later.

### 3.3 System worker

The worker is not a human user. It may:

- Generate scheduled cycles.
- Open cycles at the configured time.
- Create reminders.
- Queue WhatsApp messages.
- Process delivery retries.
- Create system notifications.

The worker must not bypass business validation or change financial values without an auditable service action.

### 3.4 Authorization rules

Every protected request must validate:

1. Access token.
2. User account status.
3. Required role.
4. Group ownership or Manager access.
5. Resource ownership where applicable.
6. Current resource state.

Never rely only on a hidden or disabled Flutter button for authorization.

## 4. API conventions

### Base URL

Use an environment-specific base URL with the version prefix:

- Development: configured development host.
- Staging: configured staging host.
- Production: configured production host.
- API prefix: `/api/v1`.

### Headers

Authenticated requests require:

- Bearer access token.
- Request ID or idempotency key for mutations.
- Content type for request bodies.
- Optional client version and device metadata.

### Success response behavior

Every successful response should include:

- Success indicator.
- Response data.
- Server timestamp.
- Request ID.

List responses should additionally include:

- Items.
- Total count when available.
- Page number or cursor.
- Page size.
- Next-page indicator or cursor.

### Error response behavior

Every error should include:

- Stable error code.
- Human-readable message.
- Request ID.
- Optional field-level validation errors.
- Retryable indicator.

Suggested error categories:

| Error code | Meaning |
|---|---|
| AUTH_REQUIRED | Access token missing or invalid. |
| AUTH_EXPIRED | Access token expired. |
| FORBIDDEN | User lacks permission. |
| NOT_FOUND | Resource does not exist or is not visible. |
| VALIDATION_ERROR | Request fields are invalid. |
| INVALID_STATE | Operation is not allowed for the current state. |
| DUPLICATE_REQUEST | Idempotency key was already processed. |
| CONFLICT | Resource changed or duplicate business record exists. |
| RATE_LIMITED | Too many requests. |
| PROVIDER_ERROR | WhatsApp or notification provider failed. |
| INTERNAL_ERROR | Unexpected server failure. |

### Pagination

Use cursor pagination for messages, notifications, audit logs, and large member lists. Use page pagination for small administrative lists if preferred. Every list endpoint must define its default and maximum page size.

### Date and time

- Store timestamps in UTC.
- Store the group timezone separately.
- Return ISO 8601 timestamps.
- Calculate cycle schedules in the group timezone.
- Display dates and times in the group timezone in WhatsApp and Flutter.

## 5. Authentication API

### Request Manager login OTP

Endpoint: `POST /api/v1/auth/login/request-otp`

Purpose:

- Receive the Manager name and mobile number.
- Create a short-lived OTP challenge.
- Send the OTP through the configured provider.

Required fields:

| Field | Type | Rules |
|---|---|---|
| managerName | text | Required, trimmed, minimum and maximum length configured by backend. |
| mobileNumber | text | Required, normalized to international format. |
| deviceId | text | Recommended for session tracking. |

Backend behavior:

- Normalize the mobile number.
- Rate-limit requests per mobile number, IP, and device.
- Store only a hashed OTP.
- Store the submitted Manager name with the challenge.
- Do not reveal whether a user already exists.
- Set challenge expiry.

### Verify Manager OTP

Endpoint: `POST /api/v1/auth/login/verify-otp`

Required fields:

| Field | Type | Rules |
|---|---|---|
| challengeId | identifier | Required. |
| otp | text | Required, fixed length, limited attempts. |
| deviceId | text | Recommended. |

Backend behavior:

- Validate challenge, expiry, attempt count, and OTP hash.
- Create or update the Manager profile using the name captured during login.
- Issue access and refresh tokens.
- Record the login audit event.
- Return Manager profile and session metadata.

The Manager name submitted at login is the authoritative profile name unless later changed through Settings.

### Refresh session

Endpoint: `POST /api/v1/auth/refresh`

The backend rotates refresh tokens and revokes the previous token where supported.

### Logout

Endpoint: `POST /api/v1/auth/logout`

Revokes the current session or device session.

### Current Manager profile

Endpoint: `GET /api/v1/users/me`

Returns Manager name, verified mobile number, role, profile status, preferences, and created date.

### Update Manager profile

Endpoint: `PATCH /api/v1/users/me`

Allows the Manager to update permitted profile fields. Historical audit records must retain the original Manager name used at the time of an action.

## 6. Manager subscription API

The application subscription is separate from BHIC member contributions. The first release uses Razorpay for the Manager's application subscription, while all BHIC member collections and winner payouts remain Cash/Offline.

### Subscription business flow

Current frontend route: `/subscription`.

Current navigation sequence:

1. Manager enters name and mobile number.
2. Manager verifies OTP.
3. Manager completes email and address steps.
4. Application opens the Subscription screen before profile setup and terms completion.
5. Subscription screen shows a monthly amount of ₹999.
6. Manager taps Pay ₹999 via Razorpay.
7. Razorpay Checkout opens only when a valid test or live public key is configured.
8. Frontend receives success, failure, or external-wallet callback.
9. After the current frontend success callback, the app navigates to Add Member.

For production, Add Member access must be granted only after the backend verifies the Razorpay payment. A Flutter success callback is not proof of payment.

### Create subscription order

Endpoint: `POST /api/v1/subscriptions/orders`

Authorization: authenticated Manager.

Request fields:

| Field | Type | Rules |
|---|---|---|
| planId | identifier | Required. Current plan represents ₹999 monthly access. |
| currency | text | INR in the current release. |
| deviceId | text | Recommended for payment and session audit. |
| idempotencyKey | text | Required to prevent duplicate orders. |

Backend behavior:

- Load the plan price from the backend, never from the Flutter request.
- Create a Razorpay order using the backend secret key.
- Store the local subscription order and provider order ID.
- Return only public checkout data required by Flutter.
- Never return or expose the Razorpay secret key.

### Verify subscription payment

Endpoint: `POST /api/v1/subscriptions/payments/verify`

Request fields:

- Local subscription order ID.
- Razorpay order ID.
- Razorpay payment ID.
- Razorpay signature.
- Idempotency key.

Backend behavior:

1. Confirm the local order belongs to the authenticated Manager.
2. Verify the Razorpay signature with the secret key.
3. Confirm amount and currency match the backend order.
4. Store the provider payment record.
5. Activate or extend the Manager subscription.
6. Write an audit record.
7. Return subscription status and access expiry.

The same payment must never activate the subscription twice.

### Razorpay webhook

Endpoint: `POST /api/v1/subscriptions/webhooks/razorpay`

The webhook must verify its signature, be idempotent by provider event ID, update payment status, apply activation or expiry changes, and preserve the provider event for diagnostics.

### Load current subscription

Endpoint: `GET /api/v1/subscriptions/me`

Returns plan name, amount, currency, status, start date, expiry date, last payment ID, and Manager entitlements.

Suggested statuses are Pending, Active, Failed, Expired, Cancelled, and Refunded.

### Subscription failure behavior

When Razorpay fails, do not activate paid access. Keep the local order failed or pending, return a safe message, preserve the provider error code for support, and allow the Manager to retry with a new idempotency key.

### Subscription access gate

If the product requires an active subscription before group creation or member management, the backend must enforce that rule. Flutter navigation alone must not provide paid access.

The subscription payment must never be stored as a BHIC member contribution. These are separate domains and separate collections.

## 7. Group API

### Create BHIC group

Endpoint: `POST /api/v1/groups`

Required fields:

| Field | Type | Description |
|---|---|---|
| name | text | BHIC group name. |
| description | text | Optional group description. |
| startDate | date | First BHIC cycle date. |
| startTime | time | First BHIC cycle time. |
| timezone | text | IANA timezone, for example Asia/Kolkata. |
| frequency | enum | Monthly in the current workflow. |
| contributionAmount | money | Amount expected from each member per cycle. |
| totalBhicAmount | money | Target amount for the BHIC. |
| controlledAmount | money | Controlled amount defined by the group rules. |
| memberLimit | integer | Maximum or expected members. |
| rules | object | Versioned BHIC calculation and operation rules. |

Backend behavior:

1. Validate all monetary values as non-negative fixed-precision values.
2. Validate that the total amount and contribution rules are internally consistent.
3. Store the first rule version.
4. Create the Manager’s group ownership record.
5. Generate the expected cycle schedule or schedule generation record.
6. Write an audit log.
7. Return the new group and setup status.

The exact formula connecting contribution amount, member count, total BHIC amount, and controlled amount must be confirmed by the product owner before production implementation. Until confirmed, the backend must reject contradictory combinations instead of silently changing values.

### List Manager groups

Endpoint: `GET /api/v1/groups`

Returns groups owned by the authenticated Manager. Supports status, search, and pagination filters.

### Load group

Endpoint: `GET /api/v1/groups/{groupId}`

Returns group configuration, Manager name, current cycle summary, schedule, and status.

### Update group

Endpoint: `PATCH /api/v1/groups/{groupId}`

Editable fields depend on the group state. Once a cycle has started, changes to financial rules or the schedule require a new rule version and an audit record.

### Group dashboard

Endpoint: `GET /api/v1/groups/{groupId}/dashboard`

Returns:

- Group details.
- Total members.
- Active members.
- Allocated members.
- Current BHIC number.
- Current cycle status.
- Total collected.
- Outstanding amount.
- Next scheduled date and time.
- Recent notifications.

### Close group

Endpoint: `POST /api/v1/groups/{groupId}/close`

Allowed only after all planned cycles are completed or the Manager records an approved closure reason.

## 8. Member API

### Add member

Endpoint: `POST /api/v1/groups/{groupId}/members`

Required fields:

| Field | Type | Rules |
|---|---|---|
| fullName | text | Required. |
| primaryContactNumber | text | Required and normalized. |
| optionalContactNumber | text | Optional and normalized when present. |
| address | text | Required according to product validation rules. |
| description | text | Optional notes. |

Backend behavior:

1. Confirm the authenticated user owns the group.
2. Validate and normalize contact numbers.
3. Prevent duplicate active membership for the same contact.
4. Create the member record.
5. Create a WhatsApp information message job.
6. Return the member and message job status.

There is no member acceptance request in the current scope.

### Member WhatsApp information message

Endpoint: `POST /api/v1/groups/{groupId}/members/{memberId}/whatsapp-information`

This endpoint may be called automatically after member creation or manually by the Manager to resend the details.

The message includes:

- Group name.
- Manager name captured at login or from the current Manager profile.
- Contribution amount.
- First BHIC date and time.
- Rules summary.

It must not include an invitation acceptance action or request for member approval.

### List group members

Endpoint: `GET /api/v1/groups/{groupId}/members`

Supports filters for Active, Allocated, Inactive, and Removed status.

### Load member details

Endpoint: `GET /api/v1/groups/{groupId}/members/{memberId}`

Returns profile, membership status, allocation status, contribution summary, cash collection summary, and cycle history.

### Update member

Endpoint: `PATCH /api/v1/groups/{groupId}/members/{memberId}`

Allows the Manager to update contact details, address, notes, and permitted status fields.

### Remove member

Endpoint: `POST /api/v1/groups/{groupId}/members/{memberId}/remove`

Removal must be blocked if the member has financial records that require retention. Use a Removed or Inactive status instead of physical deletion.

## 9. Cycle and schedule API

### List cycles

Endpoint: `GET /api/v1/groups/{groupId}/cycles`

Returns cycles ordered by sequential BHIC number.

### Load cycle

Endpoint: `GET /api/v1/cycles/{cycleId}`

Returns full cycle state, schedule, participants, collection progress, selected winner, settlement, and distribution summary according to the Manager’s permissions.

### Generate schedule

Endpoint: `POST /api/v1/groups/{groupId}/schedule/generate`

Generates No. 01, No. 02, No. 03, and later scheduled cycles using calendar-aware monthly recurrence.

Rules:

- No cycle number may be repeated within a group.
- A completed cycle is required before the next cycle can become Open, unless an approved exception exists.
- The group timezone is used to calculate the start instant.
- The backend must define behavior when the selected calendar day does not exist in a month.

### Start scheduled cycle

Endpoint: `POST /api/v1/cycles/{cycleId}/start`

Allowed when:

- Authenticated user is the group Manager.
- Cycle status is Scheduled.
- Current server time is at or after scheduled start time.
- Previous cycle is Completed or an approved exception exists.
- Group has the required member setup.

The endpoint must be idempotent. Repeated requests return the already-open cycle rather than creating a duplicate.

### Cycle participants

Endpoint: `GET /api/v1/cycles/{cycleId}/participants`

Returns each member’s expected contribution, collected amount, outstanding amount, cash status, eligibility, previous winner state, and distribution status.

## 10. Cash/offline collection API

Online payment is not part of the current BHIC member-collection release. All member collections and winner payouts are cash/offline records entered by the Manager. The separate Manager application subscription uses Razorpay.

### Record cash collection

Endpoint: `POST /api/v1/cycles/{cycleId}/collections`

Required fields:

| Field | Type | Description |
|---|---|---|
| memberId | identifier | Member who paid. |
| amount | money | Amount collected. |
| collectedAt | timestamp | Time of collection. |
| method | enum | CASH or OFFLINE. |
| reference | text | Optional receipt or manual reference. |
| note | text | Optional Manager note. |

Backend behavior:

- Confirm member belongs to the cycle.
- Reject amount greater than the allowed outstanding amount unless overpayment is explicitly supported.
- Support partial collection if group rules allow it.
- Recalculate total collected and outstanding amount.
- Create a ledger entry.
- Write an audit log.
- Prevent duplicate submission with an idempotency key.

### List cycle collections

Endpoint: `GET /api/v1/cycles/{cycleId}/collections`

Returns all collection records, totals, outstanding amounts, and receipt references.

### Correct cash collection

Endpoint: `POST /api/v1/cycles/{cycleId}/collections/{collectionId}/correct`

Corrections require a reason. The original record must remain in the audit history. Do not overwrite financial history silently.

### Collection summary

Endpoint: `GET /api/v1/cycles/{cycleId}/collections/summary`

Returns expected total, collected total, outstanding total, paid member count, partial member count, and unpaid member count.

## 11. Simple winner API

The current winner process is deliberately simple. There is no bidding flow in the active product scope.

### Load eligible winner list

Endpoint: `GET /api/v1/cycles/{cycleId}/winner/eligible-members`

The backend returns members who:

- Belong to the group.
- Are active participants in the cycle.
- Have not already won an earlier BHIC cycle in the same group.
- Are not removed or disqualified.

The frontend must populate the winner dropdown only from this response. It must not filter previous winners only in local state.

### Save winner

Endpoint: `POST /api/v1/cycles/{cycleId}/winner`

Required fields:

| Field | Type | Description |
|---|---|---|
| winnerMemberId | identifier | Selected eligible member. |
| winnerAmount | money | Winner amount entered by the Manager. |
| receivedAmount | money | Amount actually received by the winner. |
| note | text | Optional Manager note. |

Backend behavior:

1. Re-check member eligibility.
2. Confirm the member has not won a previous cycle.
3. Validate both monetary values.
4. Save a winner record.
5. Lock the winner selection.
6. Calculate remaining amount using the active rule version.
7. Move the cycle to Settlement Pending or Distribution Draft according to the configured workflow.
8. Create an audit record and notification job.

This endpoint represents the current screen flow: select winner, enter amount, enter received amount, and press Next.

### Correct winner

Endpoint: `POST /api/v1/cycles/{cycleId}/winner/correct`

Only the Manager or an elevated admin may correct a winner. A reason is mandatory. The original winner record remains in the audit history.

## 12. Winner cash settlement API

### Record winner payout

Endpoint: `POST /api/v1/cycles/{cycleId}/settlement`

Required fields:

- Winner member ID.
- Expected payout amount.
- Actual cash/offline payout amount.
- Payout date and time.
- Method: CASH or OFFLINE.
- Manual reference or receipt number.
- Optional note.

Backend behavior:

- Validate the winner belongs to the cycle.
- Validate that the settlement matches the stored winner values or requires an explicit correction reason.
- Create settlement and ledger records.
- Mark settlement as Settled after Manager submission.
- Notify members when appropriate.

## 13. Distribution API

### Create distribution draft

Endpoint: `POST /api/v1/cycles/{cycleId}/distribution/draft`

Creates a draft from the stored contribution, winner, settlement, controlled amount, and rule version.

### Load distribution draft

Endpoint: `GET /api/v1/cycles/{cycleId}/distribution`

Returns:

- Distribution amount.
- Eligible members.
- Base amount per member.
- Interest rate.
- Interest amount.
- Final total.
- Overall total.
- Rounding adjustment.
- Draft status.

### Update distribution inputs

Endpoint: `PATCH /api/v1/cycles/{cycleId}/distribution`

The Manager may update permitted amount and rate fields while the distribution is Draft. The backend recalculates every row and validates the overall total.

### Validate distribution

Endpoint: `POST /api/v1/cycles/{cycleId}/distribution/validate`

Validation must confirm:

- All members are eligible.
- The winner is not incorrectly included or excluded according to the rule.
- Rates are within the group rule limits.
- No negative value exists.
- Total rows reconcile with the distributable amount.
- Rounding adjustment is visible and accounted for.

### Publish distribution

Endpoint: `POST /api/v1/cycles/{cycleId}/distribution/publish`

Backend behavior:

1. Recalculate values one final time.
2. Validate the cycle state.
3. Lock distribution items.
4. Create ledger entries.
5. Create member notification jobs.
6. Queue WhatsApp completion/distribution messages.
7. Move cycle to Distribution Published.

Publishing must be idempotent. A second request must return the existing published distribution.

## 14. Complete cycle API

### Complete cycle

Endpoint: `POST /api/v1/cycles/{cycleId}/complete`

Allowed only when:

- Contributions are finalized.
- Winner is saved.
- Winner cash settlement is recorded.
- Distribution is published or an approved exception is documented.
- Ledger entries are balanced.
- Notification jobs are created.

The backend then:

- Marks the cycle Completed.
- Marks the winner as Allocated.
- Excludes the winner from future winner dropdowns.
- Makes the next scheduled cycle available at its configured time.
- Stores the final history snapshot.
- Sends the completion message.

## 15. Notification API

### List notifications

Endpoint: `GET /api/v1/notifications`

The Manager receives notifications for group, cycle, collection, winner, settlement, distribution, reminder, WhatsApp, and system events.

### Mark notification read

Endpoint: `PATCH /api/v1/notifications/{notificationId}/read`

### Mark all read

Endpoint: `POST /api/v1/notifications/read-all`

### Register push device

Endpoint: `POST /api/v1/notifications/devices`

Stores push provider, token, platform, app version, and last-seen timestamp.

## 16. WhatsApp message API and worker

### Queue group information message

Endpoint: `POST /api/v1/messages/whatsapp/group-information`

The worker sends the informational message to the member’s primary WhatsApp number. The message includes:

- Group name.
- Manager name from the authenticated Manager profile.
- Contribution amount.
- First BHIC date and time.
- Rules summary.

There is no acceptance link or request.

### Queue cycle reminder

Endpoint: `POST /api/v1/messages/whatsapp/cycle-reminder`

Normally called by the scheduler rather than Flutter.

The message includes:

- Member name.
- Group name.
- BHIC number.
- Date and time.
- Expected contribution amount.
- Outstanding amount when applicable.

### Queue completion message

Endpoint: `POST /api/v1/messages/whatsapp/cycle-completed`

Includes BHIC number, winner name, relevant amount summary, distribution summary, and completion date.

### Message delivery record

Every outgoing message stores:

- Recipient member ID.
- Group ID and cycle ID when applicable.
- Message type.
- Template identifier.
- Provider message ID.
- Queue time.
- Sent time.
- Delivery status.
- Failure reason.
- Attempt count.
- Last retry time.

Recommended delivery states are Queued, Sent, Delivered, Read, Failed, and Cancelled.

## 17. Scheduler requirements

The scheduler must run independently of Flutter.

### Cycle scheduler

For every active group:

1. Generate missing future cycle records.
2. Preserve sequential numbering.
3. Calculate dates in the group timezone.
4. Open the cycle at or after the configured start time.
5. Reject duplicate starts using an idempotency key.

### Reminder scheduler

Recommended reminder windows:

- Three days before cycle start.
- One day before cycle start.
- Morning of the cycle date.
- At the cycle start time when collection is still pending.

The product owner may change these windows without changing the data model.

The scheduler must record a unique reminder key per cycle, member, and reminder window so retries do not send duplicate messages.

## 18. MongoDB collections

### users

Fields:

- `_id`.
- `managerName`.
- `mobileNumber`.
- `mobileVerifiedAt`.
- `role`.
- `status`.
- `preferences`.
- `createdAt`.
- `updatedAt`.
- `lastLoginAt`.

Indexes:

- Unique normalized mobile number.
- Role and status.

### subscription_plans

Stores the Manager application subscription plans.

Fields:

- Plan ID.
- Name.
- Amount.
- Currency.
- Billing period.
- Active status.
- Entitlements.
- Created at.
- Updated at.

The current active plan is the monthly ₹999 plan shown by the Flutter Subscription screen. The backend is authoritative for the plan amount.

### subscription_orders

Stores each Manager checkout attempt.

Fields:

- Local order ID.
- Manager user ID.
- Plan ID.
- Amount.
- Currency.
- Razorpay order ID.
- Status: Created, Pending, Paid, Failed, Cancelled, or Refunded.
- Idempotency key.
- Created at.
- Updated at.

Indexes:

- Manager ID and created time.
- Razorpay order ID.
- Unique idempotency key per Manager.

### subscription_payments

Stores verified Razorpay payment results.

Fields:

- Payment ID.
- Local order ID.
- Manager user ID.
- Razorpay payment ID.
- Razorpay order ID.
- Signature verification status.
- Amount.
- Currency.
- Provider status.
- Failure code when applicable.
- Verified at.
- Created at.

Unique indexes:

- Razorpay payment ID.
- Local order ID and successful payment status.

### manager_subscriptions

Stores the Manager's current access entitlement.

Fields:

- Subscription ID.
- Manager user ID.
- Plan ID.
- Status: Active, Expired, Cancelled, or Suspended.
- Started at.
- Expires at.
- Last payment ID.
- Created at.
- Updated at.

Index:

- Manager ID and status.

### auth_challenges

Fields:

- Challenge ID.
- Mobile number hash or normalized value according to privacy policy.
- Manager name.
- OTP hash.
- Expires at.
- Attempt count.
- Consumed at.
- Created at.

Indexes:

- Mobile and created time.
- Expiry time with automatic TTL cleanup.

### sessions

Fields:

- User ID.
- Device ID.
- Refresh token hash.
- Issued at.
- Expires at.
- Revoked at.
- Last used at.

Indexes:

- User ID.
- Expiry TTL.

### groups

Fields:

- Group ID.
- Manager user ID.
- Name.
- Description.
- Status.
- Start date.
- Start time.
- Timezone.
- Frequency.
- Contribution amount.
- Total BHIC amount.
- Controlled amount.
- Member limit.
- Current cycle number.
- Active rule version ID.
- Created at.
- Updated at.
- Closed at.

Indexes:

- Manager ID and status.
- Name search as required.

### group_rule_versions

Fields:

- Rule version ID.
- Group ID.
- Version number.
- Contribution rule.
- Total amount rule.
- Controlled amount rule.
- Interest rate limits.
- Distribution rule.
- Collection completion rule.
- Effective from.
- Created by.
- Created at.

### group_members

Fields:

- Member ID.
- Group ID.
- Full name.
- Primary contact number.
- Optional contact number.
- Address.
- Description.
- Membership status.
- Allocation status.
- Won cycle IDs.
- Joined at.
- Removed at.
- Created at.
- Updated at.

Indexes:

- Group ID and membership status.
- Group ID and normalized primary contact.
- Group ID and allocation status.

### cycles

Fields:

- Cycle ID.
- Group ID.
- BHIC number.
- Scheduled start.
- Actual start.
- Status.
- Expected total.
- Total collected.
- Total outstanding.
- Winner ID.
- Winner amount.
- Received amount.
- Remaining amount.
- Active rule version ID.
- Completed at.
- Created at.
- Updated at.

Unique index:

- Group ID and BHIC number.

### cycle_participants

Fields:

- Cycle ID.
- Group member ID.
- Expected contribution.
- Collected amount.
- Outstanding amount.
- Collection status.
- Eligible for winner.
- Previous winner flag.
- Distribution status.
- Created at.
- Updated at.

Unique index:

- Cycle ID and member ID.

### cash_collections

Fields:

- Collection ID.
- Cycle ID.
- Group ID.
- Member ID.
- Amount.
- Method: CASH or OFFLINE.
- Collected at.
- Collected by Manager ID.
- Receipt/reference number.
- Note.
- Status.
- Correction reference when applicable.
- Created at.
- Updated at.

Indexes:

- Cycle ID and member ID.
- Receipt/reference number where unique within the group.

### winners

Fields:

- Winner record ID.
- Cycle ID.
- Group ID.
- Member ID.
- Winner amount.
- Received amount.
- Remaining amount.
- Eligible-member snapshot.
- Selected by Manager ID.
- Selected at.
- Status.
- Correction reason when applicable.

Unique index:

- One active winner per cycle.

### settlements

Fields:

- Settlement ID.
- Cycle ID.
- Winner record ID.
- Expected amount.
- Actual amount.
- Method: CASH or OFFLINE.
- Reference.
- Settled by Manager ID.
- Settled at.
- Status.
- Note.

### distributions

Fields:

- Distribution ID.
- Cycle ID.
- Group ID.
- Source amount.
- Status.
- Rule version ID.
- Total calculated amount.
- Rounding adjustment.
- Drafted by.
- Published by.
- Published at.
- Created at.
- Updated at.

### distribution_items

Fields:

- Distribution item ID.
- Distribution ID.
- Cycle ID.
- Member ID.
- Base amount.
- Interest rate.
- Interest amount.
- Final amount.
- Status.
- Ledger entry ID.

### ledger_entries

Fields:

- Ledger entry ID.
- Group ID.
- Cycle ID.
- Member ID when applicable.
- Entry type.
- Debit amount.
- Credit amount.
- Currency.
- Reference type.
- Reference ID.
- Created by.
- Created at.

Ledger entries should be append-only. Corrections should create compensating entries rather than overwrite old values.

### notifications

Fields:

- Notification ID.
- Recipient user ID or Manager ID.
- Group ID.
- Cycle ID.
- Type.
- Title.
- Body.
- Read at.
- Created at.

Indexes:

- Recipient and created time.
- Recipient and read state.

### whatsapp_messages

Fields:

- Message ID.
- Member ID.
- Group ID.
- Cycle ID when applicable.
- Message type.
- Template ID.
- Provider message ID.
- Recipient number.
- Status.
- Attempt count.
- Failure reason.
- Queued at.
- Sent at.
- Delivered at.
- Read at.
- Last retry at.

Indexes:

- Provider message ID.
- Recipient and created time.
- Cycle, member, message type, and reminder key.

### audit_logs

Fields:

- Audit ID.
- Actor type.
- Actor ID.
- Action.
- Entity type.
- Entity ID.
- Before summary.
- After summary.
- Reason.
- Request ID.
- Created at.

## 19. Cycle state machine

Recommended states:

1. Scheduled.
2. Open.
3. Collecting Contributions.
4. Ready for Winner Selection.
5. Winner Selected.
6. Settlement Pending.
7. Settled.
8. Distribution Draft.
9. Distribution Published.
10. Completed.
11. Cancelled.

Allowed primary transitions:

| From | To | Trigger |
|---|---|---|
| Scheduled | Open | Server time reaches schedule and Manager starts cycle. |
| Open | Collecting Contributions | Cycle participants are created. |
| Collecting Contributions | Ready for Winner Selection | Collection rule is satisfied or Manager override is audited. |
| Ready for Winner Selection | Winner Selected | Manager submits eligible winner, amount, and received amount. |
| Winner Selected | Settlement Pending | Winner record is saved. |
| Settlement Pending | Settled | Manager records cash/offline winner payout. |
| Settled | Distribution Draft | Backend creates distribution draft. |
| Distribution Draft | Distribution Published | Manager publishes validated distribution. |
| Distribution Published | Completed | Ledger, notifications, and completion checks pass. |
| Any allowed state | Cancelled | Manager or admin records a valid cancellation reason. |

Transitions must be enforced atomically so two requests cannot move the same cycle in conflicting directions.

## 20. Financial and calculation rules

### Money representation

- Never use binary floating-point for stored financial values.
- Use integer smallest units or a fixed decimal representation.
- Store currency explicitly, currently INR.
- Return formatted values only at the frontend presentation layer.

### Required validation

- Amounts cannot be negative.
- Received amount cannot be accepted without a selected winner.
- A winner cannot be selected twice for one cycle.
- A previous winner cannot appear in a later winner list.
- Distribution total must reconcile with the backend-calculated distributable amount.
- Rounding differences must be visible and stored.
- Every correction must preserve the original record.

### Business rules requiring product confirmation

The following formulas must be confirmed before production:

- How total BHIC amount is derived from member count and contribution amount.
- How controlled amount limits or adjusts the cycle.
- How winner amount and received amount derive the remaining amount.
- Whether the winner is included in or excluded from the distribution list.
- Whether interest is a percentage, fixed amount, or rule-based amount.
- Whether partial cash collections permit the cycle to proceed.
- How the final month behaves when all members have won.

The backend should store a rule version with every cycle so future rule changes do not change historical calculations.

## 21. Audit, idempotency, and reliability

### Idempotency

Require an idempotency key for:

- Group creation.
- Cycle start.
- Cash collection.
- Winner submission.
- Winner settlement.
- Distribution draft creation.
- Distribution publishing.
- Cycle completion.
- WhatsApp message creation.

The backend must return the original result for a repeated key instead of creating a duplicate record.

### Audit events

At minimum, audit:

- Manager login.
- Group creation and rule changes.
- Member creation, update, and removal.
- WhatsApp resend.
- Cycle start.
- Cash collection and correction.
- Winner selection and correction.
- Winner settlement.
- Distribution update and publish.
- Cycle completion and cancellation.
- Manager profile changes.

### Retry behavior

- Retry provider message failures with exponential backoff.
- Do not retry invalid input or permission failures.
- Use dead-letter handling for messages that exceed retry limits.
- Keep the original request ID and idempotency key across retries.

## 22. Security requirements

1. Use short-lived access tokens and revocable refresh tokens.
2. Hash OTPs and refresh tokens.
3. Rate-limit OTP, login, member creation, and WhatsApp resend actions.
4. Authorize every request by Manager identity and group ownership.
5. Do not expose other groups or members across Manager accounts.
6. Encrypt sensitive contact and address data at rest where required.
7. Never log OTPs, access tokens, or provider secrets.
8. Keep WhatsApp provider credentials in secret management.
9. Use HTTPS in every non-local environment.
10. Retain audit logs and financial records according to the business retention policy.
11. Validate all dates and amounts on the backend.
12. Add monitoring for duplicate collections, duplicate cycle starts, failed messages, and inconsistent ledger totals.

## 23. Background jobs

Required jobs:

| Job | Frequency | Responsibility |
|---|---|---|
| Cycle schedule generator | Daily or after group changes | Generate missing future cycle records. |
| Cycle opener | Every few minutes | Open cycles whose scheduled time has arrived. |
| Reminder creator | Hourly or configured interval | Create due reminders without duplicates. |
| WhatsApp dispatcher | Continuous queue worker | Send queued WhatsApp messages. |
| WhatsApp retry worker | Periodic | Retry temporary failures. |
| Notification cleanup | Daily | Apply retention policy to old transient notifications. |
| Reconciliation checker | Daily | Check collections, settlement, distributions, and ledger totals. |

## 24. Backend testing requirements

### Authentication tests

- Manager name is required.
- OTP expires correctly.
- OTP attempt limits work.
- Duplicate login requests are rate limited.
- Session refresh and logout work.

### Group tests

- Required group fields are validated.
- Contradictory amounts are rejected.
- Only the Manager can update a group.
- Rule versions are retained.

### Member tests

- Primary contact is required.
- Optional contact is accepted.
- Duplicate member records are rejected.
- WhatsApp information message contains no acceptance request.
- Manager name is included in the message.

### Schedule tests

- Monthly dates are generated correctly.
- Timezone conversion is correct.
- No duplicate BHIC numbers are created.
- Start is rejected before the scheduled time.
- Repeated start requests are idempotent.

### Collection tests

- Cash and offline methods are accepted.
- Online payment methods are rejected in the current release.
- Partial amounts follow the configured rule.
- Duplicate collection requests are idempotent.
- Corrections preserve the original record.

### Subscription tests

- Manager subscription plan amount comes from the backend.
- Razorpay order is created for the configured ₹999 plan.
- Invalid signatures do not activate access.
- Successful verification activates the Manager subscription once.
- Duplicate callbacks and webhooks are idempotent.
- Failed payments do not grant paid access.
- Expired or cancelled subscriptions are denied protected Manager actions.

### Winner tests

- Previous winners are excluded.
- Ineligible members cannot be submitted by manually changing the request.
- Winner amount and received amount are required.
- Next locks the winner selection.
- Duplicate submissions do not create multiple winners.

### Distribution tests

- Rates are within configured limits.
- Totals reconcile.
- Rounding is recorded.
- Published distribution cannot be edited directly.

### Completion tests

- Cycle cannot complete before settlement and distribution.
- Winner becomes allocated after completion.
- Next cycle remains scheduled until its configured time.
- Completion messages are queued once.

## 25. Environment configuration

The deployment must configure these values outside source code:

- MongoDB connection string.
- Database name.
- Access token secret.
- Refresh token secret.
- OTP provider credentials.
- WhatsApp provider credentials.
- WhatsApp template IDs.
- Push notification credentials.
- Scheduler configuration.
- Default timezone.
- Log level.
- Allowed client origins.

Razorpay subscription credentials must be configured securely for the Manager subscription flow. Member contribution and winner payout online-payment credentials must not be configured or used in the first release. Member online payment can be added later through a separate module without changing the cash collection records.

## 26. Implementation order

### Phase 1: Core identity and Manager control

- Manager name login.
- OTP and sessions.
- Manager profile.
- Group authorization.
- Subscription plan, Razorpay order creation, payment verification, and Manager entitlement.

### Phase 2: Group and members

- Group creation with all required fields.
- Rule versions.
- Member records with two contact numbers.
- Group details WhatsApp message.

### Phase 3: Schedule and collections

- Cycle generation.
- Exact start-time control.
- Cash/offline collections.
- Collection receipts and reconciliation.

### Phase 4: Simple winner and distribution

- Previous-winner exclusion.
- Winner dropdown.
- Winner amount and received amount.
- Cash settlement.
- Interest and distribution calculation.
- Distribution publishing.

### Phase 5: Communication and history

- Reminder worker.
- Completion and distribution messages.
- Notifications.
- Cycle history.
- Reports and audit logs.

### Phase 6: Future online member payments

- Member contribution payment orders.
- Member payment verification.
- Member payment webhooks.
- Online member receipts.

This phase must remain separate from the cash/offline first release.

## 27. Backend completion criteria

The backend is ready for frontend integration when:

- Manager name is captured during login and returned in the session.
- Manager can create a subscription order for the configured ₹999 plan.
- Verified subscription payment activates Manager access exactly once.
- Failed or invalid subscription payment does not activate access.
- Only the Manager can mutate BHIC workflow data.
- Group creation stores every required field.
- Member creation stores primary and optional contact numbers.
- WhatsApp group information is sent without an acceptance request.
- BHIC cycles are generated sequentially.
- Start BHIC is blocked before the exact schedule time.
- Cash/offline collections are recorded and reconciled.
- Previous winners are excluded from the winner dropdown by the backend.
- Winner amount and received amount are saved through one simple submission.
- Winner cash settlement is recorded.
- Distribution calculations are server-side and auditable.
- Distribution publishing is idempotent.
- Cycle completion creates the next-cycle readiness state.
- Members receive scheduled reminders and completion messages.
- Every important mutation has an audit record.
- Automated tests cover permissions, state transitions, calculations, idempotency, and message scheduling.
