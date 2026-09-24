export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { agendarBackupDiario } = await import('@/lib/backups/auto');
    agendarBackupDiario();
  }
}
