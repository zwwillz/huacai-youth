# Event Workflow Phase 1

This branch implements the product-flow convergence phase only:

- unified event lifecycle transitions
- derived Workflow Summary / role-aware Next Action
- `/admin` event command center

Explicitly deferred: competition-task simplification, engine rewrites, P2-05 preload/cache work, P2-07 large qualifier loading changes, registration/account/payment expansion, and broad UI redesign.

The permanent Luoyang test event is used for read-only workflow regression; Taiyuan/Langfang historical results must not be changed for workflow testing.

## Closure Fix

- Group roster confirm/lock can continue during `in_progress` only when that group has not produced formal competition data.
- Competition Ready requires a locked roster plus confirmed draw or confirmed bracket; draft draw/bracket is not formal competition.
- Dashboard, Event List Continue, and Event Settings all consume the same Workflow Summary / Next Action.

## Preview blocker: qualification draw persistence bridge

Taiyuan U16 exposed `cannot call jsonb_to_recordset on a non-array` while generating a qualification draw draft. The qualification calculation path was not the source of the failure. The persistence layer was sending serialized row arrays through the EdgeOne -> Supabase database bridge and unpacking them with PostgreSQL `jsonb_to_recordset`.

The draw persistence transport now keeps the existing calculation and transaction boundaries but writes `draw_prelim_matches`, `draw_participants`, and `draw_slots` as chunked scalar-parameter `INSERT ... VALUES` statements. No qualification-plan, randomization, division, slot, 16+8 advancement, q1/q2, or seed algorithm was changed.

Taiyuan validation remains read-only. U16 q1 still contains only its two historical `void` sessions; the failed browser attempt did not leave a new draft.

Final code validation is green on TypeScript, ESLint, Core Regression, and production builds. The remaining gate is EdgeOne Preview browser re-test of Taiyuan U16 draw generation; PR #60 remains Draft until that real path passes.
