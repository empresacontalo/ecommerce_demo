'use client';

export interface Decoracao {
  id: string;
  tipo: string;
}

const TIPOS: Record<string, { icone: string; label: string }> = {
  grinalda: { icone: '🌿', label: 'Grinalda' },
  baloes: { icone: '🎈', label: 'Balões' },
  rosas: { icone: '🌹', label: 'Rosas' },
  coracoes: { icone: '❤️', label: 'Corações' },
  cupido: { icone: '🏹', label: 'Cupido' },
  tema_maes: { icone: '🌸', label: 'Dia das Mães' },
  tema_pais: { icone: '👔', label: 'Dia dos Pais' },
  tema_black_friday: { icone: '🛍️', label: 'Black Friday' },
  tema_natal: { icone: '🎄', label: 'Natal' },
  outro: { icone: '✨', label: 'Outro' },
};

// Elementos decorativos configuráveis por campanha (tabela campanha_decoracoes).
// Novos temas = nova linha no banco, sem alterar código.
export default function Decorativos({ decoracoes }: { decoracoes?: Decoracao[] }) {
  if (!decoracoes?.length) return null;

  return (
    <div className="campanha-decorativos" aria-hidden="true">
      {decoracoes.map((d) => {
        const info = TIPOS[d.tipo] || TIPOS.outro;
        return (
          <span key={d.id} className="campanha-decorativo" title={info.label}>
            {info.icone}
          </span>
        );
      })}
    </div>
  );
}
