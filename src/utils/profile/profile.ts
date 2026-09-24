export interface ProfileUpdateData {
  name: string;
  lastName: string;
  phone: string;
  cpf: string;
}

/**
 * Update user profile metadata via API endpoint.
 * Safe for both client and server components (no pg import).
 */
export async function updateProfileMetadata(
  _userId: string,
  data: ProfileUpdateData
): Promise<{ success: boolean; error?: string }> {
  const { name, lastName, phone, cpf } = data;

  if (!name.trim() || !lastName.trim() || !phone.trim()) {
    return { success: false, error: 'Preencha todos os campos obrigatórios.' };
  }

  try {
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, lastName, phone, cpf }),
    });

    const result = await res.json();
    if (!res.ok) {
      return { success: false, error: result.error || 'Erro ao atualizar perfil.' };
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Erro inesperado ao atualizar perfil.';
    return { success: false, error: errorMsg };
  }
}
