import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { gravarPayloadArquivo, limparBackupsAntigos, nomeArquivoBackup } from './auto';

const PAYLOAD = {
  versao: 1,
  criado_em: '2026-08-18T00:00:00.000Z',
  tabelas: { paginas: [{ id: 'a', slug: 'x', titulo: 'X' }] },
} as never;

describe('backup automático (arquivos)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'backup-auto-'));
    process.env.BACKUP_DIR = dir;
    process.env.BACKUP_RETENTION_DAYS = '7';
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
    delete process.env.BACKUP_DIR;
    delete process.env.BACKUP_RETENTION_DAYS;
  });

  it('grava arquivo gzip com o padrão de nome', async () => {
    const { arquivo, tamanho } = await gravarPayloadArquivo(PAYLOAD, dir);
    expect(path.basename(arquivo)).toMatch(/^backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.backup\.json\.gz$/);
    expect(tamanho).toBeGreaterThan(0);
    const dados = await fs.readFile(arquivo);
    expect(dados[0]).toBe(0x1f); // magic byte do gzip
  });

  it('remove apenas arquivos mais antigos que a retenção', async () => {
    const atual = await gravarPayloadArquivo(PAYLOAD, dir);
    const antigo = path.join(dir, 'backup-2020-01-01_00-00-00.backup.json.gz');
    await fs.writeFile(antigo, 'x');
    const estranho = path.join(dir, 'nao-backup.txt');
    await fs.writeFile(estranho, 'x');

    const removidos = await limparBackupsAntigos(dir, 7);
    expect(removidos).toContain('backup-2020-01-01_00-00-00.backup.json.gz');
    expect(removidos).not.toContain(path.basename(atual.arquivo));
    // arquivo estranho não é tocado
    expect(await fs.readFile(estranho, 'utf8')).toBe('x');
  });

  it('gera nomes com timestamp do fuso', () => {
    const nome = nomeArquivoBackup(new Date('2026-08-18T12:00:00Z'));
    expect(nome).toMatch(/^backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.backup\.json\.gz$/);
  });
});