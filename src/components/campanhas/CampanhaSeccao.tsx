'use client';

import { useState } from 'react';
import BlocoPromocional from '@/components/campanhas/BlocoPromocional';
import CtaDesconto from '@/components/campanhas/CtaDesconto';
import Decorativos from '@/components/campanhas/Decorativos';
import { useCampanhaAtiva } from '@/components/campanhas/campanha-context';

interface Props {
  titulo?: string;
}

// Seção promocional da campanha: bloco promocional + CTA de desconto.
// O carrossel é integrado ao carrossel principal da página pelo
// CmsBlockRenderer (blocos 'carrossel' e 'campanha'), não renderizado aqui.
export default function CampanhaSeccao({ titulo }: Props) {
  const { campanha, decoracoes } = useCampanhaAtiva();
  const [leadId, setLeadId] = useState<string | null>(null);

  if (!campanha) return null;

  return (
    <section className="campanha-secao" id="campanha-promocional">
      <Decorativos decoracoes={decoracoes} />
      {leadId ? (
        <div className="container">
          <CtaDesconto leadId={leadId} campanhaTitulo={campanha.titulo} mensagem={campanha.descricao || undefined} />
        </div>
      ) : (
        <BlocoPromocional
          campanhaId={campanha.id}
          campanhaTitulo={campanha.titulo}
          mensagem={campanha.descricao || undefined}
          formTitulo={titulo || campanha.titulo}
          onCapturado={setLeadId}
        />
      )}    </section>
  );
}
