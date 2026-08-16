# World Snooker Data Center POC

The `/snooker` module is isolated from Huacai business data. It currently shares the Next.js repository and EdgeOne deployment only.

Data flow: verified bundled snapshot -> server-side live source validation -> optional live overlay -> our `/api/snooker/v1/*` endpoints -> mobile UI.

The future independent Supabase schema is stored in `lib/snooker/schema.sql` and has not been applied to the Huacai database.
