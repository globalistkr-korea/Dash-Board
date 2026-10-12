import { useEffect, useState } from 'react';
import { localizeText } from '../lib/i18n';
import { useLang } from '../context/LangContext';

export default function SourceSyncStatus() {
  const { lang } = useLang();
  const [status, setStatus] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let active = true;
    const check = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch('/pnl-sync.json', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Sync status unavailable');
        const value = await response.json();
        if (value.status !== 'ok' || !Number.isFinite(Date.parse(value.lastCheckedAt))) throw new Error('Invalid sync status');
        if (active) { setStatus(value); setUnavailable(false); }
      } catch { if (active) setUnavailable(true); }
      finally { clearTimeout(timeout); }
    };
    check();
    const timer = setInterval(check, 5 * 60 * 1000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  const format = value => new Date(value).toLocaleString(lang === 'ko' ? 'ko-KR' : lang === 'vi' ? 'vi-VN' : 'en-GB', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
  if (!status && !unavailable) return null;
  return <div className={`mb-3 rounded-lg px-3 py-2 text-xs ${unavailable ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-700'}`}>
    {localizeText('원본 · 요청 시 수집', 'Source · collected on request', lang)}
    {status && <> · {localizeText('확인', 'Checked', lang)} {format(status.lastCheckedAt)} · {localizeText('실적 갱신', 'Data updated', lang)} {format(status.lastUpdatedAt)}</>}
    {(unavailable) && <span className="ml-2">{localizeText('수집 상태 확인 불가 · 마지막 정상 실적 유지', 'Check source sync · retaining last validated data', lang)}</span>}
  </div>;
}
