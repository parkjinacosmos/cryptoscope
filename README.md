📍 본 프로젝트는 MIDAS 고교 멘토링 사업의 일환으로 진행되었으며, 암호화 알고리즘의 동작 원리와 성능을 탐구하고, 이를 웹 기반 시각화 서비스로 구현하는 것을 목표로 개발되었습니다.


# CipherScope

암호화 알고리즘의 실행 시간을 측정하고 비교·분석하는 웹 기반 암호화 성능 분석 서비스입니다.

AES, DES, RSA 알고리즘을 대상으로 암호화 실행 시간을 분석하고, 실험 결과를 시각화하여 알고리즘별 성능 차이를 확인할 수 있습니다.

## 배포 사이트

🔗 https://wonderful-naiad-354254.netlify.app/


## 주요 기능

- **암호화 성능 측정**: AES, DES, RSA 알고리즘의 암호화 실행 시간 측정
- **알고리즘 비교**: 알고리즘별 성능 차이 비교 및 시각화
- **텍스트 암호화 실험**: 입력한 텍스트를 대상으로 암호화 실험 수행
- **파일 암호화 실험**: 파일 입력을 활용한 암호화 성능 측정
- **실험 기록 관리**: 실험 결과 저장 및 이력 조회
- **알고리즘 추정**: 실행 시간 데이터를 활용한 암호화 알고리즘 추정

## 기술 스택

| 구분 | 기술 |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Python, FastAPI |
| Cryptography | PyCryptodome |
| Visualization | Recharts |
| Database | SQLite |
| Deployment | Netlify, Railway |

## 프로젝트 구조

```text
cryptoscope/
├── frontend/              # React 기반 웹 인터페이스
│   ├── src/
│   ├── public/
│   └── package.json
│
├── backend/               # FastAPI 기반 서버
│   ├── app/
│   └── requirements.txt
│
└── README.md
```

## 로컬 실행 방법

### Backend

```bash
cd backend
python -m venv .venv
```

가상환경 활성화 (Windows):

```bash
source .venv/Scripts/activate
```

의존성 설치 및 서버 실행:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

백엔드 API 문서: http://127.0.0.1:8000/docs

### Frontend

새 터미널에서 실행합니다.

```bash
cd frontend
npm install
npm run dev
```

프론트엔드 접속: http://localhost:5173

배포 환경에서는 `VITE_API_BASE_URL`을 통해 백엔드 API 주소를 설정합니다.

## 배포 환경

- **Frontend**: Netlify
- **Backend**: Railway
- **Database**: SQLite (Railway Volume)

## 프로젝트 목적

암호화 알고리즘의 이론적인 시간 복잡도와 실제 실행 시간의 차이를 분석하고, 실험 데이터를 기반으로 알고리즘별 성능 특성을 시각적으로 이해하는 것을 목표로 합니다.

또한 암호화 실행 시간 데이터를 활용하여 알고리즘을 추정하는 기능을 구현함으로써 암호화 성능 분석의 활용 가능성을 탐색합니다.

## 참고 사항

암호화 실행 시간은 실행 환경, 입력 데이터 크기, 시스템 부하 등에 따라 달라질 수 있습니다. 알고리즘 추정 결과는 실험 데이터에 기반한 분석 결과이며 실제 사용된 암호화 알고리즘을 확정하는 것은 아닙니다.
