'use client';
import { useState, useEffect, use } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import { abrirChatComMensagem } from '@/components/ChatWidget';
import { calcularPrecoComDesconto, DescontosPorForma } from '@/utils/desconto-pagamento';

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  price_old: number | null;
  category: string;
  origin: string;
  type: string;
  images: string[];
  badge: string | null;
  stock: number;
  descontos?: DescontosPorForma | null;
}

export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [descontoGeral, setDescontoGeral] = useState<DescontosPorForma | null>(null);
  const { addItem } = useCart();
  const router = useRouter();

  async function fetchProduct() {
    setLoading(true);
    try {
      const res = await fetch(`/api/produtos?slug=${slug}`);
      if (!res.ok) {
        throw new Error('Produto não encontrado');
      }
      const data = await res.json();
      setProduct(data ? { ...data, price: Number(data.price) || 0, price_old: data.price_old != null ? Number(data.price_old) : null } : data);
      if (data?.stock <= 0) setQuantity(0);
    } catch (error) {
      console.error('Erro ao buscar produto:', error);
    }
    setLoading(false);
  }

  async function fetchDescontosGeral() {
    try {
      const res = await fetch('/api/cms/configuracoes?chave=descontos.pagamento', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const v = data?.valor;
        if (v && typeof v === 'object' && !Array.isArray(v)) setDescontoGeral(v);
      }
    } catch { /* fallback: sem desconto geral */ }
  }

  useEffect(() => {
    fetchProduct();
    fetchDescontosGeral();
  }, [slug]);

  // PIX em destaque (pagina usa o preço com desconto da forma PIX)
  const descontoPix = product
    ? calcularPrecoComDesconto(product.price, 'pix', descontoGeral, product.descontos)
    : { percent: 0, precoComDesconto: 0 };

  const [related, setRelated] = useState<Product[]>([]);

  useEffect(() => {
    async function fetchRelated() {
      if (!product) return;
      try {
        const res = await fetch(`/api/produtos?limit=3&exclude=${product.id}`);
        if (res.ok) {
          const data = await res.json();
          setRelated(data || []);
        }
      } catch (error) {
        console.error('Erro ao buscar produtos relacionados:', error);
      }
    }
    fetchRelated();
  }, [product]);

  const handleAddToCart = () => {
    if (!product || product.stock <= 0) return;
    addItem({
      id: product.id,
      slug: product.slug,
      name: product.name,
      origin: product.origin,
      image: product.images[0],
      price: product.price,
      priceOld: product.price_old || undefined,
      quantity,
    });
  };

  const handleBuyNow = () => {
    handleAddToCart();
    router.push('/loja/checkout');
  };

  if (loading) return <div className="section container" style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '100px 0' }}>Carregando produto...</div>;
  if (!product) return <div className="section container" style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '100px 0' }}>Produto não encontrado.</div>;

  return (
    <>
      <section className="section" style={{ paddingTop: 'var(--spacing-xl)' }}>
        <div className="container">
          {/* Breadcrumb */}
          <nav style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--spacing-2xl)' }}>
            <Link href="/" style={{ color: 'var(--color-text-tertiary)' }}>Home</Link>
            {' / '}
            <Link href="/catalogo" style={{ color: 'var(--color-text-tertiary)' }}>Catálogo</Link>
            {' / '}
            <span style={{ color: 'var(--color-text)' }}>{product.name}</span>
          </nav>

          <div className="product-page-grid">
            {/* Gallery */}
            <div className="product-gallery">
              <div className="product-gallery-main">
                <Image
                  src={product.images[selectedImage] || '/images/placeholder.png'}
                  alt={product.name}
                  width={700}
                  height={700}
                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                  priority
                />
              </div>
              <div className="product-gallery-thumbs">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    className={`product-thumb ${i === selectedImage ? 'active' : ''}`}
                    onClick={() => setSelectedImage(i)}
                    aria-label={`Ver foto ${i + 1}`}
                  >
                    <Image src={img} alt="" width={72} height={72} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                  </button>
                ))}
              </div>
            </div>

            {/* Details */}
            <div className="product-details">
              <span className="product-origin" style={{ display: 'block' }}>{product.origin} · {product.type}</span>
              <h1>{product.name}</h1>

              <div className="product-price-block">
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--spacing-md)' }}>
                  {product.price_old && (
                    <span style={{ fontSize: 'var(--text-xl)', color: 'var(--color-text-tertiary)', textDecoration: 'line-through' }}>
                      R$ {product.price_old.toLocaleString('pt-BR')}
                    </span>
                  )}
                  <span className="product-price-main">R$ {product.price.toLocaleString('pt-BR')}</span>
                </div>
                <p className="product-installments">ou 12x de R$ {(product.price / 12).toFixed(2).replace('.', ',')} sem juros</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
                  {descontoPix.percent > 0 && Number(product.price) >= 5 && (
                    <>
                      <span className="badge badge-success">PIX com {descontoPix.percent}% OFF</span>
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-success)' }}>
                        R$ {descontoPix.precoComDesconto.toFixed(2).replace('.', ',')}
                      </span>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textDecoration: 'line-through' }}>
                        R$ {product.price.toFixed(2).replace('.', ',')}
                      </span>
                    </>
                  )}
                </div>
                <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', alignItems: 'center' }}>
                  {product.stock > 0 ? (
                    <span className="badge badge-success">{product.stock} unidades disponíveis</span>
                  ) : (
                    <span className="badge badge-error">Esgotado</span>
                  )}
                </div>
              </div>

              {/* Options */}
              <div className="product-options">
                <div>
                  <div className="option-label">Quantidade</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      disabled={product.stock <= 0}
                    >−</button>
                    <span style={{ width: '40px', textAlign: 'center', fontWeight: 600 }}>{quantity}</span>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      onClick={() => setQuantity(q => Math.min(product.stock, q + 1))}
                      disabled={product.stock <= 0 || quantity >= product.stock}
                    >+</button>
                  </div>
                </div>
              </div>

              {/* Buy actions */}
              <div className="product-buy-actions">
                <button 
                  className="btn btn-secondary btn-lg" 
                  onClick={handleAddToCart}
                  disabled={product.stock <= 0}
                >
                  🛒 Adicionar ao Carrinho
                </button>
                <button 
                  className="btn btn-primary btn-lg" 
                  onClick={handleBuyNow}
                  disabled={product.stock <= 0}
                >
                  {product.stock <= 0 ? 'Sem Estoque' : 'Comprar Agora'}
                </button>
                {product.stock <= 0 && (
                  <button 
                    className="btn btn-gold btn-lg" 
                    style={{ width: '100%', marginTop: 'var(--spacing-md)', border: 'none', cursor: 'pointer' }}
                    onClick={() => abrirChatComMensagem({ nome: product.name, descricao: product.description || '' })}
                  >
                    💬 Pedir pelo Chat
                  </button>
                )}
              </div>

              {/* Description */}
              <div className="product-description">
                <h3>Descrição</h3>
                <p>{product.description}</p>

                <h3 style={{ marginTop: 'var(--spacing-xl)' }}>Especificações</h3>
                <div style={{ display: 'grid', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border-light)' }}>
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>Marca</span>
                    <span style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{product.origin}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Related Products */}
      <section className="section section-alt">
        <div className="container">
          <div className="section-header">
            <h2>Produtos Relacionados</h2>
            <span className="gold-line" />
          </div>
          <div className="products-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
            {related.map(item => (
              <Link key={item.id} href={`/catalogo/produto/${item.slug}`} className="card product-card" style={{ textDecoration: 'none' }}>
                <div className="product-image-wrap">
                  <Image src={item.images[0] || '/images/placeholder.png'} alt={item.name} width={400} height={500} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                </div>
                <div className="product-info">
                  <div className="product-origin">{item.origin}</div>
                  <div className="product-name">{item.name}</div>
                  <span className="card-price">R$ {item.price.toLocaleString('pt-BR')}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
