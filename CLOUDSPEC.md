# RentMaster Pro: Cloud Sync & Session Specification

## 1. System Architecture
RentMaster Pro follows a **Local-First, Cloud-Synced** architecture.
- **Local Layer**: Uses `localStorage` via a state reference (`stateRef`) for instantaneous UI updates and offline durability.
- **Cloud Layer**: Uses Google Sheets API (V4) as a relational database and Google Drive API for file discovery.

## 2. Sync Logic (The "Quiet Period" Strategy)
To optimize performance and avoid Google API rate limits:
- **Batched Updates**: Changes are not pushed instantly. The app waits for a **2.5-second "quiet period"** after the last user modification before triggering a sync.
- **Atomic Operations**: Instead of updating individual cells, the app performs a `batchUpdate`. It clears the existing tab data and pushes the entire local state in one atomic request, ensuring no partial data states.
- **Hash Verification**: A JSON hash of the state is maintained. Sync only triggers if the current state hash differs from the `lastSyncHash`.

## 3. Session Lifecycle & Security
### A. Token Expiration (The 60-Minute Rule)
Google Access Tokens expire every hour. 
- **Silent Refresh**: On a 401 (Unauthorized) error, the app attempts a background refresh using `tokenClient.requestAccessToken({ prompt: '' })`.
- **Hard Expiry**: If silent refresh fails (user signed out of Google), the `syncStatus` shifts to `reauth`, prompting a user-facing Google popup.

### B. Genesis Mode (The Bootstrap)
- **Condition**: No users in local storage AND no `spreadsheetId` configured.
- **Behavior**: Bypasses cloud checks to allow local creation of the first `ADMIN`. Once created, the Admin can link a Google Client ID from the settings.

### C. Joining an Existing Workspace
- **Flow**: User enters Client ID -> Google Auth -> App finds `RentMaster_Pro_Database` in Drive -> Pulls all Users/Properties -> UI unlocks Login.

## 4. Error Handling & Recovery
- **401 (Unauthorized)**: Triggers re-authentication flow.
- **404 (Not Found)**: If the spreadsheet is deleted from Drive, the app resets `spreadsheetId` and asks the Admin to re-initialize or re-select.
- **Offline**: The app stores changes in `localStorage`. The sync engine polls for connectivity and pushes the backlog once the 401/Network errors resolve.
