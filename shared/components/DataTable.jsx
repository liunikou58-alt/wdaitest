/**
 * DataTable — 通用資料表格元件
 * 
 * Props:
 *   columns: [{ key, label, width?, render? }]
 *   data: array
 *   emptyIcon, emptyText
 *   searchable: bool
 *   searchPlaceholder: string
 *   actions: (row) => JSX  — 操作欄
 */
import { useState, useMemo } from 'react'

export default function DataTable({ columns = [], data = [], emptyIcon = '📭', emptyText = '尚無資料', searchable = false, searchPlaceholder = '搜尋...', searchFields = [], actions, onRowClick, pageSize = 15 }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const filtered = useMemo(() => {
    let rows = data;
    if (search && searchFields.length) {
      const q = search.toLowerCase();
      rows = rows.filter(r => searchFields.some(f => String(r[f] || '').toLowerCase().includes(q)));
    }
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortKey] || '', bv = b[sortKey] || '';
        const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  }, [data, search, searchFields, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  if (!data.length && !searchable) {
    return <div className="empty-state"><div className="empty-state-icon">{emptyIcon}</div><div className="empty-state-title">{emptyText}</div></div>;
  }

  return (
    <div>
      {searchable && (
        <div style={{ marginBottom: 12 }}>
          <input className="form-input" placeholder={searchPlaceholder} value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ maxWidth: 320 }} />
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead><tr>
            {columns.map(col => (
              <th key={col.key} style={{ width: col.width, cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleSort(col.key)}>
                {col.label} {sortKey === col.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
            ))}
            {actions && <th style={{ width: 80 }}>操作</th>}
          </tr></thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={columns.length + (actions ? 1 : 0)} style={{ textAlign: 'center', padding: 30, color: 'var(--c-text-muted)' }}>{search ? '無符合結果' : emptyText}</td></tr>
            ) : paged.map((row, i) => (
              <tr key={row.id || i} onClick={() => onRowClick?.(row)} style={{ cursor: onRowClick ? 'pointer' : 'default' }}>
                {columns.map(col => (
                  <td key={col.key} style={col.style}>
                    {col.render ? col.render(row[col.key], row) : row[col.key] ?? '-'}
                  </td>
                ))}
                {actions && <td>{actions(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 12 }}>
          <span style={{ color: 'var(--c-text-muted)' }}>共 {filtered.length} 筆，第 {page}/{totalPages} 頁</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>◀</button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
              return <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPage(p)}>{p}</button>;
            })}
            <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>▶</button>
          </div>
        </div>
      )}
    </div>
  );
}
