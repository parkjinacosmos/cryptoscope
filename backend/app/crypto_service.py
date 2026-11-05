"""Educational DES/AES/RSA benchmark helpers.

Timings cover encryption/decryption only. Key generation and setup happen
outside the timed sections so the measured values are easier to compare.
"""

from __future__ import annotations

import statistics
import time
from dataclasses import dataclass
from typing import Callable

from Crypto.Cipher import AES, DES, PKCS1_OAEP
from Crypto.Hash import SHA256
from Crypto.PublicKey import RSA
from Crypto.Random import get_random_bytes
from Crypto.Util.Padding import pad, unpad

RSA_BITS = 2048
RSA_OAEP_MAX_BYTES = RSA_BITS // 8 - 2 * SHA256.digest_size - 2


@dataclass
class BenchmarkResult:
    algorithm: str
    input_size: int
    input_type: str
    repeat_count: int
    encrypt_ms: float
    decrypt_ms: float
    encrypt_median_ms: float
    decrypt_median_ms: float
    encrypt_measurements: list[float]
    decrypt_measurements: list[float]


def _timed(operation: Callable[[], bytes]) -> tuple[bytes, float]:
    started = time.perf_counter_ns()
    result = operation()
    elapsed_ms = (time.perf_counter_ns() - started) / 1_000_000
    return result, elapsed_ms


def benchmark(algorithm: str, plaintext: bytes, input_type: str, repeat_count: int) -> BenchmarkResult:
    """Run repeat_count round trips and return mean/median operation timings."""
    algorithm = algorithm.upper()
    if algorithm not in {"DES", "AES", "RSA"}:
        raise ValueError("지원하지 않는 알고리즘입니다.")

    if algorithm == "RSA" and len(plaintext) > RSA_OAEP_MAX_BYTES:
        raise ValueError(
            f"RSA-2048 OAEP(SHA-256)는 한 번에 최대 {RSA_OAEP_MAX_BYTES}바이트만 암호화할 수 있습니다. "
            "더 작은 텍스트를 입력하거나 AES를 사용해 주세요."
        )

    # Generate keys / prepare cipher configuration before timing starts.
    if algorithm == "AES":
        key = get_random_bytes(32)  # AES-256

        def encrypt() -> bytes:
            cipher = AES.new(key, AES.MODE_GCM, nonce=get_random_bytes(12))
            ciphertext, tag = cipher.encrypt_and_digest(plaintext)
            return cipher.nonce + tag + ciphertext

        def decrypt(payload: bytes) -> bytes:
            nonce, tag, ciphertext = payload[:12], payload[12:28], payload[28:]
            cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
            return cipher.decrypt_and_verify(ciphertext, tag)

    elif algorithm == "DES":
        key = get_random_bytes(8)

        def encrypt() -> bytes:
            iv = get_random_bytes(DES.block_size)
            cipher = DES.new(key, DES.MODE_CBC, iv=iv)
            return iv + cipher.encrypt(pad(plaintext, DES.block_size))

        def decrypt(payload: bytes) -> bytes:
            iv, ciphertext = payload[: DES.block_size], payload[DES.block_size :]
            cipher = DES.new(key, DES.MODE_CBC, iv=iv)
            return unpad(cipher.decrypt(ciphertext), DES.block_size)

    else:  # RSA-OAEP, 2048-bit key
        key_pair = RSA.generate(RSA_BITS)
        public_key = key_pair.publickey()

        def encrypt() -> bytes:
            return PKCS1_OAEP.new(public_key, hashAlgo=SHA256).encrypt(plaintext)

        def decrypt(payload: bytes) -> bytes:
            return PKCS1_OAEP.new(key_pair, hashAlgo=SHA256).decrypt(payload)

    encrypt_measurements: list[float] = []
    decrypt_measurements: list[float] = []

    for _ in range(repeat_count):
        encrypted, encryption_time = _timed(encrypt)
        decrypted, decryption_time = _timed(lambda: decrypt(encrypted))
        if decrypted != plaintext:
            raise RuntimeError("복호화 검증에 실패했습니다.")
        encrypt_measurements.append(encryption_time)
        decrypt_measurements.append(decryption_time)

    return BenchmarkResult(
        algorithm=algorithm,
        input_size=len(plaintext),
        input_type=input_type,
        repeat_count=repeat_count,
        encrypt_ms=statistics.mean(encrypt_measurements),
        decrypt_ms=statistics.mean(decrypt_measurements),
        encrypt_median_ms=statistics.median(encrypt_measurements),
        decrypt_median_ms=statistics.median(decrypt_measurements),
        encrypt_measurements=encrypt_measurements,
        decrypt_measurements=decrypt_measurements,
    )
