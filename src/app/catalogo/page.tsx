import { query } from '@/utils/db'
import { getBlocosPorSlug, isPaginaAtiva, getConfiguracao } from '@/app/actions/cms'
import ProductCard from '@/components/ProductCard'
import CatalogFilters from '@/components/Catalog/CatalogFilters'
import CatalogPagination from '@/components/Catalog/CatalogPagination'
import CmsBlockRenderer from '@/components/CmsBlockRenderer'
import { clausulaOrdemMarcas, getOrdemMarcasEfetiva, ordenarMarcasPorOrdem } from '@/lib/marcas-ordem'
import Image from 'next/image'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getConfiguracao('seo.catalogo');
  const valor = (seo?.valor ?? {}) as Record<string, unknown>;
  return {
    title: typeof valor.title === 'string' && valor.title ? valor.title : 'Luxury Fragrance Catalog — Aura Fragrance Co.',
    description: typeof valor.description === 'string' && valor.description ? valor.description : 'Explore our collection of authentic luxury fragrances: Lattafa, French Avenue, Al Wataniah, Orientica, and more. Long-lasting Eau de Parfum with doorstep delivery.',
  };
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CatalogPage({ searchParams }: PageProps) {
  if (!(await isPaginaAtiva('catalogo'))) notFound();
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const origin = (params.origin as string) || 'Todos';
  const sort = (params.sort as string) || 'marca';
  
  const PAGE_SIZE = 12;
  const offset = (page - 1) * PAGE_SIZE;

  let whereClause = '';
  const values: unknown[] = [];

  if (origin !== 'Todos') {
    whereClause = 'WHERE origin = $1';
    values.push(origin);
  }

  // Ordem de marcas configurada no Admin (padrão: Lattafa primeiro, depois A–Z)
  const ordemMarcas = await getOrdemMarcasEfetiva();
  const clausulaMarcas = clausulaOrdemMarcas(ordemMarcas);
  const usaParametroOrdem = ordemMarcas.length > 0;

  let orderBy: string;
  let orderParams: unknown[] = [];
  if (sort === 'price-asc') {
    orderBy = 'ORDER BY price ASC';
  } else if (sort === 'price-desc') {
    orderBy = 'ORDER BY price DESC';
  } else if (sort === 'newest') {
    orderBy = 'ORDER BY created_at DESC';
  } else if (sort === 'name-asc') {
    orderBy = 'ORDER BY name ASC';
  } else {
    const paramIndex = values.length + 1;
    orderBy = clausulaMarcas.sql(paramIndex);
    if (usaParametroOrdem) {
      // array_position recebe UM parâmetro (o array de marcas), não um spread.
      orderParams = [clausulaMarcas.destaque];
    }
  }

  let products: any[] = [];
  let count = 0;
  let fetchError = null;
  let marcas: string[] = [];

  try {
    // Marcas disponíveis (campo origin no banco guarda a marca do perfume)
    // Listadas na ordem configurada no Admin (padrão: Lattafa primeiro)
    const marcasRes = await query(`SELECT DISTINCT origin FROM produtos WHERE origin IS NOT NULL AND origin <> ''`);
    marcas = ordenarMarcasPorOrdem((marcasRes.rows || []).map((r: any) => r.origin), ordemMarcas);
    // Get total count
    const countRes = await query(`SELECT COUNT(*)::int as count FROM produtos ${whereClause}`, values);
    count = countRes.rows[0]?.count || 0;

    // Get paginated data
    const dataQuery = `SELECT * FROM produtos ${whereClause} ${orderBy} LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
    const dataRes = await query(dataQuery, [...values, ...orderParams]);
    products = dataRes.rows;
  } catch (err: any) {
    console.error('Erro ao buscar produtos via SQL:', err);
    fetchError = { message: err.message || 'Erro de conexão com o banco de dados' };
  }

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 0;
  const blocos = await getBlocosPorSlug('catalogo');

  // Imagem de fundo do título das páginas internas (editável no admin → Configurações)
  const heroCfg = await getConfiguracao('site.hero_imagem_paginas');
  const heroImagem = (typeof heroCfg?.valor === 'string' && heroCfg.valor) ? heroCfg.valor : '/images/loja.jpg';

  return (
    <main className="min-h-screen">
      
      {/* Hero Section (blocos do CMS; fallback hardcoded) */}
      {blocos.length > 0 ? (
        <CmsBlockRenderer blocos={blocos} />
      ) : (
        <section className="catalog-hero reveal">
          <div className="catalog-hero-bg">
            <Image
              src={heroImagem}
              alt="Fundo Catálogo"
              fill
              style={{ objectFit: 'cover', opacity: 0.2, filter: 'grayscale(100%)' }}
              priority
            />
            <div className="catalog-hero-overlay" />
          </div>

          <div className="container" style={{ position: 'relative', zIndex: 10, textAlign: 'center' }}>
            <span className="badge badge-primary" style={{ marginBottom: 'var(--spacing-md)' }}>Premium Collection</span>
            <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', marginBottom: 'var(--spacing-md)' }}>
              Luxury <span>Fragrances</span>
            </h1>
            <p className="subtitle" style={{ maxWidth: '600px', margin: '0 auto var(--spacing-xl)' }}>
              Exclusive imported essences with lasting projection and refined presence.
              Discover your next signature scent.
            </p>
          </div>
        </section>
      )}

      {/* Catalog Section */}
      <section className="section">
        <div className="container">
          
          <CatalogFilters initialOrigin={origin} initialSort={sort} marcas={marcas} />

          <div className="catalog-results" style={{ marginBottom: 'var(--spacing-lg)' }}>
            {count !== null && (
              <p style={{ color: 'var(--color-text-secondary)' }}>Showing {products?.length || 0} of {count} products</p>
            )}
          </div>

          {fetchError ? (
            <div className="error-state" style={{ textAlign: 'center', padding: 'var(--spacing-3xl)' }}>
              <p style={{ color: 'var(--color-error)' }}>An error occurred while loading products.</p>
              <p className="text-sm mt-2">{fetchError.message}</p>
            </div>
          ) : products && products.length > 0 ? (
            <>
              <div className="products-grid">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              <CatalogPagination currentPage={page} totalPages={totalPages} />
            </>
          ) : (
            <div className="no-results" style={{ textAlign: 'center', padding: 'var(--spacing-3xl)' }}>
              <p>No products found.</p>
              <p style={{ color: 'var(--color-text-secondary)' }}>Try adjusting your filters to find what you are looking for.</p>
            </div>
          )}
        </div>
      </section>

    </main>
  );
}
