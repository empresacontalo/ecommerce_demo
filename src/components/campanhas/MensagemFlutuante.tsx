'use client';

import { useEffect, useState } from 'react';
import { getConfig } from '@/utils/empresa';
import { FLUTUANTE_DEFAULTS, normalizarConfigFlutuante, type FlutuanteConfig } from '@/utils/flutuante-config';

// Mensagem flutuante animada junto aos ícones de comunicação:
// balão discreto com animação e seta piscante apontando para os canais.
// Configurável em Admin > Configurações > Convite ao chat e redes (chave CMS "flutuante"):
// ativo, texto, icone, duracao_s (0 = ilimitado) e atraso_ms.
export default function MensagemFlutuante() {
  const [visivel, setVisivel] = useState(false);
  const [cfg, setCfg] = useState<FlutuanteConfig>({ ...FLUTUANTE_DEFAULTS });

  // Carrega a configuração do CMS; sem salvar nada, mantém defaults.
  useEffect(() => {
    (async () => {
      try {
        const valor = await getConfig('flutuante');
        if (valor) setCfg(normalizarConfigFlutuante(valor));
      } catch { /* mantém defaults */ }
    })();
  }, []);

  // Atraso até aparecer (ignorado quando desativado).
  useEffect(() => {
    if (!cfg.ativo) {
      setVisivel(false);
      return;
    }
    const timer = setTimeout(() => setVisivel(true), cfg.atraso_ms);
    return () => clearTimeout(timer);
  }, [cfg.ativo, cfg.atraso_ms]);

  // Duracao de exibição: duracao_s > 0 fecha após o tempo; 0 = permanece visível.
  useEffect(() => {
    if (!visivel || cfg.duracao_s <= 0) return;
    const timer = setTimeout(() => setVisivel(false), cfg.duracao_s * 1000);
    return () => clearTimeout(timer);
  }, [visivel, cfg.duracao_s]);

  if (!cfg.ativo || !visivel) return null;

  return (
    <div className="campanha-flutuante" role="complementary" aria-label="Mensagem promocional">
      <span className="campanha-flutuante-seta" aria-hidden="true">{cfg.icone}</span>
      <span className="campanha-flutuante-texto">{cfg.texto}</span>
    </div>
  );
}