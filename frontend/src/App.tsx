import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  checkHealth,
  estimateAlgorithm,
  getHistory,
  getSummary,
  runFileExperiment,
  runTextExperiment,
  type Algorithm,
  type EstimateResult,
  type Experiment,
  type Summary,
} from './api';

type View = 'experiment' | 'analysis' | 'estimate';

const algorithmInfo: Record<Algorithm, { title: string; description: string; detail: string }> = {
  AES: {
    title: 'AES-256',
    description: '대칭키 암호화',
    detail: '파일과 일반 텍스트에 사용할 수 있습니다. 본 실험은 GCM 모드를 사용합니다.',
  },
  DES: {
    title: 'DES',
    description: '대칭키 암호화',
    detail: '비교·학습 목적으로만 제공합니다. 키 길이가 짧아 실제 보안 용도로 사용하면 안 됩니다.',
  },
  RSA: {
    title: 'RSA-2048',
    description: '공개키 암호화',
    detail: 'OAEP(SHA-256) 방식입니다. 한 번에 최대 190바이트의 작은 데이터만 처리할 수 있습니다.',
  },
};

function formatMs(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (value < 0.001) return `${(value * 1000).toFixed(2)} μs`;
  return `${value.toFixed(4)} ms`;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
}

function App() {
  const [view, setView] = useState<View>('experiment');
  const [history, setHistory] = useState<Experiment[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [latest, setLatest] = useState<Experiment | null>(null);
  const [apiOnline, setApiOnline] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [toast, setToast] = useState('');

  const refreshData = async () => {
    try {
      const [items, aggregates] = await Promise.all([getHistory(), getSummary()]);
      setHistory(items);
      setSummary(aggregates);
    } catch (error) {
      setToast(error instanceof Error ? error.message : '데이터를 불러오지 못했습니다.');
    }
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const online = await checkHealth();
      if (!alive) return;
      setApiOnline(online);
      if (online) {
        try {
          const [items, aggregates] = await Promise.all([getHistory(), getSummary()]);
          if (!alive) return;
          setHistory(items);
          setSummary(aggregates);
        } catch {
          setApiOnline(false);
        }
      }
      if (alive) setLoadingData(false);
    };
    void load();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const totalExperiments = history.length;
  const averageTime = useMemo(() => {
    if (!history.length) return 0;
    return history.reduce((sum, item) => sum + item.encrypt_ms + item.decrypt_ms, 0) / (history.length * 2);
  }, [history]);

  const handleExperimentComplete = async (result: Experiment) => {
    setLatest(result);
    setApiOnline(true);
    await refreshData();
    setToast(`${result.algorithm} 실험이 완료되어 데이터베이스에 저장되었습니다.`);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" onClick={() => setView('experiment')} aria-label="CipherScope 홈">
          <span className="brand-mark"><span /></span>
          <span className="brand-copy"><strong>CipherScope</strong><small>CRYPTO ANALYSIS LAB</small></span>
        </a>
        <nav className="main-nav" aria-label="주요 메뉴">
          <button className={view === 'experiment' ? 'nav-link active' : 'nav-link'} onClick={() => setView('experiment')}>암호화 실험</button>
          <button className={view === 'analysis' ? 'nav-link active' : 'nav-link'} onClick={() => setView('analysis')}>성능 분석</button>
          <button className={view === 'estimate' ? 'nav-link active' : 'nav-link'} onClick={() => setView('estimate')}>알고리즘 추정</button>
        </nav>
        <div className="topbar-right">
          <span className={`connection-pill ${apiOnline ? 'online' : 'offline'}`}><i />{apiOnline ? 'API 연결됨' : 'API 연결 대기'}</span>
          <span className="avatar">CS</span>
        </div>
      </header>

      <main id="top" className="page-container">
        <section className="welcome-row">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> CRYPTOGRAPHY PERFORMANCE STUDIO</div>
            <h1>{view === 'experiment' ? '암호화 알고리즘 실험실' : view === 'analysis' ? '성능 분석 대시보드' : '알고리즘 추정 엔진'}</h1>
            <p className="page-subtitle">
              {view === 'experiment'
                ? '같은 조건에서 암호화·복호화 시간을 측정하고 결과를 기록합니다.'
                : view === 'analysis'
                  ? '누적된 실험 데이터를 바탕으로 알고리즘별 성능과 처리 패턴을 비교합니다.'
                  : '새로운 측정값을 기존 실험 데이터와 비교해 가장 유사한 알고리즘을 추정합니다.'}
            </p>
          </div>
          <div className="date-chip"><span className="date-dot" /> LIVE BENCHMARK ENVIRONMENT</div>
        </section>

        <section className="metrics-grid" aria-label="실험 현황">
          <MetricCard label="누적 실험" value={totalExperiments.toLocaleString('ko-KR')} suffix="회" helper="저장된 전체 실험" icon="▤" />
          <MetricCard label="실험 알고리즘" value={`${summary.length}`} suffix="/ 3" helper="기준 데이터 확보 현황" icon="⌘" />
          <MetricCard label="평균 처리 시간" value={averageTime ? formatMs(averageTime) : '—'} suffix="" helper="암·복호화 평균" icon="◷" />
          <MetricCard label="기준 데이터" value={`${summary.reduce((sum, item) => sum + item.experiment_count, 0)}`} suffix="건" helper="알고리즘 비교에 활용" icon="▥" />
        </section>

        {!apiOnline && !loadingData && (
          <div className="connection-warning">
            <span className="warning-icon">!</span>
            <div><strong>백엔드 서버에 연결할 수 없습니다.</strong><span>backend 폴더에서 서버를 실행한 뒤 새로고침해 주세요. 실행 방법은 README.md에 안내되어 있습니다.</span></div>
          </div>
        )}

        {view === 'experiment' && (
          <ExperimentView latest={latest} onComplete={handleExperimentComplete} onError={setToast} />
        )}
        {view === 'analysis' && <AnalysisView history={history} summary={summary} loading={loadingData} />}
        {view === 'estimate' && <EstimateView latest={latest} onError={setToast} />}

        <footer className="footer"><span>© 2026 CipherScope</span><span>Educational benchmark · DES / AES / RSA</span></footer>
      </main>
      {toast && <div className="toast" role="status"><span className="toast-check">✓</span>{toast}<button onClick={() => setToast('')} aria-label="알림 닫기">×</button></div>}
    </div>
  );
}

function MetricCard({ label, value, suffix, helper, icon }: { label: string; value: string; suffix: string; helper: string; icon: string }) {
  return (
    <article className="metric-card">
      <div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div>
      <div className="metric-value">{value}<small>{suffix}</small></div>
      <div className="metric-helper">{helper}</div>
    </article>
  );
}

function Panel({ title, subtitle, action, children, className = '' }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>
      {children}
    </section>
  );
}

function ExperimentView({ latest, onComplete, onError }: { latest: Experiment | null; onComplete: (result: Experiment) => void; onError: (message: string) => void }) {
  const [algorithm, setAlgorithm] = useState<Algorithm>('AES');
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text');
  const [text, setText] = useState('CipherScope는 암호화 알고리즘의 처리 시간을 비교합니다.');
  const [file, setFile] = useState<File | null>(null);
  const [repeatCount, setRepeatCount] = useState(5);
  const [running, setRunning] = useState(false);

  const selectedAlgorithm: Algorithm = inputMode === 'file' ? 'AES' : algorithm;
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setRunning(true);
    try {
      const result = inputMode === 'file'
        ? file ? await runFileExperiment(file, repeatCount) : (() => { throw new Error('실험할 파일을 선택해 주세요.'); })()
        : await runTextExperiment(selectedAlgorithm, text, repeatCount);
      onComplete(result);
    } catch (error) {
      onError(error instanceof Error ? error.message : '실험에 실패했습니다.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="content-grid experiment-grid">
      <Panel title="실험 조건 설정" subtitle="측정할 알고리즘과 입력 데이터를 선택하세요." className="form-panel">
        <form onSubmit={handleSubmit}>
          <div className="field-block">
            <label className="field-label">입력 방식</label>
            <div className="segmented-control">
              <button type="button" className={inputMode === 'text' ? 'selected' : ''} onClick={() => setInputMode('text')}>텍스트 입력</button>
              <button type="button" className={inputMode === 'file' ? 'selected' : ''} onClick={() => { setInputMode('file'); setAlgorithm('AES'); }}>파일 업로드</button>
            </div>
          </div>

          {inputMode === 'text' ? (
            <div className="field-block">
              <label className="field-label" htmlFor="algorithm">암호화 알고리즘</label>
              <div className="algorithm-options">
                {(['AES', 'DES', 'RSA'] as Algorithm[]).map((item) => (
                  <button type="button" key={item} className={`algorithm-option ${algorithm === item ? 'chosen' : ''}`} onClick={() => setAlgorithm(item)}>
                    <span className={`algorithm-symbol ${item.toLowerCase()}`}>{item === 'AES' ? 'A' : item === 'DES' ? 'D' : 'R'}</span>
                    <span><strong>{algorithmInfo[item].title}</strong><small>{algorithmInfo[item].description}</small></span>
                    <i className="radio-indicator" />
                  </button>
                ))}
              </div>
              <p className="field-hint">{algorithmInfo[algorithm].detail}</p>
            </div>
          ) : (
            <div className="field-block">
              <label className="field-label" htmlFor="file-upload">실험 파일 <span className="field-label-note">AES-256 GCM</span></label>
              <label className={`upload-area ${file ? 'has-file' : ''}`} htmlFor="file-upload">
                <input id="file-upload" type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
                <span className="upload-icon">↑</span>
                <strong>{file ? file.name : '파일을 선택하거나 여기에 끌어다 놓으세요'}</strong>
                <small>{file ? `${formatBytes(file.size)} · 선택 완료` : '최대 10MB · 모든 파일 형식 지원'}</small>
              </label>
              <p className="field-hint">파일은 브라우저에서 API로 전송되어 AES로 실험한 뒤, 파일 내용 자체는 저장하지 않습니다.</p>
            </div>
          )}

          {inputMode === 'text' && (
            <div className="field-block">
              <div className="label-row"><label className="field-label" htmlFor="plain-text">입력 텍스트</label><span className="counter">{new TextEncoder().encode(text).length.toLocaleString('ko-KR')} bytes</span></div>
              <textarea id="plain-text" className="text-input" value={text} onChange={(event) => setText(event.target.value)} rows={5} placeholder="암호화할 텍스트를 입력하세요." />
            </div>
          )}

          <div className="field-block repeat-block">
            <div className="label-row"><label className="field-label" htmlFor="repeat-count">반복 측정 횟수</label><strong className="repeat-value">{repeatCount}회</strong></div>
            <input id="repeat-count" type="range" min="1" max="30" step="1" value={repeatCount} onChange={(event) => setRepeatCount(Number(event.target.value))} />
            <div className="range-labels"><span>1회</span><span>30회</span></div>
          </div>

          <button className="primary-button run-button" type="submit" disabled={running || (inputMode === 'file' && !file)}>
            {running ? <><span className="spinner" /> 측정 실행 중...</> : <>실험 실행하기 <span>↗</span></>}
          </button>
          <div className="secure-note"><span>⌁</span> 암호화 키는 실험 요청 단위로 생성되며 데이터베이스에 저장하지 않습니다.</div>
        </form>
      </Panel>

      <div className="right-column">
        <Panel title="실험 결과" subtitle="가장 최근에 실행한 측정 결과입니다." action={<span className="live-tag">● RESULT</span>}>
          {latest ? <ResultSummary result={latest} /> : <EmptyState title="아직 실행한 실험이 없습니다." description="왼쪽에서 알고리즘과 입력 데이터를 설정한 뒤 실험을 시작하세요." />}
        </Panel>

        <Panel title="측정 알고리즘 안내" subtitle="알고리즘별 처리 방식과 실험 조건">
          <div className="algorithm-guide-list">
            <AlgorithmGuide code="AES" title="AES-256 GCM" text="대용량 데이터에 적합한 대칭키 방식. 암호화와 무결성 검증을 함께 측정합니다." />
            <AlgorithmGuide code="DES" title="DES-CBC" text="비교를 위한 레거시 대칭키 방식. 패딩 및 초기화 벡터 처리가 포함됩니다." />
            <AlgorithmGuide code="RSA" title="RSA-2048 OAEP" text="공개키 방식. 키 생성 시간은 제외하고 암·복호화 연산만 측정합니다." />
          </div>
        </Panel>
        <div className="notice-card"><span className="notice-symbol">i</span><div><strong>측정값은 실행 환경의 영향을 받습니다.</strong><p>브라우저·서버 부하, CPU, 데이터 크기에 따라 결과가 달라질 수 있습니다. 동일 환경에서 여러 번 측정한 평균값을 비교하세요.</p></div></div>
      </div>
    </div>
  );
}

function ResultSummary({ result }: { result: Experiment }) {
  return (
    <div className="result-content">
      <div className="result-topline"><span className={`result-chip ${result.algorithm.toLowerCase()}`}>{result.algorithm}</span><span className="result-date">실험 #{result.id} · {formatDate(result.created_at)}</span></div>
      <div className="result-metrics">
        <div className="result-metric"><span>암호화 평균</span><strong>{formatMs(result.encrypt_ms)}</strong><small>중앙값 {formatMs(result.encrypt_median_ms)}</small></div>
        <div className="result-metric"><span>복호화 평균</span><strong>{formatMs(result.decrypt_ms)}</strong><small>중앙값 {formatMs(result.decrypt_median_ms)}</small></div>
      </div>
      <div className="result-details">
        <div><span>입력 데이터 크기</span><strong>{formatBytes(result.input_size)}</strong></div>
        <div><span>입력 유형</span><strong>{result.input_type === 'file' ? '파일' : '텍스트'}</strong></div>
        <div><span>반복 측정</span><strong>{result.repeat_count}회</strong></div>
        <div><span>복호화 검증</span><strong className="verified">✓ 일치 확인</strong></div>
      </div>
      <div className="measurement-strip"><strong>회차별 암호화 시간</strong><div>{result.encrypt_measurements.map((value, index) => <span key={index} title={`${index + 1}회: ${formatMs(value)}`}>{formatMs(value)}</span>)}</div></div>
      <p className="result-caption">암호화와 복호화가 정상적으로 완료되었으며, 원본 데이터와 복호화 결과가 일치합니다.</p>
    </div>
  );
}

function AlgorithmGuide({ code, title, text }: { code: string; title: string; text: string }) {
  return <div className="guide-row"><span className={`guide-code ${code.toLowerCase()}`}>{code}</span><div><strong>{title}</strong><p>{text}</p></div></div>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><span className="empty-icon">⌁</span><strong>{title}</strong><p>{description}</p></div>;
}

function AnalysisView({ history, summary, loading }: { history: Experiment[]; summary: Summary[]; loading: boolean }) {
  const trendData = useMemo(() => {
    const groups = new Map<number, { input_size: number; AES: number | null; DES: number | null; RSA: number | null; counts: Record<Algorithm, number> }>();
    history.forEach((item) => {
      const row = groups.get(item.input_size) || { input_size: item.input_size, AES: null, DES: null, RSA: null, counts: { AES: 0, DES: 0, RSA: 0 } };
      const previousCount = row.counts[item.algorithm];
      const previousAverage = row[item.algorithm] ?? 0;
      row[item.algorithm] = (previousAverage * previousCount + item.encrypt_ms) / (previousCount + 1);
      row.counts[item.algorithm] += 1;
      groups.set(item.input_size, row);
    });
    return [...groups.values()].sort((a, b) => a.input_size - b.input_size);
  }, [history]);

  return (
    <div className="analysis-layout">
      <div className="analysis-grid">
        <Panel title="알고리즘별 평균 처리 시간" subtitle="누적 실험의 알고리즘별 평균 암호화·복호화 시간" className="chart-panel">
          {loading ? <ChartPlaceholder /> : summary.length ? (
            <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={summary} barGap={8} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5" />
              <XAxis dataKey="algorithm" tickLine={false} axisLine={false} tick={{ fill: '#747d91', fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: '#9aa2b2', fontSize: 11 }} width={58} />
              <Tooltip formatter={(value) => [`${Number(value).toFixed(4)} ms`, '']} contentStyle={{ borderRadius: 12, border: '1px solid #edf0f5', boxShadow: '0 8px 24px #27344d12' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: '#747d91' }} />
              <Bar dataKey="average_encrypt_ms" name="암호화" fill="#655ce6" radius={[5, 5, 0, 0]} maxBarSize={38} />
              <Bar dataKey="average_decrypt_ms" name="복호화" fill="#a9a3f4" radius={[5, 5, 0, 0]} maxBarSize={38} />
            </BarChart></ResponsiveContainer></div>
          ) : <EmptyState title="비교할 데이터가 없습니다." description="암호화 실험을 실행하면 알고리즘별 평균 처리 시간이 표시됩니다." />}
        </Panel>

        <Panel title="데이터 크기별 처리 패턴" subtitle="입력 크기가 같은 실험의 평균 암호화 시간 · 단위 ms" className="chart-panel">
          {loading ? <ChartPlaceholder /> : trendData.length ? (
            <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={trendData} margin={{ top: 12, right: 18, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5" />
              <XAxis dataKey="input_size" tickLine={false} axisLine={false} tick={{ fill: '#747d91', fontSize: 11 }} tickFormatter={(value) => formatBytes(Number(value))} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: '#9aa2b2', fontSize: 11 }} width={58} />
              <Tooltip labelFormatter={(value) => `입력 크기 ${formatBytes(Number(value))}`} formatter={(value) => [value == null ? '—' : `${Number(value).toFixed(4)} ms`, '']} contentStyle={{ borderRadius: 12, border: '1px solid #edf0f5' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: '#747d91' }} />
              <Line type="monotone" dataKey="AES" name="AES" stroke="#655ce6" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="DES" name="DES" stroke="#22a88a" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="RSA" name="RSA" stroke="#e49a42" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
            </LineChart></ResponsiveContainer></div>
          ) : <EmptyState title="처리 패턴 데이터가 없습니다." description="서로 다른 크기의 입력 데이터로 실험을 진행해 보세요." />}
        </Panel>
      </div>

      <Panel title="알고리즘별 실험 요약" subtitle="현재 데이터베이스에 저장된 기준 데이터">
        {summary.length ? (
          <div className="table-wrap"><table className="data-table"><thead><tr><th>알고리즘</th><th>실험 횟수</th><th>평균 입력 크기</th><th>평균 암호화</th><th>평균 복호화</th></tr></thead><tbody>
            {summary.map((item) => <tr key={item.algorithm}><td><span className={`table-algorithm ${item.algorithm.toLowerCase()}`}>{item.algorithm}</span></td><td>{item.experiment_count}회</td><td>{formatBytes(Math.round(item.average_input_size))}</td><td>{formatMs(item.average_encrypt_ms)}</td><td>{formatMs(item.average_decrypt_ms)}</td></tr>)}
          </tbody></table></div>
        ) : <EmptyState title="아직 누적된 실험이 없습니다." description="암호화 실험 메뉴에서 DES, AES, RSA를 실행해 주세요." />}
      </Panel>

      <Panel title="최근 실험 기록" subtitle="최근 실행된 실험 8건">
        <HistoryTable items={history.slice(0, 8)} />
      </Panel>
    </div>
  );
}

function HistoryTable({ items }: { items: Experiment[] }) {
  if (!items.length) return <EmptyState title="저장된 실험 기록이 없습니다." description="실험 결과가 자동으로 이곳에 저장됩니다." />;
  return (
    <div className="table-wrap"><table className="data-table"><thead><tr><th>알고리즘</th><th>입력 크기</th><th>암호화</th><th>복호화</th><th>반복</th><th>실행 시각</th></tr></thead><tbody>
      {items.map((item) => <tr key={item.id}><td><span className={`table-algorithm ${item.algorithm.toLowerCase()}`}>{item.algorithm}</span></td><td>{formatBytes(item.input_size)}</td><td>{formatMs(item.encrypt_ms)}</td><td>{formatMs(item.decrypt_ms)}</td><td>{item.repeat_count}회</td><td className="muted-cell">{formatDate(item.created_at)}</td></tr>)}
    </tbody></table></div>
  );
}

function ChartPlaceholder() {
  return <div className="chart-placeholder"><span className="spinner dark" /> 그래프 데이터를 불러오는 중입니다.</div>;
}

function EstimateView({ latest, onError }: { latest: Experiment | null; onError: (message: string) => void }) {
  const [inputSize, setInputSize] = useState(latest ? String(latest.input_size) : '1024');
  const [encryptTime, setEncryptTime] = useState(latest ? String(latest.encrypt_ms) : '');
  const [decryptTime, setDecryptTime] = useState(latest ? String(latest.decrypt_ms) : '');
  const [inputType, setInputType] = useState<'text' | 'file'>(latest?.input_type || 'text');
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!latest) return;
    setInputSize(String(latest.input_size));
    setEncryptTime(String(latest.encrypt_ms));
    setDecryptTime(String(latest.decrypt_ms));
    setInputType(latest.input_type);
  }, [latest]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setRunning(true);
    setResult(null);
    try {
      const estimate = await estimateAlgorithm({
        input_size: Number(inputSize),
        encrypt_ms: Number(encryptTime),
        decrypt_ms: Number(decryptTime),
        input_type: inputType,
      });
      setResult(estimate);
    } catch (error) {
      onError(error instanceof Error ? error.message : '알고리즘 추정에 실패했습니다.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="content-grid estimate-grid">
      <Panel title="측정값 입력" subtitle="분석할 데이터의 크기와 암·복호화 시간을 입력하세요." className="form-panel">
        <form onSubmit={submit}>
          <div className="field-block"><label className="field-label" htmlFor="estimate-size">입력 데이터 크기 (bytes)</label><input id="estimate-size" className="number-input" type="number" min="1" max="10485760" value={inputSize} onChange={(event) => setInputSize(event.target.value)} required /></div>
          <div className="two-fields">
            <div className="field-block"><label className="field-label" htmlFor="estimate-encrypt">암호화 시간 (ms)</label><input id="estimate-encrypt" className="number-input" type="number" min="0.000001" step="any" value={encryptTime} onChange={(event) => setEncryptTime(event.target.value)} placeholder="예: 0.025" required /></div>
            <div className="field-block"><label className="field-label" htmlFor="estimate-decrypt">복호화 시간 (ms)</label><input id="estimate-decrypt" className="number-input" type="number" min="0.000001" step="any" value={decryptTime} onChange={(event) => setDecryptTime(event.target.value)} placeholder="예: 0.018" required /></div>
          </div>
          <div className="field-block"><label className="field-label">입력 유형</label><div className="segmented-control"><button type="button" className={inputType === 'text' ? 'selected' : ''} onClick={() => setInputType('text')}>텍스트</button><button type="button" className={inputType === 'file' ? 'selected' : ''} onClick={() => setInputType('file')}>파일</button></div></div>
          <button className="primary-button run-button" type="submit" disabled={running || !inputSize || !encryptTime || !decryptTime}>{running ? <><span className="spinner" /> 분석 중...</> : <>알고리즘 추정하기 <span>↗</span></>}</button>
          <button className="secondary-button full-width" type="button" disabled={!latest} onClick={() => { if (latest) { setInputSize(String(latest.input_size)); setEncryptTime(String(latest.encrypt_ms)); setDecryptTime(String(latest.decrypt_ms)); setInputType(latest.input_type); } }}>최근 실험값 불러오기</button>
        </form>
      </Panel>

      <div className="right-column">
        <Panel title="추정 결과" subtitle="실험 데이터와의 유사도 분석">
          {result ? <EstimateResultCard result={result} /> : <EmptyState title="분석 대기 중" description="측정값을 입력하고 추정 버튼을 누르면 알고리즘별 유사도를 계산합니다." />}
        </Panel>
        <div className="notice-card"><span className="notice-symbol">i</span><div><strong>추정 기능의 한계</strong><p>처리 시간은 서버 환경, CPU 부하, 라이브러리, 키 길이, 구현 방식 등에 영향을 받습니다. 이 결과는 저장된 실험 데이터와의 유사도를 계산한 참고값이며, 실제 서버에서 사용한 알고리즘을 확정하지 않습니다.</p></div></div>
      </div>
    </div>
  );
}

function EstimateResultCard({ result }: { result: EstimateResult }) {
  return (
    <div className="estimate-result">
      <div className="estimate-winner-label">가장 유사한 알고리즘</div>
      <div className="estimate-winner"><strong>{result.top_algorithm}</strong><span>{result.top_similarity.toFixed(2)}<small>%</small></span></div>
      <div className="similarity-list">
        {result.results.map((item, index) => <div className="similarity-item" key={item.algorithm}>
          <div className="similarity-head"><span><i className={`legend-dot ${item.algorithm.toLowerCase()}`} />{item.algorithm}{index === 0 && <em>BEST MATCH</em>}</span><strong>{item.similarity.toFixed(2)}%</strong></div>
          <div className="similarity-track"><span className={item.algorithm.toLowerCase()} style={{ width: `${item.similarity}%` }} /></div>
          <div className="similarity-meta"><span>기준 실험 {item.reference_count}건</span><span>기준 암호화 {formatMs(item.expected_encrypt_ms)}</span><span>기준 복호화 {formatMs(item.expected_decrypt_ms)}</span></div>
        </div>)}
      </div>
      <p className="estimate-disclaimer">ⓘ {result.notice}</p>
    </div>
  );
}

export default App;
