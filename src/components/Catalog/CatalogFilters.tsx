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
        <label htmlFor="origin">Brand</label>
        <select 
          id="origin" 
          value={initialOrigin}
          onChange={(e) => updateQuery('origin', e.target.value)}
          className="filter-select"
        >
          <option value="Todos">All Brands</option>
          {marcas.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="sort">Sort by</label>
        <select 
          id="sort" 
          value={initialSort}
          onChange={(e) => updateQuery('sort', e.target.value)}
          className="filter-select"
        >
          <option value="marca">Featured Brands</option>
          <option value="newest">Newest</option>
          <option value="name-asc">Name (A–Z)</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
        </select>
      </div>
    </div>
  );
}
