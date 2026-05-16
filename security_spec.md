# Security Specification

## Data Invariants
1. A user cannot create their own admin profile.
2. A manager can only see properties assigned to them (or visible to managers).
3. Payments must be linked to valid records.
4. Timestamps must be server-validated.
5. Critical fields like `role` are immutable for non-admins.

## The "Dirty Dozen" Payloads

1. **Identity Spoofing**: Attempt to create a user profile with `role: 'ADMIN'` as an unauthenticated user.
2. **Privilege Escalation**: A non-admin user trying to update their own `role` to 'ADMIN'.
3. **Data Poisoning**: Creating a property with a 1MB string as the `name`.
4. **Relational Bypass**: Creating a `record` for a `property` that doesn't exist.
5. **Timestamp Fraud**: Setting `createdAt` to a date in the past from the client.
6. **Unauthorized Read**: A user trying to read another user's private data.
7. **Bypassing Whitelist**: A manager trying to read a property not marked `isVisibleToManager`.
8. **Shadow Field Injection**: Adding an `isAdmin: true` field to a document where it doesn't belong.
9. **Terminal State Break**: Updating a `Payment` that is already marked as 'PAID' or 'REFUNDED' (if terminal states are enforced).
10. **ID Injection**: Using a long, malicious string as a document ID.
11. **Massive List**: Attempting to read a collection without any filters as a generic user.
12. **Orphaned Write**: Creating a `recordValue` without a corresponding `record`.

## Test Runner
I will use the `firestore.rules` file to prevent these.
