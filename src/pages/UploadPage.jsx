import { useRef, useState } from 'react';
import { useData } from '../context/DataContext';
import { Upload, CheckCircle, FileSpreadsheet, AlertCircle, Loader } from 'lucide-react';

const FILE_TYPES = [
  {
    key: 'plan',
    label: '경영계획/실적 파일',
    desc: 'tieng viet So. *.xlsx',
    hint: '"월별가마감" 시트 포함 파일',
    color: 'blue',
  },
  {
    key: 'customer',
    label: '고객실적 파일',
    desc: 'khach hang *.xlsx',
    hint: '"(Data)고객별&월별실적" 시트 포함 파일',
    color: 'green',
  },
  {
    key: 'warehouse',
    label: '창고실적 파일',
    desc: 'kho tieng viet *.xlsx',
    hint: '"피벗" 시트 포함 파일',
    color: 'purple',
  },
];

const colorMap = {
  blue:   { border: 'border-blue-400',   bg: 'bg-blue-50',   icon: 'text-blue-500',   badge: 'bg-blue-100 text-blue-700' },
  green:  { border: 'border-green-400',  bg: 'bg-green-50',  icon: 'text-green-500',  badge: 'bg-green-100 text-green-700' },
  purple: { border: 'border-purple-400', bg: 'bg-purple-50', icon: 'text-purple-500', badge: 'bg-purple-100 text-purple-700' },
};

function UploadCard({ type, uploadStatus, onUpload, loading }) {
  const { key, label, desc, hint, color } = type;
  const c = colorMap[color];
  const status = uploadStatus?.[key];
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  const handleFile = (file) => {
    if (!file || !file.name.endsWith('.xlsx')) {
      alert('.xlsx 파일만 업로드 가능합니다.');
      return;
    }
    onUpload(file, key);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-800">{label}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
        </div>
        {status && (
          <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${c.badge}`}>
            <CheckCircle className="w-3.5 h-3.5" />
            업로드 완료
          </span>
        )}
      </div>

      {/* 드래그 영역 */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault(); setDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all text-center
          ${dragging ? `${c.border} ${c.bg}` : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={e => handleFile(e.target.files?.[0])}
        />
        {loading ? (
          <Loader className="w-8 h-8 mx-auto text-slate-400 animate-spin mb-2" />
        ) : (
          <FileSpreadsheet className={`w-8 h-8 mx-auto mb-2 ${c.icon}`} />
        )}
        <p className="text-sm font-medium text-slate-600">
          {loading ? '처리 중...' : '클릭하거나 파일을 드래그하세요'}
        </p>
        <p className="text-xs text-slate-400 mt-1">{desc}</p>
      </div>

      {/* 업로드 이력 */}
      {status && (
        <div className="mt-3 p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
          <p className="font-medium truncate">📄 {status.filename}</p>
          <p className="text-slate-400 mt-0.5">업로드: {status.date}</p>
        </div>
      )}
    </div>
  );
}

export default function UploadPage() {
  const { uploadStatus, loading, uploadFile } = useData();

  const allUploaded = uploadStatus.plan && uploadStatus.customer && uploadStatus.warehouse;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-800">데이터 업로드</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          엑셀 파일 3종을 업로드하면 대시보드가 자동으로 갱신됩니다.
          기존 데이터를 덮어쓰는 방식으로 동작합니다.
        </p>
      </div>

      {/* 안내 배너 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-semibold mb-1">업로드 전 확인사항</p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-700">
            <li>각 파일은 지정된 시트 구조를 유지해야 합니다</li>
            <li>업로드 시 기존 데이터가 즉시 교체됩니다</li>
            <li>데이터는 브라우저 로컬에 저장되므로 같은 기기에서 유지됩니다</li>
            <li>다른 기기에서 보려면 각 기기에서 업로드가 필요합니다</li>
          </ul>
        </div>
      </div>

      {/* 업로드 카드 */}
      <div className="grid gap-4">
        {FILE_TYPES.map(ft => (
          <UploadCard
            key={ft.key}
            type={ft}
            uploadStatus={uploadStatus}
            onUpload={uploadFile}
            loading={loading}
          />
        ))}
      </div>

      {/* 완료 메시지 */}
      {allUploaded && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          <div className="text-sm text-green-800">
            <p className="font-semibold">모든 파일이 업로드되었습니다</p>
            <p className="text-green-700">상단 메뉴에서 경영계획, 고객실적, 창고실적을 확인하세요.</p>
          </div>
        </div>
      )}

      {/* 업로드 이력 요약 */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">업로드 이력</h2>
        <div className="space-y-2">
          {FILE_TYPES.map(ft => {
            const s = uploadStatus?.[ft.key];
            return (
              <div key={ft.key} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <span className="text-sm text-slate-600">{ft.label}</span>
                {s ? (
                  <span className="text-xs text-slate-500">
                    {s.filename} ({s.date})
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">미업로드</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
