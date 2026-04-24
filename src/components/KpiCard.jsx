export default function KpiCard({ title, value, sub, color = 'blue', trend }) {
  const colorMap = {
    blue:   'border-blue-500 bg-blue-50 text-blue-700',
    green:  'border-green-500 bg-green-50 text-green-700',
    purple: 'border-purple-500 bg-purple-50 text-purple-700',
    red:    'border-red-500 bg-red-50 text-red-700',
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border-l-4 p-4 ${colorMap[color]}`}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{title}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      {trend != null && (
        <p className={`text-xs font-medium mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
        </p>
      )}
    </div>
  );
}
