'use client';

import { useState, useEffect } from 'react';
import { PALETTE_KEYS, DEFAULT_PALETTES, applyPalette } from '@/components/ThemeProvider';
import type { Palettes, PaletteTheme } from '@/components/ThemeProvider';
import { LOGO_ICONES } from '@/utils/logo-icones';
import { CHATWOOT_BASE_URL, CHATWOOT_WEBSITE_TOKEN } from '@/utils/chatwoot-config';
import { urlPadrao as urlPadraoPagamento, DOCS_PAGAMENTO } from '@/utils/pagamento-consts';
import EnvironmentVariablesSection from './EnvironmentVariablesSection';
import McpSection from './McpSection';
import BackupCard from './BackupCard';
import ConviteChatSection from './ConviteChatSection';
import SolicitacoesAgentesSection from './SolicitacoesAgentesSection';

const PALETTE_LABELS: Record<string, string> = {
  primary: 'Dourado principal', 'primary-light': 'Dourado claro', 'primary-dark': 'Dourado escuro', 'primary-hover': 'Dourado hover', 'primary-rgb': 'Dourado RGB',
  secondary: 'Secundário', 'secondary-light': 'Secundário claro', 'secondary-dark': 'Secundário escuro',
  gold: 'Gold', 'gold-light': 'Gold claro', 'gold-dark': 'Gold escuro',
  dark: 'Fundo principal', 'dark-soft': 'Fundo suave', light: 'Claro (inverso)', 'light-warm': 'Claro quente',
  surface: 'Superfície', 'surface-alt': 'Superfície zebra',
  text: 'Texto', 'text-secondary': 'Texto secundário', 'text-tertiary': 'Texto terciário', 'text-inverse': 'Texto inverso',
  border: 'Borda', 'border-light': 'Borda clara', 'border-hover': 'Borda hover',
  success: 'Sucesso', warning: 'Aviso', error: 'Erro', info: 'Info',
};

export default function AdminConfiguracoes() {
  const [companyData, setCompanyData] = useState({
    name: '',
    subtitle: '',
    logoUrl: '',
    address: '',
    address2: '',
    cep: '',
    city: '',
    phone: '',
    email: '',
    instagram: '',
    facebook: '',
    tiktok: '',
    whatsapp: '',
    whatsappMsg: '',
  });

  const [hours, setHours] = useState({
    weekdays: '',
    saturday: '',
    sunday: '',
  });

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ── Frete por motoboy (municípios + taxa em R$, editável sem deploy) ── */
  const [motoboyItens, setMotoboyItens] = useState<{ cidade: string; valor: string }[]>([]);
  const [motoboySaved, setMotoboySaved] = useState(false);
  const [motoboySaving, setMotoboySaving] = useState(false);

  /* ── Aparência / Hero das páginas (imagem de fundo dos títulos das páginas internas) ── */
  const [heroImagem, setHeroImagem] = useState('/images/loja.jpg');
  const [heroImagemSaved, setHeroImagemSaved] = useState(false);
  const [heroImagemSaving, setHeroImagemSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/cms/configuracoes?chave=site.hero_imagem_paginas');
        if (r.ok) {
          const v = (await r.json()).valor;
          if (typeof v === 'string' && v.trim()) setHeroImagem(v.trim());
        }
      } catch { /* mantém padrão */ }
    })();
  }, []);

  const salvarHeroImagem = async () => {
    setHeroImagemSaving(true);
    try {
      await fetch('/api/cms/configuracoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chave: 'site.hero_imagem_paginas',
          valor: heroImagem.trim(),
          descricao: 'Imagem de fundo dos títulos das páginas internas (sobre, galeria, catálogo)',
        }),
      });
      setHeroImagemSaved(true);
      setTimeout(() => setHeroImagemSaved(false), 3000);
    } finally {
      setHeroImagemSaving(false);
    }
  };

  /* ── Upload do ícone do logo: arquivo → data URI (base64) ── */
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        e.target.value = '';
        return;
      }
      setCompanyData(prev => ({ ...prev, logoUrl: dataUri }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  /* ── Carrega Dados da Empresa do banco ── */
  useEffect(() => {
    (async () => {
      try {
        const [logo, end, tel, ig, fb, tk, wa, hr, email, logoImg, waMsg] = await Promise.all([
          fetch('/api/cms/configuracoes?chave=header.logo').then(r => r.ok ? r.json() : null),
          fetch('/api/cms/configuracoes?chave=footer.endereco').then(r => r.ok ? r.json() : null),
          fetch('/api/cms/configuracoes?chave=footer.contato.telefone').then(r => r.ok ? r.json() : null),
          fetch('/api/cms/configuracoes?chave=footer.contato.instagram').then(r => r.ok ? r.json() : null),
          fetch('/api/cms/configuracoes?chave=empresa.facebook').then(r => r.ok ? r.json() : null),
          fetch('/api/cms/configuracoes?chave=footer.contato.tiktok').then(r => r.ok ? r.json() : null),
          fetch('/api/cms/configuracoes?chave=whatsapp.numero').then(r => r.ok ? r.json() : null),
          fetch('/api/cms/configuracoes?chave=footer.horario').then(r => r.ok ? r.json() : null),
          fetch('/api/cms/configuracoes?chave=empresa.email').then(r => r.ok ? r.json() : null),
          fetch('/api/cms/configuracoes?chave=header.logo_imagem').then(r => r.ok ? r.json() : null),
          fetch('/api/cms/configuracoes?chave=whatsapp.mensagem').then(r => r.ok ? r.json() : null),
        ]);
        const v = (d: any, campo?: string) => (d?.valor ? (campo ? d.valor[campo] : d.valor) : undefined);
        setCompanyData(prev => ({
          ...prev,
          name: v(logo, 'texto') || prev.name,
          subtitle: v(logo, 'subtitulo') || prev.subtitle,
          logoUrl: v(logoImg) || prev.logoUrl,
          address: v(end, 'linha1') || prev.address,
          address2: v(end, 'linha2') || prev.address2,
          cep: (v(end, 'cep') || '').replace('CEP ', '') || prev.cep,
          city: v(end, 'cidade') || prev.city,
          phone: v(tel, 'numero') || prev.phone,
          email: v(email) || prev.email,
          instagram: v(ig, 'usuario') || prev.instagram,
          facebook: (v(fb, 'usuario') || prev.facebook),
          tiktok: v(tk, 'usuario') || prev.tiktok,
          whatsapp: (v(wa, 'numero') || '').replace(/\D/g, '') || prev.whatsapp,
          whatsappMsg: v(waMsg) || prev.whatsappMsg,
        }));
        setHours(prev => ({
          weekdays: v(hr, 'semana') || prev.weekdays,
          saturday: v(hr, 'sabado') || prev.saturday,
          sunday: v(hr, 'domingo') || prev.sunday,
        }));
      } catch { /* mantém padrões */ }
    })();
  }, []);

  /* ── Tema / Paleta ── */
  const [temaAtivo, setTemaAtivo] = useState<PaletteTheme>('dark');
  const [paletas, setPaletas] = useState<Palettes>(DEFAULT_PALETTES);
  const [temaSaved, setTemaSaved] = useState(false);
  const [temaSaving, setTemaSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [a, p, m] = await Promise.all([
          fetch('/api/cms/configuracoes?chave=tema.ativo'),
          fetch('/api/cms/configuracoes?chave=tema.paleta'),
          fetch('/api/cms/configuracoes?chave=frete.motoboy'),
        ]);
        if (a.ok) {
          const v = (await a.json()).valor;
          if (v === 'light' || v === 'dark') setTemaAtivo(v);
        }
        if (p.ok) {
          const v = (await p.json()).valor;
          if (v?.dark && v?.light) setPaletas(v);
        }
        if (m.ok) {
          const v = (await m.json()).valor;
          if (Array.isArray(v)) {
            setMotoboyItens(v.map((item: { cidade?: unknown; valor?: unknown }) => ({
              cidade: String(item?.cidade ?? ''),
              valor: String(item?.valor ?? ''),
            })));
          } else if (v && typeof v === 'object') {
            setMotoboyItens(Object.entries(v as Record<string, unknown>).map(([cidade, valor]) => ({
              cidade,
              valor: String(valor ?? ''),
            })));
          }
        }
      } catch { /* mantém padrões */ }
    })();
  }, []);

  const salvarTema = async () => {
    setTemaSaving(true);
    try {
      await fetch('/api/cms/configuracoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: 'tema.ativo', valor: temaAtivo }),
      });
      await fetch('/api/cms/configuracoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: 'tema.paleta', valor: paletas, descricao: 'Paletas de cores (dark/light)' }),
      });
      applyPalette(temaAtivo, paletas);
      setTemaSaved(true);
      setTimeout(() => setTemaSaved(false), 3000);
    } finally {
      setTemaSaving(false);
    }
  };

  /* ── Frete motoboy: adiciona/remove/alterar municípios + taxa ── */
  const alterarMotoboyItem = (idx: number, campo: 'cidade' | 'valor', valor: string) => {
    setMotoboyItens(prev => prev.map((item, i) => (i === idx ? { ...item, [campo]: valor } : item)));
  };
  const adicionarMotoboyItem = () => setMotoboyItens(prev => [...prev, { cidade: '', valor: '' }]);
  const removerMotoboyItem = (idx: number) => setMotoboyItens(prev => prev.filter((_, i) => i !== idx));

  const salvarMotoboy = async () => {
    setMotoboySaving(true);
    try {
      const lista = motoboyItens
        .filter(i => i.cidade.trim())
        .map(i => ({ cidade: i.cidade.trim(), valor: Number(String(i.valor).replace(',', '.')) || 0 }));
      const res = await fetch('/api/cms/configuracoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chave: 'frete.motoboy',
          valor: lista,
          descricao: 'Entrega por motoboy: municípios e taxa (R$) por cidade. Sem a cidade na lista, o motoboy fica indisponível.',
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d?.error || 'Erro ao salvar o frete de motoboy.');
        return;
      }
      setMotoboySaved(true);
      setTimeout(() => setMotoboySaved(false), 3000);
    } finally {
      setMotoboySaving(false);
    }
  };

  const restaurarTema = () => {
    setPaletas(DEFAULT_PALETTES);
  };

  /* ── Pagamento ── */
  const [pagConfig, setPagConfig] = useState({ provedor: 'asaas', modo: 'sandbox', apiUrl: '', apiKey: '', webhookToken: '' });
  const [pagSaved, setPagSaved] = useState(false);
  const [pagSaving, setPagSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [prov, modo, url, key, wh] = await Promise.all([
          fetch('/api/cms/configuracoes?chave=pagamento.provedor').then(r => r.ok ? r.json() : null),
          fetch('/api/cms/configuracoes?chave=pagamento.modo').then(r => r.ok ? r.json() : null),
          fetch('/api/cms/configuracoes?chave=pagamento.api_url').then(r => r.ok ? r.json() : null),
          fetch('/api/cms/configuracoes?chave=pagamento.api_key').then(r => r.ok ? r.json() : null),
          fetch('/api/cms/configuracoes?chave=pagamento.webhook_token').then(r => r.ok ? r.json() : null),
        ]);
        const provedor = prov?.valor || 'asaas';
        const modoPag = modo?.valor || 'sandbox';
        setPagConfig({
          provedor,
          modo: modoPag,
          apiUrl: url?.valor || urlPadraoPagamento(provedor, modoPag),
          apiKey: key?.valor || '',
          webhookToken: wh?.valor || '',
        });
      } catch { /* mantém padrão */ }
    })();
  }, []);

  const salvarPagamento = async () => {
    setPagSaving(true);
    try {
      await fetch('/api/cms/configuracoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: 'pagamento.provedor', valor: pagConfig.provedor, descricao: 'Provedor de pagamento (asaas|getnet|cielo)' }),
      });
      await fetch('/api/cms/configuracoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: 'pagamento.modo', valor: pagConfig.modo, descricao: 'Modo do provedor (sandbox|producao)' }),
      });
      await fetch('/api/cms/configuracoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: 'pagamento.api_url', valor: pagConfig.apiUrl, descricao: 'URL da API do provedor' }),
      });
      await fetch('/api/cms/configuracoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: 'pagamento.api_key', valor: pagConfig.apiKey, descricao: 'Token do provedor de pagamento' }),
      });
      await fetch('/api/cms/configuracoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: 'pagamento.webhook_token', valor: pagConfig.webhookToken, descricao: 'Token de assinatura do webhook' }),
      });
      setPagSaved(true);
      setTimeout(() => setPagSaved(false), 3000);
    } finally {
      setPagSaving(false);
    }
  };

  /* ── Chat ── */
  const [chatConfig, setChatConfig] = useState({ url: CHATWOOT_BASE_URL, token: CHATWOOT_WEBSITE_TOKEN });
  const [chatSaved, setChatSaved] = useState(false);
  const [chatSaving, setChatSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [url, token] = await Promise.all([
          fetch('/api/cms/configuracoes?chave=chatwoot.url').then(r => r.ok ? r.json() : null),
          fetch('/api/cms/configuracoes?chave=chatwoot.token').then(r => r.ok ? r.json() : null),
        ]);
        setChatConfig({
          url: url?.valor || CHATWOOT_BASE_URL,
          token: token?.valor || CHATWOOT_WEBSITE_TOKEN,
        });
      } catch { /* mantém padrão */ }
    })();
  }, []);

  const salvarChat = async () => {
    setChatSaving(true);
    try {
      await fetch('/api/cms/configuracoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: 'chatwoot.url', valor: chatConfig.url, descricao: 'URL base do Chatwoot' }),
      });
      await fetch('/api/cms/configuracoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: 'chatwoot.token', valor: chatConfig.token, descricao: 'Token da caixa de entrada (website_token)' }),
      });
      setChatSaved(true);
      setTimeout(() => setChatSaved(false), 3000);
    } finally {
      setChatSaving(false);
    }
  };

  /* ── Modo do site ── */
  const [siteModo, setSiteModo] = useState<'teste' | 'producao'>('producao');
  const [modoSaved, setModoSaved] = useState(false);
  const [modoSaving, setModoSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/cms/configuracoes?chave=site.modo');
        if (res.ok) {
          const v = (await res.json()).valor;
          if (v === 'teste' || v === 'producao') setSiteModo(v);
        }
      } catch { /* mantém produção */ }
    })();
  }, []);

  const salvarModo = async () => {
    setModoSaving(true);
    try {
      await fetch('/api/cms/configuracoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: 'site.modo', valor: siteModo, descricao: 'Modo do site (teste|producao)' }),
      });
      setModoSaved(true);
      setTimeout(() => setModoSaved(false), 3000);
    } finally {
      setModoSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const telDigits = companyData.phone.replace(/\D/g, '');
      const waDigits = companyData.whatsapp.replace(/\D/g, '');
      const tiktokInput = companyData.tiktok.trim();
        const igInput = companyData.instagram.trim();
        const fbInput = companyData.facebook.trim();
        const saves: Array<Promise<unknown>> = [
        fetch('/api/cms/configuracoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chave: 'header.logo', valor: { texto: companyData.name, subtitulo: companyData.subtitle }, descricao: 'Logo do header' }) }),
        fetch('/api/cms/configuracoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chave: 'header.logo_imagem', valor: companyData.logoUrl, descricao: 'Ícone do logo (pré-definido, upload ou URL)' }) }),
        fetch('/api/cms/configuracoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chave: 'footer.endereco', valor: { linha1: companyData.address, linha2: companyData.address2, cidade: companyData.city, cep: `CEP ${companyData.cep}` }, descricao: 'Endereço do rodapé' }) }),
        fetch('/api/cms/configuracoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chave: 'footer.contato.telefone', valor: { link: `tel:+${telDigits}`, numero: companyData.phone }, descricao: 'Telefone de contato' }) }),
        fetch('/api/cms/configuracoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chave: 'footer.contato.instagram', valor: { link: igInput ? `https://instagram.com/${igInput.replace('@', '')}` : '', usuario: igInput }, descricao: 'Instagram' }) }),
        fetch('/api/cms/configuracoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chave: 'footer.contato.tiktok', valor: { link: tiktokInput ? (tiktokInput.startsWith('http') ? tiktokInput : `https://www.tiktok.com/@${tiktokInput.replace('@', '')}`) : '', usuario: tiktokInput }, descricao: 'TikTok' }) }),
        fetch('/api/cms/configuracoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chave: 'empresa.facebook', valor: { link: fbInput ? `https://facebook.com/${fbInput}` : '', usuario: fbInput }, descricao: 'Facebook' }) }),
        fetch('/api/cms/configuracoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chave: 'whatsapp.numero', valor: { link: `https://wa.me/${waDigits}`, numero: `+${waDigits}` }, descricao: 'Número do WhatsApp' }) }),
        fetch('/api/cms/configuracoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chave: 'whatsapp.mensagem', valor: companyData.whatsappMsg, descricao: 'Mensagem padrão enviada ao clicar no WhatsApp' }) }),
        fetch('/api/cms/configuracoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chave: 'footer.contato.whatsapp', valor: { link: `https://wa.me/${waDigits}`, numero: `+${waDigits}` }, descricao: 'WhatsApp do rodapé' }) }),
        fetch('/api/cms/configuracoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chave: 'empresa.email', valor: companyData.email, descricao: 'E-mail de contato' }) }),
        fetch('/api/cms/configuracoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chave: 'footer.horario', valor: { semana: hours.weekdays, sabado: hours.saturday, domingo: hours.sunday }, descricao: 'Horários de funcionamento' }) }),
      ];
      await Promise.all(saves);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const set = (obj: Record<string, string>, setter: (v: Record<string, string>) => void, field: string) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setter({ ...obj, [field]: e.target.value });

  const setCor = (key: string, value: string) => {
    setPaletas(prev => ({ ...prev, [temaAtivo]: { ...prev[temaAtivo], [key]: value } }));
  };

  return (
    <>
      <div className="admin-page-header">
        <h2>Configurações</h2>
        {saved && (
          <span className="badge badge-success">✅ Salvo com sucesso!</span>
        )}
      </div>

      {/* Tema e Paleta de Cores */}
      <div className="admin-card" style={{ marginBottom: 'var(--spacing-lg)', border: '1px solid rgba(212,175,55,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
          <h3 style={{ margin: 0 }}>🎨 Tema e Paleta de Cores</h3>
          {temaSaved && <span className="badge badge-success">✅ Tema salvo!</span>}
        </div>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--spacing-lg)' }}>
          Escolha o tema padrão do site (dark ou light) e personalize as cores de cada versão.
        </p>

        <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
          {(['dark', 'light'] as PaletteTheme[]).map(t => (
            <button
              key={t}
              onClick={() => setTemaAtivo(t)}
              style={{
                padding: '0.5rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
                border: `2px solid ${temaAtivo === t ? 'var(--color-gold)' : 'rgba(255,255,255,0.15)'}`,
                background: temaAtivo === t ? 'rgba(212,175,55,0.15)' : 'transparent',
                color: 'var(--color-text)',
              }}
            >
              {t === 'dark' ? '🌙 Tema Dark' : '☀️ Tema Light'}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--spacing-md)' }}>
          {PALETTE_KEYS.map(key => (
            <div key={key} className="input-group">
              <label>{PALETTE_LABELS[key] || key} <code style={{ fontSize: '0.7rem', opacity: 0.7 }}>--color-{key}</code></label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {!key.endsWith('-rgb') ? (
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(paletas[temaAtivo][key] || '') ? paletas[temaAtivo][key] : '#000000'}
                    onChange={e => setCor(key, e.target.value)}
                    style={{ width: 44, height: 36, borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', cursor: 'pointer' }}
                  />
                ) : null}
                <input
                  className="input"
                  value={paletas[temaAtivo][key] || ''}
                  onChange={e => setCor(key, e.target.value)}
                  placeholder={key.endsWith('-rgb') ? 'ex: 255, 215, 0' : '#FFD700'}
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'flex-end', marginTop: 'var(--spacing-lg)' }}>
          <button type="button" onClick={restaurarTema} className="btn btn-secondary" style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'var(--color-text)' }}>
            ♻️ Restaurar Padrões
          </button>
          <button type="button" onClick={salvarTema} disabled={temaSaving} className="btn btn-gold btn-lg">
            {temaSaving ? 'Salvando...' : '💾 Salvar Tema'}
          </button>
        </div>
      </div>

      {/* Pagamento */}
      <div className="admin-card" style={{ marginBottom: 'var(--spacing-lg)', border: '1px solid rgba(212,175,55,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
          <h3 style={{ margin: 0 }}>💳 Pagamento</h3>
          {pagSaved && <span className="badge badge-success">✅ Pagamento salvo!</span>}
          {pagConfig.modo === 'producao' && (
            <span className="badge badge-error" style={{ marginLeft: 'var(--spacing-sm)' }} title="Cobranças reais serão geradas">
              🚨 PRODUÇÃO ATIVA
            </span>
          )}
        </div>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--spacing-lg)' }}>
          Provedor de pagamento, modo (teste/produção) e credenciais. O checkout usa o provedor selecionado.
        </p>
        {pagConfig.modo === 'producao' && (
          <div style={{ marginBottom: 'var(--spacing-lg)', padding: 'var(--spacing-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-error)', background: 'rgba(220,38,38,0.08)' }}>
            <strong style={{ color: 'var(--color-error)' }}>⚠️ Atenção — modo produção:</strong>{' '}
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              Este provedor está em <strong>produção</strong>: os pagamentos são <strong>reais</strong> (não são teste). Certifique-se de usar as credenciais oficiais e de que o webhook está configurado no painel do provedor antes de divulgar o site.
            </span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
          {([
            { value: 'asaas', label: '💠 Asaas' },
            { value: 'getnet', label: '🏦 GetNet' },
            { value: 'cielo', label: '💳 Cielo' },
          ]).map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                setPagConfig(prev => ({
                  ...prev,
                  provedor: opt.value,
                  apiUrl: urlPadraoPagamento(opt.value as 'asaas' | 'getnet' | 'cielo', prev.modo as 'sandbox' | 'producao'),
                }));
              }}
              style={{
                padding: '0.5rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
                border: `2px solid ${pagConfig.provedor === opt.value ? 'var(--color-gold)' : 'var(--color-border)'}`,
                background: pagConfig.provedor === opt.value ? 'rgba(212,175,55,0.15)' : 'transparent',
                color: 'var(--color-text)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
          {([
            { value: 'sandbox', label: '🧪 Sandbox (teste)' },
            { value: 'producao', label: '🚀 Produção' },
          ]).map(opt => (
            <button
              key={opt.value}
              onClick={() => setPagConfig(prev => ({
                ...prev,
                modo: opt.value,
                apiUrl: urlPadraoPagamento(prev.provedor as 'asaas' | 'getnet' | 'cielo', opt.value as 'sandbox' | 'producao'),
              }))}
              style={{
                padding: '0.4rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                border: `2px solid ${pagConfig.modo === opt.value ? 'var(--color-gold)' : 'var(--color-border)'}`,
                background: pagConfig.modo === opt.value ? 'rgba(212,175,55,0.15)' : 'transparent',
                color: 'var(--color-text)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
          <div className="input-group" style={{ gridColumn: '1 / -1' }}>
            <label>URL da API (link do provedor — visível)</label>
            <input
              className="input"
              placeholder="https://..."
              value={pagConfig.apiUrl}
              onChange={e => setPagConfig(prev => ({ ...prev, apiUrl: e.target.value }))}
            />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              Padrão {pagConfig.modo}: {urlPadraoPagamento(pagConfig.provedor as 'asaas' | 'getnet' | 'cielo', pagConfig.modo as 'sandbox' | 'producao')}
            </span>
          </div>
          <div className="input-group">
            <label>Token do provedor</label>
            <input
              className="input"
              type="password"
              placeholder={pagConfig.provedor === 'asaas' ? '$aact_...' : pagConfig.provedor === 'cielo' ? 'MerchantId:MerchantKey' : 'client_id:client_secret:seller_id'}
              value={pagConfig.apiKey}
              onChange={e => setPagConfig(prev => ({ ...prev, apiKey: e.target.value }))}
            />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              {pagConfig.provedor === 'cielo' ? 'Formato: MerchantId:MerchantKey' : pagConfig.provedor === 'getnet' ? 'Formato: client_id:client_secret:seller_id' : 'Token API do Asaas'}
            </span>
          </div>
          <div className="input-group">
            <label>Token do Webhook</label>
            <input className="input" type="password" placeholder="whsec_..." value={pagConfig.webhookToken} onChange={e => setPagConfig(prev => ({ ...prev, webhookToken: e.target.value }))} />
          </div>
        </div>

        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <a
            href={DOCS_PAGAMENTO[pagConfig.provedor as 'asaas' | 'getnet' | 'cielo']?.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-gold)', fontWeight: 600, textDecoration: 'underline', fontSize: 'var(--text-sm)' }}
          >
            📘 {DOCS_PAGAMENTO[pagConfig.provedor as 'asaas' | 'getnet' | 'cielo']?.label}
          </a>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={salvarPagamento} disabled={pagSaving} className="btn btn-gold btn-lg">
            {pagSaving ? 'Salvando...' : '💾 Salvar Pagamento'}
          </button>
        </div>
      </div>

      {/* Chat */}
      <div className="admin-card" style={{ marginBottom: 'var(--spacing-lg)', border: '1px solid rgba(212,175,55,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
          <h3 style={{ margin: 0 }}>💬 Chat</h3>
          {chatSaved && <span className="badge badge-success">✅ Chat salvo!</span>}
        </div>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--spacing-lg)' }}>
           URL base e token da caixa de entrada do Chatwoot. O widget público usa o canal fixo deste site; estes valores são usados pelos fluxos de chat por API (pedido pelo chat, follow-ups e campanhas).
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
          <div className="input-group">
            <label>URL Base do Chatwoot</label>
            <input className="input" type="url" placeholder="https://chat.seudominio.com" value={chatConfig.url} onChange={e => setChatConfig(prev => ({ ...prev, url: e.target.value }))} />
          </div>
          <div className="input-group">
            <label>Token da Caixa de Entrada (website_token)</label>
            <input className="input" placeholder={CHATWOOT_WEBSITE_TOKEN} value={chatConfig.token} onChange={e => setChatConfig(prev => ({ ...prev, token: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={salvarChat} disabled={chatSaving} className="btn btn-gold btn-lg">
            {chatSaving ? 'Salvando...' : '💾 Salvar Chat'}
          </button>
        </div>
      </div>

      {/* Convite ao chat e redes */}
      <ConviteChatSection />

      {/* Solicitações aos Agentes */}
      <SolicitacoesAgentesSection />

      {/* Modo do Site */}
      <div className="admin-card" style={{ marginBottom: 'var(--spacing-lg)', border: '1px solid rgba(212,175,55,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
          <h3 style={{ margin: 0 }}>🚦 Modo do Site</h3>
          {modoSaved && <span className="badge badge-success">✅ Modo salvo!</span>}
        </div>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--spacing-lg)' }}>
          Em <strong>modo de teste</strong>, uma tarja no topo do site avisa que as operações não serão levadas em consideração.
          Em <strong>produção</strong>, nenhuma tarja é exibida.
        </p>
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
          {([
            { value: 'teste', label: '🧪 Modo Teste', desc: 'Exibe tarja de aviso' },
            { value: 'producao', label: '🚀 Modo Produção', desc: 'Sem tarja' },
          ] as const).map(m => (
            <button
              key={m.value}
              onClick={() => setSiteModo(m.value)}
              style={{
                padding: '0.5rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
                border: `2px solid ${siteModo === m.value ? 'var(--color-gold)' : 'var(--color-border)'}`,
                background: siteModo === m.value ? 'rgba(212,175,55,0.15)' : 'transparent',
                color: 'var(--color-text)',
              }}
            >
              {m.label}
              <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 400, opacity: 0.7 }}>{m.desc}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={salvarModo} disabled={modoSaving} className="btn btn-gold btn-lg">
            {modoSaving ? 'Salvando...' : '💾 Salvar Modo'}
          </button>
        </div>
      </div>

      {/* Aparência — Hero das páginas internas */}
      <div className="admin-card" style={{ marginBottom: 'var(--spacing-lg)', border: '1px solid rgba(212,175,55,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
          <h3 style={{ margin: 0 }}>🖼️ Hero das Páginas (Sobre, Galeria, Catálogo)</h3>
          {heroImagemSaved && <span className="badge badge-success">✅ Salvo!</span>}
        </div>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--spacing-lg)' }}>
          Imagem de fundo dos títulos das páginas internas (Sobre, Galeria e Catálogo). Cole uma URL ou envie uma imagem abaixo.
        </p>
        <div className="input-group" style={{ maxWidth: 520 }}>
          <label>Imagem de fundo (URL)</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input className="input" value={heroImagem} onChange={e => setHeroImagem(e.target.value)}
              placeholder="https://... ou /images/loja.jpg" />
            <button type="button" onClick={salvarHeroImagem} disabled={heroImagemSaving} className="btn btn-gold">
              {heroImagemSaving ? 'Salvando...' : '💾 Salvar'}
            </button>
          </div>
        </div>
        {heroImagem && (
          <img src={heroImagem} alt="Preview do fundo" style={{ marginTop: '0.75rem', maxHeight: 120, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--color-border)' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        )}
      </div>

      {/* Entrega por motoboy (configurável sem deploy) */}
      <div className="admin-card" style={{ marginBottom: 'var(--spacing-lg)', border: '1px solid rgba(212,175,55,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
          <h3 style={{ margin: 0 }}>🛵 Entrega por Motoboy (municípios e taxa)</h3>
          {motoboySaved && <span className="badge badge-success">✅ Salvo!</span>}
        </div>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--spacing-lg)' }}>
          Define em quais municípios a entrega por motoboy está disponível e a taxa (R$) de cada um.
          Municípios fora desta lista ficam <strong>sem</strong> a opção de motoboy no checkout.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
          {motoboyItens.length === 0 && (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
              Nenhum município configurado — será usado o padrão: Praia Grande R$15, São Vicente R$25 e Santos R$35.
            </p>
          )}
          {motoboyItens.map((item, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 44px', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
              <input
                className="input"
                placeholder="Município (ex: Praia Grande)"
                value={item.cidade}
                onChange={e => alterarMotoboyItem(idx, 'cidade', e.target.value)}
              />
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                placeholder="R$"
                value={item.valor}
                onChange={e => alterarMotoboyItem(idx, 'valor', e.target.value)}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => removerMotoboyItem(idx)}
                style={{ height: '100%', color: 'var(--color-error)' }}
                aria-label="Remover município"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
          <button type="button" onClick={adicionarMotoboyItem} className="btn btn-ghost btn-sm">＋ Adicionar município</button>
          <button type="button" onClick={salvarMotoboy} disabled={motoboySaving} className="btn btn-gold btn-sm">
            {motoboySaving ? 'Salvando...' : '💾 Salvar Motoboy'}
          </button>
        </div>
      </div>

      <EnvironmentVariablesSection />

      <McpSection />

      <BackupCard />

      <form onSubmit={handleSave}>
        {/* Company */}
        <div className="admin-card" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>🏪 Dados da Empresa</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--spacing-md)' }}>
            {[
              { label: 'Nome da Empresa', key: 'name' },
              { label: 'Subtítulo do Logo', key: 'subtitle' },
              { label: 'Telefone / WhatsApp', key: 'phone' },
              { label: 'E-mail de Contato', key: 'email' },
              { label: 'Instagram', key: 'instagram' },
              { label: 'TikTok', key: 'tiktok' },
              { label: 'Facebook', key: 'facebook' },
              { label: 'WhatsApp (somente números)', key: 'whatsapp' },
            ].map(f => (
              <div key={f.key} className="input-group">
                <label>{f.label}</label>
                <input
                  className="input"
                  value={companyData[f.key as keyof typeof companyData]}
                  onChange={set(companyData as unknown as Record<string, string>, (v) => setCompanyData(v as typeof companyData), f.key)}
                />
              </div>
            ))}
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label>Mensagem padrão do WhatsApp (enviada ao clicar no ícone)</label>
              <textarea
                className="input"
                rows={2}
                placeholder="Ex: Olá! Gostaria de saber mais sobre seus produtos."
                value={companyData.whatsappMsg}
                onChange={e => setCompanyData(prev => ({ ...prev, whatsappMsg: e.target.value }))}
              />
            </div>
            <div className="input-group">
              <label>Ícone do Logo (pré-definido)</label>
              <select
                className="input"
                value={LOGO_ICONES.some(i => i.nome === companyData.logoUrl) ? companyData.logoUrl : ''}
                onChange={e => setCompanyData(prev => ({ ...prev, logoUrl: e.target.value }))}
              >
                <option value="">— Sem ícone (texto) —</option>
                {LOGO_ICONES.map(i => (
                  <option key={i.nome} value={i.nome}>{i.icone} {i.label}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Ou envie um ícone novo (imagem)</label>
              <input className="input" type="file" accept="image/*" onChange={handleLogoUpload} />
              {companyData.logoUrl && !LOGO_ICONES.some(i => i.nome === companyData.logoUrl) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <img src={companyData.logoUrl} alt="Logo" style={{ maxHeight: 40, maxWidth: 120, objectFit: 'contain' }} />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCompanyData(prev => ({ ...prev, logoUrl: '' }))}>
                    Remover ícone
                  </button>
                </div>
              )}
              {companyData.logoUrl && LOGO_ICONES.some(i => i.nome === companyData.logoUrl) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>{LOGO_ICONES.find(i => i.nome === companyData.logoUrl)?.icone}</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCompanyData(prev => ({ ...prev, logoUrl: '' }))}>
                    Remover ícone
                  </button>
                </div>
              )}
            </div>
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label>Endereço (rua/avenida)</label>
              <input className="input" value={companyData.address} onChange={e => setCompanyData(prev => ({ ...prev, address: e.target.value }))} />
            </div>
            <div className="input-group">
              <label>Complemento (box/sala)</label>
              <input className="input" value={companyData.address2} onChange={e => setCompanyData(prev => ({ ...prev, address2: e.target.value }))} />
            </div>
            <div className="input-group">
              <label>Cidade</label>
              <input className="input" value={companyData.city} onChange={e => setCompanyData(prev => ({ ...prev, city: e.target.value }))} />
            </div>
            <div className="input-group">
              <label>CEP</label>
              <input className="input" value={companyData.cep} onChange={e => setCompanyData(prev => ({ ...prev, cep: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Horários */}
        <div className="admin-card" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>🕐 Horários de Funcionamento</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--spacing-md)' }}>
            {[
              { label: 'Segunda a Sexta', key: 'weekdays' },
              { label: 'Sábado', key: 'saturday' },
              { label: 'Domingo', key: 'sunday' },
            ].map(f => (
              <div key={f.key} className="input-group">
                <label>{f.label}</label>
                <input
                  className="input"
                  value={hours[f.key as keyof typeof hours]}
                  onChange={e => setHours(prev => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" disabled={saving} className="btn btn-gold btn-lg">💾 {saving ? 'Salvando...' : 'Salvar Configurações'}</button>
        </div>
      </form>
    </>
  );
}
