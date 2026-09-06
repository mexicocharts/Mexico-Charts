---
name: Saved SELECT adapter contract
description: Rules for replaying connector-returned CSV fields from saved production SELECT results.
---

When replaying saved SELECT output, JSON-serialized array fields must be decoded with JSON.parse and validated as arrays of strings. An empty JSON array must remain `[]`, never become a literal alias token such as `[]`. SQL NULL fields may become `null`, but literal `null` and `undefined` strings must be rejected for provider IDs.

**Why:** A replay adapter treated the serialized empty alias array as a real shared alias and merged otherwise unrelated accepted MusicBrainz identities into one false conflict group.

**How to apply:** Validate exact headers and row widths, decode array-valued fields before identity grouping, normalize blank SQL NULLs explicitly, reject sentinel IDs, and preserve conversion provenance beside corrected replay artifacts.