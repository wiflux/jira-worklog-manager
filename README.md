# JiraWorkLog

JiraWorkLog is a FastAPI service to view Jira worklogs and add custom worklogs
for a configured Jira user.

## Features

- Worklog report by date range
- Add custom worklog on any Jira ticket
- Ticket lookup with summary, priority, assignee, and estimate

## Prerequisites

- Docker + Docker Compose
- Jira base URL, user email, and API token

## Setup

1. Copy environment file:
   - `cp .env.example .env`
2. Update `.env`:
   - `JIRA_BASE_URL`
   - `JIRA_EMAIL`
   - `JIRA_API_TOKEN`
3. Start service:
   - `docker compose up --build -d`
4. Open app:
   - `http://localhost:8086/`

## API Endpoints

- `GET /` UI for worklog reporting and custom entries
- `GET /health` health check
- `POST /report/worklogs`
  - body:
    ```json
    {
      "start_date": "2026-04-01",
      "end_date": "2026-04-15"
    }
    ```
- `POST /worklogs/custom`
  - body:
    ```json
    {
      "issue_key": "TS-4353",
      "time_spent": "30m",
      "started": "2026-04-15T10:30:00.000+0530",
      "description": "Investigated and fixed API timeout"
    }
    ```
- `POST /issues/lookup`
  - body:
    ```json
    {
      "issue_key": "TS-4353"
    }
    ```

## Notes

- Ticket key format: `[A-Z][A-Z0-9]+-\\d+`
- Worklog durations support Jira style values (for example: `15m`, `2h`, `1d`)
- Worklogs are created with Jira `adjustEstimate=leave`

## Troubleshooting

- Worklog manager logs:
  - `docker logs -f jira-worklog-manager`
