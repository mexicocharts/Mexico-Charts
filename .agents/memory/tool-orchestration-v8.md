---
name: Tool-orchestration V8 runtime
description: Runtime limitations and safe parsing patterns for the durable CodeExecution sandbox.
---

The durable tool-orchestration V8 runtime does not provide Node globals such as `Buffer` or `TextEncoder`. It can read and parse JSON/CSV with plain JavaScript, while byte-accurate filesystem measurements belong in a small `"use impure"` filesystem helper.

**Why:** Reporting code that assumed Node globals failed after the underlying database callback had already completed, creating avoidable ambiguity about whether the query itself had failed.

**How to apply:** Keep production callbacks and pure parsing in the durable scope; use string lengths only when approximate character size is acceptable, and use an impure `fs.stat`/`fs.writeFile` helper for private file byte counts.