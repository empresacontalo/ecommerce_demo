'use client';

import { useState } from 'react';
import Link from 'next/link';
import CmsBlockRenderer from '@/components/CmsBlockRenderer';
import CtaButton from '@/components/CtaButton';
import type { CmsBloco } from '@/app/actions/cms';

export default function CmsPage({ blocos, slug }: { blocos: CmsBloco[]; slug: string }) {
  if (!blocos.length) {
    if (slug === 'home') return <HomeFallback />;
    return <div style={{ padding:'4rem', textAlign:'center', color:'var(--color-text-tertiary)' }}>Página em construção.</div>;
  }
  return (
    <>
      <CmsBlockRenderer blocos={blocos} />
    </>
  );
}

function HomeFallback() {
  const H = [{ img:'/images/hero-perfumes.jpg', badge:'✨ Authentic Luxury Perfumery', t:'Aura of Distinction, Unforgettable Sillage', s:'Exclusive imported formulations with legendary oil concentration.', l1:'Shop Catalog', h1:'/catalogo', l2:'Scent Concierge', h2:'chat:atendimento' },{ img:'/images/hero-loja.jpg', badge:'💎 Haute Parfumerie', t:'Fragrances That Define Presence', s:'Lattafa, French Avenue, Al Wataniah, Orientica, and more.', l1:'Explore Portfolio', h1:'/catalogo', l2:'Scent Concierge', h2:'chat:atendimento' },{ img:'/images/hero-1.jpg', badge:'🛍️ Direct Boutique Delivery', t:'Express Doorstep Dispatch', s:'Complimentary signature packaging on all premium orders.', l1:'Shop Catalog', h1:'/catalogo', l2:'Scent Concierge', h2:'chat:atendimento' }];
  const D = [{ i:'💎', t:'100% Authentic Imports', d:'Directly sourced from verified global perfume houses.' },{ i:'🌍', t:'Niche Portfolio', d:'Lattafa, French Avenue, Orientica, Al Wataniah and beyond.' },{ i:'🚚', t:'Express Worldwide Dispatch', d:'Fast, insured shipping directly to your doorstep.' },{ i:'💬', t:'Personalized Fragrance Advisory', d:'Bespoke guidance to help discover your signature scent.' }];
  const [c, setC] = useState(0);
  return (
    <>
      <section className="hero" style={{ backgroundImage:`url(${H[c].img})` }}><div className="hero-overlay" /><div className="container hero-content"><span className="badge badge-gold">{H[c].badge}</span><h1>{H[c].t}</h1><p className="subtitle">{H[c].s}</p><div style={{ display:'flex', gap:'var(--spacing-md)', flexWrap:'wrap', marginTop:'var(--spacing-xl)' }}><Link href={H[c].h1} className="btn btn-gold btn-lg">{H[c].l1}</Link><CtaButton href={H[c].h2} className="btn btn-secondary btn-lg">{H[c].l2}</CtaButton></div><div style={{ marginTop:'2rem', display:'flex', justifyContent:'center', gap:'0.5rem' }}>{H.map((_,i) => <button key={i} onClick={() => setC(i)} style={{ width:12, height:12, borderRadius:'50%', border:'2px solid #b8860b', background:i===c?'#b8860b':'transparent', cursor:'pointer' }} />)}</div></div></section>
      <section className="section section-alt"><div className="container"><div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(250px,1fr))', gap:'var(--spacing-lg)' }}>{D.map((x,i) => <div key={i} style={{ textAlign:'center' }}><div style={{ fontSize:'2.5rem' }}>{x.i}</div><h3>{x.t}</h3><p className="subtitle">{x.d}</p></div>)}</div></div></section>
    </>
  );
}
