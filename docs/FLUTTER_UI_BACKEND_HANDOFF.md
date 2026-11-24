# Bhishi App – Flutter UI and Backend Handoff

## Purpose

This document describes the current Flutter UI, screens, fields, buttons, routes, navigation, local behavior, and the backend data required to make the UI production-ready.

Backend developers should compare this document with the backend API specification and then add, remove, or modify backend fields and behavior accordingly.

Important:

- The current Flutter app is primarily a UI prototype.
- Several controllers still use static/sample data.
- Financial values must be calculated and validated by the backend.
- Flutter must display backend state; it must not be the source of truth for money, winner eligibility, cycle state, or permissions.
- Do not create one API endpoint per screen. Reuse business-resource endpoints and pass the required IDs.

## Product role

The current product has one operational role:

- BHIC Manager: creates groups, adds members, starts cycles, records cash collections, selects a winner, publishes distribution, and completes a cycle.

Members currently do not log in or operate the workflow. They receive group, reminder, winner, and completion information through WhatsApp. Member login can be added later.

## New Flutter UI context

The latest UI reference includes these manager-facing areas in addition to the original cycle workflow:

- Dashboard with fund summary, next Bhishi date, member summary, and winner history.
- My Groups list with multiple groups, progress, status, contribution amount, and next Bhishi date.
- Group creation, group details, member list, member details, and add member.
- Cash collection with paid/pending states.
- Winner selection, winner announcement, winner details, and distribution.
- Bhishi history and next Bhishi details.
- Notifications and notification details.
- Messages/group chat screens shown in the UI reference.
- Vyavhar/transaction-style screen shown in the UI reference.
- Profile/settings with language, notifications, help, terms, and logout.
- Cash payment-success/receipt screen with transaction ID and receipt sharing.

This section maps the new UI to the existing backend resources. It does not require new backend behavior unless a screen is explicitly marked as future scope.

## Current Flutter project structure

```text
lib/
  core/widgets/
    appbuttons.dart
    appcolors.dart
    appsurface.dart
    apptext.dart
  routes/
    app_routes.dart
    app_pages.dart
  features/
    auth/
      splash/
      language_selection/
      login/
      otp_verification/
    dashboard/
    groups/
      create_group/
      group_details/
    add_member/
    member_list/
    member_details/
    start_bhishi/
    collect_amount/
    winner_announcement/
    winner_congratulation/
    distribute_amount/
    complete_bhishi/
```

The active route imports use the direct feature folders for most modules. `create_group` and `group_details` currently remain under `features/groups/`. Backend integration should use one final canonical folder structure and one model per business resource.

## Design system used by every screen

```text
Primary green: #0E4D3A
Dark green:    #073B2C
Light green:   #1A6B4F
Gold:          #C9A227
Light gold:    #E8C86A
Cream BG:      #FFF8E7
Card BG:       #FFFDF5
Text dark:     #1A1A1A
Text grey:     #6B7280
Success:       #1E9E5A
Danger:        #D92D20
Border gold:   #D9C58A
```

Common visual rules:

- Responsive mobile-first layout.
- Screen horizontal padding: approximately 16–20px.
- Card radius: 18px.
- Button radius: 16px and height approximately 56px.
- Input radius: 14px and height approximately 56px.
- Marathi typography uses Noto Sans Devanagari through `google_fonts`.
- Backend error messages should be displayed using the same theme.

## Application startup and authentication routes

### Route list

| Route | Current screen | Required backend state |
|---|---|---|
| `/splash` | Splash images | No API required |
| `/language-selection` | Language selection | Local preference initially; backend profile preference later |
| `/login` | Manager login | Mobile number or registered email |
| `/otp-verification` | OTP verification | OTP challenge ID and selected login identifier |
| `/dashboard` | Main dashboard | Authenticated Manager, active session, group data |

### Splash screen

Current behavior:

- Shows splash images from `assets/images/`.
- Images fill the screen.
- User can swipe left/right using `PageView`.
- Next icon changes the image.
- Next on the final image navigates to language selection.

Backend requirement: none.

### Language selection

Current fields and actions:

- Marathi selected by default.
- Hindi option.
- English option.
- `पुढे जा` button.

Current navigation:

```text
/language-selection → /login
```

Backend requirement:

- Language can initially remain local.
- If language is persisted per Manager, save it in Manager preferences using the profile API.

### Login screen

Current UI fields:

- Login method selector: Mobile or Email.
- Mobile number field when Mobile is selected.
- Registered email field when Email is selected.
- `OTP पाठवा` button.
- Google login button is currently visual only.
- Terms and conditions text is visual only.

For mobile login, use:

```http
POST /api/v1/auth/login/request-otp
```

Expected request:

```json
{
  "managerName": "Manager name",
  "mobileNumber": "+919876543210",
  "deviceId": "optional-device-id"
}
```

Required backend response data:

- `challengeId`
- expiry timestamp or expiry seconds
- masked mobile number
- request ID

Current UI is missing a Manager name field. Backend and Flutter should agree whether the name is collected on this screen or in a profile step before/after OTP.

For returning-user email login, use:

```http
POST /api/v1/auth/login/email/request-otp
```

```json
{
  "email": "rahul@example.com",
  "deviceId": "optional-device-id"
}
```

The email must already belong to an active Manager account. The response contains the same `challengeId` and expiry fields as mobile login.

### OTP verification screen

Current UI:

- Six OTP boxes.
- Auto-focus moves to the next box.
- `Verify OTP` button.
- `Resend OTP in 00:30` text.
- `Change Mobile Number` action.
- Splash image used as background.

Required backend request:

```http
POST /api/v1/auth/login/verify-otp
```

```json
{
  "challengeId": "challenge-id",
  "otp": "123456",
  "deviceId": "optional-device-id"
}
```

Required response:

- Manager profile.
- Access token.
- Refresh token.
- Access expiry.
- Session metadata.
- Subscription status or entitlement status.

Current limitation: the Flutter controller currently navigates directly to dashboard after clicking verify. It must call the API first and only navigate after successful verification.

For email OTP verification, use:

```http
POST /api/v1/auth/login/email/verify-otp
```

```json
{
  "challengeId": "challenge-id",
  "otp": "123456",
  "deviceId": "optional-device-id"
}
```

After either mobile or email verification succeeds, store both returned tokens and navigate to `/dashboard`. On app launch, if the stored session is invalid or absent, navigate to `/login`. On logout, call the logout API, clear both tokens locally, and navigate to `/login`.

### Session APIs required by Flutter

```http
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/users/me
PATCH /api/v1/users/me
```

Tokens must be stored securely. Do not store access or refresh tokens in normal preferences or hardcode them in the app.

## Subscription requirement

The backend specification includes a Manager subscription flow, but the current Flutter route list does not contain a subscription screen.

Required backend APIs:

```http
POST /api/v1/subscriptions/orders
POST /api/v1/subscriptions/payments/verify
POST /api/v1/subscriptions/webhooks/razorpay
GET  /api/v1/subscriptions/me
```

Required behavior:

1. OTP verification succeeds.
2. Flutter checks subscription status.
3. If subscription is inactive, Flutter opens subscription screen.
4. Backend creates the Razorpay order using the backend price.
5. Flutter sends payment details to backend verification.
6. Backend activates access only after signature verification.
7. Group/member operations remain blocked without active entitlement.

The Manager subscription must never be stored as a BHIC member contribution.

## Main dashboard

Current dashboard UI displays:

- App title `माझी भिशी`.
- Total BHIC fund.
- Next BHIC date.
- Current/active BHIC number.
- Calendar/next date card.
- Member summary list.
- Winner history.
- Quick actions: collect amount, add member, and select/view winner.
- Member count and active-member status badges.
- Current cycle progress/status summary.
- Bottom navigation: Home, Group, Transactions, Profile.

The DashboardModel must be created from the dashboard API response. `DashboardModel.sample` must not be used for the production screen.

Required dashboard data:

```text
groupId
groupName
currentBhishiNumber
currentCycleId
currentCycleStatus
totalFund
totalCollected
totalOutstanding
paidMemberCount
pendingMemberCount
nextScheduledDateTime
memberPreview
winnerHistory
recentNotifications
```

Recommended supporting fields:

```text
totalMembers
activeMembers
allocatedMembers
contributionAmount
currentCycleNumber
currentCycleExpectedTotal
currentCycleTotalCollected
currentCycleTotalOutstanding
recentWinner
```

`memberPreview` should contain the member ID, name, initials/photo reference where available, membership status, allocation/winner status, and current-cycle collection status needed by the dashboard list.

`winnerHistory` should contain the winner member ID/name, Bhishi number, winner amount, and cycle date needed by the winner-history card.

Recommended APIs:

```http
GET /api/v1/groups
GET /api/v1/groups/{groupId}/dashboard
```

The dashboard must not calculate collection totals from UI clicks. It should render server totals.

## Group creation

Current route:

```text
/groups/create-group
```

Current UI fields:

- Group name.
- Total member count.
- Contribution amount.
- First BHIC date.
- First BHIC time.
- Bhishi type: Monthly or Weekly.
- Create group button.

Current local defaults in the prototype include a sample group name, 10 members, ₹10,000 contribution, and a sample date/time. These defaults must not be sent silently in production.

Required backend request:

```http
POST /api/v1/groups
```

Expected fields:

```json
{
  "name": "माझी भिशी ग्रुप १",
  "description": "optional",
  "startDate": "2026-01-15",
  "startTime": "10:00",
  "timezone": "Asia/Kolkata",
  "frequency": "MONTHLY",
  "contributionAmount": 10000,
  "totalBhicAmount": 100000,
  "controlledAmount": 85000,
  "memberLimit": 10,
  "rules": {}
}
```

Important missing UI/backend contract items:

- Description.
- Timezone.
- Total BHIC amount.
- Controlled amount.
- Versioned rules.
- Exact formula validating member count, contribution, total amount, and controlled amount.

Successful response must return:

- `groupId`
- group configuration
- setup status
- first cycle/schedule information

Navigation after success:

```text
/groups/create-group → /groups/details
```

The `groupId` must be passed to group details.

## Group details

Current route:

```text
/groups/details
```

Current UI displays:

- Total fund.
- Next BHIC date/day/time.
- Remaining days.
- Member list preview.
- Winner history.
- Add member action.
- Member list action.
- Start BHIC action where available.

Required APIs:

```http
GET   /api/v1/groups/{groupId}
GET   /api/v1/groups/{groupId}/details
PATCH /api/v1/groups/{groupId}
GET   /api/v1/groups/{groupId}/dashboard
POST  /api/v1/groups/{groupId}/close
```

Use `GET /api/v1/groups/{groupId}/details` when the dashboard Bhishi group card is tapped. It returns the Bhishi name/number, start date, next date-time, countdown seconds, total and contributed amounts, member counts, add-member availability, and the complete active member list. `canAddMembers` must be checked before showing the add-member action; the add-member API also enforces the same limit.

Current limitation: the group details model contains static sample members and static dates. These must be replaced with API response models.

## Add member

Current route:

```text
/groups/add-member
```

Current UI fields:

- Full name.
- Mobile number.
- Address.
- Group name display.
- Add member button.

Current UI changes already requested:

- Photo section title changed to `माझी भिशी`.
- Group selection dropdown removed.
- WhatsApp invitation toggle/section removed visually.
- Aadhaar-like field removed.
- Explicit invitation preference removed.
- Member is added only to the existing group identified by `groupId`.

Required backend request:

```http
POST /api/v1/groups/{groupId}/members
```

Expected fields:

```json
{
  "fullName": "Rajesh Patil",
  "primaryContactNumber": "+919876543210",
  "optionalContactNumber": null,
  "address": "Pune",
  "description": "optional notes"
}
```

Backend behavior:

- Validate and normalize contact numbers.
- Reject duplicate active membership.
- Confirm Manager owns the group.
- Create WhatsApp information message job automatically.
- Return member data and message job status.

The backend request must not require an Aadhaar-like field, group-selection field, or invitation-preference field. WhatsApp group-information sending remains a backend message job and is not a member acceptance workflow.

## Member list

Current route:

```text
/groups/members
```

Current UI:

- Group/member list title.
- Search field.
- Member initials/avatar.
- Name.
- Mobile number.
- Admin/winner badges.
- Active status.
- Click member to open member details.
- `नवीन सदस्य जोडा` button.
- `भिशी चालू करा` button.

Required APIs:

```http
GET  /api/v1/groups/{groupId}/members
POST /api/v1/groups/{groupId}/members/{memberId}/remove
```

Recommended query parameters:

```text
status=ACTIVE|ALLOCATED|INACTIVE|REMOVED
search=...
cursor=...
limit=...
```

Each member row should have:

- `memberId`
- `fullName`
- initials or photo URL
- primary contact
- membership status
- allocation status
- winner badge where applicable
- collection status for the current cycle where applicable

Navigation:

```text
member click → /groups/member-details with groupId and memberId
add member → /groups/add-member with groupId
start bhishi → cycle start flow with groupId/cycleId
```

## Member details

Current route:

```text
/groups/member-details
```

Current UI displays:

- Member profile card.
- Name.
- Mobile number.
- Location/address.
- Collected amount.
- Received amount.
- Winner/history cards.
- Call button.

Required API:

```http
GET /api/v1/groups/{groupId}/members/{memberId}
PATCH /api/v1/groups/{groupId}/members/{memberId}
```

Expected response sections:

- Profile.
- Membership status.
- Allocation status.
- Contribution summary.
- Cash collection summary.
- Cycle history.
- Winner history.

The call button can use the normalized primary contact from the API. It should not depend on a hardcoded phone number.

## Cycle and schedule flow

Required APIs:

```http
GET  /api/v1/groups/{groupId}/cycles
GET  /api/v1/cycles/{cycleId}
POST /api/v1/groups/{groupId}/schedule/generate
POST /api/v1/cycles/{cycleId}/start
GET  /api/v1/cycles/{cycleId}/participants
```

Required cycle fields:

```text
cycleId
groupId
bhishiNumber
scheduledStart
actualStart
status
expectedTotal
totalCollected
totalOutstanding
winnerId
winnerAmount
receivedAmount
remainingAmount
activeRuleVersionId
completedAt
```

Recommended status values:

```text
SCHEDULED
OPEN
COLLECTING_CONTRIBUTIONS
READY_FOR_WINNER_SELECTION
WINNER_SELECTED
DISTRIBUTION_DRAFT
DISTRIBUTION_PUBLISHED
COMPLETED
CANCELLED
```

The Flutter button must not assume that a cycle can start. Backend must validate schedule time, previous cycle state, member setup, ownership, and idempotency.

## Start Bhishi screen

Current route:

```text
/groups/start-bhishi
```

Current UI was designed as `बोली / लिलाव` and contains:

- Current BHIC amount.
- Lowest bid display.
- Timer-like display.
- Bid/member list.
- Winner dropdown.
- Winner declaration button.

Backend specification currently defines a simple winner flow, not an auction flow.

Recommended change:

- Keep the screen as a winner selection screen.
- Remove auction timer and lowest-bid semantics unless the backend is changed to support bidding.
- Load eligible members from backend.

Required API for the specification flow:

```http
GET /api/v1/cycles/{cycleId}/winner/eligible-members
```

If auction UI is retained, backend must separately define auction sessions, bids, bid validation, timer state, and winner locking. Do not implement auction behavior only in Flutter.

## Collect amount screen

Current route:

```text
/groups/collect-amount
```

Current UI:

- Total expected amount.
- Collected amount.
- Progress count.
- Next BHIC date.
- Member list.
- Paid/pending visual status.
- Cash button.
- `संकलन पूर्ण करा` button.

Additional new UI behavior:

- Collection is cash-only for the current Flutter release.
- UPI and online payment-provider flows are not part of this handoff.
- A successful collection opens a payment-success/receipt result.
- The receipt displays a backend transaction ID and supports sharing.

Current prototype behavior:

- Paid members are stored in a local `Set<String>`.
- Clicking a member toggles color/status.
- Total collected is calculated locally using a fixed amount.
- Completion directly navigates to winner announcement.

Required APIs:

```http
GET  /api/v1/cycles/{cycleId}/participants
POST /api/v1/cycles/{cycleId}/collections
GET  /api/v1/cycles/{cycleId}/collections
GET  /api/v1/cycles/{cycleId}/collections/summary
POST /api/v1/cycles/{cycleId}/collections/{collectionId}/correct
```

Collection request:

```json
{
  "memberId": "member-id",
  "amount": 10000,
  "collectedAt": "2026-01-15T10:00:00+05:30",
  "method": "CASH",
  "reference": "optional-receipt",
  "note": "optional"
}
```

Backend must return:

- expected total
- collected total
- outstanding total
- paid count
- partial count
- unpaid count
- each participant status

`संकलन पूर्ण करा` must call backend validation/state transition. It must not only show a Snackbar or navigate locally.

## Winner announcement screen

Current route:

```text
/groups/winner-announcement
```

Current UI fields/actions:

- BHIC number.
- Total BHIC amount.
- `विजेता सभासद निवडा` dropdown.
- `बोली रक्कम / winner amount` input.
- Remaining amount display.
- `विजेता घोषित` button.

Required APIs:

```http
GET  /api/v1/cycles/{cycleId}/winner/eligible-members
POST /api/v1/cycles/{cycleId}/winner
POST /api/v1/cycles/{cycleId}/winner/correct
```

Required submit fields:

```json
{
  "winnerMemberId": "member-id",
  "winnerAmount": 85000,
  "receivedAmount": 85000,
  "note": "optional"
}
```

Important:

- Dropdown must contain only backend eligible members.
- Do not filter previous winners only in Flutter.
- Use member ID, not member name, for submission.
- Backend must recalculate remaining amount.
- Winner selection must be locked after successful submission.
- Repeated submit must be idempotent.

## Winner congratulations screen

Current route:

```text
/groups/winner-congratulations
```

Current UI displays:

- Winner name/photo.
- Winner amount.
- BHIC number.
- Congratulations message.
- `उरलेली रक्कम वाटप` button.
- `नवीन भिशी चालू करा` button.

Current navigation:

```text
उरलेली रक्कम वाटप → /groups/distribute-amount
नवीन भिशी चालू करा → /groups/winner-announcement
```

The separate settlement screen and settlement navigation are removed from the Flutter flow.

The winner declaration response must contain all winner payout information required by the next screen, including winner amount, received amount, remaining amount, payout status, and ledger status where applicable.

Navigation after successful winner declaration:

```text
Winner announcement
  → Winner congratulations
  → Distribution screen
```

If the backend still stores a settlement record internally, it should be created automatically as part of winner declaration or distribution preparation. Flutter should not open a separate settlement route.

## Distribution screen

Current route:

```text
/groups/distribute-amount
```

Current UI displays:

- Distribution total.
- Winner/details summary.
- Member distribution list.
- Paid/distributed visual status.
- Progress indicator.
- `वाटप पूर्ण करा` button.

Current prototype behavior:

- Distribution rows use sample data.
- A local set controls row status.
- Interest calculation is not backend connected.
- Completion button navigates locally.

Required APIs:

```http
POST  /api/v1/cycles/{cycleId}/distribution/draft
GET   /api/v1/cycles/{cycleId}/distribution
PATCH /api/v1/cycles/{cycleId}/distribution
POST  /api/v1/cycles/{cycleId}/distribution/validate
POST  /api/v1/cycles/{cycleId}/distribution/publish
```

Distribution row fields:

```text
distributionItemId
memberId
memberName
baseAmount
interestRate
interestAmount
finalAmount
status
ledgerEntryId
```

Backend must calculate and validate:

- eligible members
- winner inclusion/exclusion
- rate limits
- no negative values
- total reconciliation
- rounding adjustment
- ledger entries

After publish, distribution rows must be locked from direct editing.

## Completed Bhishi screen

Current route:

```text
/groups/completed-bhishi
```

Current UI should display:

- BHIC number.
- Winner details.
- Total amount.
- Winner amount.
- Received amount.
- Remaining amount.
- Date and time.
- Distributed member list.
- Base amount per member.
- Interest rate and amount.
- Final distributed amount.
- Next BHIC date/time.
- `होम स्क्रीनवर जा` button.

Required API:

```http
POST /api/v1/cycles/{cycleId}/complete
GET  /api/v1/cycles/{cycleId}
```

Completion is allowed only when:

- Contributions are finalized.
- Winner is saved.
- Winner payout information is finalized during winner declaration, or the backend automatically completes the internal payout step.
- Distribution is published or approved exception exists.
- Ledger entries are balanced.
- Notifications are queued.

The current `goHome()` behavior navigates locally to group details. It should navigate using the returned group ID and latest dashboard state.

## Group and cycle history

Required APIs:

```http
GET /api/v1/groups/{groupId}/cycles
GET /api/v1/cycles/{cycleId}
```

History should show completed cycles ordered by BHIC number, including winner and distribution summary. Previous winners must be excluded from future eligible winner responses by backend logic.

The My Groups, Bhishi History, Next Bhishi Details, Notifications, Profile/Settings, Vyavhar, and message/chat screens should reuse the existing group, cycle, notification, profile, and WhatsApp resources where applicable. Flutter must not invent separate financial state or calculate authoritative totals locally.

## Notifications and WhatsApp

Required notification APIs:

```http
GET   /api/v1/notifications
PATCH /api/v1/notifications/{notificationId}/read
POST  /api/v1/notifications/read-all
POST  /api/v1/notifications/devices
```

Required WhatsApp job APIs:

```http
POST /api/v1/groups/{groupId}/members/{memberId}/whatsapp-information
POST /api/v1/messages/whatsapp/group-information
POST /api/v1/messages/whatsapp/cycle-reminder
POST /api/v1/messages/whatsapp/cycle-completed
```

WhatsApp message jobs should return:

- message job ID
- status: QUEUED/SENT/DELIVERED/READ/FAILED
- provider message ID where available
- failure reason where applicable

The WhatsApp message must be informational only in the current release. It must not request member acceptance.

## Route argument contract

The current route constants do not yet enforce route parameters. The following IDs must be passed between screens.

| Screen | Required arguments |
|---|---|
| Group details | `groupId` |
| Add member | `groupId` |
| Member list | `groupId` |
| Member details | `groupId`, `memberId` |
| Start cycle | `groupId`, `cycleId` |
| Collect amount | `groupId`, `cycleId` |
| Winner announcement | `groupId`, `cycleId` |
| Winner congratulations | `groupId`, `cycleId`, winner response or reload flag |
| Distribution | `groupId`, `cycleId` |
| Completed Bhishi | `groupId`, `cycleId` |

Recommended GetX navigation payload:

```dart
Get.toNamed(
  AppRoutes.collectAmount,
  arguments: {
    'groupId': groupId,
    'cycleId': cycleId,
  },
);
```

Business IDs must never be inferred from member names or display labels.

## Current static/sample behavior to remove

The following prototype behavior must be replaced by API-backed state:

- Static group name.
- Static member list.
- Static dates and remaining days.
- Static total fund.
- Static winner history.
- Local member payment `Set<String>`.
- Fixed contribution amount calculations in Flutter.
- Hardcoded winner names.
- Hardcoded winner amount.
- Hardcoded distribution amounts.
- Direct navigation after financial buttons.
- Direct dashboard navigation after OTP without verification.

## Required frontend architecture for integration

Recommended reusable layers:

```text
lib/
  core/network/
    api_client.dart
    api_endpoints.dart
    api_exception.dart
    auth_interceptor.dart
  core/storage/
    token_storage.dart
  data/models/
  data/repositories/
  features/<feature>/
    model.dart
    controller.dart
    view.dart
    bindings.dart
```

Controllers should expose at least:

```text
isLoading
errorMessage
isEmpty where applicable
data/model
load method
submit method
retry method
```

Every mutation should support:

- loading state
- disabled submit button while request is in progress
- backend error display
- request ID logging for support
- idempotency key where specified
- refresh/reload after success

## Backend comparison checklist

Backend team should verify the following before Flutter integration:

- [ ] Login request accepts Manager name and normalized mobile number.
- [ ] OTP response returns challenge ID and expiry.
- [ ] OTP verification returns access and refresh tokens.
- [ ] Refresh and logout are available.
- [ ] Manager profile endpoint is available.
- [ ] Subscription entitlement is enforced server-side.
- [ ] Group creation accepts every required financial and schedule field.
- [ ] Group response returns group ID.
- [ ] Member creation supports primary and optional contact numbers.
- [ ] Duplicate active membership is rejected.
- [ ] Member list returns IDs and statuses.
- [ ] Cycle records are generated sequentially.
- [ ] Cycle start validates exact schedule time.
- [ ] Cycle start is idempotent.
- [ ] Participants API returns collection status and eligibility.
- [ ] Cash collection supports CASH/OFFLINE only in the first release.
- [ ] Collection totals are recalculated server-side.
- [ ] Collection correction preserves audit history.
- [ ] Eligible winner endpoint excludes previous winners.
- [ ] Winner submit accepts member ID, winner amount, and received amount.
- [ ] Winner submit is idempotent and locks selection.
- [ ] Winner declaration returns final payout/remaining amount and payout status, or backend creates the internal payout record automatically.
- [ ] Distribution draft/load/validate/publish endpoints exist.
- [ ] Interest and rounding are calculated server-side.
- [ ] Distribution publish is idempotent.
- [ ] Complete cycle validates all previous states.
- [ ] Completed cycle contains a complete history snapshot.
- [ ] Notifications and WhatsApp message jobs are persisted.
- [ ] Scheduler operates independently of Flutter.
- [ ] Important mutations create audit records.

## Product decisions required before implementation

The following must be confirmed by the product owner/backend team:

1. Simple winner dropdown or auction/bidding flow?
2. What exactly is `controlledAmount`?
3. How is total BHIC amount calculated?
4. Is the winner included in distribution?
5. Is interest percentage-based, fixed, or rule-based?
6. Can partial collections proceed to winner selection?
7. Is a subscription mandatory before group creation?
8. How should a monthly date behave when that date does not exist in a month?
9. What is the final-cycle behavior after every member has won?

Confirmed UI decisions:

- Aadhaar-like field is removed.
- Group dropdown is removed from Add Member.
- Explicit invitation preference is removed.
- Collection is cash-only; UPI is excluded from the current release.
- Paid/pending states are required.
- Individual payment tracking is required.
- Payment-success/receipt screen is required.
- Transaction ID is required for a successful collection.
- Receipt sharing is required.

## Recommended implementation sequence

```text
1. API client, secure storage, error handling
2. Login OTP and session management
3. Subscription entitlement
4. Group list/create/details
5. Member create/list/details
6. Cycle schedule and start
7. Cash collection and summary
8. Eligible winner and winner submission
9. Distribution draft/validate/publish
10. Complete cycle and history
11. Notifications, WhatsApp jobs, and reports
```

## Definition of frontend-backend integration complete

Integration is complete when:

- No production screen depends on `.sample` data.
- Every protected request sends the authenticated Manager token.
- Every screen receives resource IDs rather than display names.
- All financial totals come from backend responses.
- All financial mutations are idempotent and auditable.
- Cycle state transitions are enforced by backend.
- Winner eligibility is enforced by backend.
- Distribution is recalculated and validated by backend.
- Completed Bhishi history is loaded from persisted backend data.
- Failed API requests show useful user-facing messages.
- Session expiry redirects safely to login.
- Backend automated tests cover permissions, state transitions, calculations, duplicate requests, and message jobs.
