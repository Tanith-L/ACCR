"""Shared fixtures. Database tests run against the project in .env, but every test
works inside a transaction that is always rolled back, so nothing is ever committed.
They skip when no database is configured or when migration 0004 is not applied."""
import json
import os
import re
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "scripts"))

import import_content as imp  # noqa: E402

MOCK = BACKEND / "fixtures" / "mock_export.json"

# Test content uses its own IDs and disease so it can never collide with real content
# that may already be in the database.
RENAMES = [
    ("psa-dx-", "zzt-dx-"),
    ('"dx-criteria"', '"zzt-criteria"'),
    ('"dx-imaging"', '"zzt-imaging"'),
    ('"dx"', '"zzt-dx"'),
    ('"psa"', '"zzt"'),
    ("src-mock-onepager", "src-zzt-onepager"),
    ('"mock-joints"', '"zzt-joints"'),
]


def pytest_configure(config):
    config.addinivalue_line("markers", "db: needs the Supabase database (rolled-back transactions only)")


def zzt_export() -> dict:
    text = MOCK.read_text(encoding="utf-8")
    for old, new in RENAMES:
        text = text.replace(old, new)
    return json.loads(text)


def _db_url():
    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        from dotenv import dotenv_values
        env_file = imp.find_upwards(BACKEND, ".env")
        url = dotenv_values(env_file).get("SUPABASE_DB_URL") if env_file else None
    return url


@pytest.fixture(scope="session")
def _connection():
    url = _db_url()
    if not url:
        pytest.skip("SUPABASE_DB_URL not set; database tests skipped")
    import psycopg

    try:
        conn = psycopg.connect(url, autocommit=True, connect_timeout=15)
    except psycopg.OperationalError as e:
        pytest.skip(f"database not reachable: {type(e).__name__}")
    has_column = conn.execute(
        "select 1 from information_schema.columns "
        "where table_name = 'lessons' and column_name = 'evidence_hash'").fetchone()
    if not has_column:
        conn.close()
        pytest.skip("migration 0004 not applied; database tests skipped")
    yield conn
    conn.close()


@pytest.fixture
def db(_connection):
    """The connection inside a transaction that is rolled back at the end of the test."""
    with _connection.transaction(force_rollback=True):
        yield _connection


@pytest.fixture
def export():
    return zzt_export()


class KeepOpen:
    """Context manager that hands the test's connection to a script and never closes it."""

    def __init__(self, conn):
        self.conn = conn

    def __enter__(self):
        return self.conn

    def __exit__(self, *exc):
        return False


@pytest.fixture
def run_script_on_test_db(db, monkeypatch):
    """Make a script's main() use the test connection (inside the rolled-back transaction)."""
    def patch(module):
        monkeypatch.setattr(module, "load_settings", lambda start: {"SUPABASE_DB_URL": "test"})
        monkeypatch.setattr(module, "open_connection", lambda url: KeepOpen(db))
    return patch


def do_import(conn, data, file_name="test_export.json"):
    existing = imp.fetch_existing(conn, [l["id"] for l in data["lessons"]])
    plan = imp.plan_lessons(data, existing)
    result = imp.write_import(conn, data, plan, file_name)
    return plan, result


def publish(conn, lesson_id, version=1):
    """Pass review with top scores, then publish."""
    assert conn.execute("select apply_review(%s,%s,'tester',5,5,5,5,5)", (lesson_id, version)).fetchone()[0] == "reviewed"
    conn.execute("select publish_lesson(%s,%s)", (lesson_id, version))
