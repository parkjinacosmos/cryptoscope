# CipherScope — 암호화 알고리즘 분석 및 시각화

DES, AES, RSA의 암호화·복호화 시간을 같은 조건에서 반복 측정하고, 결과를 SQLite에 저장해 그래프와 유사도 기반 알고리즘 추정에 활용하는 교육용 웹 MVP입니다.

## 구현 기능

- **암호화 실험**: 텍스트 입력으로 DES / AES / RSA 실행, 파일 입력으로 AES 실행
- **시간 측정**: 암호화·복호화 연산을 각각 `perf_counter_ns`로 측정하고 반복 측정 평균 및 중앙값 제공
- **복호화 검증**: 복호화 결과가 입력 원본과 일치하는지 확인
- **성능 분석**: 알고리즘별 평균 시간, 데이터 크기별 암호화 패턴 그래프, 최근 실험 기록
- **실험 데이터베이스**: 알고리즘, 입력 크기/종류, 반복 횟수, 평균·중앙값, 개별 측정값, 실행 시각 저장
- **알고리즘 추정**: 새로운 입력 크기 및 암·복호화 시간을 기존 데이터와 비교해 상대 유사도 계산

## 실행 방법

### 1. 백엔드 실행

Python 3.10 이상을 권장합니다.

```bash
cd backend
python -m venv .venv

# Windows PowerShell
.venv\Scripts\Activate.ps1

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
python run.py
```

백엔드 주소: `http://localhost:8000`  
API 문서: `http://localhost:8000/docs`

### 2. 프론트엔드 실행

별도의 터미널에서 실행합니다.

```bash
cd frontend
npm install

# .env.example을 .env로 복사한 뒤 필요하면 API 주소를 수정
npm run dev
```

프론트엔드 주소: `http://localhost:5173`

기본 API 주소는 `http://localhost:8000`입니다. 다른 주소를 사용한다면 `frontend/.env` 파일에 `VITE_API_BASE_URL`을 설정하세요.

## API 요약

| Method | Endpoint | 설명 |
|---|---|---|
| GET | `/api/health` | 서버 상태 확인 |
| POST | `/api/experiments/run` | 텍스트 암호화 실험 |
| POST | `/api/experiments/run/file` | 파일 AES 실험 (multipart/form-data) |
| GET | `/api/experiments/history` | 최근 실험 기록 조회 |
| GET | `/api/experiments/summary` | 알고리즘별 통계 조회 |
| POST | `/api/estimate` | 입력 측정값 기반 알고리즘 유사도 추정 |

`POST /api/experiments/run` 예시:

```json
{
  "algorithm": "AES",
  "text": "CipherScope benchmark",
  "repeat_count": 5
}
```

`POST /api/estimate` 예시:

```json
{
  "input_size": 22,
  "encrypt_ms": 0.03,
  "decrypt_ms": 0.02,
  "input_type": "text"
}
```

## 추정 기능 사용 순서

1. 실험 화면에서 AES, DES, RSA를 각각 한 번 이상 실행합니다.
2. 비교하려는 입력 크기와 비슷한 크기로 각 알고리즘을 여러 번 실험하면 기준 데이터가 더 안정적입니다.
3. 추정 화면에 미지의 측정값(입력 크기, 암호화 시간, 복호화 시간)을 입력합니다.
4. 시스템은 각 알고리즘의 입력 크기 근접 실험 최대 5건의 중앙값을 기준으로 상대 오차를 계산하고, 세 알고리즘 간 유사도를 100% 기준으로 정규화해 표시합니다.

**중요:** 세 알고리즘의 기준 실험 데이터가 모두 있어야 추정 요청이 동작합니다. 유사도는 이 서비스에서 수집한 실험 데이터에 대한 상대적인 근접도이지, 실제 외부 서버의 암호화 방식을 식별하거나 증명하는 값이 아닙니다.

## 암호화·측정 조건 및 주의사항

- **AES**: AES-256 GCM. 입력 파일은 최대 10MB, 텍스트는 UTF-8 기준 최대 2MB입니다.
- **DES**: DES-CBC + PKCS#7 패딩. 오래되고 안전하지 않은 알고리즘이므로 교육·비교 목적 외의 사용을 금지합니다.
- **RSA**: RSA-2048 OAEP(SHA-256). OAEP의 입력 길이 제한으로 최대 190바이트의 작은 데이터만 처리합니다.
- 키 생성 및 알고리즘 준비는 측정 구간에서 제외하고, 암호화 및 복호화 연산 시간만 측정합니다.
- AES/DES/RSA 키와 파일 원문은 데이터베이스에 저장하지 않습니다. 파일의 이름과 내용도 실험 기록에 저장하지 않습니다.
- 측정 결과는 운영체제, CPU, 서버 부하, 런타임, 라이브러리 버전 등에 따라 달라집니다. 가능한 한 같은 환경에서 반복 측정한 결과를 비교해야 합니다.
- DES와 RSA 구성은 실습용입니다. 실제 서비스에서는 AES-GCM과 같은 검증된 현대 암호 구성을 사용하고, 키 관리 및 인증 설계를 별도로 수행해야 합니다.

## 데이터 저장 위치

기본 SQLite 데이터베이스는 `backend/data/experiments.db`에 생성됩니다. 다른 위치를 지정하려면 `CRYPTOSCOPE_DB_PATH` 환경 변수를 설정하세요.

## 프로젝트 구조

```text
cryptoscope/
├── README.md
├── backend/
│   ├── app/
│   │   ├── crypto_service.py
│   │   ├── database.py
│   │   └── main.py
│   ├── requirements.txt
│   └── run.py
└── frontend/
    ├── src/
    │   ├── api.ts
    │   ├── App.tsx
    │   ├── main.tsx
    │   └── styles.css
    ├── index.html
    ├── package.json
    └── vite.config.ts
```
