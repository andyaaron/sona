# Open questions — feedback round 2026-09-04 (Tasks 22–29)

One place to answer. Each question is also in its task file with more context. Fill in the
**A:** lines; the task files get updated from here. Blocking questions are marked ⚠️.

## Cross-cutting

- **Q0.1** Priority order. Proposed: 22 (unblocker) → 26 → 21 → 23 → 24 → 29 → 27 → 28 → 25
  (25 last: compliance-gated and needs 28). Agree?
  **A:**
- **Q0.2** Fold Task 26 (notified row) into Task 27 (full check-in flow), or ship 26 first?
  **A:**

## Task 22 — Opie schema discovery

- **Q22.1** "We already have a db column from *this* db" (Cerner note) — Opie_data, or a separate
  Cerner extract? **A:**
- **Q22.2** Any column names already known (practitioner id, room)? **A:**
- **Q22.3** Read-only Opie login for this machine, or run the SQL on the work machine and paste
  column names back? **A:**
- **Q22.4** More than one site/location in Opie? **A:**

## Task 23 — Provider filter

- **Q23.1** Ship the interim "Primary practitioner" filter now, or wait for the appointment-level
  practitioner from Task 22? (Recommend wait.) **A:**
- **Q23.2** Options from Sona `Providers` linked to Opie ids by hand, or the distinct practitioners
  Opie returns for the day? **A:**
- **Q23.3** Filter internal blocks too, or always show them? **A:**
- **Q23.4** Persist the selection per user (localStorage) as well as in the URL? **A:**
- **Q23.5** Real tabs (single-select) or the multi-select dropdown with chips? **A:**

## Task 24 — Provider + exam room columns

- **Q24.1** Just two columns in the hourly list, or reproduce Cerner's per-provider layout (then
  it belongs in Task 29's Day view)? **A:**
- **Q24.2** Screenshot of the Cerner Ambulatory Organizer (patient data covered)? **A:**
- **Q24.3** Provider display: Opie name as stored, or linked Sona `Provider` name + credentials?
  **A:**
- **Q24.4** Is the exam room set at booking or only when roomed? **A:**

## Task 25 — SMS with appointment time + provider name

- ⚠️ **Q25.1** Who signs off on message-content compliance, and is time + provider name in an
  SMS approved? **A:**
- ⚠️ **Q25.2** Provider name only, or "Dr. Last"? Any names that must never appear? **A:**
- **Q25.3** Which message: the on-site "ready to be seen" ping, or a new pre-visit
  confirmation/reminder? If reminder — when sent and by whom? **A:**
- **Q25.4** Replace the single template, or add a second and let the sender pick? **A:**
- **Q25.5** Time format / include the date? **A:**

## Task 26 — Notified row state

- **Q26.1** Post-send button label: "Notified" (proposed), "Checked in", or "Confirmed"? **A:**
- **Q26.2** Allow "Send again"? **A:**
- **Q26.3** 30-second background refetch against Opie acceptable, or refetch on focus only? **A:**
- **Q26.4** Notified rows hideable via a chip, or just tinted? **A:**

## Task 27 — Check-in flow

- ⚠️ **Q27.1** Does Opie (or Cerner) already record arrived / checked in / roomed? **A:**
- **Q27.2** Where does the SMS sit: (a) independent notification, no state change (proposed);
  (b) moves the row to Confirmed; (c) moves it to Ready? **A:**
- **Q27.3** Allow skipping steps and moving back? **A:**
- **Q27.4** Everyone in the org can change every state, or front desk vs clinical split (needs
  new roles)? **A:**
- **Q27.5** Concurrent edits: last write wins, or conflict prompt? **A:**
- **Q27.6** Per-row history visible in v1? **A:**
- **Q27.7** No-show / cancelled states needed? **A:**
- **Q27.8** Keep Jamie's labels verbatim ("Seen by LPN/MA", "Seen by Physician", "Check out")?
  Is "Physician" right for an O&P clinic? **A:**

## Task 28 — Message templates UI

- ⚠️ **Q28.1** Workflow: any assigned staff drafts → org_admin approves (proposed)? Who is the
  compliance reviewer in practice? **A:**
- ⚠️ **Q28.2** Org-scoped templates with a system default, or one global set? **A:**
- **Q28.3** May an org_admin approve their own draft? **A:**
- **Q28.4** Approving retires the previous template automatically, or several approved templates
  coexist with the sender choosing? **A:**
- **Q28.5** Rejected/retired stay listable forever? **A:**
- **Q28.6** Enforce one SMS segment (160 chars) or allow two with a warning? **A:**

## Task 29 — Hourly / Day / Week views

- ⚠️ **Q29.1** What does **Day** show that Hourly does not: per-provider time grid, flat list, or
  something else (sketch)? **A:**
- **Q29.2** Week shows rows, or counts only? **A:**
- **Q29.3** Week starts Monday? Hide empty weekends? **A:**
- **Q29.4** Notify / status controls inside Week view? **A:**
- **Q29.5** One Opie query per week acceptable? **A:**
