-- ============================================================
-- Migração: Controle seguro de variáveis de ambiente
-- Data: 2026-08-16
-- Escopo: somente a aplicação portal-gerenciavel.
-- Não armazena valores de segredo em texto puro.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.environment_controller_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id text NOT NULL UNIQUE,
    public_key text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    retired_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_environment_controller_key_active
    ON public.environment_controller_keys (active)
    WHERE active = true;

CREATE TABLE IF NOT EXISTS public.environment_change_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid NOT NULL,
    actor_email text NOT NULL,
    environment_name text NOT NULL DEFAULT 'production',
    expected_revision text NOT NULL,
    status text NOT NULL DEFAULT 'preview',
    impact text NOT NULL DEFAULT 'stack_redeploy',
    encrypted_payload text,
    encrypted_key text,
    payload_iv text,
    payload_tag text,
    public_diff_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    confirmation_token_hash text,
    confirmation_at timestamptz,
    controller_operation_id text,
    error_code text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_environment_requests_status
    ON public.environment_change_requests (status, created_at);

CREATE INDEX IF NOT EXISTS idx_environment_requests_actor
    ON public.environment_change_requests (actor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.environment_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_name text NOT NULL DEFAULT 'production',
    manifest_version text NOT NULL,
    portainer_fingerprint text,
    env_file_fingerprint text,
    image_digest text,
    health_status text NOT NULL DEFAULT 'unknown',
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_environment_revisions_environment
    ON public.environment_revisions (environment_name, created_at DESC);

CREATE TABLE IF NOT EXISTS public.environment_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid REFERENCES public.environment_change_requests(id) ON DELETE SET NULL,
    actor_id uuid,
    actor_email text,
    action text NOT NULL,
    key_names text[] NOT NULL DEFAULT '{}',
    redacted_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    old_fingerprint text,
    new_fingerprint text,
    result text NOT NULL,
    rollback_request_id uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_environment_audit_created
    ON public.environment_audit_log (created_at DESC);

COMMENT ON TABLE public.environment_change_requests IS 'Solicitações criptografadas para o controlador operacional do portal-gerenciavel';
COMMENT ON TABLE public.environment_revisions IS 'Revisões redigidas de Portainer/.env.local/imagem';
COMMENT ON TABLE public.environment_audit_log IS 'Auditoria sem valores brutos de ambiente';
