# Compliance (HIPAA)

Sona sends communications from healthcare providers to patients, which very likely puts it in HIPAA territory. **This is not legal advice — get a compliance review before production.** Design constraints baked in from day one:

## Notification content

- **No PHI in any notification payload.** SMS and push content must be generic: "You're ready to be seen. Please come to the front desk." Never include names of conditions, appointment reasons, provider specialty, clinic names that imply a condition, or anything else that reveals health information.
- SMS is unencrypted in transit and visible on lock screens — treat every message as if a third party will read it.
- Push notification payloads transit Apple/Google/Expo infrastructure — same rule: identifiers only, sensitive detail stays behind app authentication.

## Vendors

- **SMS provider must sign a BAA** (Business Associate Agreement). Twilio does; budget SMS APIs generally don't. This constrains vendor choice — check before integrating.
- Same for any hosting, logging, or analytics vendor that could touch PHI.

## Data handling

- **Audit logging:** every notification send must be recorded — who sent it, to whom, when, via which channel, delivery outcome. The `ReadyNotification` entity is designed for this; do not add a code path that sends without persisting.
- **Encryption at rest** for the database; TLS everywhere in transit.
- **Access control:** admin app requires authenticated provider accounts; role checks server-side, never client-only.
- **Minimum necessary:** the mobile app should only surface the current patient's own data; the API must enforce patient-scoped authorization on every endpoint.

## Practical checklist before launch

- [ ] BAA signed with SMS provider
- [ ] BAA signed with hosting provider
- [ ] Notification templates reviewed — zero PHI
- [ ] Audit log on all notification sends
- [ ] DB encryption at rest enabled
- [ ] AuthN/AuthZ on every API endpoint
- [ ] Formal compliance/legal review
