import { Upload } from 'lucide-react';

export default function NoData({ onUpload }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
        <Upload className="w-8 h-8 text-blue-500" />
      </div>
      <h3 className="text-lg font-semibold text-slate-700 mb-2">데이터가 없습니다</h3>
      <p className="text-sm text-slate-500 mb-6">
        엑셀 파일을 업로드하면 대시보드가 표시됩니다.
      </p>
      {onUpload && (
        <button
          onClick={onUpload}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          파일 업로드하기
        </button>
      )}
    </div>
  );
}
