// Validação de CPF pelos dígitos verificadores (algoritmo oficial)
export function validarCpf(cpf: string | null | undefined): boolean {
  const d = (cpf || '').replace(/\D/g, '');
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false; // todos dígitos iguais

  const calc = (len: number): number => {
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += Number(d[i]) * (len + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  if (calc(9) !== Number(d[9])) return false;
  if (calc(10) !== Number(d[10])) return false;
  return true;
}

// Formata CPF como 000.000.000-00 (aceita string parcial)
export function formatarCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
