# Snooker Sync Center v2.1

- ranking lists are first-class independently scheduled sync tasks
- `rankings_all` is a manual batch orchestrator only
- manual sync requests are queued and executed by a 30-second database worker
- ranking task cards show last success, last change, latest data version, result, duration and next run
- ranking snapshot/data version is only written when source ranking content changes
- common sync errors are localized for the admin UI while raw errors remain in detailed logs
