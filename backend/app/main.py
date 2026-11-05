
from __future__ import annotations

import math
import os
from datetime import datetime, timezone
from typing import Literal

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from . import database
from .crypto_service import RSA_OAEP_MAX_BYTES, benchmark

MAX_TEXT_BYTES = 2 * 1024 * 1024
MAX_FILE_BYTES = 10 * 1024 * 1024

app = FastAPI(
    title="CipherScope API",
    version="1.0.0",
    description="DES, AES, RSA educational benchmark and similarity-estimation API",
)

# CORS settings
local_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

deployment_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("FRONTEND_ORIGIN", "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=local_origins + deployment_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunRequest(BaseModel):
    algorithm: Literal["DES", "AES", "RSA"]
    text: str = Field(max_length=MAX_TEXT_BYTES)
    repeat_count: int = Field(default=5, ge=1, le=30)


class EstimateRequest(BaseModel):
    input_size: int = Field(gt=0, le=MAX_FILE_BYTES)
    encrypt_ms: float = Field(gt=0, le=600_000)
    decrypt_ms: float = Field(gt=0, le=600_000)
    input_type: Literal["text", "file"] = "text"

    @field_validator("encrypt_ms", "decrypt_ms")
    @classmethod
    def finite_time(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("측정 시간은 유한한 양수여야 합니다.")
        return value


@app.on_event("startup")
def startup() -> None:
    database.initialize_database()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "CipherScope API"}


def _run_and_store(
    algorithm: str,
    content: bytes,
    input_type: str,
    repeat_count: int,
) -> dict:
    try:
        result = benchmark(
            algorithm,
            content,
            input_type,
            repeat_count,
        )
        return database.insert_experiment(result)

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"실험 처리 중 오류가 발생했습니다: {error}",
        ) from error


@app.post("/api/experiments/run")
def run_text_experiment(request: RunRequest) -> dict:
    content = request.text.encode("utf-8")

    if len(content) > MAX_TEXT_BYTES:
        raise HTTPException(
            status_code=413,
            detail="텍스트 입력은 UTF-8 기준 최대 2MB까지 가능합니다.",
        )

    return _run_and_store(
        request.algorithm,
        content,
        "text",
        request.repeat_count,
    )


@app.post("/api/experiments/run/file")
async def run_file_experiment(
    file: UploadFile = File(...),
    repeat_count: int = Query(default=5, ge=1, le=30),
) -> dict:
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="파일을 선택해 주세요.",
        )

    content = await file.read(MAX_FILE_BYTES + 1)

    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="파일 입력은 최대 10MB까지 가능합니다.",
        )

    if not content:
        raise HTTPException(
            status_code=400,
            detail="빈 파일은 실험할 수 없습니다.",
        )

    return _run_and_store(
        "AES",
        content,
        "file",
        repeat_count,
    )


@app.get("/api/experiments/history")
def experiment_history(
    limit: int = Query(default=100, ge=1, le=500),
) -> dict:
    return {
        "items": database.get_history(limit)
    }


@app.get("/api/experiments/summary")
def experiment_summary() -> dict:
    return {
        "items": database.get_summary()
    }


def _median(values: list[float]) -> float:
    ordered = sorted(values)
    middle = len(ordered) // 2

    if len(ordered) % 2:
        return ordered[middle]

    return (ordered[middle - 1] + ordered[middle]) / 2


@app.post("/api/estimate")
def estimate_algorithm(request: EstimateRequest) -> dict:
    records = database.get_all_experiments()

    algorithms = ("DES", "AES", "RSA")
    candidates: list[dict] = []
    missing: list[str] = []

    for algorithm in algorithms:
        same_algorithm = [
            item
            for item in records
            if item["algorithm"] == algorithm
        ]

        if not same_algorithm:
            missing.append(algorithm)
            continue

        # Find up to five records with the closest input sizes.
        nearest = sorted(
            same_algorithm,
            key=lambda item: abs(
                math.log(
                    (item["input_size"] + 1)
                    / (request.input_size + 1)
                )
            ),
        )[:5]

        expected_encrypt = _median([
            float(item["encrypt_ms"])
            for item in nearest
        ])

        expected_decrypt = _median([
            float(item["decrypt_ms"])
            for item in nearest
        ])

        size_distance = sum(
            abs(
                math.log(
                    (item["input_size"] + 1)
                    / (request.input_size + 1)
                )
            )
            for item in nearest
        ) / len(nearest)

        # Compare relative encryption/decryption time differences.
        time_error = (
            abs(
                math.log(
                    request.encrypt_ms
                    / max(expected_encrypt, 1e-9)
                )
            )
            +
            abs(
                math.log(
                    request.decrypt_ms
                    / max(expected_decrypt, 1e-9)
                )
            )
        ) / 2

        score = time_error + 0.20 * size_distance

        candidates.append({
            "algorithm": algorithm,
            "score": score,
            "reference_count": len(same_algorithm),
            "reference_size_count": len(nearest),
            "expected_encrypt_ms": expected_encrypt,
            "expected_decrypt_ms": expected_decrypt,
        })

    if missing:
        raise HTTPException(
            status_code=409,
            detail={
                "message": (
                    "세 알고리즘의 기준 데이터가 모두 필요합니다. "
                    "각 알고리즘으로 먼저 실험을 실행해 주세요."
                ),
                "missing_algorithms": missing,
            },
        )

    # Convert scores into relative similarity values.
    weights = [
        math.exp(-min(item["score"], 50))
        for item in candidates
    ]

    total_weight = sum(weights) or 1.0

    for item, weight in zip(candidates, weights):
        item["similarity"] = round(
            weight / total_weight * 100,
            2,
        )

        item["score"] = round(item["score"], 5)

        item["expected_encrypt_ms"] = round(
            item["expected_encrypt_ms"],
            6,
        )

        item["expected_decrypt_ms"] = round(
            item["expected_decrypt_ms"],
            6,
        )

    candidates.sort(
        key=lambda item: item["score"]
    )

    return {
        "top_algorithm": candidates[0]["algorithm"],
        "top_similarity": candidates[0]["similarity"],
        "input_size": request.input_size,
        "input_type": request.input_type,
        "results": candidates,
        "notice": (
            "실험 데이터의 시간 패턴에 기반한 유사도 추정입니다. "
            "실제 서버의 암호화 알고리즘을 확정하거나 식별하지 않습니다."
        ),
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
    }
