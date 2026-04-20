import re
from datetime import date, datetime
from pathlib import Path

import requests
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .clients import (
    add_custom_jira_worklog,
    delete_jira_worklog,
    fetch_jira_issue_details,
    fetch_jira_worklogs,
)
from .config import settings

app = FastAPI(title="JiraWorkLog", version="1.0.0")

STATIC_DIR = Path(__file__).resolve().parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class WorklogReportRequest(BaseModel):
    start_date: date
    end_date: date


class CustomWorklogRequest(BaseModel):
    issue_key: str = Field(min_length=3, max_length=30, pattern=r"^[A-Z][A-Z0-9]+-\d+$")
    time_spent: str = Field(min_length=1, max_length=20, pattern=r"^\s*\d+\s*[mhdw]\s*$")
    started: str | None = Field(default=None, max_length=40)
    description: str | None = Field(default=None, max_length=5000)


class IssueLookupRequest(BaseModel):
    issue_key: str = Field(min_length=3, max_length=30, pattern=r"^[A-Z][A-Z0-9]+-\d+$")


class DeleteWorklogRequest(BaseModel):
    issue_key: str = Field(min_length=3, max_length=30, pattern=r"^[A-Z][A-Z0-9]+-\d+$")
    worklog_id: str = Field(min_length=1, max_length=40, pattern=r"^\d+$")


def _normalize_started(started_raw: str | None) -> str | None:
    value = (started_raw or "").strip()
    if not value:
        return None

    jira_pattern = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000[+-]\d{4}$"
    if re.match(jira_pattern, value):
        return value

    try:
        parsed_local = datetime.strptime(value, "%d-%b-%Y %I:%M %p").astimezone()
    except ValueError as exc:
        try:
            parsed_local = datetime.strptime(value, "%d-%b-%Y").astimezone()
        except ValueError as date_exc:
            raise HTTPException(
                status_code=400,
                detail='Invalid started format. Use "DD-MMM-YYYY" or "DD-MMM-YYYY hh:mm AM/PM", e.g. "04-Apr-2026" or "04-Apr-2026 06:30 PM".',
            ) from date_exc

    return parsed_local.strftime("%Y-%m-%dT%H:%M:%S.000%z")


@app.get("/")
def homepage() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/meta")
def meta():
    return {"report_email_label": settings.jira_email or "unknown"}


@app.post("/report/worklogs")
def report_worklogs(req: WorklogReportRequest):
    if req.start_date > req.end_date:
        raise HTTPException(status_code=400, detail="start_date cannot be after end_date")

    try:
        worklogs = fetch_jira_worklogs(
            user_email=settings.jira_email,
            start_date=req.start_date,
            end_date=req.end_date,
        )
    except requests.HTTPError as exc:
        detail = "Failed to fetch Jira worklogs"
        response = exc.response
        if response is not None:
            try:
                jira_payload = response.json()
                if jira_payload:
                    detail = jira_payload
            except ValueError:
                if response.text:
                    detail = response.text
        raise HTTPException(status_code=502, detail=detail) from exc

    return {
        "email": settings.jira_email,
        "start_date": req.start_date.isoformat(),
        "end_date": req.end_date.isoformat(),
        "count": len(worklogs),
        "worklogs": worklogs,
    }


@app.post("/worklogs/custom")
def add_custom_worklog(req: CustomWorklogRequest):
    try:
        return add_custom_jira_worklog(
            issue_key=req.issue_key.strip().upper(),
            time_spent=req.time_spent.strip().lower(),
            started=_normalize_started(req.started),
            description=(req.description or "").strip() or None,
        )
    except requests.HTTPError as exc:
        detail = "Failed to add Jira worklog"
        response = exc.response
        if response is not None:
            try:
                jira_payload = response.json()
                if jira_payload:
                    detail = jira_payload
            except ValueError:
                if response.text:
                    detail = response.text
        raise HTTPException(status_code=502, detail=detail) from exc


@app.post("/issues/lookup")
def lookup_issue(req: IssueLookupRequest):
    try:
        return fetch_jira_issue_details(req.issue_key.strip().upper())
    except requests.HTTPError as exc:
        detail = "Failed to fetch Jira issue details"
        response = exc.response
        if response is not None:
            try:
                jira_payload = response.json()
                if jira_payload:
                    detail = jira_payload
            except ValueError:
                if response.text:
                    detail = response.text
        raise HTTPException(status_code=502, detail=detail) from exc


@app.post("/worklogs/delete")
def delete_worklog(req: DeleteWorklogRequest):
    try:
        return delete_jira_worklog(
            issue_key=req.issue_key.strip().upper(),
            worklog_id=req.worklog_id.strip(),
        )
    except requests.HTTPError as exc:
        detail = "Failed to delete Jira worklog"
        response = exc.response
        if response is not None:
            try:
                jira_payload = response.json()
                if jira_payload:
                    detail = jira_payload
            except ValueError:
                if response.text:
                    detail = response.text
        raise HTTPException(status_code=502, detail=detail) from exc
