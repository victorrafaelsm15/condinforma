# Cond-Informa — Checklists digitais com QR Code para condomínios

Sistema para síndicos, administradoras e equipes de limpeza/zeladoria controlarem
rotinas por ambiente com QR Code, com transparência para os moradores.

## Como rodar localmente

```bash
npm install
npm run dev
```

## Painel do gestor

Acesse em `/admin/login`.

- **E-mail:** admin@condinforma.com
- **Senha:** condinforma2026

Troque essas credenciais antes de publicar (veja `src/lib/authService.js`, ou defina
`VITE_ADMIN_EMAIL` / `VITE_ADMIN_PASSWORD` no `.env`).

## Como funciona

1. **Cadastre um condomínio** no painel
2. **Cadastre os ambientes** desse condomínio (halls, banheiros, elevadores, academia etc.)
3. Dentro de cada ambiente, **monte o checklist** de tarefas
4. Na aba **QR Codes**, baixe os dois QR Codes gerados:
   - Um para o **colaborador executar o checklist** (sem login — a própria URL do QR
     Code é o acesso)
   - Um para o **morador consultar o status** da limpeza (também sem login)
5. Imprima e fixe os QR Codes nos ambientes correspondentes
6. Acompanhe execuções, fotos e ocorrências pelo painel, nas abas **Histórico** e
   **Ocorrências** de cada ambiente (ou na visão agregada em "Ocorrências" no menu)

## Persistência de dados

Os dados ficam salvos automaticamente no navegador (localStorage) — funciona
imediatamente para demonstração, mas **cada navegador/dispositivo tem seu próprio
armazenamento isolado**. Como o QR Code precisa funcionar entre dispositivos
diferentes (celular do colaborador, celular do morador, computador do síndico),
é essencial configurar o Supabase para uso real:

1. Crie um projeto em https://supabase.com
2. Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
3. Crie as tabelas: `condominios`, `ambientes`, `checklist_items`, `execucoes`, `ocorrencias`

## Build de produção

```bash
npm run build
```

## Pendências conhecidas

- Fotos são armazenadas como base64 diretamente no registro — para uso em maior
  escala, migrar para o Supabase Storage (upload de arquivo real).
- Não há landing page de vendas — o app abre direto no painel/execução, conforme solicitado.
