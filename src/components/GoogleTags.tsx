import { montarBlocosHead, montarBlocosBody, type GoogleTag } from '@/lib/google-tags';

/**
 * Snippets de Tráfego Pago renderizados no servidor entre <head></head>.
 * A seleção de quais tags entram é feita no layout raiz, por página.
 */
export function GoogleTagsHead({ tags }: { tags: GoogleTag[] }) {
  const blocos = montarBlocosHead(tags);
  if (blocos.length === 0) return null;

  return (
    <>
      {blocos.map(bloco => {
        if (bloco.tipo === 'script-src') {
          return <script key={bloco.id} async src={bloco.src} />;
        }
        if (bloco.tipo === 'script-inline') {
          return <script key={bloco.id} dangerouslySetInnerHTML={{ __html: bloco.html }} />;
        }
        return null;
      })}
    </>
  );
}

/** Fallback do Google Tag Manager (<noscript>) logo após a abertura do <body>. */
export function GoogleTagsBody({ tags }: { tags: GoogleTag[] }) {
  const blocos = montarBlocosBody(tags);
  if (blocos.length === 0) return null;

  return (
    <>
      {blocos.map(bloco => (
        <noscript key={bloco.id}>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${bloco.gtmId}`}
            height="0"
            width="0"
            title="Google Tag Manager"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
      ))}
    </>
  );
}
