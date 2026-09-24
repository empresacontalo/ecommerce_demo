import { promises as fs } from 'fs';
import path from 'path';
import { snapshotConteudo, compactarPayload } from '@/lib/backups/backups';
import { purgarAuditLogs } from '@/utils/audit';

export const BACKUP_DIR = process.env.BACKUP_DIR || '/backups';
export const BACKUP_RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS || 7);
export const BACKUP_TZ = process.env.BACKUP_TZ || 'America/Sao_Paulo';

const ARQUIVO_RE = /^backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.backup\.json\.gz$/;

export function nomeArquivoBackup(agora = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: BACKUP_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(agora);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `backup-${get('year')}-${get('month')}-${get('day')}_${get('hour')}-${get('minute')}-${get('second')}.backup.json.gz`;
}

/** Grava um payload comprimido na pasta e retorna o caminho. */
export async function gravarPayloadArquivo(payload: ReturnType<typeof snapshotConteudo> extends Promise<infer T> ? T : never, dir = BACKUP_DIR): Promise<{ arquivo: string; tamanho: number }> {
  await fs.mkdir(dir, { recursive: true });
  const dados = compactarPayload(payload);
  const arquivo = path.join(dir, nomeArquivoBackup());
  await fs.writeFile(arquivo, dados);
  return { arquivo, tamanho: dados.length };
}

/** Grava o backup do conteúdo atual (snapshot do banco) na pasta e retorna o caminho. */
export async function gravarBackupArquivo(dir = BACKUP_DIR): Promise<{ arquivo: string; tamanho: number }> {
  const payload = await snapshotConteudo();
  return gravarPayloadArquivo(payload, dir);
}

/** Extrai o timestamp de criação a partir do nome (backup-YYYY-MM-DD_HH-mm-ss). */
function timestampDoNome(nome: string): number | null {
  const m = nome.match(/^backup-(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.backup\.json\.gz$/);
  if (!m) return null;
  const ano = Number(m[1]); const mes = Number(m[2]); const dia = Number(m[3]);
  const hora = Number(m[4]); const min = Number(m[5]); const seg = Number(m[6]);
  const t = Date.UTC(ano, mes - 1, dia, hora, min, seg);
  return Number.isNaN(t) ? null : t;
}

/** Remove backups mais antigos que o período de retenção (dias). */
export async function limparBackupsAntigos(dir = BACKUP_DIR, dias = BACKUP_RETENTION_DAYS): Promise<string[]> {
  const removidos: string[] = [];
  try {
    const arquivos = await fs.readdir(dir);
    const corte = Date.now() - dias * 24 * 60 * 60 * 1000;
    for (const nome of arquivos) {
      if (!ARQUIVO_RE.test(nome)) continue;
      // Prioriza a data do nome do arquivo; mtime como fallback
      const criacao = timestampDoNome(nome) ?? (await fs.stat(path.join(dir, nome)).catch(() => null))?.mtimeMs ?? Date.now();
      if (criacao < corte) {
        await fs.unlink(path.join(dir, nome)).catch(() => {});
        removidos.push(nome);
      }
    }
  } catch { /* pasta inexistente = nada a limpar */ }
  return removidos;
}

/** Executa um backup automático e aplica a retenção de 7 dias. */
export async function executarBackupAutomatico(): Promise<{ arquivo: string; tamanho: number; removidos: string[] }> {
  const { arquivo, tamanho } = await gravarBackupArquivo();
  const removidos = await limparBackupsAntigos();
  console.log(`[backup-auto] arquivo=${arquivo} tamanho=${tamanho} removidos=${removidos.length}`);
  return { arquivo, tamanho, removidos };
}

/** Milissegundos até a próxima 00:00 (horário de parede) no fuso configurado. */
function msAteProximaMeiaNoite(tz = BACKUP_TZ): number {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? '';
  const hora = Number(get('hour')) % 24;
  const min = Number(get('minute'));
  const seg = Number(get('second'));
  const ate = (24 * 3600) - (hora * 3600 + min * 60 + seg);
  return Math.max(1000, ate * 1000);
}

let iniciado = false;

/**
 * Agenda o backup diário às 00:00 (fuso BACKUP_TZ, padrão America/Sao_Paulo).
 * Chamado uma única vez na inicialização do servidor (instrumentation.ts).
 */
export function agendarBackupDiario(): void {
  if (iniciado) return;
  iniciado = true;

  // Limpeza de retenção na subida (arquivos acumulados em deploys anteriores)
  limparBackupsAntigos().then((removidos) => {
    if (removidos.length) console.log(`[backup-auto] limpeza inicial: ${removidos.length} arquivo(s) removido(s)`);
  }).catch(() => {});

  // Manutenção diária: remove logs de auditoria com mais de 7 dias
  purgarAuditLogs().then((removidos) => {
    if (removidos) console.log(`[audit] limpeza inicial: ${removidos} log(s) expirado(s) removido(s)`);
  }).catch(() => {});

  const programar = () => {
    const delay = msAteProximaMeiaNoite();
    setTimeout(async () => {
      try {
        await executarBackupAutomatico();
      } catch (err) {
        console.error('[backup-auto] falha na execução:', err);
      }
      try {
        await purgarAuditLogs();
      } catch (err) {
        console.error('[audit] falha na limpeza diária:', err);
      }
      programar();
    }, delay);
  };
  programar();
  console.log(`[backup-auto] agendado: 1x/dia às 00:00 (${BACKUP_TZ}) em ${BACKUP_DIR} — retenção ${BACKUP_RETENTION_DAYS} dias`);
}