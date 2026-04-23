# Security Spec
1. Data Invariants:
- A Lead must contain name, phone, createdAt, and userId.
- A Lead status must be in ["New", "In Progress", "Sold", "Lost"].
- For Scans, require makeModel, price, scannedAt, userId.
- Admin is `info.appledream@gmail.com`.

2. The "Dirty Dozen" Payloads:
Payload 1: Unverified Email (Ghost admin)
Payload 2: Missing required field on Lead
Payload 3: extra field on Lead (shadow update)
Payload 4: Invalid status on Lead
Payload 5: Invalid string length on Scan ID (ID poisoning)
Payload 6: Client queries all leads (list without filter)
Payload 7: Update someone else's Lead
Payload 8: Setting list size over MAX
Payload 9: Change `userId` on update
Payload 10: Client provided timestamp instead of server timestamp
Payload 11: Changing terminal state (`Lost` to `New`)
Payload 12: Admin modifying non-admin fields without admin override

3. The Test Runner: Included in `firestore.rules.test.ts`.
