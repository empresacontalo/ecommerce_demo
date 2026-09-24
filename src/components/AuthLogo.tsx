'use client';

import { useEffect, useState } from 'react';
import { getConfig } from '@/utils/empresa';
import { EMPRESA_NOME_PADRAO } from '@/utils/empresa-default';

/** Logo das páginas de autenticação com o nome da empresa das Configurações */
export default function AuthLogo() {
  const [nome, setNome] = useState(EMPRESA_NOME_PADRAO);

  useEffect(() => {
    (async () => {
      const logo = await getConfig('header.logo');
      if (logo?.texto) setNome(logo.texto);
    })();
  }, []);

  const parts = nome.split(' ');
  return (
    <div className="auth-logo">
      {parts[0]} {parts.length > 1 && <span>{parts.slice(1).join(' ')}</span>}
    </div>
  );
}
