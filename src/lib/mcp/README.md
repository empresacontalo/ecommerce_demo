# MCP do Portal Gerenciável (painel administrativo)

Servidor [MCP (Model Context Protocol)](https://modelcontextprotocol.io) embutido
no próprio site (`/api/mcp`). Permite que uma **inteligência artificial**
(Claude, Cursor, agente customizado, etc.) conectada pelo cliente **leia e
altere** o mesmo conteúdo que o painel administrativo disponibiliza:
páginas, blocos, configurações, depoimentos, galeria, campanhas, produtos,
leads, agendamentos, pedidos, usuários admin e status do ambiente.

> Segredos (variáveis sensíveis de ambiente) **nunca** são retornados — o tool
> `ler_ambiente` devolve apenas status (configurada/drift/fonte).

## 1. Obter o token de acesso

O token é a env `MCP_ADMIN_TOKEN` (gerada com `openssl rand -hex 32`).
Você vê/define em **Admin → Configurações → Variáveis de Ambiente** (chave
`MCP_ADMIN_TOKEN`). Ele é usado no header `Authorization: Bearer <token>`.

## 2. URL do servidor

```
https://portalgerenciavel.digitalarea.online/api/mcp
```

Autenticação: `Authorization: Bearer <MCP_ADMIN_TOKEN>`.

## 3. Conectar uma IA (exemplos)

**Claude (CLI / Desktop):**
```bash
claude mcp add --transport http portal-admin \
  -u https://portalgerenciavel.digitalarea.online/api/mcp \
  -H "Authorization: Bearer SEU_TOKEN"
```

**Claude Desktop (claude_desktop_config.json):**
```json
{
  "mcpServers": {
    "portal-admin": {
      "type": "http",
      "url": "https://portalgerenciavel.digitalarea.online/api/mcp",
      "headers": { "Authorization": "Bearer SEU_TOKEN" }
    }
  }
}
```

**Cursor / Zed / outro cliente MCP:** adicione um servidor MCP "streamable
HTTP" apontando para a URL acima, com o mesmo header de autorização.

**Teste rápido via curl:**
```bash
TOKEN="SEU_TOKEN"
# Listar ferramentas (JSON-RPC)
curl -sS -X POST https://portalgerenciavel.digitalarea.online/api/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'

curl -sS -X POST https://portalgerenciavel.digitalarea.online/api/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

## 4. Ferramentas disponíveis

**Leitura:** `dashboard_resumo`, `ler_ambiente`, `listar_paginas`,
`listar_blocos`, `listar_configuracoes`, `listar_depoimentos`,
`listar_galeria`, `listar_campanhas`, `listar_produtos`, `listar_leads`,
`listar_agendamentos`, `listar_pedidos`, `listar_usuarios_admin`,
`listar_leads_campanha`.

**Escrita:** `criar_pagina`, `atualizar_pagina`, `excluir_pagina`,
`criar_ou_atualizar_bloco`, `excluir_bloco`, `salvar_configuracao`,
`excluir_configuracao`, `criar_depoimento`, `atualizar_depoimento`,
`excluir_depoimento`, `adicionar_galeria`, `atualizar_galeria`,
`excluir_galeria`, `criar_campanha`, `atualizar_campanha`, `excluir_campanha`,
`criar_produto`, `atualizar_produto`, `excluir_produto`,
`atualizar_status_lead`, `criar_agendamento`, `atualizar_agendamento`,
`excluir_agendamento`, `atualizar_status_pedido`, `atualizar_usuario_admin`,
`excluir_usuario_admin`.

## 5. Segurança

- O endpoint exige o token `MCP_ADMIN_TOKEN` em toda chamada (inclusive
  `initialize`). Sem o token configurado, o MCP fica desativado.
- Mantenha o token em sigilo — quem o possuir tem o mesmo poder do painel.
- Rotacione o token pela aba de Variáveis de Ambiente quando necessário.
