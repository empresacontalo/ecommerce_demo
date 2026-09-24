'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@/utils/auth/client';
import {
  arquivoImagemValido,
  ehLinkValido,
  redimensionarImagemParaEnvio,
  valorImagemValido,
} from '@/utils/imagem';
import { DescontosPorForma } from '@/utils/desconto-pagamento';

interface Produto {
  id: string;
  name: string;
  origin: string;
  price: number;
  price_old?: number | null;
  stock: number;
  slug: string;
  category?: string;
  type?: string;
  description?: string;
  badge?: string | null;
  images?: string[];
  descontos?: DescontosPorForma | null;
}

export default function AdminProdutos() {
  const supabase = createClient();
  const [products, setProducts] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros da listagem
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroMarca, setFiltroMarca] = useState('Todos');
  const [filtroEstoque, setFiltroEstoque] = useState('Todos');
  const [filtroOrdenar, setFiltroOrdenar] = useState('nome');
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Produto | null>(null);
  
  // Form fields
  const [name, setName] = useState('');
  const [origin, setOrigin] = useState('Lattafa');
  const [price, setPrice] = useState('');
  const [priceOld, setPriceOld] = useState('');
  const [stock, setStock] = useState('10');
  const [category, setCategory] = useState('Cabelo');
const [description, setDescription] = useState('');
  const [badge, setBadge] = useState('');
  // Descontos específicos do produto por forma de pagamento (em %)
  const [descontoPix, setDescontoPix] = useState('');
  const [descontoCredit, setDescontoCredit] = useState('');
  const [descontoBoleto, setDescontoBoleto] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [linkFoto, setLinkFoto] = useState('');
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);

// ── Ordem de exibição das marcas (catálogo público + vitrines) ──
  const MARCA_PADRAO = 'Lattafa';
  // Desconto Geral por forma de pagamento (config descontos.pagamento)
  const [descontosGeral, setDescontosGeral] = useState<{ pix: string; credit: string; boleto: string }>({ pix: '5', credit: '0', boleto: '0' });
  const [descontosGeralCarregado, setDescontosGeralCarregado] = useState(false);
  const [descontosGeralSaved, setDescontosGeralSaved] = useState(false);
  const [descontosGeralSaving, setDescontosGeralSaving] = useState(false);
  // Preferência salva no CMS (pode conter apenas um subconjunto). A lista
  // exibida no painel é derivada: marcas configuradas na sequência, novas no fim (A–Z).
  const [ordemSalva, setOrdemSalva] = useState<string[]>([]);
  const [ordemMarcasCarregada, setOrdemMarcasCarregada] = useState(false);
  const [salvandoOrdem, setSalvandoOrdem] = useState(false);
  const [msgOrdem, setMsgOrdem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  function ordenarMarcasLista(marcasLista: string[], ordem: string[]): string[] {
    const posicao = new Map<string, number>();
    ordem.forEach((m, i) => { if (!posicao.has(m)) posicao.set(m, i); });
    const comOrdem = [...marcasLista].filter((m) => posicao.has(m))
      .sort((a, b) => (posicao.get(a) ?? 0) - (posicao.get(b) ?? 0));
    const semOrdem = [...marcasLista].filter((m) => !posicao.has(m))
      .sort((a, b) => a.localeCompare(b, 'pt'));
    return [...comOrdem, ...semOrdem];
  }

  // Marcas distintas derivadas dos produtos carregados (auto-gerenciável:
  // novas marcas aparecem conforme produtos são cadastrados — nada hardcoded)
  const marcas = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => { if (p.origin && p.origin.trim()) set.add(p.origin.trim()); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt'));
  }, [products]);

  // Lista COMPLETA e ORDENADA exibida no painel (fonte da verdade visual).
  const marcasOrdenadas = useMemo(() => {
    const alvo = ordemSalva.length > 0 ? ordemSalva : [MARCA_PADRAO];
    return ordenarMarcasLista(marcas, alvo);
  }, [marcas, ordemSalva]);

  // Categorias derivadas dos produtos carregados
  // Aplica busca + filtros + ordenação (client-side; a listagem é local)
  const produtosFiltrados = useMemo(() => {
    const q = filtroBusca.trim().toLowerCase();
    const lista = products.filter(p => {
      if (q && !`${p.name} ${p.origin} ${p.category || ''} ${p.slug || ''}`.toLowerCase().includes(q)) return false;
      if (filtroMarca !== 'Todos' && p.origin !== filtroMarca) return false;
      if (filtroEstoque === 'estoque' && !(p.stock > 0)) return false;
      if (filtroEstoque === 'esgotado' && !(p.stock <= 0)) return false;
      return true;
    });
    if (filtroOrdenar === 'nome') lista.sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    else if (filtroOrdenar === 'menor_preco') lista.sort((a, b) => a.price - b.price);
    else if (filtroOrdenar === 'maior_preco') lista.sort((a, b) => b.price - a.price);
    else if (filtroOrdenar === 'estoque') lista.sort((a, b) => b.stock - a.stock);
    return lista;
  }, [products, filtroBusca, filtroMarca, filtroEstoque, filtroOrdenar]);

  const limparFiltros = () => {
    setFiltroBusca('');
    setFiltroMarca('Todos');
    setFiltroEstoque('Todos');
    setFiltroOrdenar('nome');
  };

  useEffect(() => {
    fetchProducts();
    fetchOrdemMarcas();
    fetchDescontosGeral();
  }, []);

  async function fetchDescontosGeral() {
    try {
      const res = await fetch('/api/cms/configuracoes?chave=descontos.pagamento', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const v = data?.valor;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          setDescontosGeral({
            pix: String(v.pix ?? 0),
            credit: String(v.credit ?? 0),
            boleto: String(v.boleto ?? 0),
          });
        }
      }
    } catch { /* mantém padrão */ } finally {
      setDescontosGeralCarregado(true);
    }
  }

  async function salvarDescontosGeral() {
    setDescontosGeralSaving(true);
    try {
      const res = await fetch('/api/cms/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chave: 'descontos.pagamento',
          valor: {
            pix: Number(descontosGeral.pix) || 0,
            credit: Number(descontosGeral.credit) || 0,
            boleto: Number(descontosGeral.boleto) || 0,
          },
          descricao: 'Desconto geral por forma de pagamento em % (PIX, cartão, boleto)',
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d?.error || 'Erro ao salvar descontos gerais');
        return;
      }
      setDescontosGeralSaved(true);
      setTimeout(() => setDescontosGeralSaved(false), 3000);
    } finally {
      setDescontosGeralSaving(false);
    }
  }

  async function fetchOrdemMarcas() {
    try {
      const res = await fetch('/api/cms/configuracoes?chave=catalogo.ordem_marcas', { cache: 'no-store' });
      if (!res.ok) {
        setOrdemSalva([]);
      } else {
        const data = await res.json();
        const valor = data?.valor;
        if (Array.isArray(valor)) {
          setOrdemSalva(valor.filter((m): m is string => typeof m === 'string' && m.trim() !== ''));
        } else {
          setOrdemSalva([]);
        }
      }
    } catch {
      setOrdemSalva([]);
    } finally {
      setOrdemMarcasCarregada(true);
    }
  }

  // Move um item dentro da lista COMPLETA exibida e persiste essa nova
  // sequência como a preferência (garantindo que Lattafa possa ir p/ o topo).
  function moverMarca(idx: number, dir: -1 | 1) {
    const proximo = [...marcasOrdenadas];
    const destino = idx + dir;
    if (destino < 0 || destino >= proximo.length) return;
    const [item] = proximo.splice(idx, 1);
    proximo.splice(destino, 0, item);
    setOrdemSalva(proximo);
  }

  function moverMarcaParaTopo(idx: number) {
    if (idx <= 0) return;
    const proximo = [...marcasOrdenadas];
    const [item] = proximo.splice(idx, 1);
    proximo.unshift(item);
    setOrdemSalva(proximo);
  }

  async function salvarOrdemMarcas() {
    setSalvandoOrdem(true);
    setMsgOrdem(null);
    try {
      const res = await fetch('/api/cms/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chave: 'catalogo.ordem_marcas',
          valor: marcasOrdenadas,
          descricao: 'Ordem de exibição das marcas no catálogo e vitrines (Lattafa primeiro por padrão)',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao salvar ordem das marcas');
      }
      setOrdemSalva(marcasOrdenadas);
      setMsgOrdem({ tipo: 'ok', texto: 'Ordem das marcas salva. As alterações já estão ativas no site.' });
    } catch (e: unknown) {
      setMsgOrdem({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Falha ao salvar a ordem das marcas.' });
    } finally {
      setSalvandoOrdem(false);
    }
  }

  async function fetchProducts() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/produtos');
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      const data = await response.json();
      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao buscar produtos via API:', error);
    } finally {
      setLoading(false);
    }
  }

  function openNewModal() {
    setEditingProduct(null);
    setName('');
    setOrigin('Lattafa');
    setPrice('');
    setPriceOld('');
    setStock('10');
    setCategory('Cabelo');
    setDescription('');
    setBadge('');
    setDescontoPix('');
    setDescontoCredit('');
    setDescontoBoleto('');
    setImages(['/images/product-1.jpg']); // placeholder default
    setLinkFoto('');
    setErroFoto('');
    setShowModal(true);
  }

  function openEditModal(p: Produto) {
    setEditingProduct(p);
    setName(p.name);
    setOrigin(p.origin || 'Lattafa');
    setPrice(String(p.price));
    setPriceOld(p.price_old ? String(p.price_old) : '');
    setStock(String(p.stock));
    setCategory(p.category || 'Cabelo');
    setDescription(p.description || '');
    setBadge(p.badge || '');
    setDescontoPix(p.descontos?.pix != null ? String(p.descontos.pix) : '');
    setDescontoCredit(p.descontos?.credit != null ? String(p.descontos.credit) : '');
    setDescontoBoleto(p.descontos?.boleto != null ? String(p.descontos.boleto) : '');
    setImages(p.images && p.images.length > 0 ? [...p.images] : ['/images/product-1.jpg']);
    setLinkFoto('');
    setErroFoto('');
    setShowModal(true);
  }

  async function enviarParaServidor(imagem: string): Promise<string> {
    // Caminhos locais já estão no servidor; data URI e links http(s) são
    // baixados/convertidos pelo endpoint e viram /uploads/<arquivo>.webp.
    if (imagem.startsWith('/uploads/') || imagem.startsWith('/images/')) return imagem;
    const res = await fetch('/api/admin/imagem-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ehLinkValido(imagem) ? { url: imagem } : { dataUri: imagem }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Erro ao processar a imagem (HTTP ${res.status})`);
    }
    const data = (await res.json()) as { url: string };
    return data.url;
  }

  async function escolherFoto(file: File | undefined | null) {
    if (!file) return;
    if (!arquivoImagemValido(file)) {
      setErroFoto('Envie uma imagem (JPG, PNG, WEBP, GIF, AVIF ou SVG) de até 8MB.');
      return;
    }
    setUploadingFoto(true);
    setErroFoto('');
    try {
      const dataUri = await redimensionarImagemParaEnvio(file);
      const urlLocal = await enviarParaServidor(dataUri);
      setImages((prev) => (prev.length >= 10 ? prev : [...prev, urlLocal]));
      if (images.length >= 10) setErroFoto('Limite de 10 fotos por produto atingido.');
    } catch (e: unknown) {
      setErroFoto(e instanceof Error ? e.message : 'Falha ao processar a imagem.');
    } finally {
      setUploadingFoto(false);
    }
  }

  async function usarLinkFoto() {
    const link = linkFoto.trim();
    if (!link) return;
    if (!ehLinkValido(link)) {
      setErroFoto('Informe um link válido começando com http:// ou https://');
      return;
    }
    setUploadingFoto(true);
    setErroFoto('');
    try {
      const urlLocal = await enviarParaServidor(link);
      setImages((prev) => (prev.length >= 10 ? prev : [...prev, urlLocal]));
      setLinkFoto('');
      if (images.length >= 10) setErroFoto('Limite de 10 fotos por produto atingido.');
    } catch (e: unknown) {
      setErroFoto(e instanceof Error ? e.message : 'Falha ao baixar a imagem do link.');
    } finally {
      setUploadingFoto(false);
    }
  }

  function removerImagem(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  function tornarPrincipal(idx: number) {
    if (idx === 0) return;
    setImages((prev) => {
      const proximo = [...prev];
      const [item] = proximo.splice(idx, 1);
      proximo.unshift(item);
      return proximo;
    });
  }

  function adicionarFotos(files: FileList | null) {
    if (!files) return;
    const lista = Array.from(files);
    void (async () => {
      for (const file of lista) {
        await escolherFoto(file);
      }
    })();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !price) {
      alert('Nome e preço são obrigatórios');
      return;
    }
    if (images.length === 0 || !images.every((img) => valorImagemValido(img))) {
      setErroFoto('Adicione ao menos uma foto válida (upload ou link http(s)) antes de salvar.');
      return;
    }
    if (images.length > 10) {
      setErroFoto('O produto pode ter no máximo 10 fotos.');
      return;
    }
    setSaving(true);
    try {
      // Produtos antigos com link externo/data URI: normaliza para arquivo
      // local no servidor antes de salvar (o site nunca aponta para fora).
      const imagensFinal: string[] = [];
      for (const img of images) {
        imagensFinal.push(
          img.startsWith('/uploads/') || img.startsWith('/images/')
            ? img
            : await enviarParaServidor(img),
        );
      }
      const descontosProduto: DescontosPorForma | null = (() => {
        const d: DescontosPorForma = {};
        if (descontoPix !== '') d.pix = Number(descontoPix) || 0;
        if (descontoCredit !== '') d.credit = Number(descontoCredit) || 0;
        if (descontoBoleto !== '') d.boleto = Number(descontoBoleto) || 0;
        return Object.keys(d).length > 0 ? d : null;
      })();
      const payload = {
        id: editingProduct?.id,
        name,
        origin,
        price: parseFloat(price),
        price_old: priceOld ? parseFloat(priceOld) : null,
        stock: parseInt(stock, 10) || 0,
        category,
        description,
        badge: badge || null,
        images: imagensFinal,
        descontos: descontosProduto
      };

      const method = editingProduct ? 'PUT' : 'POST';
      const response = await fetch('/api/admin/produtos', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar produto');
      }

      await fetchProducts();
      setShowModal(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deseja realmente excluir este produto?')) return;
    try {
      const response = await fetch(`/api/admin/produtos?id=${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao excluir produto');
      }
      await fetchProducts();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-xl)' }}>
        <h2>Produtos</h2>
        <button className="btn btn-primary" onClick={openNewModal}>
          + Novo Produto
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          Carregando produtos...
        </div>
      ) : (
        <>
        <div className="admin-card" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
            <h3 style={{ margin: 0 }}>Descontos Gerais por Forma de Pagamento</h3>
            <button
              className="btn btn-primary btn-sm"
              onClick={salvarDescontosGeral}
              disabled={descontosGeralSaving || !descontosGeralCarregado}
            >
              {descontosGeralSaving ? 'Salvando...' : 'Salvar Descontos'}
            </button>
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: '0 0 var(--spacing-md)' }}>
            Percentual de desconto aplicado a <strong>todos</strong> os produtos conforme a forma de pagamento escolhida no checkout.
            Se um produto tiver desconto próprio para a mesma forma, vale o <strong>maior</strong> dos dois.
            O desconto incide no valor cobrado (QRCode PIX, cartão e boleto).
          </p>
          {descontosGeralSaved && (
            <p style={{ fontSize: 'var(--text-sm)', color: '#22c55e', margin: '0 0 var(--spacing-md)' }}>
              Descontos gerais salvos. Já valem no checkout (sem deploy).
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--spacing-md)' }}>
            {([
              { key: 'pix', label: 'PIX (%)' },
              { key: 'credit', label: 'Cartão de crédito (%)' },
              { key: 'boleto', label: 'Boleto (%)' },
            ] as const).map(f => (
              <div key={f.key} className="input-group">
                <label>{f.label}</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  className="input"
                  value={descontosGeral[f.key]}
                  onChange={e => setDescontosGeral(p => ({ ...p, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="admin-card" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
            <h3 style={{ margin: 0 }}>Ordem de Exibição das Marcas</h3>
            <button
              className="btn btn-primary btn-sm"
              onClick={salvarOrdemMarcas}
              disabled={salvandoOrdem || !ordemMarcasCarregada}
            >
              {salvandoOrdem ? 'Salvando...' : 'Salvar Ordem'}
            </button>
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: '0 0 var(--spacing-md)' }}>
            Define a sequência em que as marcas aparecem no catálogo, nas vitrines da home e no filtro.
            Por padrão, <strong>{MARCA_PADRAO}</strong> é exibida primeiro. Use as setas para reordenar.
          </p>
          {msgOrdem && (
            <p style={{ fontSize: 'var(--text-sm)', color: msgOrdem.tipo === 'ok' ? '#22c55e' : 'var(--color-error)', margin: '0 0 var(--spacing-md)' }}>
              {msgOrdem.texto}
            </p>
          )}
          {!ordemMarcasCarregada ? (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Carregando ordem...</p>
          ) : marcasOrdenadas.length === 0 ? (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Nenhuma marca cadastrada ainda.</p>
          ) : (
            <div className="table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>Posição</th>
                    <th>Marca</th>
                    <th style={{ width: 190 }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {marcasOrdenadas.map((m, idx) => (
                    <tr key={m}>
                      <td style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{idx + 1}º</td>
                      <td style={{ fontWeight: 500 }}>
                        {m}
                        {m === MARCA_PADRAO && (
                          <span className="badge badge-primary" style={{ marginLeft: 'var(--spacing-sm)' }}>Padrão</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '4px 8px' }}
                            disabled={idx === 0}
                            onClick={() => moverMarcaParaTopo(idx)}
                            title="Mover para o primeiro lugar"
                          >
                            ⏫
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '4px 8px' }}
                            disabled={idx === 0}
                            onClick={() => moverMarca(idx, -1)}
                            title="Mover para cima"
                          >
                            ↑
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '4px 8px' }}
                            disabled={idx === marcasOrdenadas.length - 1}
                            onClick={() => moverMarca(idx, 1)}
                            title="Mover para baixo"
                          >
                            ↓
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="admin-card">
          <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="input"
              placeholder="Buscar por nome, marca, categoria..."
              style={{ maxWidth: 300 }}
              value={filtroBusca}
              onChange={e => setFiltroBusca(e.target.value)}
            />
            <select className="input" style={{ maxWidth: 180 }} value={filtroMarca} onChange={e => setFiltroMarca(e.target.value)}>
              <option value="Todos">Todas as Marcas</option>
              {marcas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select className="input" style={{ maxWidth: 160 }} value={filtroEstoque} onChange={e => setFiltroEstoque(e.target.value)}>
              <option value="Todos">Estoque: Todos</option>
              <option value="estoque">Em estoque</option>
              <option value="esgotado">Esgotados</option>
            </select>
            <select className="input" style={{ maxWidth: 180 }} value={filtroOrdenar} onChange={e => setFiltroOrdenar(e.target.value)}>
              <option value="nome">Ordenar: Nome (A–Z)</option>
              <option value="menor_preco">Menor preço</option>
              <option value="maior_preco">Maior preço</option>
              <option value="estoque">Maior estoque</option>
            </select>
            {(filtroBusca || filtroMarca !== 'Todos' || filtroEstoque !== 'Todos') && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={limparFiltros}>✕ Limpar filtros</button>
            )}
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: '0 0 var(--spacing-md)' }}>
            {produtosFiltrados.length} de {products.length} produto(s)
          </p>
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nome</th>
                  <th>Marca</th>
                  <th>Preço</th>
                  <th>Estoque</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {produtosFiltrados.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>{p.id.slice(0, 8)}...</td>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td>{p.origin}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>R$ {p.price.toLocaleString('pt-BR')}</span>
                        {p.price_old && (
                          <span style={{ fontSize: '11px', textDecoration: 'line-through', color: 'var(--color-text-tertiary)' }}>
                            R$ {p.price_old.toLocaleString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {p.stock > 0 
                        ? <span className="badge badge-success">{p.stock} uni</span>
                        : <span className="badge badge-error">Esgotado</span>
                      }
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={() => openEditModal(p)}>
                          Editar
                        </button>
                        <button 
                          className="btn btn-ghost btn-sm" 
                          style={{ padding: '4px 8px', color: 'var(--color-error)' }}
                          onClick={() => handleDelete(p.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {produtosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-tertiary)' }}>
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {/* Modal Novo/Editar Produto */}
      {showModal && (
        <div className="modal-overlay active">
          <div className="modal-content" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSave} className="checkout-grid" id="product-form">
                <div className="col-span-2">
                  <label className="label">Nome do Produto</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="Ex: Fakhar Black EDP 100ml..." 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Marca</label>
                  <input 
                    className="input"
                    list="marcas-lista"
                    placeholder="Digite ou selecione uma marca"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    required
                  />
                  <datalist id="marcas-lista">
                    {marcas.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>
                <div>
  <label className="label">Preço Venda (R$) — mínimo {5}</label>
  <input 
    type="number" 
    step="0.01"
    min="5"
    className="input" 
    placeholder="0.00" 
    value={price}
    onChange={(e) => setPrice(e.target.value)}
    required
  />
</div>
                <div>
                  <label className="label">Preço Antigo / Atacado (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="input" 
                    placeholder="Sem desconto" 
                    value={priceOld}
                    onChange={(e) => setPriceOld(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Estoque Atual</label>
                  <input 
                    type="number" 
                    className="input" 
                    placeholder="0" 
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Categoria</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="Ex: Cabelo" 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Etiqueta / Badge</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="Ex: Mais Vendido, Promoção" 
                    value={badge}
                    onChange={(e) => setBadge(e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="label">Desconto próprio por forma de pagamento (%) — opcional; vale o MAIOR entre este e o Desconto Geral</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--spacing-sm)' }}>
                    {([
                      { key: 'pix' as const, label: 'PIX (%)', val: descontoPix, set: setDescontoPix },
                      { key: 'credit' as const, label: 'Cartão (%)', val: descontoCredit, set: setDescontoCredit },
                      { key: 'boleto' as const, label: 'Boleto (%)', val: descontoBoleto, set: setDescontoBoleto },
                    ]).map(f => (
                      <div key={f.key} className="input-group">
                        <label>{f.label}</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          className="input"
                          placeholder="0"
                          value={f.val}
                          onChange={e => f.set(e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="label">Fotos do Produto (até 10 — a primeira é a foto principal)</label>
                  <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                    {images.map((img, idx) => (
                      <div key={idx} style={{ position: 'relative', width: 110, height: 120, borderRadius: 'var(--radius-md)', border: idx === 0 ? '2px solid var(--color-gold)' : '1px solid var(--color-border)', overflow: 'hidden', background: 'var(--color-surface-alt)', flexShrink: 0 }}>
                        <img src={img} alt={`Foto ${idx + 1} do produto`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        {idx === 0 && (
                          <span style={{ position: 'absolute', top: 4, left: 4, background: 'var(--color-gold)', color: '#1F1B12', fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>
                            Principal
                          </span>
                        )}
                        <div style={{ position: 'absolute', bottom: 4, right: 4, display: 'flex', gap: 4 }}>
                          {idx > 0 && (
                            <button type="button" title="Tornar esta a foto principal" onClick={() => tornarPrincipal(idx)} style={{ background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: 4, width: 24, height: 24, cursor: 'pointer', fontSize: '0.8rem' }}>⭐</button>
                          )}
                          <button type="button" title="Remover foto" onClick={() => removerImagem(idx)} style={{ background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: 4, width: 24, height: 24, cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
                        </div>
                      </div>
                    ))}
                    {images.length < 10 && (
                      <div style={{ width: 110, height: 120, border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--color-surface-alt)', flexShrink: 0 }}>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml"
                          multiple
                          style={{ display: 'none' }}
                          onChange={(e) => { adicionarFotos(e.target.files); e.target.value = ''; }}
                        />
                        <button type="button" disabled={uploadingFoto} onClick={() => fileInputRef.current?.click()} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.5rem' }} title="Enviar fotos">
                          {uploadingFoto ? '⏳' : '📷'}
                        </button>
                        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)', textAlign: 'center', padding: '0 var(--spacing-sm)' }}>
                          {uploadingFoto ? 'Processando...' : 'Enviar fotos'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-md)' }}>
                    <input
                      type="text"
                      className="input"
                      style={{ flex: 1 }}
                      placeholder="ou cole o link de uma foto online e clique em Usar"
                      value={linkFoto}
                      onChange={(e) => setLinkFoto(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); usarLinkFoto(); } }}
                    />
                    <button type="button" className="btn btn-ghost" onClick={usarLinkFoto} disabled={uploadingFoto}>Usar</button>
                  </div>
                  {erroFoto && (
                    <span style={{ color: '#ef4444', fontSize: 'var(--text-xs)' }}>{erroFoto}</span>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="label">Descrição</label>
                  <textarea 
                    className="input" 
                    rows={3} 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button 
                type="submit" 
                form="product-form" 
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? 'Salvando...' : 'Salvar Produto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
