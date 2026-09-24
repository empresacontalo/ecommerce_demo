'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/auth/client';
import { updateProfileMetadata } from '@/utils/profile/profile';
import { useRouter } from 'next/navigation';
import { validarCpf, formatarCpf } from '@/utils/cpf';

export default function MinhaContaPage() {
  const router = useRouter();
  const client = createClient();
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'perfil' | 'enderecos'>('perfil');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Profile State
  const [profileData, setProfileData] = useState({ name: '', lastName: '', email: '', cpf: '', phone: '' });
  const [cpfCadastrado, setCpfCadastrado] = useState(false);

  // Address State
  const [addresses, setAddresses] = useState<any[]>([]);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({
    zip_code: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', label: 'Casa', is_default: false
  });

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await client.auth.getUser();
      if (!user) {
        router.push('/auth/login?next=/minha-conta');
        return;
      }
      setSessionUser(user);

      // Fetch full profile from /api/auth/me
      try {
        const profileRes = await fetch('/api/auth/me');
        const profileData = await profileRes.json();
        if (profileData.user) {
          const fullName = profileData.user.full_name || '';
          const nameParts = fullName.split(' ');
          const cpfExistente = profileData.user.cpf || '';
          setCpfCadastrado(!!cpfExistente);
          setProfileData({
            name: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            email: profileData.user.email || '',
            cpf: cpfExistente ? formatarCpf(cpfExistente) : '',
            phone: profileData.user.phone || ''
          });
        }
      } catch (err) {
        console.error('Erro ao buscar perfil:', err);
      }

      // Fetch addresses
      try {
        const res = await fetch('/api/addresses');
        const addrData = await res.json();
        if (addrData && !addrData.error) {
          setAddresses(addrData);
        }
      } catch (err) {
        console.error('Erro ao buscar endereços:', err);
      }
      setLoading(false);
    };

    fetchUser();
  }, [client, router]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUser?.id) return;
    // CPF editável apenas se ainda não foi cadastrado; valida antes de salvar
    if (!cpfCadastrado) {
      if (!profileData.cpf.trim()) {
        setMessage({ type: 'error', text: 'Informe seu CPF.' });
        return;
      }
      if (!validarCpf(profileData.cpf)) {
        setMessage({ type: 'error', text: 'CPF inválido. Verifique os números digitados.' });
        return;
      }
    }
    setLoading(true);
    const result = await updateProfileMetadata(sessionUser.id, {
      name: profileData.name,
      lastName: profileData.lastName,
      phone: profileData.phone,
      cpf: profileData.cpf
    });

    if (result.error) {
      setMessage({ type: 'error', text: result.error });
    } else {
      setMessage({ type: 'success', text: 'Dados atualizados com sucesso!' });
    }
    setLoading(false);
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addresses.length >= 5) {
      setMessage({ type: 'error', text: 'Limite de 5 endereços atingido.' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newAddress,
          is_default: addresses.length === 0 ? true : newAddress.is_default
        })
      });
      const data = await res.json();
      if (data.error) {
        setMessage({ type: 'error', text: data.error });
      } else if (data && data.length > 0) {
        setAddresses([...addresses, data[0]]);
        setIsAddingAddress(false);
        setNewAddress({ zip_code: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', label: 'Casa', is_default: false });
        setMessage({ type: 'success', text: 'Endereço adicionado!' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading(false);
  };

  const handleDeleteAddress = async (id: string) => {
    if (addresses.length <= 1) {
      setMessage({ type: 'error', text: 'Você deve ter pelo menos 1 endereço cadastrado.' });
      return;
    }

    if (!confirm('Tem certeza que deseja excluir este endereço?')) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/addresses?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) {
        setMessage({ type: 'error', text: data.error });
      } else {
        setAddresses(addresses.filter(a => a.id !== id));
        setMessage({ type: 'success', text: 'Endereço removido.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading(false);
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
        setMessage({ type: 'error', text: data.error });
      } else {
        setAddresses(addresses.map(a => ({ ...a, is_default: a.id === id })));
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
    setLoading(false);
  };

  const fetchCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setNewAddress(prev => ({
            ...prev,
            street: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf,
            zip_code: cep
          }));
        }
      } catch (e) { console.error('Erro ao buscar CEP'); }
    }
  };

  if (loading && !sessionUser) return <div className="loading-screen">Carregando sua conta...</div>;

  return (
    <div style={{ background: 'var(--color-surface-alt)', minHeight: '100vh', paddingTop: 'var(--spacing-3xl)', paddingBottom: 'var(--spacing-3xl)' }}>
      <div className="container" style={{ maxWidth: '900px' }}>
        
        <header style={{ marginBottom: 'var(--spacing-2xl)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ textAlign: 'left' }}>
            <h1 style={{ color: 'var(--color-gold)', fontSize: '2.5rem', marginBottom: 'var(--spacing-xs)' }}>Minha Conta</h1>
            <p style={{ color: 'var(--color-text-secondary)' }}>Gerencie seus dados e endereços</p>
          </div>
          <button 
            className="btn btn-ghost btn-sm" 
            style={{ color: 'var(--color-error)', border: '1px solid var(--color-error)' }}
            onClick={async () => {
              await client.auth.signOut();
              router.push('/');
              router.refresh();
            }}
          >
            Sair da Conta
          </button>
        </header>

        {message.text && (
          <div style={{ 
            padding: 'var(--spacing-md)', 
            borderRadius: 'var(--radius-md)', 
            marginBottom: 'var(--spacing-xl)',
            background: message.type === 'success' ? 'rgba(46, 213, 115, 0.1)' : 'rgba(255, 71, 87, 0.1)',
            color: message.type === 'success' ? '#2ed573' : '#ff4757',
            border: `1px solid ${message.type === 'success' ? '#2ed573' : '#ff4757'}`,
            textAlign: 'center'
          }}>
            {message.text}
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xl)', borderBottom: '1px solid var(--color-border)', paddingBottom: '1px' }}>
          <button 
            className={`btn ${activeTab === 'perfil' ? 'btn-gold' : 'btn-ghost'}`} 
            onClick={() => setActiveTab('perfil')}
            style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }}
          >
            Dados Pessoais
          </button>
          <button 
            className={`btn ${activeTab === 'enderecos' ? 'btn-gold' : 'btn-ghost'}`} 
            onClick={() => setActiveTab('enderecos')}
            style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }}
          >
            Endereços
          </button>
        </div>

        {activeTab === 'perfil' && (
          <div className="checkout-section">
            <h3 style={{ marginBottom: 'var(--spacing-xl)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--spacing-sm)' }}>Seu Perfil</h3>
            <form onSubmit={handleUpdateProfile}>
              <div className="checkout-grid">
                <div>
                  <label className="label">Nome</label>
                  <input type="text" className="input" required value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} />
                </div>
                <div>
                  <label className="label">Sobrenome</label>
                  <input type="text" className="input" required value={profileData.lastName} onChange={e => setProfileData({...profileData, lastName: e.target.value})} />
                </div>
                <div>
                  <label className="label">{cpfCadastrado ? 'CPF (não editável após cadastro)' : 'CPF (será fixado após salvar)'}</label>
                  {cpfCadastrado ? (
                    <input type="text" className="input" value={profileData.cpf} disabled style={{ opacity: 0.6 }} />
                  ) : (
                    <input
                      type="text"
                      className="input"
                      required
                      placeholder="000.000.000-00"
                      value={profileData.cpf}
                      onChange={e => setProfileData({ ...profileData, cpf: formatarCpf(e.target.value) })}
                    />
                  )}
                </div>
                <div>
                  <label className="label">WhatsApp</label>
                  <input type="text" className="input" required value={profileData.phone} onChange={e => setProfileData({...profileData, phone: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="label">E-mail</label>
                  <input type="email" className="input" value={profileData.email} disabled style={{ opacity: 0.6 }} />
                </div>
              </div>
              <div style={{ marginTop: 'var(--spacing-xl)', textAlign: 'right' }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'enderecos' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-xl)' }}>
              <h3>Seus Endereços ({addresses.length}/5)</h3>
              {!isAddingAddress && addresses.length < 5 && (
                <button className="btn btn-gold btn-sm" onClick={() => setIsAddingAddress(true)}>+ Adicionar Endereço</button>
              )}
            </div>

            {isAddingAddress && (
              <div className="checkout-section" style={{ marginBottom: 'var(--spacing-xl)', border: '1px solid var(--color-gold)' }}>
                <h4>Novo Endereço</h4>
                <form onSubmit={handleAddAddress}>
                  <div className="checkout-grid">
                    <div>
                      <label className="label">Apelido (Ex: Casa, Trabalho)</label>
                      <input type="text" className="input" required value={newAddress.label} onChange={e => setNewAddress({...newAddress, label: e.target.value})} />
                    </div>
                    <div>
                      <label className="label">CEP</label>
                      <input 
                        type="text" className="input" required 
                        value={newAddress.zip_code} 
                        onChange={e => {
                          setNewAddress({...newAddress, zip_code: e.target.value});
                          fetchCep(e.target.value);
                        }} 
                        onBlur={() => fetchCep(newAddress.zip_code)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="label">Endereço</label>
                      <input type="text" className="input" required value={newAddress.street} onChange={e => setNewAddress({...newAddress, street: e.target.value})} />
                    </div>
                    <div>
                      <label className="label">Número</label>
                      <input type="text" className="input" required value={newAddress.number} onChange={e => setNewAddress({...newAddress, number: e.target.value})} />
                    </div>
                    <div>
                      <label className="label">Complemento</label>
                      <input type="text" className="input" value={newAddress.complement || ''} onChange={e => setNewAddress({...newAddress, complement: e.target.value})} />
                    </div>
                    <div>
                      <label className="label">Bairro</label>
                      <input type="text" className="input" required value={newAddress.neighborhood} onChange={e => setNewAddress({...newAddress, neighborhood: e.target.value})} />
                    </div>
                    <div>
                      <label className="label">Cidade</label>
                      <input type="text" className="input" required value={newAddress.city} readOnly />
                    </div>
                  </div>
                  <div style={{ marginTop: 'var(--spacing-xl)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={newAddress.is_default} onChange={e => setNewAddress({...newAddress, is_default: e.target.checked})} />
                      Definir como principal
                    </label>
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                      <button type="button" className="btn btn-ghost" onClick={() => setIsAddingAddress(false)}>Cancelar</button>
                      <button type="submit" className="btn btn-primary" disabled={loading}>Adicionar</button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--spacing-lg)' }}>
              {addresses.map(addr => (
                <div key={addr.id} style={{ 
                  background: 'var(--color-surface)', 
                  padding: 'var(--spacing-lg)', 
                  borderRadius: 'var(--radius-md)', 
                  border: addr.is_default ? '1px solid var(--color-gold)' : '1px solid var(--color-border)',
                  position: 'relative'
                }}>
                  {addr.is_default && <span style={{ position: 'absolute', top: '-10px', right: '15px', background: 'var(--color-gold)', color: 'black', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>PRINCIPAL</span>}
                  <h4 style={{ marginBottom: 'var(--spacing-sm)' }}>{addr.label}</h4>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                    {addr.street}, {addr.number} {addr.complement && `- ${addr.complement}`}<br/>
                    {addr.neighborhood} - {addr.city}/{addr.state}<br/>
                    CEP: {addr.zip_code}
                  </p>
                  <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', gap: 'var(--spacing-sm)' }}>
                    {!addr.is_default && (
                      <button className="btn btn-ghost btn-sm" onClick={() => handleSetDefault(addr.id)}>Tornar Principal</button>
                    )}
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error)' }} onClick={() => handleDeleteAddress(addr.id)}>Excluir</button>
                  </div>
                </div>
              ))}
            </div>

            {addresses.length === 0 && !isAddingAddress && (
              <div style={{ textAlign: 'center', padding: 'var(--spacing-3xl)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)' }}>
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-lg)' }}>Você ainda não tem nenhum endereço cadastrado.</p>
                <button className="btn btn-gold" onClick={() => setIsAddingAddress(true)}>Cadastrar meu primeiro endereço</button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
