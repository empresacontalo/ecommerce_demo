export type EnvironmentImpact =
  | 'local_projection'
  | 'stack_redeploy'
  | 'image_rebuild'
  | 'database_rotation';

export type EnvironmentScope = 'app-runtime' | 'database' | 'build' | 'derived' | 'local-only';

export interface EnvironmentDefinition {
  key: string;
  description: string;
  scope: EnvironmentScope;
  service: 'app' | 'db' | 'controller' | 'derived';
  sensitive: boolean;
  buildTime?: boolean;
  editable: boolean;
  impact: EnvironmentImpact;
  localOnly?: boolean;
  howTo?: string;
}

const secret = (key: string, description: string, service: 'app' | 'db' = 'app', howTo?: string): EnvironmentDefinition => ({
  key,
  description,
  scope: service === 'db' ? 'database' : 'app-runtime',
  service,
  sensitive: true,
  editable: true,
  impact: service === 'db' ? 'database_rotation' : 'stack_redeploy',
  howTo,
});

const runtime = (key: string, description: string, sensitive = false, howTo?: string): EnvironmentDefinition => ({
  key,
  description,
  scope: 'app-runtime',
  service: 'app',
  sensitive,
  editable: true,
  impact: 'stack_redeploy',
  howTo,
});

export const ENVIRONMENT_MANIFEST: EnvironmentDefinition[] = [
  secret('JWT_SECRET', 'Chave de assinatura das sessões JWT', 'app', 'Gere com: openssl rand -hex 32 — ou node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))". Mínimo de 32 caracteres.'),
  runtime('JWT_EXPIRY', 'Duração da sessão JWT em segundos', false, 'Duração da sessão em segundos: 3600 = 1 hora. Valor mínimo aceito: 60.'),
  secret('GOOGLE_SECRET', 'Segredo do OAuth Google', 'app', 'Crie um OAuth Client (tipo Web) em https://console.cloud.google.com/apis/credentials. Redirect URI: https://SEU-DOMINIO/api/auth/google/callback'),
  runtime('GOOGLE_CLIENT_ID', 'Client ID do OAuth Google', false, 'No mesmo cliente OAuth do console Google Cloud, copie o campo "Client ID".'),
  secret('ASAAS_API_KEY', 'Token fallback do Asaas', 'app', 'Painel Asaas → Integrações → API: copie o token da sua chave de API (produção ou sandbox).'),
  secret('ASSAAS_WEBHOOK_TOKEN', 'Token de validação do webhook Asaas', 'app', 'Painel Asaas → Integrações → Webhooks: use o token de validação exibido/gerado ao configurar o webhook.'),
  secret('OPENAI_API_KEY', 'Chave da API OpenAI', 'app', 'Em https://platform.openai.com/api-keys → Create new secret key e copie a chave sk-...'),
  secret('CRON_SECRET', 'Segredo da rota de tarefas agendadas', 'app', 'Gere com: openssl rand -hex 32 (mesmo padrão do JWT_SECRET).'),
  secret('MCP_ADMIN_TOKEN', 'Token de acesso da IA ao painel via MCP', 'app', 'Gere com: openssl rand -hex 32. É usado no header Authorization: Bearer <token> ao conectar a IA no endpoint /api/mcp.'),
  runtime('SMTP_HOST', 'Servidor SMTP', false, 'Servidor de saída do seu provedor de e-mail. Gmail: smtp.gmail.com.'),
  runtime('SMTP_PORT', 'Porta SMTP', false, 'Porta SMTP: 587 (STARTTLS) ou 465 (TLS direto, combina com SMTP_SECURE=true).'),
  runtime('SMTP_FROM_NAME', 'Nome remetente de e-mails', false, 'Nome exibido como remetente (ex: Fragrance E-commerce Demo).'),
  secret('SMTP_PASS', 'Senha SMTP', 'app', 'No Gmail, gere uma "Senha de app" em Conta Google → Segurança → Senhas de app (requer verificação em 2 etapas). Para outros provedores, use a senha ou chave de API SMTP do serviço (ex: SendGrid, Brevo).'),
  secret('SMTP_USER', 'Usuário SMTP', 'app', 'E-mail usado no SMTP (ex: seuemail@gmail.com).'),
  runtime('SMTP_SECURE', 'SMTP usa TLS direto', false, 'true se a porta 465 usa TLS direto; false para 587 com STARTTLS.'),
  runtime('API_EXTERNAL_URL', 'URL externa permitida para APIs', false, 'URL externa permitida para chamadas de API (ex: https://api.seudominio.com).'),
  runtime('SITE_URL', 'URL alternativa do site', false, 'URL alternativa do site usada em e-mails e links (ex: https://seudominio.com).'),
  runtime('CHATWOOT_API_TOKEN', 'Token fallback do Chatwoot', true, 'Painel Chatwoot → Configurações da conta → Perfil → Token de acesso.'),
  runtime('EMPRESA_NOME', 'Nome fallback da empresa', false, 'Nome fallback exibido quando a empresa não está configurada no CMS.'),
  runtime('AUTO_APPROVE', 'Aprovação automática de ambiente local', false, 'true permite aplicar mudanças sem confirmação extra no ambiente local.'),
  runtime('REQUIRE_CONFIRMATION', 'Exige confirmação de ambiente local', false, 'true exige confirmação antes de aplicar alterações.'),
  runtime('INTERACTIVE', 'Modo interativo do ambiente local', false, 'true habilita o modo interativo no ambiente local.'),
  {
    key: 'NEXT_PUBLIC_SITE_URL',
    description: 'URL pública incorporada no bundle Next.js',
    scope: 'build',
    service: 'app',
    sensitive: false,
    buildTime: true,
    editable: true,
    impact: 'image_rebuild',
    howTo: 'URL pública do site, sem barra no final (ex: https://seudominio.com). Alterar aqui reconstrói a imagem.',
  },
  secret('POSTGRES_PASSWORD', 'Senha de inicialização/rotação do PostgreSQL', 'db', 'Gere com: openssl rand -base64 24. Usada na inicialização/rotação do banco.'),
  runtime('POSTGRES_USER', 'Usuário de inicialização do PostgreSQL', false, 'Usuário do PostgreSQL (padrão: postgres).'),
  runtime('POSTGRES_DB', 'Banco de inicialização do PostgreSQL', false, 'Nome do banco de dados (padrão: postgres).'),
  {
    key: 'DATABASE_URL',
    description: 'Conexão derivada de POSTGRES_* e do serviço db',
    scope: 'derived',
    service: 'derived',
    sensitive: true,
    editable: true,
    impact: 'database_rotation',
    howTo: 'Derivada automaticamente de POSTGRES_* e do serviço db. Normalmente não precisa ser editada.',
  },
  {
    key: 'DB_USER',
    description: 'Usuário de banco derivado de POSTGRES_USER',
    scope: 'derived',
    service: 'derived',
    sensitive: false,
    editable: true,
    impact: 'database_rotation',
    howTo: 'Derivada de POSTGRES_USER. Não edite manualmente.',
  },
  {
    key: 'DB_PASSWORD',
    description: 'Senha de banco derivada de POSTGRES_PASSWORD',
    scope: 'derived',
    service: 'derived',
    sensitive: true,
    editable: true,
    impact: 'database_rotation',
    howTo: 'Derivada de POSTGRES_PASSWORD. Não edite manualmente.',
  },
  {
    key: 'DB_HOST',
    description: 'Host do banco derivado do serviço db',
    scope: 'derived',
    service: 'derived',
    sensitive: false,
    editable: true,
    impact: 'stack_redeploy',
    howTo: 'Derivado do serviço db do Compose. Não edite manualmente.',
  },
  {
    key: 'DB_PORT',
    description: 'Porta do banco derivada do Compose',
    scope: 'derived',
    service: 'derived',
    sensitive: false,
    editable: true,
    impact: 'database_rotation',
    howTo: 'Derivada do Compose (5432). Não edite manualmente.',
  },
  {
    key: 'DB_NAME',
    description: 'Banco usado pelo app derivado de POSTGRES_DB',
    scope: 'derived',
    service: 'derived',
    sensitive: false,
    editable: true,
    impact: 'database_rotation',
    howTo: 'Derivado de POSTGRES_DB. Não edite manualmente.',
  },
];

const DEFINITIONS = new Map(ENVIRONMENT_MANIFEST.map((item) => [item.key, item]));

export function getEnvironmentDefinition(key: string): EnvironmentDefinition | undefined {
  return DEFINITIONS.get(key);
}

function isUrlKey(key: string): boolean {
  return key === 'NEXT_PUBLIC_SITE_URL' || key === 'SITE_URL' || key === 'API_EXTERNAL_URL';
}

function isBooleanString(value: string): boolean {
  return value === 'true' || value === 'false';
}

function validateValue(definition: EnvironmentDefinition, value: unknown): string | null {
  if (typeof value !== 'string') return `${definition.key} deve ser texto`;
  if (value.includes('\r') || value.includes('\n')) return `${definition.key} não pode conter quebra de linha`;
  if (value.length > 8192) return `${definition.key} excede o limite de tamanho`;

  if (definition.key === 'JWT_SECRET' && value.length < 32) return 'JWT_SECRET deve ter pelo menos 32 caracteres';
  if (definition.key === 'JWT_EXPIRY' && (!/^\d+$/.test(value) || Number(value) < 60)) return 'JWT_EXPIRY deve ser ao menos 60 segundos';
  if (definition.key === 'SMTP_PORT' && (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535)) return 'SMTP_PORT inválida';
  if (definition.key === 'DB_PORT' && (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535)) return 'DB_PORT inválida';
  if (definition.key === 'POSTGRES_USER' && !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(value)) return 'POSTGRES_USER inválido';
  if (definition.key === 'POSTGRES_DB' && !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(value)) return 'POSTGRES_DB inválido';
  if (isUrlKey(definition.key)) {
    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol)) return `${definition.key} deve usar http ou https`;
    } catch {
      return `${definition.key} deve ser uma URL válida`;
    }
  }
  if (['AUTO_APPROVE', 'REQUIRE_CONFIRMATION', 'INTERACTIVE', 'SMTP_SECURE'].includes(definition.key) && !isBooleanString(value)) {
    return `${definition.key} deve ser true ou false`;
  }
  return null;
}

export function validateEnvironmentPatch(patch: unknown): {
  valid: boolean;
  errors: string[];
  keys: string[];
  impact: EnvironmentImpact;
} {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return { valid: false, errors: ['Patch inválido'], keys: [], impact: 'stack_redeploy' };
  }

  const values = patch as Record<string, unknown>;
  const keys = Object.keys(values);
  const errors: string[] = [];
  let impact: EnvironmentImpact = 'local_projection';
  const rank: Record<EnvironmentImpact, number> = {
    local_projection: 0,
    stack_redeploy: 1,
    image_rebuild: 2,
    database_rotation: 3,
  };

  for (const key of keys) {
    const definition = getEnvironmentDefinition(key);
    if (!definition) {
      errors.push(`Variável não permitida: ${key}`);
      continue;
    }
    const error = validateValue(definition, values[key]);
    if (error) errors.push(error);
    if (rank[definition.impact] > rank[impact]) impact = definition.impact;
  }

  return { valid: errors.length === 0 && keys.length > 0, errors, keys, impact };
}
