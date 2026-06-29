# Contract: Locale-Aware Date/Time Utilities

**Module**: `src/lib/date-utils.ts` (additions) | **Feature**: 002-calendar-month-navigation

These are the public function contracts the UI depends on. They are pure and synchronous, making them
directly unit-testable (constitution II). Signatures are guidance; names/types must be honored by callers
and tests.

---

## `resolveLocale(): string`

Returns the active BCP-47 locale tag.

- **Resolution order**: `Intl.DateTimeFormat().resolvedOptions().locale` → `navigator.language` → `'en-US'`.
- **Pure**: depends only on the host environment; no arguments.
- **Guarantees**: always returns a non-empty string usable by `Intl.DateTimeFormat`.

---

## `formatTime(date: Date, locale?: string): string`

Formats the time-of-day portion of `date` in the user's (or supplied) locale.

- **Behavior**: uses `Intl.DateTimeFormat(locale ?? resolveLocale(), { hour: 'numeric', minute: '2-digit' })`.
- **Locale-driven format**: 12-hour with AM/PM for locales that use it (e.g., `en-US` → `8:30 AM`); 24-hour for
  locales that use it (e.g., `de-DE`/`en-GB` → `20:30`). `hour12` is NOT hardcoded.
- **Edge cases (MUST hold)**:
  - Noon `12:00` → `12:00 PM` (12-hr) / `12:00` (24-hr)
  - Midnight `00:00` → `12:00 AM` (12-hr) / `00:00` (24-hr)
- **Time zone**: renders in the runtime's local time zone (FR-011).
- **Determinism for tests**: passing an explicit `locale` MUST override environment locale.

### Acceptance (maps to FR-009, FR-011; SC-003)
| Input (local time) | locale | Expected |
|---|---|---|
| 08:30 | `en-US` | `8:30 AM` |
| 20:30 | `en-US` | `8:30 PM` |
| 20:30 | `en-GB` | `20:30` |
| 12:00 | `en-US` | `12:00 PM` |
| 00:00 | `en-US` | `12:00 AM` |
| 00:00 | `de-DE` | `00:00` |

> Note: exact AM/PM spacing/casing may vary slightly by ICU version; tests assert the meaningful parts
> (hour, minute, and presence/absence of an AM/PM indicator), not byte-exact strings.

---

## `formatDateLabel(date: Date, opts: Intl.DateTimeFormatOptions, locale?: string): string`

Formats a user-visible date heading in locale conventions (month/year heading, selected-day heading).

- **Behavior**: `Intl.DateTimeFormat(locale ?? resolveLocale(), opts).format(date)`.
- **Used for**: the selected-day panel heading (replaces `format(selectedDate, 'MMMM d, yyyy')`) and any
  month/year label not rendered by the calendar control itself.
- **MUST NOT** be used for internal keys/grouping — those keep `date-fns` `yyyy-MM-dd` (locale-stable).

### Acceptance (maps to FR-010)
- `formatDateLabel(new Date(2026,5,25), { year:'numeric', month:'long', day:'numeric' }, 'en-US')`
  → a US-style long date (e.g., `June 25, 2026`).
- Same call with `'de-DE'` → German-style long date (e.g., `25. Juni 2026`).

---

## Non-goals / Invariants

- These helpers do not change stored data; formatting is display-only.
- `date-fns` remains the source for date arithmetic (`startOfMonth`, `endOfMonth`, `isSameDay`) and for
  locale-independent internal keys.
- No `any` types; no inline per-component time formatting after this lands.
