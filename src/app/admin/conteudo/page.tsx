'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/auth/client';

/* ── Tipos ── */
interface Pagina {
  id: string; slug: string; titulo: string;
  meta_description: string | null; ativo: boolean;
}
interface Bloco {
  id: string; pagina_id: string; tipo: string;
  titulo: string | null; ordem: number; conteudo: any; ativo: boolean;
}

/* ── Definição de campos por tipo de bloco ── */
interface FieldDef {
  key: string; label: string; type: 'text' | 'textarea' | 'image' | 'number' | 'richtext' | 'color';
  placeholder?: string;
}
interface ArrayFieldDef {
  key: string; label: string; type: 'array';
  itemLabel: string;
  fields: FieldDef[];
}
type BlocoFieldDef = FieldDef | ArrayFieldDef;

const BLOCK_FIELDS: Record<string, BlocoFieldDef[]> = {
  hero: [
    { key: 'badge', label: 'Badge / Tag', type: 'text', placeholder: 'ex: ✨ Qualidade Premium' },
    { key: 'titulo', label: 'Título', type: 'text', placeholder: 'Título principal do banner' },
    { key: 'subtitulo', label: 'Subtítulo', type: 'textarea', placeholder: 'Texto descritivo' },
    { key: 'imagem_fundo', label: 'Imagem de Fundo (URL)', type: 'image', placeholder: '/images/hero-1.jpg' },
    { key: 'cta_texto', label: 'Texto do Botão 1', type: 'text', placeholder: 'Ver Catálogo' },
    { key: 'cta_link', label: 'Link do Botão 1', type: 'text', placeholder: '/catalogo' },
    { key: 'cta2_texto', label: 'Texto do Botão 2', type: 'text', placeholder: 'Agendar Horário' },
    { key: 'cta2_link', label: 'Link do Botão 2', type: 'text', placeholder: 'chat:agendar (abre o chat)' },
  ],
  carrossel: [
    { key: 'slides', label: 'Slides', type: 'array', itemLabel: 'Slide',
      fields: [
        { key: 'imagem', label: 'Imagem (URL)', type: 'image', placeholder: '/images/hero-1.jpg' },
        { key: 'badge', label: 'Badge', type: 'text', placeholder: '✨ Qualidade Premium' },
        { key: 'titulo', label: 'Título', type: 'text', placeholder: 'Título do slide' },
        { key: 'subtitulo', label: 'Subtítulo', type: 'textarea', placeholder: 'Description do slide' },
        { key: 'cta1_label', label: 'Botão 1 - Texto', type: 'text', placeholder: 'Ver Catálogo' },
        { key: 'cta1_link', label: 'Botão 1 - Link', type: 'text', placeholder: '/catalogo' },
        { key: 'cta2_label', label: 'Botão 2 - Texto', type: 'text', placeholder: 'Agendar Horário' },
        { key: 'cta2_link', label: 'Botão 2 - Link', type: 'text', placeholder: 'chat:agendar (abre o chat)' },
      ],
    },
  ],
  cards: [
    { key: 'estilo', label: 'Estilo da seção (default | section-alt para fundo zebra)', type: 'text', placeholder: 'default' },
    { key: 'cards', label: 'Cards', type: 'array', itemLabel: 'Card',
      fields: [
        { key: 'icone', label: 'Ícone (emoji)', type: 'text', placeholder: '💎' },
        { key: 'titulo', label: 'Título', type: 'text', placeholder: 'Título do card' },
        { key: 'descricao', label: 'Description', type: 'textarea', placeholder: 'Texto do card' },
        { key: 'link', label: 'Link (opcional)', type: 'text', placeholder: '/pagina' },
      ],
    },
  ],
  diferenciais: [
    { key: 'itens', label: 'Diferenciais', type: 'array', itemLabel: 'Diferencial',
      fields: [
        { key: 'icone', label: 'Ícone (emoji)', type: 'text', placeholder: '💎' },
        { key: 'titulo', label: 'Título', type: 'text' },
        { key: 'descricao', label: 'Description', type: 'textarea' },
      ],
    },
  ],
  servicos: [
    { key: 'itens', label: 'Serviços', type: 'array', itemLabel: 'Serviço',
      fields: [
        { key: 'titulo', label: 'Título', type: 'text', placeholder: 'Nome do serviço' },
        { key: 'descricao', label: 'Description', type: 'textarea' },
        { key: 'preco', label: 'Preço', type: 'text', placeholder: 'A partir de R$ 200' },
        { key: 'duracao', label: 'Duração', type: 'text', placeholder: '2-4 horas' },
        { key: 'imagem', label: 'Imagem (URL)', type: 'image', placeholder: '/images/servico.jpg' },
        { key: 'cta_label', label: 'Texto do Botão', type: 'text', placeholder: 'Agendar pelo Chat' },
        { key: 'cta_link', label: 'Link do Botão', type: 'text', placeholder: 'chat:agendar' },
      ],
    },
  ],
  produtos: [
    { key: 'titulo', label: 'Título da Seção', type: 'text', placeholder: 'Nossos Produtos' },
    { key: 'subtitulo', label: 'Subtítulo', type: 'text', placeholder: 'Os queridinhos da casa e das redes.' },
    { key: 'max_produtos', label: 'Máximo de Produtos', type: 'number', placeholder: '8' },
    { key: 'categoria', label: 'Filtrar por Categoria (slug)', type: 'text', placeholder: 'cabelos (deixe vazio para todos)' },
    { key: 'cta1_label', label: 'Botão 1 — Texto', type: 'text', placeholder: 'Ver Catálogo' },
    { key: 'cta1_link', label: 'Botão 1 — Link', type: 'text', placeholder: '/catalogo' },
    { key: 'cta2_label', label: 'Botão 2 — Texto', type: 'text', placeholder: 'Falar pelo WhatsApp (deixe vazio para ocultar)' },
    { key: 'cta2_link', label: 'Botão 2 — Link', type: 'text', placeholder: 'whatsapp: (usa o número do Admin) ou https://wa.me/...' },
  ],
  depoimentos: [
    { key: 'titulo', label: 'Título da Seção', type: 'text', placeholder: 'Opinião dos Clientes' },
    { key: 'subtitulo', label: 'Subtítulo', type: 'text', placeholder: 'Avaliações reais de quem já visitou a loja' },
    { key: 'link_google', label: 'Link do Google (avaliações)', type: 'text', placeholder: 'https://www.google.com/maps/place/...' },
    { key: 'link_label', label: 'Texto do botão do Google', type: 'text', placeholder: 'Ver todas as avaliações no Google' },
    { key: 'itens', label: 'Depoimentos', type: 'array', itemLabel: 'Depoimento',
      fields: [
        { key: 'nome', label: 'Nome', type: 'text', placeholder: 'Maria Silva' },
        { key: 'texto', label: 'Depoimento', type: 'textarea', placeholder: 'Texto do depoimento...' },
        { key: 'estrelas', label: 'Estrelas (1-5)', type: 'number', placeholder: '5' },
        { key: 'papel', label: 'Papel / Função', type: 'text', placeholder: 'Avaliação no Google' },
        { key: 'avatar_url', label: 'URL do Avatar', type: 'image', placeholder: '(deixe vazio para usar inicial)' },
      ],
    },
  ],
  galeria: [
    { key: 'titulo', label: 'Título da Seção', type: 'text', placeholder: 'Nossa Galeria' },
    { key: 'categorias', label: 'Categorias (separadas por vírgula)', type: 'text', placeholder: 'Todos, Produtos, Antes e Depois, Salão' },
    { key: 'itens', label: 'Imagens', type: 'array', itemLabel: 'Imagem',
      fields: [
        { key: 'url', label: 'URL da Imagem', type: 'image', placeholder: '/images/foto.jpg' },
        { key: 'categoria', label: 'Categoria', type: 'text', placeholder: 'Produtos' },
        { key: 'titulo', label: 'Título', type: 'text', placeholder: 'Nome da imagem' },
        { key: 'alt', label: 'Texto Alternativo', type: 'text', placeholder: 'Description para acessibilidade' },
      ],
    },
  ],
  cta: [
    { key: 'titulo', label: 'Título', type: 'text', placeholder: 'Pronta para Transformar seu Visual?' },
    { key: 'subtitulo', label: 'Subtítulo', type: 'textarea', placeholder: 'Texto de apoio' },
    { key: 'texto_botao', label: 'Texto do Botão', type: 'text', placeholder: 'Ver Catálogo' },
    { key: 'link_botao', label: 'Link do Botão', type: 'text', placeholder: '/catalogo' },
    { key: 'texto_botao2', label: 'Texto do Botão 2 (opcional)', type: 'text', placeholder: 'Falar no WhatsApp' },
    { key: 'link_botao2', label: 'Link do Botão 2', type: 'text', placeholder: 'whatsapp: (usa o número do Admin) ou https://wa.me/...' },
    { key: 'imagem_fundo', label: 'Imagem de Fundo (URL)', type: 'image', placeholder: '/images/cta-bg.jpg' },
  ],
  texto: [
    { key: 'conteudo_html', label: 'Conteúdo HTML', type: 'richtext', placeholder: '<h2>Title</h2><p>Texto...</p>' },
  ],
  html: [
    { key: 'codigo', label: 'Código HTML', type: 'richtext', placeholder: '<div>...</div>' },
    { key: 'css', label: 'CSS opcional (estilização)', type: 'richtext', placeholder: '.meu-bloco { color: #b8860b; }' },
  ],
  about: [
    { key: 'titulo', label: 'Título', type: 'text', placeholder: 'Nossa História' },
    { key: 'texto_html', label: 'Texto (HTML — aceita tokens {{...}})', type: 'richtext', placeholder: '<p>Texto sobre a empresa...</p>' },
    { key: 'imagem', label: 'Imagem (URL ou enviar)', type: 'image', placeholder: '/images/sobre.jpg' },
    { key: 'cta_label', label: 'Texto do Botão', type: 'text', placeholder: 'Conheça Nossos Produtos' },
    { key: 'cta_link', label: 'Link do Botão', type: 'text', placeholder: '/catalogo' },
  ],
  form: [
    { key: 'titulo', label: 'Título do Formulário', type: 'text', placeholder: 'Fale Conosco' },
    { key: 'subtitulo', label: 'Subtítulo', type: 'text' },
    { key: 'texto_sucesso', label: 'Mensagem de Sucesso', type: 'text', placeholder: 'Mensagem enviada com sucesso!' },
    { key: 'destino_email', label: 'E-mail de Destino', type: 'text', placeholder: 'contato@empresa.com.br' },
    { key: 'campos', label: 'Campos', type: 'array', itemLabel: 'Campo',
      fields: [
        { key: 'nome', label: 'Nome do Campo', type: 'text', placeholder: 'name' },
        { key: 'label', label: 'Label', type: 'text', placeholder: 'Seu Nome' },
        { key: 'tipo', label: 'Tipo (text/email/phone/textarea)', type: 'text', placeholder: 'text' },
        { key: 'obrigatorio', label: 'Obrigatório (true/false)', type: 'text', placeholder: 'true' },
      ],
    },
  ],
  campanha: [
    { key: 'titulo', label: 'Título (opcional — sobrepõe o da campanha)', type: 'text', placeholder: 'Dia dos Pais 2026' },
  ],
};

const TIPOS_BLOCO = [
  { value: 'hero', label: '🖼️ Hero / Banner' },
  { value: 'carrossel', label: '🎠 Carrossel de Slides' },
  { value: 'cards', label: '🃏 Cards' },
  { value: 'diferenciais', label: '⭐ Diferenciais' },
  { value: 'servicos', label: '💇 Serviços' },
  { value: 'produtos', label: '🛍️ Vitrine de Produtos' },
  { value: 'depoimentos', label: '💬 Depoimentos' },
  { value: 'galeria', label: '🖼️ Galeria de Imagens' },
  { value: 'cta', label: '📣 Call to Action' },
  { value: 'form', label: '📋 Formulário' },
  { value: 'campanha', label: '🎯 Campanha Promocional' },
  { value: 'about', label: 'ℹ️ Sobre (imagem + texto)' },
  { value: 'texto', label: '📝 Texto Rico (HTML)' },
  { value: 'html', label: '🔧 HTML Customizado (HTML + CSS)' },
];

/* ── Tokens dos Dados da Empresa (texto dinâmico) ── */
const TOKENS = [
  { token: '{{nome.empresa}}', label: 'Nome da empresa' },
  { token: '{{telefone}}', label: 'Telefone' },
  { token: '{{whatsapp}}', label: 'WhatsApp' },
  { token: '{{email}}', label: 'E-mail' },
  { token: '{{endereco}}', label: 'Endereço' },
  { token: '{{cidade}}', label: 'Cidade' },
  { token: '{{cep}}', label: 'CEP' },
  { token: '{{instagram}}', label: 'Instagram' },
  { token: '{{horario.semana}}', label: 'Horário de semana' },
  { token: '{{horario.sabado}}', label: 'Horário de sábado' },
];

/* ── Estilos reutilizáveis ── */
const s = {
  label: { display:'block', fontSize:'0.75rem', fontWeight:600, marginBottom:'0.25rem', color:'var(--color-text-secondary)' } as React.CSSProperties,
  input: { width:'100%', padding:'0.5rem 0.75rem', borderRadius:'8px', border:'1px solid var(--color-border)', backgroundColor:'var(--color-surface)', color:'var(--color-text)', fontSize:'0.875rem' } as React.CSSProperties,
  textarea: { width:'100%', padding:'0.5rem 0.75rem', borderRadius:'8px', border:'1px solid var(--color-border)', backgroundColor:'var(--color-surface)', color:'var(--color-text)', fontSize:'0.875rem', minHeight:'80px', resize:'vertical' as const } as React.CSSProperties,
  btn: { padding:'0.5rem 1rem', borderRadius:'8px', border:'1px solid var(--color-border)', cursor:'pointer', fontSize:'0.875rem', fontWeight:500, color:'var(--color-text)', background:'var(--color-surface)' } as React.CSSProperties,
  btnPrimary: { padding:'0.5rem 1rem', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'0.875rem', fontWeight:500, background:'#b8860b', color:'#fff' } as React.CSSProperties,
  btnDanger: { padding:'0.375rem 0.75rem', borderRadius:'6px', border:'1px solid rgba(255,0,0,0.2)', background:'none', cursor:'pointer', fontSize:'0.75rem', color:'#ef4444' } as React.CSSProperties,
  card: { backgroundColor:'var(--color-surface)', border:'1px solid var(--color-border-light)', borderRadius:'10px', padding:'1rem' } as React.CSSProperties,
  arrayItem: { backgroundColor:'var(--color-surface)', border:'1px solid var(--color-border-light)', borderRadius:'8px', padding:'0.75rem', marginBottom:'0.5rem' } as React.CSSProperties,
};

/* ── Preview da imagem ── */
function ImagePreview({ url }: { url: string }) {
  if (!url || (!url.startsWith('/') && !url.startsWith('http') && !url.startsWith('data:image'))) return null;
  return (
    <div style={{ marginTop: '0.25rem' }}>
      <img src={url} alt="preview" style={{ maxWidth:'200px', maxHeight:'120px', borderRadius:'6px', border:'1px solid var(--color-border)', objectFit:'cover' }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
    </div>
  );
}

/* ── Campo de imagem: URL OU upload (arquivo → base64) ── */
function ImageField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Envie um arquivo de imagem (PNG, JPG, SVG...).');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = String(reader.result || '');
      if (dataUri.length > 2_000_000) {
        alert('Imagem muito grande. Máximo ~2MB.');
        return;
      }
      onChange(dataUri);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div>
      <label style={{ display:'block', fontSize:'0.75rem', fontWeight:600, marginBottom:'0.25rem', color:'var(--color-text-secondary)' }}>Image</label>
      <input style={{ width:'100%', padding:'0.5rem 0.75rem', borderRadius:'8px', border:'1px solid var(--color-border)', backgroundColor:'var(--color-surface)', color:'var(--color-text)', fontSize:'0.875rem' }}
        value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder || 'URL da imagem ou envie abaixo'} />
      <input type="file" accept="image/*" onChange={handleFile} style={{ marginTop:'0.25rem', fontSize:'0.75rem', color:'var(--color-text-secondary)' }} title="Enviar imagem do computador" />
      <ImagePreview url={value} />
    </div>
  );
}

/* ── Insere token no campo de texto focado (cursor) ── */
function inserirTokenNoFoco(token: string) {
  const el = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
  if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return;
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (!setter) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const novo = el.value.slice(0, start) + token + el.value.slice(end);
  setter.call(el, novo);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.focus();
  const pos = start + token.length;
  try { el.setSelectionRange(pos, pos); } catch { /* ignorar */ }
}

/* ── Componente principal ── */
export default function AdminConteudoPage() {
  const [paginas, setPaginas] = useState<Pagina[]>([]);
  const [paginaSelecionada, setPaginaSelecionada] = useState<Pagina | null>(null);
  const [blocos, setBlocos] = useState<Bloco[]>([]);
  const [loading, setLoading] = useState(true);
  const [editandoBloco, setEditandoBloco] = useState<Bloco | null>(null);
  const [novoBloco, setNovoBloco] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [paginaModal, setPaginaModal] = useState<{ modo: 'nova' | 'editar'; pagina?: Pagina } | null>(null);
  const [paginaForm, setPaginaForm] = useState({ titulo: '', slug: '', meta_description: '' });
  const [blocosModal, setBlocosModal] = useState<Bloco[]>([]);

  // Form state: tipo + titulo + ordem + ativo + conteudo dinâmico
  const [formTipo, setFormTipo] = useState('hero');
  const [formTitulo, setFormTitulo] = useState('');
  const [formOrdem, setFormOrdem] = useState(0);
  const [formAtivo, setFormAtivo] = useState(true);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonTexto, setJsonTexto] = useState('');

  const supabase = createClient();

  const alternarPagina = async (pagina: Pagina) => {
    const novoAtivo = !pagina.ativo;
    try {
      const res = await fetch('/api/cms/paginas', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pagina.id, ativo: novoAtivo }),
      });
      if (res.ok) {
        setPaginas(prev => prev.map(p => p.id === pagina.id ? { ...p, ativo: novoAtivo } : p));
        setMensagem({ tipo: 'sucesso', texto: `Página "${pagina.titulo}" ${novoAtivo ? 'ativada' : 'desativada'}!` });
        setTimeout(() => setMensagem(null), 3000);
      } else {
        const err = await res.json();
        setMensagem({ tipo: 'erro', texto: err.error || 'Erro ao alternar página.' });
      }
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Erro ao alternar página.' });
    }
  };

  const salvarPagina = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const slug = paginaForm.slug.trim().toLowerCase().replace(/\s+/g, '-');
      const body = paginaModal?.modo === 'editar' && paginaModal.pagina
        ? { id: paginaModal.pagina.id, titulo: paginaForm.titulo, slug, meta_description: paginaForm.meta_description }
        : { titulo: paginaForm.titulo, slug, meta_description: paginaForm.meta_description };
      const res = await fetch('/api/cms/paginas', {
        method: paginaModal?.modo === 'editar' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const pagina = await res.json();
        setPaginaModal(null);
        setMensagem({ tipo: 'sucesso', texto: `Página "${pagina.titulo}" ${paginaModal?.modo === 'editar' ? 'atualizada' : 'criada'}!` });
        setTimeout(() => setMensagem(null), 3000);
        await carregarPaginas();
      } else {
        const err = await res.json();
        setMensagem({ tipo: 'erro', texto: err.error || 'Erro ao salvar página.' });
      }
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Erro ao salvar página.' });
    } finally {
      setSalvando(false);
    }
  };

  const excluirPagina = async (pagina: Pagina) => {
    if (!confirm(`Excluir a página "${pagina.titulo}" e todos os seus blocos?`)) return;
    try {
      const res = await fetch('/api/cms/paginas', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pagina.id }),
      });
      if (res.ok) {
        if (paginaSelecionada?.id === pagina.id) setPaginaSelecionada(null);
        setPaginas(prev => prev.filter(p => p.id !== pagina.id));
        setMensagem({ tipo: 'sucesso', texto: `Página "${pagina.titulo}" excluída!` });
        setTimeout(() => setMensagem(null), 3000);
      } else {
        const err = await res.json();
        setMensagem({ tipo: 'erro', texto: err.error || 'Erro ao excluir página.' });
      }
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Erro ao excluir página.' });
    }
  };

  const carregarPaginas = useCallback(async () => {
    try {
      const res = await fetch('/api/cms/paginas');
      if (res.ok) setPaginas(await res.json());
    } catch (err) { console.error('Erro ao carregar páginas:', err); }
    finally { setLoading(false); }
  }, []);

  const carregarBlocos = useCallback(async (paginaId: string) => {
    try {
      const res = await fetch(`/api/cms/blocos?pagina_id=${paginaId}`);
      if (res.ok) setBlocos(await res.json());
    } catch (err) { console.error('Erro ao carregar blocos:', err); }
  }, []);

  const abrirModalPagina = (modo: 'nova' | 'editar', pagina?: Pagina) => {
    setPaginaModal({ modo, pagina });
    setPaginaForm({
      titulo: pagina?.titulo || '',
      slug: pagina?.slug || '',
      meta_description: pagina?.meta_description || '',
    });
    setBlocosModal([]);
    if (pagina) {
      fetch(`/api/cms/blocos?pagina_id=${pagina.id}`)
        .then(r => r.ok ? r.json() : [])
        .then(setBlocosModal)
        .catch(() => setBlocosModal([]));
    }
  };

  const recarregarBlocosModal = async (paginaId: string) => {
    try {
      const res = await fetch(`/api/cms/blocos?pagina_id=${paginaId}`);
      if (res.ok) setBlocosModal(await res.json());
    } catch { /* mantém lista atual */ }
  };

  useEffect(() => { carregarPaginas(); }, [carregarPaginas]);
  useEffect(() => { if (paginaSelecionada) carregarBlocos(paginaSelecionada.id); }, [paginaSelecionada, carregarBlocos]);

  /* helpers */
  const resetForm = (tipo: string) => {
    setFormTipo(tipo);
    setFormTitulo('');
    setFormOrdem(blocos.length > 0 ? blocos[blocos.length - 1].ordem + 1 : 1);
    setFormAtivo(true);
    const fields = BLOCK_FIELDS[tipo] || [];
    const init: Record<string, any> = {};
    fields.forEach(f => {
      if (f.type === 'array') init[f.key] = [];
      else init[f.key] = '';
    });
    setFormData(init);
  };

  const selecionarPagina = (pagina: Pagina) => {
    setPaginaSelecionada(pagina);
    setEditandoBloco(null);
    setNovoBloco(false);
  };

  const abrirEdicaoBloco = (bloco: Bloco) => {
    setEditandoBloco(bloco);
    setNovoBloco(false);
    setJsonMode(false);
    setFormTipo(bloco.tipo);
    setFormTitulo(bloco.titulo || '');
    setFormOrdem(bloco.ordem);
    setFormAtivo(bloco.ativo);
    setFormData(typeof bloco.conteudo === 'object' ? { ...bloco.conteudo } : {});
  };

  const abrirNovoBloco = () => {
    setEditandoBloco(null);
    setNovoBloco(true);
    setJsonMode(false);
    resetForm('hero');
  };

  const cancelarEdicao = () => { setEditandoBloco(null); setNovoBloco(false); setJsonMode(false); };

  const alternarJsonMode = () => {
    if (!jsonMode) setJsonTexto(JSON.stringify(formData, null, 2));
    setJsonMode(!jsonMode);
  };

  const atualizarCampo = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const atualizarArrayItem = (arrayKey: string, index: number, fieldKey: string, value: any) => {
    setFormData(prev => {
      const arr = [...(prev[arrayKey] || [])];
      arr[index] = { ...arr[index], [fieldKey]: value };
      return { ...prev, [arrayKey]: arr };
    });
  };

  const adicionarArrayItem = (arrayKey: string, fields: FieldDef[]) => {
    setFormData(prev => {
      const novo: Record<string, any> = {};
      fields.forEach(f => { novo[f.key] = f.type === 'number' ? 0 : ''; });
      return { ...prev, [arrayKey]: [...(prev[arrayKey] || []), novo] };
    });
  };

  const removerArrayItem = (arrayKey: string, index: number) => {
    setFormData(prev => {
      const arr = [...(prev[arrayKey] || [])];
      arr.splice(index, 1);
      return { ...prev, [arrayKey]: arr };
    });
  };

  const salvarBloco = async () => {
    if (!paginaSelecionada) return;
    setSalvando(true);
    setMensagem(null);

    try {
      let conteudoFinal = formData;
      if (jsonMode) {
        try {
          const parseado = JSON.parse(jsonTexto);
          if (!parseado || typeof parseado !== 'object' || Array.isArray(parseado)) {
            throw new Error('O JSON deve ser um objeto');
          }
          conteudoFinal = parseado;
        } catch (err) {
          setMensagem({ tipo: 'erro', texto: `JSON inválido: ${err instanceof Error ? err.message : 'erro de sintaxe'}` });
          setSalvando(false);
          return;
        }
      }

      const url = '/api/cms/blocos';
      const method = editandoBloco ? 'PUT' : 'POST';
      const body = editandoBloco
        ? { id: editandoBloco.id, tipo: formTipo, titulo: formTitulo, ordem: formOrdem, conteudo: conteudoFinal, ativo: formAtivo }
        : { pagina_id: paginaSelecionada.id, tipo: formTipo, titulo: formTitulo, ordem: formOrdem, conteudo: conteudoFinal };

      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setMensagem({ tipo: 'sucesso', texto: editandoBloco ? 'Bloco atualizado!' : 'Bloco criado!' });
        cancelarEdicao();
        carregarBlocos(paginaSelecionada.id);
      } else {
        const err = await res.json();
        setMensagem({ tipo: 'erro', texto: err.error || 'Erro ao salvar.' });
      }
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Erro ao salvar bloco.' });
    } finally { setSalvando(false); }
  };

  const excluirBloco = async (bloco: Bloco) => {
    if (!confirm(`Excluir o bloco "${bloco.titulo || bloco.tipo}"?`)) return;
    try {
      const res = await fetch('/api/cms/blocos', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: bloco.id }) });
      if (res.ok) { setMensagem({ tipo:'sucesso', texto:'Bloco excluído!' }); if (paginaSelecionada) carregarBlocos(paginaSelecionada.id); }
    } catch { setMensagem({ tipo:'erro', texto:'Erro ao excluir.' }); }
  };

  const toggleAtivoBloco = async (bloco: Bloco) => {
    const novoAtivo = !bloco.ativo;
    try {
      const res = await fetch('/api/cms/blocos', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: bloco.id, ativo: novoAtivo }) });
      if (res.ok) {
        setBlocos(prev => prev.map(b => b.id === bloco.id ? { ...b, ativo: novoAtivo } : b));
        setMensagem({ tipo:'sucesso', texto: novoAtivo ? 'Bloco habilitado (visível no site)' : 'Bloco desabilitado (oculto no site)' });
      }
    } catch { setMensagem({ tipo:'erro', texto:'Erro ao atualizar.' }); }
  };

  const moverBloco = async (bloco: Bloco, direcao: 'cima' | 'baixo') => {
    const idx = blocos.findIndex(b => b.id === bloco.id);
    if (idx === -1) return;
    if (direcao === 'cima' && idx === 0) return;
    if (direcao === 'baixo' && idx === blocos.length - 1) return;
    const alvoIdx = direcao === 'cima' ? idx - 1 : idx + 1;
    const outro = blocos[alvoIdx];

    // Swap real de posições no array (fonte de verdade visual)
    const novos = [...blocos];
    novos[idx] = { ...outro, ordem: bloco.ordem };
    novos[alvoIdx] = { ...bloco, ordem: outro.ordem };
    setBlocos(novos);
    await fetch('/api/cms/blocos', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: bloco.id, ordem: outro.ordem }) });
    await fetch('/api/cms/blocos', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: outro.id, ordem: bloco.ordem }) });
  };

  const moverBlocoExtremo = async (bloco: Bloco, direcao: 'topo' | 'rodape') => {
    const idx = blocos.findIndex(b => b.id === bloco.id);
    if (idx === -1) return;
    const alvoIdx = direcao === 'topo' ? 0 : blocos.length - 1;
    if (idx === alvoIdx) return;

    const novos = [...blocos];
    const [removido] = novos.splice(idx, 1);
    novos.splice(alvoIdx, 0, removido);
    // Reatribui ordens sequenciais a partir de 1, mantendo a posição visual
    const comOrdem = novos.map((b, i) => ({ ...b, ordem: i + 1 }));
    setBlocos(comOrdem);
    await Promise.all(comOrdem.map(b =>
      fetch('/api/cms/blocos', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: b.id, ordem: b.ordem }) })
    ));
  };

  /* ── Renderiza o campo de formulário adequado ── */
  const renderField = (field: FieldDef, value: any, onChange: (v: any) => void, prefix = '') => {
    const k = prefix + field.key;
    switch (field.type) {
      case 'textarea':
        return (
          <div key={k}>
            <label style={s.label}>{field.label}</label>
            <textarea className="token-target" style={s.textarea} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} />
          </div>
        );
      case 'richtext':
        return (
          <div key={k}>
            <label style={s.label}>{field.label}</label>
            <textarea className="token-target" style={{ ...s.textarea, minHeight:'150px', fontFamily:'monospace', fontSize:'0.8rem' }} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} />
          </div>
        );
      case 'image':
        return (
          <div key={k}>
            <label style={s.label}>{field.label}</label>
            <ImageField value={value} onChange={onChange} placeholder={field.placeholder} />
          </div>
        );
      case 'number':
        return (
          <div key={k}>
            <label style={s.label}>{field.label}</label>
            <input style={s.input} type="number" value={value ?? ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : '')} placeholder={field.placeholder} />
          </div>
        );
      default:
        return (
          <div key={k}>
            <label style={s.label}>{field.label}</label>
            <input className="token-target" style={s.input} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} />
          </div>
        );
    }
  };

  const renderArrayField = (af: ArrayFieldDef) => {
    const items: any[] = formData[af.key] || [];
    return (
      <div key={af.key} style={{ marginTop: '0.75rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem' }}>
          <label style={{ ...s.label, marginBottom: 0 }}>{af.label} ({items.length})</label>
          <button type="button" onClick={() => adicionarArrayItem(af.key, af.fields)}
            style={{ ...s.btnPrimary, padding:'0.25rem 0.75rem', fontSize:'0.75rem' }}>
            + {af.itemLabel}
          </button>
        </div>
        {items.map((item, idx) => (
          <div key={idx} style={s.arrayItem}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem' }}>
              <span style={{ fontWeight:600, fontSize:'0.8rem', color:'var(--color-text-secondary)' }}>{af.itemLabel} #{idx + 1}</span>
              <button type="button" onClick={() => removerArrayItem(af.key, idx)}
                style={{ ...s.btnDanger, padding:'0.2rem 0.5rem', fontSize:'0.7rem' }}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {af.fields.map(f => renderField(f, item[f.key], (v: any) => atualizarArrayItem(af.key, idx, f.key, v), `${idx}-`))}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div style={{ padding:'0.75rem', textAlign:'center', color:'var(--color-text-tertiary)', fontSize:'0.75rem' }}>
            Nenhum item. Clique em "+ {af.itemLabel}" para adicionar.
          </div>
        )}
      </div>
    );
  };

  /* handlers para troca de tipo */
  const handleTipoChange = (novoTipo: string) => {
    setFormTipo(novoTipo);
    setJsonMode(false);
    const fields = BLOCK_FIELDS[novoTipo] || [];
    const init: Record<string, any> = {};
    fields.forEach(f => {
      if (f.type === 'array') init[f.key] = [];
      else init[f.key] = '';
    });
    setFormData(init);
  };

  if (loading) return <div style={{ padding:'2rem' }}>Loading...</div>;

  const currentFields = BLOCK_FIELDS[formTipo] || [];

  return (
    <div style={{ padding:'1.5rem', maxWidth:'1200px', margin:'0 auto' }}>
      <h1 style={{ fontSize:'1.5rem', fontWeight:700, marginBottom:'1.5rem' }}>📝 Content Manager (CMS)</h1>

      {mensagem && (
        <div style={{ padding:'0.75rem 1rem', marginBottom:'1rem', borderRadius:'8px', backgroundColor: mensagem.tipo==='sucesso'?'#dcfce7':'#fee2e2', color: mensagem.tipo==='sucesso'?'#166534':'#991b1b', }}>
          {mensagem.texto}
        </div>
      )}

      {/* Lista de Páginas */}
      <div style={{ ...s.card, marginBottom:'1.5rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
          <h2 style={{ fontSize:'1.125rem', fontWeight:600 }}>📄 Pages</h2>
          <button
            onClick={() => abrirModalPagina('nova')}
            style={s.btnPrimary}
          >
            + New Page
          </button>
        </div>
        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Blocks</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginas.map(p => {
                const qtdBlocos = p.id === paginaSelecionada?.id ? blocos.length : undefined;
                return (
                  <tr key={p.id} style={{ opacity: p.ativo ? 1 : 0.55 }}>
                    <td>
                      <button
                        onClick={() => selecionarPagina(p)}
                        style={{ background:'none', border:'none', cursor:'pointer', padding:0, textAlign:'left', fontWeight:600, fontSize:'0.875rem', color:'var(--color-text-primary)', textDecoration: p.ativo ? 'none' : 'line-through' }}
                        title="Gerenciar blocos desta página"
                      >
                        {p.titulo}
                      </button>
                    </td>
                    <td style={{ fontSize:'0.8rem', color:'var(--color-text-tertiary)' }}>/{p.slug}</td>
                    <td>
                      <button
                        onClick={() => alternarPagina(p)}
                        title={p.ativo ? 'Desativar (esconder do site)' : 'Ativar (exibir no site)'}
                        style={{ padding:'0.25rem 0.6rem', borderRadius:'6px', border:'1px solid', cursor:'pointer', fontSize:'0.75rem',
                          color: p.ativo ? '#1D9E75' : '#ef4444',
                          borderColor: p.ativo ? 'rgba(29,158,117,0.4)' : 'rgba(255,0,0,0.3)',
                          background: p.ativo ? 'rgba(29,158,117,0.1)' : 'rgba(255,0,0,0.06)' }}
                      >
                        {p.ativo ? '👁️ Ativa' : '🚫 Inativa'}
                      </button>
                    </td>
                    <td style={{ fontSize:'0.8rem', color:'var(--color-text-secondary)' }}>
                      {qtdBlocos !== undefined ? `${qtdBlocos} blocos` : '—'}
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:'0.25rem' }}>
                        <button
                          onClick={() => abrirModalPagina('editar', p)}
                          style={{ padding:'0.375rem 0.75rem', borderRadius:'6px', border:'1px solid var(--color-border)', background:'none', cursor:'pointer', fontSize:'0.75rem', color:'var(--color-text-primary)' }}
                        >
                          Editar
                        </button>
                        <button onClick={() => excluirPagina(p)} style={s.btnDanger}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginas.length === 0 && !loading && (
                <tr><td colSpan={5} style={{ color:'var(--color-text-tertiary)', textAlign:'center' }}>Nenhuma página cadastrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {paginaSelecionada && (
        <div style={s.card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
            <div>
              <h2 style={{ fontSize:'1.125rem', fontWeight:600 }}>{paginaSelecionada.titulo}</h2>
              <span style={{ fontSize:'0.75rem', color:'var(--color-text-tertiary)' }}>/{paginaSelecionada.slug}</span>
            </div>
            <button onClick={abrirNovoBloco} style={s.btnPrimary}>+ Add Block</button>
          </div>

          {/* Lista de Blocos */}
          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {blocos.map((bloco, idx) => (
              <div key={bloco.id} style={{ display:'flex', gap:'0.75rem', alignItems:'center', padding:'0.75rem', border:'1px solid var(--color-border-light)', borderRadius:'8px', backgroundColor:'var(--color-surface)', opacity: bloco.ativo ? 1 : 0.55 }}>
                <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
                  <div style={{ display:'flex', gap:'2px', justifyContent:'center' }}>
                    <button onClick={() => moverBlocoExtremo(bloco, 'topo')} disabled={idx === 0}
                      style={{ ...s.btn, padding:'2px 4px', fontSize:'0.55rem', background:'none', border:'1px solid var(--color-border)', opacity: idx===0?0.3:1 }} title="Mover para o topo">⏫</button>
                  </div>
                  <button onClick={() => moverBloco(bloco, 'cima')} disabled={idx === 0}
                    style={{ ...s.btn, padding:'2px 6px', fontSize:'0.6rem', background:'none', border:'1px solid var(--color-border)', opacity: idx===0?0.3:1 }}>▲</button>
                  <button onClick={() => moverBloco(bloco, 'baixo')} disabled={idx === blocos.length - 1}
                    style={{ ...s.btn, padding:'2px 6px', fontSize:'0.6rem', background:'none', border:'1px solid var(--color-border)', opacity: idx===blocos.length-1?0.3:1 }}>▼</button>
                  <div style={{ display:'flex', gap:'2px', justifyContent:'center' }}>
                    <button onClick={() => moverBlocoExtremo(bloco, 'rodape')} disabled={idx === blocos.length - 1}
                      style={{ ...s.btn, padding:'2px 4px', fontSize:'0.55rem', background:'none', border:'1px solid var(--color-border)', opacity: idx===blocos.length-1?0.3:1 }} title="Mover para o rodapé">⏬</button>
                  </div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:'0.875rem' }}>
                    {bloco.titulo || bloco.tipo}
                    <span style={{ marginLeft:'0.5rem', padding:'2px 6px', borderRadius:'4px', fontSize:'0.65rem', background:'rgba(184,134,11,0.2)', color:'#b8860b' }}>
                      {TIPOS_BLOCO.find(t => t.value === bloco.tipo)?.label || bloco.tipo}
                    </span>
                  </div>
                  <div style={{ fontSize:'0.7rem', color:'var(--color-text-tertiary)' }}>Ordem: {bloco.ordem} {!bloco.ativo ? '• Inativo' : ''}</div>
                  {/* Preview do conteúdo */}
                  <div style={{ fontSize:'0.7rem', color:'var(--color-text-tertiary)', marginTop:'2px' }}>
                    {(() => {
                      const c = bloco.conteudo;
                      if (!c || typeof c !== 'object') return '(sem conteúdo)';
                      const preview: string[] = [];
                      if (c.titulo) preview.push(`📝 "${String(c.titulo).slice(0, 40)}"`);
                      if (c.slides?.length) preview.push(`🎠 ${c.slides.length} slides`);
                      if (c.itens?.length) preview.push(`📋 ${c.itens.length} itens`);
                      if (c.cards?.length) preview.push(`🃏 ${c.cards.length} cards`);
                      if (c.imagem_fundo) preview.push('🖼️ com imagem');
                      return preview.join(' • ') || '(conteúdo configurado)';
                    })()}
                  </div>
                </div>
                <div style={{ display:'flex', gap:'0.25rem', alignItems:'center' }}>
                  <button onClick={() => toggleAtivoBloco(bloco)}
                    title={bloco.ativo ? 'Desabilitar (ocultar na página)' : 'Habilitar (mostrar na página)'}
                    style={{ padding:'0.375rem 0.6rem', borderRadius:'6px', border:'1px solid', cursor:'pointer', fontSize:'0.8rem',
                      color: bloco.ativo ? '#1D9E75' : '#ef4444',
                      borderColor: bloco.ativo ? 'rgba(29,158,117,0.4)' : 'rgba(255,0,0,0.3)',
                      background: bloco.ativo ? 'rgba(29,158,117,0.1)' : 'rgba(255,0,0,0.06)' }}>
                    {bloco.ativo ? '👁️' : '🚫'}
                  </button>
                  <button onClick={() => abrirEdicaoBloco(bloco)}
                    style={{ padding:'0.375rem 0.75rem', borderRadius:'6px', border:'1px solid var(--color-border)', background:'none', cursor:'pointer', fontSize:'0.75rem', color:'var(--color-text-primary)' }}>
                    Editar
                  </button>
                  <button onClick={() => excluirBloco(bloco)} style={s.btnDanger}>Delete</button>
                </div>
              </div>
            ))}
            {blocos.length === 0 && (
              <div style={{ padding:'2rem', textAlign:'center', color:'var(--color-text-tertiary)', fontSize:'0.875rem' }}>
                Nenhum bloco. Clique em "Adicionar Bloco".
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Edição / Novo Bloco */}
      {(editandoBloco || novoBloco) && (
        <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'1rem' }}>
          <div style={{ backgroundColor:'var(--color-dark-soft)', border:'1px solid var(--color-border)', borderRadius:'12px', padding:'1.5rem', maxWidth:'700px', width:'100%', maxHeight:'90vh', overflow:'auto' }}>
            <h3 style={{ fontSize:'1.125rem', fontWeight:600, marginBottom:'1rem' }}>
              {editandoBloco ? 'Editar Bloco' : 'Novo Bloco'}
            </h3>

            <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
              {/* Tipo */}
              <div>
                <label style={s.label}>Tipo do Bloco</label>
                <select value={formTipo} onChange={e => handleTipoChange(e.target.value)} style={s.input}>
                  {TIPOS_BLOCO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {/* Título admin */}
              <div>
                <label style={s.label}>Título (identificação no admin)</label>
                <input style={s.input} value={formTitulo} onChange={e => setFormTitulo(e.target.value)} placeholder="Ex: Hero Principal" />
              </div>

              {/* Ordem */}
              <div>
                <label style={s.label}>Ordem</label>
                <input style={s.input} type="number" value={formOrdem} onChange={e => setFormOrdem(Number(e.target.value))} />
              </div>

              {/* Ativo */}
              <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                <input type="checkbox" checked={formAtivo} onChange={e => setFormAtivo(e.target.checked)} id="bloco-ativo" />
                <label htmlFor="bloco-ativo" style={{ fontSize:'0.875rem', cursor:'pointer' }}>Ativo (visível no site)</label>
              </div>

              {/* Campos específicos por tipo */}
              <div style={{ borderTop:'1px solid var(--color-border)', paddingTop:'1rem', marginTop:'0.5rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
                  <h4 style={{ fontSize:'0.875rem', fontWeight:600, margin:0, color:'#b8860b' }}>
                    📋 Block Content
                  </h4>
                  <button type="button" onClick={alternarJsonMode} style={{ ...s.btn, fontSize:'0.75rem', background:'var(--color-surface-alt)', border:'1px solid var(--color-border)' }}>
                    {jsonMode ? '🔙 Modo visual' : '⚙️ Modo avançado (JSON)'}
                  </button>
                </div>

                {!jsonMode && (
                  <>
                    <p style={{ fontSize:'0.75rem', color:'var(--color-text-tertiary)', marginBottom:'0.5rem' }}>
                      💡 <strong>Texto dinâmico:</strong> clique em um campo abaixo (posicione o cursor onde quiser) e depois em uma chave para inseri-la:
                    </p>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'0.375rem', marginBottom:'0.75rem' }}>
                      {TOKENS.map(t => (
                        <button key={t.token} type="button" title={t.label}
                          onClick={() => inserirTokenNoFoco(t.token)}
                          style={{ padding:'0.25rem 0.5rem', borderRadius:'6px', border:'1px solid rgba(184,134,11,0.4)', background:'rgba(184,134,11,0.12)', cursor:'pointer', fontSize:'0.7rem', fontFamily:'monospace', color:'#d4af37' }}>
                          {t.token}
                        </button>
                      ))}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                      {currentFields.map(f => {
                        if (f.type === 'array') return renderArrayField(f as ArrayFieldDef);
                        return renderField(f as FieldDef, formData[f.key], (v: any) => atualizarCampo(f.key, v));
                      })}
                    </div>
                  </>
                )}

                {jsonMode && (
                  <div>
                    <p style={{ fontSize:'0.75rem', color:'var(--color-text-tertiary)', marginBottom:'0.5rem' }}>
                      Edite o conteúdo como JSON (qualquer campo, HTML/CSS inclusos). Tokens <code>{'{{...}}'}</code> continuam funcionando.
                    </p>
                    <textarea
                      className="token-target"
                      style={{ ...s.textarea, minHeight:'300px', fontFamily:'monospace', fontSize:'0.8rem' }}
                      value={jsonTexto}
                      onChange={e => setJsonTexto(e.target.value)}
                      spellCheck={false}
                    />
                  </div>
                )}
              </div>

              {/* Botões */}
              <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end', marginTop:'0.5rem' }}>
                <button onClick={cancelarEdicao} style={{ ...s.btn, background:'var(--color-surface-alt)' }}>Cancel</button>
                <button onClick={salvarBloco} disabled={salvando} style={s.btnPrimary}>
                  {salvando ? 'Salvando...' : 'Save Block'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Página (nova/editar) */}
      {paginaModal && (
        <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'1rem' }}>
          <div style={{ backgroundColor:'var(--color-dark-soft)', border:'1px solid var(--color-border)', borderRadius:'12px', padding:'1.5rem', maxWidth:'640px', width:'100%', maxHeight:'90vh', overflow:'auto' }}>
            <h3 style={{ fontSize:'1.125rem', fontWeight:600, marginBottom:'1rem' }}>
              {paginaModal.modo === 'editar' ? `Editar Página — ${paginaModal.pagina?.titulo || ''}` : 'Nova Página'}
            </h3>
            <form onSubmit={salvarPagina} style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
              <div>
                <label style={s.label}>Título *</label>
                <input style={s.input} value={paginaForm.titulo} onChange={e => setPaginaForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Nossa História" required />
              </div>
              <div>
                <label style={s.label}>Slug (URL) *</label>
                <input style={s.input} value={paginaForm.slug} onChange={e => setPaginaForm(p => ({ ...p, slug: e.target.value }))} placeholder="ex: nossa-historia" required
                  pattern="[a-z0-9-]+" title="Apenas letras minúsculas, números e hífens" />
                <span style={{ fontSize:'0.7rem', color:'var(--color-text-tertiary)' }}>Acesso: /{paginaForm.slug || 'slug'}</span>
              </div>
              <div>
                <label style={s.label}>Meta Description (SEO)</label>
                <textarea style={{ ...s.textarea, minHeight: 70 }} value={paginaForm.meta_description} onChange={e => setPaginaForm(p => ({ ...p, meta_description: e.target.value }))} placeholder="Breve descrição exibida em buscadores" />
              </div>
              <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end', marginTop:'0.5rem' }}>
                <button type="button" onClick={() => setPaginaModal(null)} style={{ ...s.btn, background:'var(--color-surface-alt)' }}>Cancel</button>
                <button type="submit" disabled={salvando} style={s.btnPrimary}>
                  {salvando ? 'Salvando...' : (paginaModal.modo === 'editar' ? 'Salvar Alterações' : 'Criar Página')}
                </button>
              </div>
            </form>

            {/* Conteúdo da página (blocos) — visível ao editar uma página existente */}
            {paginaModal.modo === 'editar' && paginaModal.pagina && (
              <div style={{ borderTop:'1px solid var(--color-border)', marginTop:'1.25rem', paddingTop:'1rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem' }}>
                  <h4 style={{ margin:0, fontSize:'0.9rem', fontWeight:600 }}>📋 Page Content (Blocks)</h4>
                  <button
                    type="button"
                    onClick={() => { const p = paginaModal.pagina!; setPaginaModal(null); selecionarPagina(p); abrirNovoBloco(); }}
                    style={{ ...s.btnPrimary, padding:'0.25rem 0.75rem', fontSize:'0.75rem' }}
                  >
                    + Add Block
                  </button>
                </div>
                {blocosModal.length === 0 && (
                  <p style={{ fontSize:'0.75rem', color:'var(--color-text-tertiary)', margin:0 }}>
                    Esta página ainda não tem blocos. Clique em &quot;+ Add Block&quot; para criar o conteúdo (texto, imagens, chaves dinâmicas e HTML/CSS).
                  </p>
                )}
                <div style={{ display:'flex', flexDirection:'column', gap:'0.375rem' }}>
                  {blocosModal.map(b => (
                    <div key={b.id} style={{ display:'flex', gap:'0.5rem', alignItems:'center', padding:'0.5rem 0.75rem', border:'1px solid var(--color-border-light)', borderRadius:'8px', backgroundColor:'var(--color-surface)', opacity: b.ativo ? 1 : 0.55 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:600, fontSize:'0.8rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {b.titulo || TIPOS_BLOCO.find(t => t.value === b.tipo)?.label || b.tipo}
                        </div>
                        <div style={{ fontSize:'0.68rem', color:'var(--color-text-tertiary)' }}>
                          {b.tipo} • ordem {b.ordem} {!b.ativo ? '• inativo' : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { const p = paginaModal.pagina!; setPaginaModal(null); selecionarPagina(p); abrirEdicaoBloco(b); }}
                        style={{ ...s.btn, background:'var(--color-surface-alt)', border:'1px solid var(--color-border)', fontSize:'0.75rem' }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        title={b.ativo ? 'Desabilitar (ocultar)' : 'Habilitar (mostrar)'}
                        onClick={async () => {
                          const res = await fetch('/api/cms/blocos', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: b.id, ativo: !b.ativo }) });
                          if (res.ok && paginaModal.pagina) recarregarBlocosModal(paginaModal.pagina.id);
                        }}
                        style={{ padding:'0.3rem 0.5rem', borderRadius:'6px', border:'1px solid', cursor:'pointer', fontSize:'0.75rem', color: b.ativo ? '#1D9E75' : '#ef4444', borderColor: b.ativo ? 'rgba(29,158,117,0.4)' : 'rgba(255,0,0,0.3)', background: b.ativo ? 'rgba(29,158,117,0.1)' : 'rgba(255,0,0,0.06)' }}
                      >
                        {b.ativo ? '👁️' : '🚫'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`Excluir o bloco "${b.titulo || b.tipo}"?`)) return;
                          const res = await fetch('/api/cms/blocos', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: b.id }) });
                          if (res.ok && paginaModal.pagina) recarregarBlocosModal(paginaModal.pagina.id);
                        }}
                        style={s.btnDanger}
                      >
                        Excluir
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
