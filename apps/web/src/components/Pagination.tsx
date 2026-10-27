import { useState } from 'react';
const normalize = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function usePagination<T>(rows: T[], searchable: (row: T) => string, size = 12) {
  const [search, setSearchValue] = useState(''),
    [page, setPage] = useState(1);
  const filtered = search.trim()
    ? rows.filter((row) => normalize(searchable(row)).includes(normalize(search.trim())))
    : rows;
  const pages = Math.max(1, Math.ceil(filtered.length / size)),
    current = Math.min(page, pages);
  return {
    search,
    setSearch: (s: string) => {
      setSearchValue(s);
      setPage(1);
    },
    page: current,
    pages,
    total: filtered.length,
    rows: filtered.slice((current - 1) * size, current * size),
    setPage,
  };
}
export function Pagination({
  value,
  label,
}: {
  value: {
    search: string;
    setSearch: (v: string) => void;
    page: number;
    pages: number;
    total: number;
    setPage: (n: number) => void;
  };
  label: string;
}) {
  return (
    <div className="pagination-controls">
      <input
        className="search-input"
        aria-label={`Buscar ${label}`}
        placeholder={`Buscar ${label}…`}
        value={value.search}
        onChange={(e) => value.setSearch(e.target.value)}
      />
      <span className="small muted">
        {value.total} registros · página {value.page}/{value.pages}
      </span>
      <div className="inline-actions">
        <button
          className="secondary"
          disabled={value.page <= 1}
          onClick={() => value.setPage(value.page - 1)}
        >
          Anterior
        </button>
        <button
          className="secondary"
          disabled={value.page >= value.pages}
          onClick={() => value.setPage(value.page + 1)}
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
