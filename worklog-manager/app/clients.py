from datetime import date, datetime, timedelta, timezone
from typing import Any

import requests

from .config import settings


def fetch_jira_issue_details(issue_key: str) -> dict[str, Any]:
    auth = (settings.jira_email, settings.jira_api_token)
    headers = {"Accept": "application/json"}

    issue_resp = requests.get(
        f"{settings.jira_base_url}/rest/api/3/issue/{issue_key}",
        params={"fields": "summary,priority,assignee,timetracking"},
        auth=auth,
        headers=headers,
        timeout=30,
    )
    issue_resp.raise_for_status()
    issue_payload = issue_resp.json()
    fields = issue_payload.get("fields") or {}

    return {
        "issue_key": issue_key,
        "issue_url": f"{settings.jira_base_url}/browse/{issue_key}",
        "summary": fields.get("summary") or "",
        "priority": ((fields.get("priority") or {}).get("name") or ""),
        "assignee": ((fields.get("assignee") or {}).get("displayName") or ""),
        "original_estimate": ((fields.get("timetracking") or {}).get("originalEstimate") or ""),
    }


def add_custom_jira_worklog(
    issue_key: str, time_spent: str, started: str | None = None, description: str | None = None
) -> dict[str, Any]:
    auth = (settings.jira_email, settings.jira_api_token)
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    url = f"{settings.jira_base_url}/rest/api/3/issue/{issue_key}/worklog"
    started_value = started or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000+0000")
    payload: dict[str, Any] = {"started": started_value, "timeSpent": time_spent.strip()}
    cleaned_description = (description or "").strip()
    legacy_prefix = "Logged:"
    if cleaned_description.startswith(legacy_prefix):
        cleaned_description = cleaned_description[len(legacy_prefix) :].strip()

    if cleaned_description:
        payload["comment"] = {
            "type": "doc",
            "version": 1,
            "content": [
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": cleaned_description}],
                }
            ],
        }

    resp = requests.post(
        url,
        json=payload,
        auth=auth,
        headers=headers,
        timeout=30,
    )
    resp.raise_for_status()
    payload = resp.json()
    return {
        "worklog_id": str(payload.get("id", "")),
        "issue_key": issue_key,
        "issue_url": f"{settings.jira_base_url}/browse/{issue_key}",
        "time_spent": time_spent.strip(),
        "started": started_value,
        "description": cleaned_description,
    }


def delete_jira_worklog(issue_key: str, worklog_id: str) -> dict[str, Any]:
    auth = (settings.jira_email, settings.jira_api_token)
    headers = {"Accept": "application/json"}
    resp = requests.delete(
        f"{settings.jira_base_url}/rest/api/3/issue/{issue_key}/worklog/{worklog_id}",
        auth=auth,
        headers=headers,
        timeout=30,
    )
    resp.raise_for_status()
    return {
        "ok": True,
        "issue_key": issue_key,
        "worklog_id": str(worklog_id),
    }


def _extract_adf_text(node: Any) -> str:
    if not node or not isinstance(node, dict):
        return ""
    if node.get("type") == "text":
        return node.get("text", "")
    parts = [_extract_adf_text(child) for child in (node.get("content") or [])]
    return " ".join(p for p in parts if p)


def fetch_jira_worklogs(
    user_email: str, start_date: date, end_date: date
) -> list[dict[str, Any]]:
    auth = (settings.jira_email, settings.jira_api_token)
    headers = {"Accept": "application/json"}

    jql = (
        f'worklogAuthor = "{user_email}" '
        f'AND worklogDate >= "{start_date.isoformat()}" '
        f'AND worklogDate <= "{end_date.isoformat()}"'
    )

    issues: list[dict[str, Any]] = []
    page_size = 100
    next_page_token: str | None = None

    while True:
        search_payload: dict[str, Any] = {
            "jql": jql,
            "maxResults": page_size,
            "fields": ["summary"],
        }
        if next_page_token:
            search_payload["nextPageToken"] = next_page_token

        search_resp = requests.post(
            f"{settings.jira_base_url}/rest/api/3/search/jql",
            json=search_payload,
            auth=auth,
            headers={**headers, "Content-Type": "application/json"},
            timeout=30,
        )
        if search_resp.status_code == 400:
            # Some tenants accept this endpoint only with query params.
            search_resp = requests.get(
                f"{settings.jira_base_url}/rest/api/3/search/jql",
                params={
                    "jql": jql,
                    "maxResults": page_size,
                    **({"nextPageToken": next_page_token} if next_page_token else {}),
                },
                auth=auth,
                headers=headers,
                timeout=30,
            )

        search_resp.raise_for_status()
        payload = search_resp.json()
        page_issues = payload.get("issues") or payload.get("values") or []
        issues.extend(page_issues)
        next_page_token = payload.get("nextPageToken")
        if not next_page_token:
            break

    range_start = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    range_end_exclusive = datetime.combine(
        end_date + timedelta(days=1), datetime.min.time()
    ).replace(tzinfo=timezone.utc)

    rows: list[dict[str, Any]] = []
    for issue in issues:
        issue_key = issue.get("key", "")
        issue_summary = (issue.get("fields") or {}).get("summary") or ""
        wl_start_at = 0
        wl_page_size = 100

        while True:
            wl_resp = requests.get(
                f"{settings.jira_base_url}/rest/api/3/issue/{issue_key}/worklog",
                params={"startAt": wl_start_at, "maxResults": wl_page_size},
                auth=auth,
                headers=headers,
                timeout=30,
            )
            wl_resp.raise_for_status()
            wl_payload = wl_resp.json()
            worklogs = wl_payload.get("worklogs", [])

            for wl in worklogs:
                author = wl.get("author") or {}
                author_email = (
                    author.get("emailAddress") or author.get("accountId") or ""
                ).lower()
                if author_email != user_email.lower():
                    continue

                started_raw = wl.get("started")
                if not started_raw:
                    continue
                normalized_started = started_raw
                if len(normalized_started) >= 5 and normalized_started[-5] in {"+", "-"}:
                    normalized_started = (
                        f"{normalized_started[:-5]}{normalized_started[-5:-2]}:{normalized_started[-2:]}"
                    )
                started_dt = datetime.fromisoformat(normalized_started).astimezone(timezone.utc)
                if not (range_start <= started_dt < range_end_exclusive):
                    continue

                rows.append(
                    {
                        "worklog_id": str(wl.get("id", "")),
                        "issue_key": issue_key,
                        "issue_url": f"{settings.jira_base_url}/browse/{issue_key}" if issue_key else "",
                        "issue_summary": issue_summary,
                        "author": author.get("displayName") or "",
                        "author_email": author.get("emailAddress") or author.get("accountId") or "",
                        "started": started_raw,
                        "time_spent_seconds": int(wl.get("timeSpentSeconds") or 0),
                        "time_spent": wl.get("timeSpent") or "",
                        "description": _extract_adf_text(wl.get("comment")) if isinstance(wl.get("comment"), dict) else (wl.get("comment") or ""),
                    }
                )

            if len(worklogs) < wl_page_size:
                break
            wl_start_at += wl_page_size

    rows.sort(key=lambda item: item.get("started", ""), reverse=True)
    return rows
