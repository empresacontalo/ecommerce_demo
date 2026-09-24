'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCart } from '@/context/CartContext';
import Image from 'next/image';
import Link from 'next/link';
import { getConfig } from '@/utils/empresa';
import { EMPRESA_NOME_PADRAO } from '@/utils/empresa-default';
import { createClient } from '@/utils/auth/client';
import { updateProfileMetadata } from '@/utils/profile/profile';
import { calcularFreteMotoboy, TabelaMotoboy, parseTabelaMotoboy } from '@/utils/frete';
import { calcularDescontoFormaPagamento, DescontosPorForma, normalizarFormaPagamento } from '@/utils/desconto-pagamento';

export default function CheckoutPage() {
  const { items, totalPrice, discount, coupon, clearCart } = useCart();
  const [empresa, setEmpresa] = useState({ nome: EMPRESA_NOME_PADRAO, endereco: '', endereco2: '', cidade: '', cep: '', horario: '' });

  useEffect(() => {
    (async () => {
      const [logo, end, hr] = await Promise.all([
        getConfig('header.logo'),
        getConfig('footer.endereco'),
        getConfig('footer.horario'),
      ]);
      setEmpresa({
        nome: logo?.texto || EMPRESA_NOME_PADRAO,
        endereco: end?.linha1 || '',
        endereco2: end?.linha2 || '',
        cidade: end?.cidade || '',
        cep: end?.cep || '',
        horario: `${hr?.semana || ''}${hr?.sabado ? ` e ${hr.sabado}` : ''}`,
      });
    })();
  }, []);

  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit' | 'boleto'>('pix');
  const supabase = createClient();
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Cartão de crédito state
  const [cardData, setCardData] = useState({ number: '', name: '', expiry: '', cvv: '', installments: '1' });
  const [cardAddressUse, setCardAddressUse] = useState<'entrega' | 'novo'>('entrega');
  const [cardAddressForm, setCardAddressForm] = useState({
    zip_code: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '',
  });

  // Delivery options state
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [shippingMethod, setShippingMethod] = useState<'pac' | 'sedex' | 'motoboy' | 'retirada'>('pac');

  // Form State
  const [formData, setFormData] = useState({ name: '', lastName: '', email: '', cpf: '', phone: '' });
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({
    zip_code: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', label: 'Principal'
  });

  // Tabela de motoboy editável no CMS (frete.motoboy); null → usa padrão do código.
  const [tabelaMotoboy, setTabelaMotoboy] = useState<TabelaMotoboy | null>(null);
  // Desconto geral por forma de pagamento (descontos.pagamento); null → sem desconto geral.
  const [descontoGeral, setDescontoGeral] = useState<DescontosPorForma | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [fm, dg] = await Promise.all([
          fetch('/api/cms/configuracoes?chave=frete.motoboy', { cache: 'no-store' }),
          fetch('/api/cms/configuracoes?chave=descontos.pagamento', { cache: 'no-store' }),
        ]);
        if (fm.ok) {
          const data = await fm.json();
          const tabela = parseTabelaMotoboy(data?.valor);
          if (active && tabela) setTabelaMotoboy(tabela);
        }
        if (dg.ok) {
          const data = await dg.json();
          const v = data?.valor;
          if (active && v && typeof v === 'object' && !Array.isArray(v)) setDescontoGeral(v);
        }
      } catch { /* mantém padrões do código */ }
    })();
    return () => { active = false; };
  }, []);

  // Endereço de entrega atual (salvo do usuário ou formulário novo)
  const enderecoEntrega = addresses.find(a => a.id === selectedAddressId) || addressForm;
  const freteMotoboy = useMemo(
    () => calcularFreteMotoboy(enderecoEntrega?.city, enderecoEntrega?.state, tabelaMotoboy),
    [enderecoEntrega?.city, enderecoEntrega?.state, tabelaMotoboy]
  );

  // Método efetivo: motoboy só é válido quando disponível para o endereço;
  // caso contrário, cai para PAC (mesmo que o radio anteriormente o marcasse).
  const motoboyDisponivelEfetivo = freteMotoboy.disponivel;
  const shippingMethodEfetivo = shippingMethod === 'motoboy' && !motoboyDisponivelEfetivo
    ? 'pac'
    : shippingMethod;

  const getShippingFee = () => {
    if (deliveryType === 'pickup') return 0;
    if (shippingMethodEfetivo === 'pac') return 25.90;
    if (shippingMethodEfetivo === 'sedex') return 48.90;
    if (shippingMethodEfetivo === 'motoboy') return freteMotoboy.valor;
    return 25.90;
  };

  const getShippingLabel = () => {
    if (deliveryType === 'pickup') return 'Retirar na loja';
    if (shippingMethodEfetivo === 'pac') return 'PAC Correios';
    if (shippingMethodEfetivo === 'sedex') return 'Sedex Correios';
    if (shippingMethodEfetivo === 'motoboy') return `Motoboy (${freteMotoboy.municipio || 'região'})`;
    return 'PAC Correios';
  };

  const shippingFee = getShippingFee();
  const shippingLabel = getShippingLabel();

  const [loading, setLoading] = useState(false);
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setSessionUser(user);
        const fullName = user.user_metadata?.full_name || user.user_metadata?.name || '';
        const nameParts = fullName.trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        const cpf = user.user_metadata?.cpf || '';
        const phone = user.user_metadata?.phone || '';

        setFormData(prev => ({
          ...prev,
          name: prev.name || firstName,
          lastName: prev.lastName || lastName,
          email: prev.email || user.email || '',
          cpf: prev.cpf || cpf,
          phone: prev.phone || phone
        }));

        if (!firstName.trim() || !lastName.trim() || !cpf.trim() || !phone.trim()) {
          setIsEditingProfile(true);
        }

        // Fetch user addresses via API
        fetch('/api/addresses')
          .then(res => res.json())
          .then(data => {
            if (data && data.length > 0 && !data.error) {
              setAddresses(data);
              const defaultAddress = data.find((a: any) => a.is_default) || data[0];
              setSelectedAddressId(defaultAddress.id);
              setAddressForm(defaultAddress);
            }
          })
          .catch(err => console.error('Erro ao buscar endereços:', err));
      }
    });
  }, [supabase]);

  // Reactive CEP Lookup triggered whenever zip_code changes
  useEffect(() => {
    const cleanCep = (addressForm.zip_code || '').replace(/\D/g, '');
    if (cleanCep.length === 8 && (!addressForm.street || !addressForm.city || !addressForm.state)) {
      fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
        .then(r => r.json())
        .then(d => {
          if (!d.erro) {
            setAddressForm(prev => ({
              ...prev,
              street: prev.street || d.logradouro || '',
              neighborhood: prev.neighborhood || d.bairro || '',
              city: prev.city || d.localidade || '',
              state: prev.state || d.uf || ''
            }));
          }
        })
        .catch(err => console.error('Erro na busca de CEP:', err));
    }
  }, [addressForm.zip_code]);

  const handleCepBlur = async () => {
    const cleanCep = (addressForm.zip_code || '').replace(/\D/g, '');
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const d = await res.json();
        if (!d.erro) {
          setAddressForm(prev => ({
            ...prev,
            street: d.logradouro || '',
            neighborhood: d.bairro || '',
            city: d.localidade || '',
            state: d.uf || ''
          }));
        }
      } catch (err) {
        console.error('Erro na busca de CEP:', err);
      }
    }
  };

  const handleSetDefault = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/addresses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_default: true })
      });
      const data = await res.json();
      if (data.error) {
        alert('Erro ao definir endereço padrão: ' + data.error);
      } else {
        const updated = addresses.map(a => ({ ...a, is_default: a.id === id }));
        setAddresses(updated);
        const defaultAddr = updated.find(a => a.id === id);
        if (defaultAddr && selectedAddressId === id) {
          setAddressForm(defaultAddr);
        }
      }
    } catch (err: any) {
      alert('Erro ao definir endereço padrão: ' + err.message);
    }
    setLoading(false);
  };

  const handleDeleteAddress = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este endereço?')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/addresses?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.error) {
        const remaining = addresses.filter(a => a.id !== id);
        setAddresses(remaining);
        if (remaining.length > 0) {
          if (selectedAddressId === id) {
            const nextSelected = remaining.find(a => a.is_default) || remaining[0];
            setSelectedAddressId(nextSelected.id);
            setAddressForm(nextSelected);
          }
        } else {
          setSelectedAddressId('');
          setUseNewAddress(true);
          setAddressForm({
            zip_code: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', label: 'Outro'
          });
        }
      } else {
        alert('Erro ao excluir endereço: ' + data.error);
      }
    } catch (err: any) {
      alert('Erro ao excluir endereço: ' + err.message);
    }
    setLoading(false);
  };

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discountVal = Math.max(0, subtotal - totalPrice);

  // Desconto da forma de pagamento selecionada (estimativa com o Desconto
  // Geral; o valor exato, com descontos por produto, é calculado no servidor).
  const formaPixAtiva = normalizarFormaPagamento(paymentMethod);
  const { descontoForma } = calcularDescontoFormaPagamento(
    items.map(i => ({ id: i.id, price: i.price, quantity: i.quantity, descontos: null })),
    paymentMethod,
    descontoGeral
  );
  const percForma = formaPixAtiva && descontoGeral ? (Number(descontoGeral[formaPixAtiva]) || 0) : 0;
  const totalWithShipping = Math.max(0, totalPrice - descontoForma) + shippingFee;

  if (items.length === 0 && !paymentResult) {
    return (
      <section className="section" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Seu carrinho está vazio</h2>
          <p style={{ margin: 'var(--spacing-md) 0 var(--spacing-xl)' }}>Adicione produtos antes de finalizar a compra.</p>
          <Link href="/catalogo" className="btn btn-primary">Voltar à loja</Link>
        </div>
      </section>
    );
  }

  // Removido o bloqueio total da página para integrar no Passo 1

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    
    const res = await updateProfileMetadata(sessionUser?.id, {
      name: formData.name,
      lastName: formData.lastName,
      phone: formData.phone,
      cpf: formData.cpf,
    });
    
    if (!res.success) {
      setErrorMsg(res.error || 'Erro ao atualizar dados do perfil.');
      setLoading(false);
      return;
    }
    
    setIsEditingProfile(false);
    setLoading(false);
    
    // Refresh the user session state
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setSessionUser(user);
    }
    
    // Proceed to next step
    setStep(2);
  };

  const handleCheckout = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const selectedAddress = deliveryType === 'pickup' ? null : (addresses.find(a => a.id === selectedAddressId) || addressForm);
      const cardAddress = cardAddressUse === 'entrega' && selectedAddress
        ? {
            postalCode: selectedAddress.zip_code || '',
            number: selectedAddress.number || '',
            complement: selectedAddress.complement || '',
            phone: formData.phone || '',
          }
        : {
            postalCode: cardAddressForm.zip_code || '',
            number: cardAddressForm.number || '',
            complement: cardAddressForm.complement || '',
            phone: formData.phone || '',
          };
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${formData.name} ${formData.lastName}`.trim(),
          email: formData.email,
          cpf: formData.cpf,
          phone: formData.phone,
          items,
          coupon,
          paymentMethod,
          shippingMethod: deliveryType === 'pickup' ? 'retirada' : shippingMethodEfetivo,
          shippingAddress: selectedAddress,
          card: paymentMethod === 'credit' ? {
            number: cardData.number.replace(/\s/g, ''),
            name: cardData.name,
            expiry: cardData.expiry,
            cvv: cardData.cvv,
            installments: Number(cardData.installments) || 1,
            address: cardAddress,
          } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro no checkout');

      setPaymentResult(data.payment);
      clearCart(); // pedido finalizado: carrinho e cupom são zerados
      setStep(4); // Sucesso
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div style={{ background: 'var(--color-surface-alt)', minHeight: '100vh', paddingBottom: 'var(--spacing-3xl)' }}>
      <div className="checkout-container">
        
        {/* Main Content */}
        <div className="checkout-main">
          {/* Steps Indicator */}
          <div className="checkout-steps">
            <div className={`checkout-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
              <div className="checkout-step-number">{step > 1 ? '✓' : '1'}</div>
              Identificação
            </div>
            <div className={`checkout-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
              <div className="checkout-step-number">{step > 2 ? '✓' : '2'}</div>
              Entrega
            </div>
            <div className={`checkout-step ${step >= 3 ? 'active' : ''}`}>
              <div className="checkout-step-number">3</div>
              Pagamento
            </div>
          </div>

          {/* STEP 1: IDENTIFICAÇÃO */}
          {step === 1 && (
            <div className="checkout-section">
              <h2>1. Identificação</h2>
              
              {!sessionUser ? (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl) 0' }}>
                  <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xl)' }}>
                    Para continuar com seu pedido, por favor acesse sua conta ou crie uma nova.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', maxWidth: '350px', margin: '0 auto' }}>
                    <Link href="/auth/login?next=/loja/checkout" className="btn btn-gold">
                      Fazer Login
                    </Link>
                    <Link href="/auth/registro?next=/loja/checkout" className="btn btn-secondary">
                      Criar Nova Conta
                    </Link>

                  </div>
                </div>
              ) : (
                <div>
                  {isEditingProfile ? (
                    <form onSubmit={handleSaveProfile} style={{ background: 'var(--color-surface)', padding: 'var(--spacing-lg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                      <h4 style={{ color: 'var(--color-gold)', marginBottom: 'var(--spacing-md)' }}>Complete seus Dados de Cadastro</h4>
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xl)' }}>
                        Precisamos de mais algumas informações para emitir sua nota fiscal e prosseguir com a compra de forma segura.
                      </p>

                      {errorMsg && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', padding: 'var(--spacing-md)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--spacing-lg)', fontSize: 'var(--text-sm)' }}>
                          {errorMsg}
                        </div>
                      )}

                      <div className="checkout-grid" style={{ gap: 'var(--spacing-lg)', marginBottom: 'var(--spacing-xl)' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>Nome</label>
                          <input 
                            type="text" 
                            className="input" 
                            value={formData.name} 
                            onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} 
                            required 
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>Sobrenome</label>
                          <input 
                            type="text" 
                            className="input" 
                            value={formData.lastName} 
                            onChange={(e) => setFormData(p => ({ ...p, lastName: e.target.value }))} 
                            required 
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>CPF</label>
                          <input 
                            type="text" 
                            className="input" 
                            placeholder="000.000.000-00"
                            value={formData.cpf} 
                            onChange={(e) => setFormData(p => ({ ...p, cpf: e.target.value }))} 
                            required 
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>WhatsApp / Telefone</label>
                          <input 
                            type="text" 
                            className="input" 
                            placeholder="(00) 00000-0000"
                            value={formData.phone} 
                            onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))} 
                            required 
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-md)' }}>
                        {formData.name.trim() && formData.lastName.trim() && formData.cpf.trim() && formData.phone.trim() && (
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            onClick={() => setIsEditingProfile(false)}
                          >
                            Cancelar
                          </button>
                        )}
                        <button 
                          type="submit" 
                          className="btn btn-gold" 
                          disabled={loading}
                          style={{ minWidth: '220px' }}
                        >
                          {loading ? (
                            <>
                              <span className="btn-spinner" aria-hidden="true" />
                              Salvando...
                            </>
                          ) : 'Salvar e Continuar'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div style={{ background: 'var(--color-surface)', padding: 'var(--spacing-lg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-xl)' }}>
                        <div>
                          <h4 style={{ color: 'var(--color-gold)', marginBottom: '4px' }}>Dados do Cliente</h4>
                          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Logado como {sessionUser.email}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <button 
                            type="button" 
                            className="btn btn-ghost btn-sm" 
                            onClick={() => setIsEditingProfile(true)}
                            style={{ color: 'var(--color-gold)', marginRight: 'var(--spacing-md)' }}
                          >
                            Editar Cadastro
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-ghost btn-sm" 
                            onClick={async () => {
                              await supabase.auth.signOut();
                              setSessionUser(null);
                              window.location.reload();
                            }}
                            style={{ color: 'var(--color-error)' }}
                          >
                            Sair
                          </button>
                        </div>
                      </div>

                      <div className="checkout-grid" style={{ gap: 'var(--spacing-lg)' }}>
                        <div>
                          <span style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Nome Completo</span>
                          <span style={{ fontWeight: 500 }}>{formData.name} {formData.lastName}</span>
                        </div>
                        <div>
                          <span style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>E-mail</span>
                          <span style={{ fontWeight: 500 }}>{formData.email}</span>
                        </div>
                        <div>
                          <span style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>CPF</span>
                          <span style={{ fontWeight: 500 }}>{formData.cpf || 'Não informado'}</span>
                        </div>
                        <div>
                          <span style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>WhatsApp</span>
                          <span style={{ fontWeight: 500 }}>{formData.phone || 'Não informado'}</span>
                        </div>
                      </div>

                      <div style={{ marginTop: 'var(--spacing-2xl)', textAlign: 'right' }}>
                        <button 
                          type="button" 
                          className="btn btn-primary" 
                          onClick={() => setStep(2)}
                          disabled={!formData.cpf || !formData.phone}
                        >
                          {!formData.cpf || !formData.phone ? 'Complete seu perfil para continuar' : 'Confirmar e Continuar'}
                        </button>
                        {(!formData.cpf || !formData.phone) && (
                          <p style={{ color: 'var(--color-error)', fontSize: '12px', marginTop: '8px' }}>
                            CPF e Telefone são obrigatórios para emissão da nota e pagamento.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: ENTREGA */}
          {step === 2 && (
            <div className="checkout-section">
              <h2>2. Opções de Entrega</h2>

              <div style={{ marginBottom: 'var(--spacing-xl)', display: 'flex', gap: 'var(--spacing-md)' }}>
                <button
                  type="button"
                  className={`btn ${deliveryType === 'delivery' ? 'btn-gold' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: 'var(--spacing-md)' }}
                  onClick={() => {
                    setDeliveryType('delivery');
                    if (shippingMethod === 'retirada') setShippingMethod('pac');
                  }}
                >
                  🚚 Receber no meu Endereço
                </button>
                <button
                  type="button"
                  className={`btn ${deliveryType === 'pickup' ? 'btn-gold' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: 'var(--spacing-md)' }}
                  onClick={() => {
                    setDeliveryType('pickup');
                    setShippingMethod('retirada');
                  }}
                >
                  🏪 Retirar na Loja (Grátis)
                </button>
              </div>
              
              {deliveryType === 'pickup' ? (
                <div style={{ 
                  background: 'var(--color-surface)', 
                  padding: 'var(--spacing-lg)', 
                  borderRadius: 'var(--radius-md)', 
                  border: '1px solid var(--color-border)',
                  marginBottom: 'var(--spacing-xl)'
                }}>
                  <h4 style={{ color: 'var(--color-gold)', marginBottom: 'var(--spacing-md)' }}>🏪 Retirada na Loja</h4>
                  <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
                    Você poderá retirar seu pedido diretamente em nossa loja física após a confirmação do pagamento:
                  </p>
                  <div style={{ 
                    marginTop: 'var(--spacing-md)', 
                    padding: 'var(--spacing-md)', 
                    background: 'var(--color-surface-alt)', 
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--text-sm)'
                  }}>
                    <strong>{empresa.nome} - Flagship Boutique</strong><br />
                    {empresa.endereco}{empresa.endereco2 && ` — ${empresa.endereco2}`}<br />
                    {empresa.cidade}<br />
                    {empresa.cep}<br />
                    <strong>Hours:</strong> {empresa.horario}
                  </div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-md)' }}>
                    * Your order will be available for pickup within 1 business day after payment confirmation.
                  </p>
                </div>
              ) : (
                addresses.length > 0 && !useNewAddress ? (
                  <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-lg)' }}>Selecione um endereço salvo ou cadastre um novo:</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--spacing-md)' }}>
                      {addresses.map(addr => (
                        <div 
                          key={addr.id} 
                          onClick={() => {
                            setSelectedAddressId(addr.id);
                            setAddressForm(addr);
                          }}
                          style={{ 
                            background: 'var(--color-surface)', 
                            padding: 'var(--spacing-md)', 
                            borderRadius: 'var(--radius-md)', 
                            border: selectedAddressId === addr.id ? '2px solid var(--color-gold)' : '1px solid var(--color-border)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '250px' }}>
                            <input type="radio" checked={selectedAddressId === addr.id} readOnly />
                            <div>
                              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {addr.label}
                                {addr.is_default && (
                                  <span style={{ 
                                    background: 'var(--color-gold)', 
                                    color: 'black', 
                                    padding: '2px 6px', 
                                    borderRadius: '4px', 
                                    fontSize: '10px', 
                                    fontWeight: 700,
                                    textTransform: 'uppercase'
                                  }}>
                                    Padrão
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                                {addr.street}, {addr.number} {addr.complement} - {addr.neighborhood}, {addr.city}/{addr.state}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
                            {!addr.is_default && (
                              <button 
                                type="button" 
                                className="btn btn-ghost btn-sm" 
                                onClick={() => handleSetDefault(addr.id)}
                                style={{ border: '1px solid var(--color-gold)', color: 'var(--color-gold)', padding: '4px 8px', fontSize: '11px' }}
                                disabled={loading}
                              >
                                Tornar Padrão
                              </button>
                            )}
                            <button 
                              type="button" 
                              className="btn btn-ghost btn-sm" 
                              onClick={() => handleDeleteAddress(addr.id)}
                              style={{ color: 'var(--color-error)', border: '1px solid rgba(255, 71, 87, 0.2)', padding: '4px 8px', fontSize: '11px' }}
                              disabled={loading}
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 'var(--spacing-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {addresses.length < 5 ? (
                        <button 
                          type="button" 
                          className="btn btn-gold btn-sm"
                          onClick={() => {
                            setUseNewAddress(true);
                            setAddressForm({
                              zip_code: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', label: 'Outro'
                            });
                          }}
                        >
                          + Usar novo endereço
                        </button>
                      ) : (
                        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                          Limite de 5 endereços salvos atingido.
                        </span>
                      )}
                      <Link href="/minha-conta" className="btn btn-ghost btn-sm">Gerenciar Endereços</Link>
                    </div>
                  </div>
                ) : (
                  <form id="address-form" onSubmit={e => { e.preventDefault(); setStep(3); }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
                      <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>Preencha os dados de entrega:</p>
                      {addresses.length > 0 && (
                        <button 
                          type="button" 
                          className="btn btn-ghost btn-sm" 
                          onClick={() => {
                            setUseNewAddress(false);
                            const selected = addresses.find(a => a.id === selectedAddressId) || addresses[0];
                            if (selected) {
                              setSelectedAddressId(selected.id);
                              setAddressForm(selected);
                            }
                          }}
                        >
                          Usar endereço salvo
                        </button>
                      )}
                    </div>

                    <div className="checkout-grid">
                      <div>
                        <label className="label">CEP *</label>
                        <input 
                          type="text" className="input" required placeholder="00000-000" 
                          value={addressForm.zip_code}
                          onChange={e => {
                            const val = e.target.value;
                            setAddressForm({...addressForm, zip_code: val});
                          }}
                          onBlur={handleCepBlur}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="label">Endereço *</label>
                        <input type="text" className="input" required value={addressForm.street} onChange={e => setAddressForm({...addressForm, street: e.target.value})} />
                      </div>
                      <div>
                        <label className="label">Número *</label>
                        <input type="text" className="input" required value={addressForm.number} onChange={e => setAddressForm({...addressForm, number: e.target.value})} />
                      </div>
                      <div>
                        <label className="label">Complemento</label>
                        <input type="text" className="input" value={addressForm.complement || ''} onChange={e => setAddressForm({...addressForm, complement: e.target.value})} />
                      </div>
                      <div>
                        <label className="label">Bairro *</label>
                        <input type="text" className="input" required value={addressForm.neighborhood} onChange={e => setAddressForm({...addressForm, neighborhood: e.target.value})} />
                      </div>
                      <div>
                        <label className="label">Cidade *</label>
                        <input type="text" className="input" required value={addressForm.city} onChange={e => setAddressForm({...addressForm, city: e.target.value})} />
                      </div>
                      <div>
                        <label className="label">Estado (UF) *</label>
                        <input type="text" className="input" required maxLength={2} placeholder="UF" value={addressForm.state} onChange={e => setAddressForm({...addressForm, state: e.target.value})} />
                      </div>
                    </div>
                  </form>
                )
              )}

              {deliveryType === 'delivery' && (
                <div style={{ marginTop: 'var(--spacing-xl)', padding: 'var(--spacing-md)', background: 'var(--color-surface-alt)', borderRadius: 'var(--radius-md)' }}>
                  <h4 style={{ marginBottom: 'var(--spacing-md)' }}>Opções de Frete</h4>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="frete" 
                      checked={shippingMethod === 'pac'} 
                      onChange={() => setShippingMethod('pac')} 
                    />
                    <span style={{ flex: 1 }}>PAC Correios (5 a 8 dias úteis)</span>
                    <span style={{ fontWeight: 600 }}>R$ 25,90</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="frete" 
                      checked={shippingMethod === 'sedex'} 
                      onChange={() => setShippingMethod('sedex')} 
                    />
                    <span style={{ flex: 1 }}>Sedex (2 a 4 dias úteis)</span>
                    <span style={{ fontWeight: 600 }}>R$ 48,90</span>
                  </label>
                  {freteMotoboy.disponivel && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="frete" 
                        checked={shippingMethod === 'motoboy'} 
                        onChange={() => setShippingMethod('motoboy')} 
                      />
                      <span style={{ flex: 1 }}>Entrega por motoboy ({freteMotoboy.municipio})</span>
                      <span style={{ fontWeight: 600 }}>R$ {freteMotoboy.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </label>
                  )}
                </div>
              )}

              <div style={{ marginTop: 'var(--spacing-xl)', display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>Voltar</button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={async () => {
                    if (deliveryType === 'pickup') {
                      setStep(3);
                      return;
                    }
                    // Se estiver criando novo endereço no checkout, salva no banco antes de prosseguir
                    if ((addresses.length === 0 || useNewAddress) && addressForm.zip_code) {
                      if (addresses.length >= 5) {
                        alert('Você já atingiu o limite de 5 endereços salvos. Por favor, remova um endereço antes de cadastrar outro.');
                        return;
                      }
                      setLoading(true);
                      const isDefault = addresses.length === 0;
                      try {
                        const res = await fetch('/api/addresses', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            zip_code: addressForm.zip_code,
                            street: addressForm.street,
                            number: addressForm.number,
                            complement: addressForm.complement || '',
                            neighborhood: addressForm.neighborhood,
                            city: addressForm.city,
                            state: addressForm.state,
                            label: addressForm.label || 'Outro',
                            is_default: isDefault
                          })
                        });
                        const resData = await res.json();
                        if (resData && !resData.error && resData.length > 0) {
                          setAddresses(prev => [...prev, resData[0]]);
                          setSelectedAddressId(resData[0].id);
                          setUseNewAddress(false);
                        } else {
                          alert('Erro ao cadastrar endereço: ' + (resData.error || 'Erro desconhecido'));
                          setLoading(false);
                          return;
                        }
                      } catch (err: any) {
                        alert('Erro ao cadastrar endereço: ' + err.message);
                        setLoading(false);
                        return;
                      }
                      setLoading(false);
                    }
                    setStep(3);
                  }}
                  disabled={deliveryType === 'delivery' && (!addressForm.zip_code || !addressForm.street || !addressForm.number || !addressForm.city || !addressForm.state)}
                >
                  {loading ? (
                    <>
                      <span className="btn-spinner" aria-hidden="true" />
                      Salvando Endereço...
                    </>
                  ) : 'Continuar para Pagamento'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PAGAMENTO */}
          {step === 3 && (
            <div className="checkout-section">
              <h2>3. Pagamento</h2>
              <div className="payment-methods">
                <div className={`payment-method ${paymentMethod === 'pix' ? 'active' : ''}`} onClick={() => setPaymentMethod('pix')}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M11.964.045l-5.694 5.694-3.64-3.64L0 4.727l6.27 6.27 5.694-5.694 5.694 5.694 6.27-6.27-2.628-2.628-3.642 3.642L11.964.045zM2.628 2.628L0 5.256l11.964 11.964 11.964-11.964-2.628-2.628-9.336 9.336L2.628 2.628zm9.336 12.008l-5.694-5.694-6.27 6.27 2.628 2.628 3.64-3.64L11.964 23.95l5.694-5.694 3.642 3.642 2.628-2.628-6.27-6.27-5.694 5.694z"/></svg>
                  <div>PIX<br/><small style={{color:'var(--color-success)'}}>{percForma > 0 ? `-${percForma}% OFF` : 'À vista'}</small></div>
                </div>
                <div className={`payment-method ${paymentMethod === 'credit' ? 'active' : ''}`} onClick={() => setPaymentMethod('credit')}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  <div>Cartão de Crédito<br/><small>Até 12x</small></div>
                </div>
                <div className={`payment-method ${paymentMethod === 'boleto' ? 'active' : ''}`} onClick={() => setPaymentMethod('boleto')}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v16H4zM4 8h16M4 12h16M4 16h16M8 4v16M12 4v16M16 4v16"/></svg>
                  <div>Boleto<br/><small>À vista</small></div>
                </div>
              </div>

              {paymentMethod === 'pix' && (
                <div className="pix-qr">
                  <h4>Pagamento via PIX</h4>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-md)' }}>Ao finalizar, você receberá um QR Code válido por 15 minutos.</p>
                  <div style={{ background: 'white', padding: '16px', display: 'inline-block', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                    <div style={{ width: 150, height: 150, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>[QR CODE]</div>
                  </div>
                </div>
              )}

              {paymentMethod === 'credit' && (
                <div className="checkout-grid" style={{ marginTop: 'var(--spacing-lg)' }}>
                  <div className="col-span-2">
                    <label className="label">Número do Cartão</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="0000 0000 0000 0000"
                      required
                      value={cardData.number}
                      onChange={e => setCardData(p => ({ ...p, number: e.target.value.replace(/[^\d ]/g, '').slice(0, 19) }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Nome Impresso no Cartão</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Nome como está no cartão"
                      required
                      value={cardData.name}
                      onChange={e => setCardData(p => ({ ...p, name: e.target.value.slice(0, 60) }))}
                    />
                  </div>
                  <div>
                    <label className="label">Validade</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="MM/AA"
                      required
                      pattern="\d{2}/\d{2}"
                      title="Formato MM/AA"
                      value={cardData.expiry}
                      onChange={e => {
                        const d = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setCardData(p => ({ ...p, expiry: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }));
                      }}
                    />
                  </div>
                  <div>
                    <label className="label">CVV</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="123"
                      required
                      pattern="\d{3,4}"
                      title="3 ou 4 dígitos"
                      value={cardData.cvv}
                      onChange={e => setCardData(p => ({ ...p, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Parcelas</label>
                    <select
                      className="input"
                      value={cardData.installments}
                      onChange={e => setCardData(p => ({ ...p, installments: e.target.value }))}
                    >
                      {[1, 2, 3, 4, 5, 6].map(n => (
                        <option key={n} value={n}>
                          {n}x de R$ {(totalWithShipping / n).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} sem juros
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2" style={{ marginTop: 'var(--spacing-md)', paddingTop: 'var(--spacing-md)', borderTop: '1px solid var(--color-border-light)' }}>
                    <label className="label">Endereço do Titular do Cartão</label>
                    {deliveryType === 'delivery' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                          <input type="radio" name="cardAddressUse" checked={cardAddressUse === 'entrega'} onChange={() => setCardAddressUse('entrega')} />
                          Usar o mesmo endereço de entrega
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                          <input type="radio" name="cardAddressUse" checked={cardAddressUse === 'novo'} onChange={() => setCardAddressUse('novo')} />
                          Informar endereço do cartão
                        </label>
                      </div>
                    ) : null}

                    {(cardAddressUse === 'novo' || deliveryType === 'pickup') ? (
                      <div className="checkout-grid" style={{ gap: 'var(--spacing-md)' }}>
                        <div>
                          <label className="label">CEP *</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="00000-000"
                            value={cardAddressForm.zip_code}
                            onChange={e => setCardAddressForm(p => ({ ...p, zip_code: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                            onBlur={() => {
                              const cleanCep = (cardAddressForm.zip_code || '').replace(/\D/g, '');
                              if (cleanCep.length === 8) {
                                fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
                                  .then(r => r.json())
                                  .then(d => {
                                    if (!d.erro) {
                                      setCardAddressForm(prev => ({
                                        ...prev,
                                        street: prev.street || d.logradouro || '',
                                        neighborhood: prev.neighborhood || d.bairro || '',
                                        city: prev.city || d.localidade || '',
                                        state: prev.state || d.uf || '',
                                      }));
                                    }
                                  })
                                  .catch(() => {});
                              }
                            }}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="label">Endereço *</label>
                          <input type="text" className="input" placeholder="Rua, avenida..." value={cardAddressForm.street} onChange={e => setCardAddressForm(p => ({ ...p, street: e.target.value }))} />
                        </div>
                        <div>
                          <label className="label">Número *</label>
                          <input type="text" className="input" placeholder="Número" value={cardAddressForm.number} onChange={e => setCardAddressForm(p => ({ ...p, number: e.target.value }))} />
                        </div>
                        <div>
                          <label className="label">Complemento</label>
                          <input type="text" className="input" placeholder="Apto, bloco..." value={cardAddressForm.complement || ''} onChange={e => setCardAddressForm(p => ({ ...p, complement: e.target.value }))} />
                        </div>
                        <div>
                          <label className="label">Bairro</label>
                          <input type="text" className="input" placeholder="Bairro" value={cardAddressForm.neighborhood || ''} onChange={e => setCardAddressForm(p => ({ ...p, neighborhood: e.target.value }))} />
                        </div>
                        <div>
                          <label className="label">Cidade *</label>
                          <input type="text" className="input" placeholder="Cidade" value={cardAddressForm.city || ''} onChange={e => setCardAddressForm(p => ({ ...p, city: e.target.value }))} />
                        </div>
                        <div>
                          <label className="label">Estado (UF) *</label>
                          <input type="text" className="input" maxLength={2} placeholder="UF" value={cardAddressForm.state || ''} onChange={e => setCardAddressForm(p => ({ ...p, state: e.target.value.toUpperCase() }))} />
                        </div>
                      </div>
                    ) : (
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>
                        O endereço de entrega será usado como endereço do titular do cartão.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {errorMsg && <p style={{ color: 'var(--color-error)', marginTop: 'var(--spacing-md)' }}>{errorMsg}</p>}

              <div style={{ marginTop: 'var(--spacing-xl)', display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>Voltar</button>
                <button type="button" className="btn btn-gold btn-lg" onClick={handleCheckout} disabled={loading}>
                  {loading ? (
                    <>
                      <span className="btn-spinner" aria-hidden="true" />
                      PROCESSANDO...
                    </>
                  ) : 'FINALIZAR PEDIDO'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: SUCESSO (ASaaS Result) */}
          {step === 4 && paymentResult && (
            <div className="checkout-section" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', color: 'var(--color-success)', marginBottom: 'var(--spacing-md)' }}>✓</div>
              <h2>Pedido Gerado com Sucesso!</h2>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xl)' }}>ID: {paymentResult.id}</p>

              {paymentMethod === 'pix' && paymentResult.pixQrCodePayload && (
                <div style={{ background: 'var(--color-surface)', padding: 'var(--spacing-xl)', borderRadius: 'var(--radius-md)', display: 'inline-block', border: '1px solid rgba(255,255,255,0.05)', color: 'var(--color-text)', maxWidth: '400px', width: '100%' }}>
                  <h4 style={{ marginBottom: 'var(--spacing-md)', fontSize: '18px', fontWeight: 600 }}>Escaneie o QR Code</h4>
                  
                  {paymentResult.pixQrCodeUrl && (
                    <div style={{ background: 'white', padding: '16px', borderRadius: 'var(--radius-md)', display: 'inline-block', margin: '0 auto var(--spacing-md) auto' }}>
                      <img src={`data:image/png;base64,${paymentResult.pixQrCodeUrl}`} alt="PIX QR Code" style={{ width: 200, height: 200, display: 'block' }} />
                    </div>
                  )}
                  
                  <div style={{ margin: 'var(--spacing-md) auto', textAlign: 'left' }}>
                     <label style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>Código PIX Copia e Cola</label>
                     <p style={{ 
                       wordBreak: 'break-all', 
                       fontSize: '11px', 
                       color: 'var(--color-text-secondary)', 
                       background: 'rgba(0,0,0,0.2)', 
                       padding: '10px 12px', 
                       borderRadius: 'var(--radius-sm)', 
                       border: '1px dashed rgba(255,255,255,0.1)',
                       marginTop: '4px',
                       fontFamily: 'monospace'
                     }}>
                       {paymentResult.pixQrCodePayload}
                     </p>
                  </div>
                  
                  {paymentResult.invoiceUrl && (
                    <p style={{ margin: 'var(--spacing-md) 0 4px 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>Ou se preferir, acesse a fatura oficial:</p>
                  )}
                  {paymentResult.invoiceUrl && (
                    <a href={paymentResult.invoiceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--color-gold)', fontWeight: 600, textDecoration: 'underline', fontSize: '13px' }}>
                      Visualizar Fatura no Provedor
                    </a>
                  )}
                </div>
              )}

              {paymentMethod === 'boleto' && (paymentResult.boletoUrl || paymentResult.boletoLinhaDigitavel) && (
                <div style={{ background: 'var(--color-surface)', padding: 'var(--spacing-xl)', borderRadius: 'var(--radius-md)', display: 'inline-block', border: '1px solid rgba(255,255,255,0.05)', color: 'var(--color-text)', maxWidth: '400px', width: '100%' }}>
                  <h4 style={{ marginBottom: 'var(--spacing-md)', fontSize: '18px', fontWeight: 600 }}>Boleto Gerado</h4>
                  {paymentResult.boletoLinhaDigitavel && (
                    <div style={{ marginBottom: 'var(--spacing-md)', textAlign: 'left' }}>
                      <label style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>Linha Digitável</label>
                      <p style={{ wordBreak: 'break-all', fontSize: '12px', color: 'var(--color-text-secondary)', background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px dashed rgba(255,255,255,0.1)', marginTop: '4px', fontFamily: 'monospace' }}>
                        {paymentResult.boletoLinhaDigitavel}
                      </p>
                    </div>
                  )}
                  {paymentResult.boletoUrl && (
                    <a href={paymentResult.boletoUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--color-gold)', fontWeight: 600, textDecoration: 'underline', fontSize: '13px' }}>
                      Visualizar / Baixar Boleto
                    </a>
                  )}
                </div>
              )}

              {paymentMethod !== 'pix' && paymentMethod !== 'boleto' && paymentResult.invoiceUrl && (
                <div style={{ background: 'var(--color-surface)', padding: 'var(--spacing-xl)', borderRadius: 'var(--radius-md)', display: 'inline-block' }}>
                  <p>Acesse o link abaixo para visualizar a fatura/boleto:</p>
                  <a href={paymentResult.invoiceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>{paymentResult.invoiceUrl}</a>
                </div>
              )}

              <div style={{ marginTop: 'var(--spacing-2xl)' }}>
                <Link href="/" className="btn btn-ghost">Voltar para a Home</Link>
              </div>
            </div>
          )}

        </div>

        {/* Sidebar Summary */}
        <div className="checkout-sidebar">
          <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>Resumo do Pedido</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
            {items.map(item => (
              <div key={`${item.id}-${item.length || ''}`} style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                <div style={{ width: 50, height: 50, borderRadius: 4, overflow: 'hidden', background: '#eee', flexShrink: 0 }}>
                  <Image src={item.image} alt={item.name} width={50} height={50} style={{ objectFit: 'cover' }} />
                </div>
                <div style={{ flex: 1, fontSize: 'var(--text-sm)' }}>
                  <div style={{ fontWeight: 500 }}>{item.name}</div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>{item.origin}</div>
                </div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                  {item.quantity}x
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', fontSize: 'var(--text-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal</span>
              <span>R$ {subtotal.toLocaleString('pt-BR')}</span>
            </div>
            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-success)' }}>
                <span>Desconto ({discount}%)</span>
                <span>- R$ {discountVal.toLocaleString('pt-BR')}</span>
              </div>
            )}
            {descontoForma > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-success)' }}>
                <span>Desconto {formaPixAtiva === 'pix' ? 'PIX' : formaPixAtiva === 'credit' ? 'Crédito' : 'Boleto'} ({percForma}%)</span>
                <span>- R$ {descontoForma.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Frete ({shippingLabel})</span>
              <span>{shippingFee === 0 && shippingMethod !== 'motoboy' ? 'Grátis' : `R$ ${shippingFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</span>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--color-border-light)', marginTop: 'var(--spacing-md)', paddingTop: 'var(--spacing-md)', display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-lg)', fontWeight: 700 }}>
            <span>Total</span>
            <span>R$ {totalWithShipping.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>

        </div>
      </div>
    </div>
  );
}
