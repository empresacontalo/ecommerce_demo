'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export default function CatalogFilters({ initialOrigin, initialSort, marcas = [] }: { initialOrigin: string, initialSort: string, marcas?: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateQuery = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'Todos') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Sempre volta para a página 1 ao filtrar
    params.set('page', '1');
    router.push(`?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="filters-grid">
      <div className="filter-group">
        <label htmlFor="origin">Marca</label>
        <select 
          id="origin" 
          value={initialOrigin}
          onChange={(e) => updateQuery('origin', e.target.value)}
          className="filter-select"
        >
          <option value="Todos">Todas as Marcas</option>
          {marcas.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="sort">Ordenar por</label>
        <select 
          id="sort" 
          value={initialSort}
          onChange={(e) => updateQuery('sort', e.target.value)}
          className="filter-select"
        >
          <option value="marca">Ordem das marcas</option>
          <option value="newest">Mais recentes</option>
          <option value="name-asc">Nome (A–Z)</option>
          <option value="price-asc">Menor preço</option>
          <option value="price-desc">Maior preço</option>
        </select>
      </div>
    </div>
  );
}
