# Event Workflow Phase 1

This branch implements the product-flow convergence phase only:

- unified event lifecycle transitions
- derived Workflow Summary / role-aware Next Action
- `/admin` event command center

Phase 1 closure invariants:

- U16 / U20 roster progression is group-level. After the event enters `in_progress`, a group that has not started formal competition may still confirm and lock its roster.
- A group is treated as already in formal competition when it has confirmed draw/bracket/schedule, confirmed/completed result data, confirmed qualification, locked main roster, confirmed advancement, or ranking data.
- `registration_closed -> in_progress` requires at least one active group with a locked roster and a **confirmed** draw or **confirmed** bracket. Draft competition data never makes the event Competition Ready.
- Dashboard, event-list Continue, and event settings consume the same Workflow Summary / Next Action. Event settings do not maintain a second `event.status -> action` map.
- Workflow recommends actions; server lifecycle/roster services remain the final execution guard.

Shared closure implementation:

- `db/formal-competition-policy.mjs`: common pure formal-competition / Competition Ready policy.
- `db/formal-competition.ts`: read-only formal competition fact queries used by server guards.
- `db/participant-roster-lifecycle.ts`: group-aware confirm/lock lifecycle boundary.
- `db/event-lifecycle.ts`: confirmed-only start-competition boundary.
- `db/event-workflow.ts`: confirmed-only Workflow readiness and the same shared ready predicate.

Second-round acceptance scenarios:

1. U16 starts first; U20 can still confirm and lock its roster while the event is `in_progress` if U20 has no formal competition data.
2. Draft draw cannot start competition.
3. Confirmed draw can start competition when that group's roster is locked.
4. Dashboard / event-list Continue / event settings give the same Next Action direction.
5. `registration_closed` with no Competition Ready group does not recommend start competition.
6. `in_progress` group without formal competition may continue roster preparation.
7. `in_progress` group with formal competition data is rejected when attempting roster reconfirm/relock.

Explicitly deferred: competition-task simplification, engine rewrites, P2-05 preload/cache work, P2-07 large qualifier loading changes, registration/account/payment expansion, and broad UI redesign.

The permanent Luoyang test event is used for read-only workflow regression; Taiyuan/Langfang historical results must not be changed for workflow testing.
