"""Tiny SQLite storage for transactions (stdlib only, no ORM).

Single-user for now. Before exposing this to the internet add authentication and a
user_id column - otherwise everyone sees the same transactions.
"""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager

from . import config

TX_TYPES = ("purchase", "sip", "redemption", "dividend")

SCHEMA = """
CREATE TABLE IF NOT EXISTS transactions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    date         TEXT    NOT NULL,                 -- ISO yyyy-mm-dd
    type         TEXT    NOT NULL CHECK (type IN ('purchase','sip','redemption','dividend')),
    amount       REAL    NOT NULL CHECK (amount > 0),   -- always positive; sign comes from type
    scheme_code  INTEGER,
    fund_name    TEXT,
    units        REAL,
    nav          REAL,
    units_source TEXT,                              -- 'user' | 'derived' | NULL
    notes        TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_tx_scheme ON transactions(scheme_code);
"""

_SORTABLE = {"date", "amount", "type", "fund_name", "created_at", "id"}
_FIELDS = ("date", "type", "amount", "scheme_code", "fund_name", "units", "nav", "units_source", "notes")


@contextmanager
def connection():
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with connection() as conn:
        conn.executescript(SCHEMA)


def _row(r: sqlite3.Row | None) -> dict | None:
    return dict(r) if r else None


def insert_tx(conn, data: dict) -> dict:
    cols = [f for f in _FIELDS if f in data]
    cur = conn.execute(
        f"INSERT INTO transactions ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})",
        [data[c] for c in cols],
    )
    return get_tx(conn, cur.lastrowid)


def get_tx(conn, tx_id: int) -> dict | None:
    return _row(conn.execute("SELECT * FROM transactions WHERE id = ?", (tx_id,)).fetchone())


def update_tx(conn, tx_id: int, data: dict) -> dict | None:
    cols = [f for f in _FIELDS if f in data]
    if cols:
        conn.execute(
            f"UPDATE transactions SET {','.join(c + '=?' for c in cols)} WHERE id = ?",
            [data[c] for c in cols] + [tx_id],
        )
    return get_tx(conn, tx_id)


def delete_tx(conn, tx_id: int) -> bool:
    return conn.execute("DELETE FROM transactions WHERE id = ?", (tx_id,)).rowcount > 0


def list_tx(conn, *, scheme_code=None, type=None, date_from=None, date_to=None,
            sort="date", order="desc", limit=100, offset=0) -> tuple[list[dict], int]:
    where, params = [], []
    if scheme_code is not None:
        where.append("scheme_code = ?"); params.append(scheme_code)
    if type:
        where.append("type = ?"); params.append(type)
    if date_from:
        where.append("date >= ?"); params.append(date_from)
    if date_to:
        where.append("date <= ?"); params.append(date_to)
    clause = ("WHERE " + " AND ".join(where)) if where else ""

    sort = sort if sort in _SORTABLE else "date"
    order = "ASC" if str(order).lower() == "asc" else "DESC"
    total = conn.execute(f"SELECT COUNT(*) FROM transactions {clause}", params).fetchone()[0]
    rows = conn.execute(
        f"SELECT * FROM transactions {clause} ORDER BY {sort} {order}, id {order} LIMIT ? OFFSET ?",
        params + [limit, offset],
    ).fetchall()
    return [dict(r) for r in rows], total


def all_tx(conn) -> list[dict]:
    return [dict(r) for r in conn.execute("SELECT * FROM transactions ORDER BY date ASC, id ASC")]
