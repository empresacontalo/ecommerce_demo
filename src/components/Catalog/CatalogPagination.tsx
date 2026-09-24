'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

export default function CatalogPagination({ currentPage, totalPages }: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const goToPage = useCallback((page: number) => {
    if (page < 1 || page > totalPages) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    router.push(`?${params.toString()}`);
    // Scroll to top of catalog
    window.scrollTo({ top: 400, behavior: 'smooth' });
  }, [router, searchParams, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <div className="pagination">
      <button 
        className="pagination-btn"
        disabled={currentPage === 1}
        onClick={() => goToPage(currentPage - 1)}
      >
        Anterior
      </button>
      
      <div className="pagination-numbers">
        {[...Array(totalPages)].map((_, i) => (
          <button
            key={i + 1}
            className={`pagination-number ${currentPage === i + 1 ? 'active' : ''}`}
            onClick={() => goToPage(i + 1)}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <button 
        className="pagination-btn"
        disabled={currentPage === totalPages}
        onClick={() => goToPage(currentPage + 1)}
      >
        Próximo
      </button>
    </div>
  );
}
