from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "experiments.db"
DB_PATH = Path(os.getenv("CRYPTOSCOPE_DB_PATH", str(DEFAULT_DB_PATH)))


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database() -> None:
    with connect() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS experiments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                algorithm TEXT NOT NULL CHECK (algorithm IN ('DES', 'AES', 'RSA')),
                input_size INTEGER NOT NULL,
                input_type TEXT NOT NULL,
                repeat_count INTEGER NOT NULL,
                encrypt_ms REAL NOT NULL,
                decrypt_ms REAL NOT NULL,
                encrypt_median_ms REAL NOT NULL,
                decrypt_median_ms REAL NOT NULL,
                encrypt_measurements TEXT NOT NULL,
                decrypt_measurements TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            )
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_experiments_algorithm_size ON experiments(algorithm, input_size)"
        )
        connection.commit()


def insert_experiment(result: Any) -> dict[str, Any]:
    with connect() as connection:
        cursor = connection.execute(
            """
            INSERT INTO experiments (
                algorithm, input_size, input_type, repeat_count,
                encrypt_ms, decrypt_ms, encrypt_median_ms, decrypt_median_ms,
                encrypt_measurements, decrypt_measurements
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                result.algorithm,
                result.input_size,
                result.input_type,
                result.repeat_count,
                result.encrypt_ms,
                result.decrypt_ms,
                result.encrypt_median_ms,
                result.decrypt_median_ms,
                json.dumps(result.encrypt_measurements),
                json.dumps(result.decrypt_measurements),
            ),
        )
        connection.commit()
        row = connection.execute("SELECT * FROM experiments WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return serialize_row(row)


def serialize_row(row: sqlite3.Row) -> dict[str, Any]:
    data = dict(row)
    data["encrypt_measurements"] = json.loads(data["encrypt_measurements"])
    data["decrypt_measurements"] = json.loads(data["decrypt_measurements"])
    return data


def get_history(limit: int = 100) -> list[dict[str, Any]]:
    with connect() as connection:
        rows = connection.execute(
            "SELECT * FROM experiments ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
    return [serialize_row(row) for row in rows]


def get_all_experiments() -> list[dict[str, Any]]:
    with connect() as connection:
        rows = connection.execute("SELECT * FROM experiments ORDER BY id ASC").fetchall()
    return [serialize_row(row) for row in rows]


def get_summary() -> list[dict[str, Any]]:
    with connect() as connection:
        rows = connection.execute(
            """
            SELECT algorithm,
                   COUNT(*) AS experiment_count,
                   AVG(input_size) AS average_input_size,
                   AVG(encrypt_ms) AS average_encrypt_ms,
                   AVG(decrypt_ms) AS average_decrypt_ms
            FROM experiments
            GROUP BY algorithm
            ORDER BY CASE algorithm WHEN 'AES' THEN 1 WHEN 'DES' THEN 2 ELSE 3 END
            """
        ).fetchall()
    return [dict(row) for row in rows]
