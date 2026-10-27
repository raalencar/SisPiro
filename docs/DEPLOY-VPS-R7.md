# Deploy nesta VPS (r7solutions) — estado e troubleshooting

Este documento cobre o deploy nativo do SisPiro na VPS da r7solutions
(`app.casadefogossaojoao.com`), fora do fluxo Docker descrito em
`docker-compose.prod.yml`/`RUNBOOK-IMPLANTACAO-PRODUCAO.md`. Serve de referência pra quem for
reimplantar, debugar ou dar manutenção nesse ambiente específico.

## Arquitetura do deploy

- **Backend**: NestJS (`backend/`), Prisma, porta **4055** (interna, `127.0.0.1`), prefixo `api/v1`.
- **Frontend**: Next.js 16.4.3 (`frontend/`), App Router, `output: 'standalone'`, porta **4056**
  (interna, `127.0.0.1`, `HOSTNAME=127.0.0.1`).
- **Banco**: PostgreSQL 16 local na VPS. Database `sispiro_db`, role dedicado `sispiro_app` (não usa
  superuser `postgres`).
- **Redis**: local (`127.0.0.1:6379`).
- **Domínio**: `app.casadefogossaojoao.com` → nginx → `/api/v1/` pra porta 4055, `/` pra porta 4056.
  HTTPS via Certbot.
- **Processos**: systemd `sispiro-api.service` (NestJS, `EnvironmentFile=backend/.env`) e
  `sispiro-web.service` (Next.js standalone, `node .next/standalone/server.js`,
  `NODE_ENV=production` fixado no próprio service).

Clonado e deployado nesta VPS em 2026-10-27 (primeiro deploy, ambiente rotulado "homologação" nos
systemd units).

## ⚠️ Gotcha: build standalone do Next não copia assets estáticos

`next build` com `output: 'standalone'` gera `.next/standalone/server.js`, mas **não copia**
`.next/static/` nem `public/` para dentro de `.next/standalone/.next/static` e
`.next/standalone/public` — isso é manual, sempre. Sem a cópia, o servidor sobe normal e serve HTML,
mas todo asset com hash (`/_next/static/...`) devolve 404 e a página renderiza sem estilo nenhum.

Todo rebuild do frontend precisa repetir:
```
cd frontend
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public   # se existir
sudo systemctl restart sispiro-web.service
```
Não existe script de deploy automatizando isso ainda (decisão deliberada de manter manual por ora,
nesta fase). Se isso virar recorrente, vale reconsiderar.

## ⚠️ Corrigido: login sempre devolvia 403 atrás do nginx

`frontend/src/lib/server-auth.ts` tinha um `isSameOriginRequest()` que comparava o header `Origin` do
browser com `new URL(request.url).origin`. Dois problemas, ambos por rodar atrás de um nginx que
termina TLS:

1. **Host errado**: `request.url` do Next (standalone, bind em `127.0.0.1:4056`) resolve pro
   host/porta locais do processo (`localhost:4056`), não pro `Host` real da requisição — mesmo o
   nginx mandando `Host: $host` corretamente.
2. **Protocolo errado**: por extensão, o protocolo também não refletia HTTPS externo.

Resultado: `origin` (`https://app.casadefogossaojoao.com`) nunca batia com `url.origin`
(`https://localhost:4056`) → **todo POST de login levava 403**, mesmo com credenciais corretas.

Corrigido reconstruindo a origem esperada a partir dos headers que o nginx já encaminha
(`X-Forwarded-Proto`/`X-Forwarded-Host`/`Host`) em vez de confiar em `request.url`. Seguro porque o
Next só escuta em `127.0.0.1` — a única via de acesso é através do nginx. Validado: login com
credenciais erradas devolve `401` (não mais `403`), e origem cruzada de verdade continua bloqueada com
`403`.

**Atenção se este app vier a rodar atrás de outro proxy/CDN**: qualquer checagem de same-origin/CSRF
que use `request.url` direto (em vez dos headers `X-Forwarded-*`) tem o mesmo bug quando há um proxy
terminando TLS na frente.

## Login: seed, senha e rate limiter

1. **Seed já aplicado nesta VPS.** `usuarios` tem 6 linhas desde o deploy inicial (`admin@`,
   `comercial@`, `operacoes@`, `estoque@`, `financeiro@casadefogossaojoao.com` +
   `demo.admin@local.test`), criadas via `prisma/seed.mjs` (controlado por `DEV_SEED_ENABLED=true` +
   `DEV_SEED_ADMIN_PASSWORD` no `.env`, exige senha de 12–128 chars pra rodar). O seed usa a MESMA
   senha (`DEV_SEED_ADMIN_PASSWORD`) pra todos os usuários, tanto no `create` quanto no `update` do
   upsert — ou seja, rodar o seed de novo reseta a senha de todo mundo pro valor atual dessa env var.
2. **Senha trocada pra `admin@123` em todas as 6 contas** — update direto no Postgres
   (`UPDATE usuarios SET senha_hash = ...`), gerando hash no formato scrypt que o backend espera
   (`scrypt$N$r$p$saltHex$hashHex`, ver `passwordHash()` em `prisma/seed.mjs`). Não foi feito via
   `DEV_SEED_ADMIN_PASSWORD` (exige ≥12 chars) — se o seed rodar de novo, a senha volta pro valor
   daquela env var, não pro `admin@123`.
   ⚠️ Senha fraca e igual em todas as contas, incluindo admin, num domínio real — ok pra
   homologação, mas trocar antes de considerar isso produção de verdade.
3. **Rate limiter pode bloquear a conta durante debug.** `LoginRateLimiterService`
   (`backend/src/modules/auth/login-rate-limiter.service.ts`) usa Redis: bloqueia por **conta**
   depois de 5 tentativas em 15 min (bloqueio de 15 min), por **IP** depois de 25 (100 se for
   loopback `127.0.0.1`). Chaves: `rl:attempts:email:<email>`, `rl:blocked:email:<email>`,
   `rl:attempts:ip:<ip>`, `rl:blocked:ip:<ip>`. Fix se travar durante teste manual:
   ```
   redis-cli --scan --pattern 'rl:*'
   redis-cli DEL "rl:blocked:email:<email>" "rl:attempts:email:<email>"
   ```

## Pendências conhecidas (deploy nesta VPS)

- Senha compartilhada fraca (`admin@123`) em todas as 6 contas seedadas — trocar por senhas
  individuais mais fortes antes de uso real.
- `NODE_ENV=development` no `backend/.env` mesmo em "homologação" (frontend está correto, com
  `NODE_ENV=production` fixado no systemd). Pode afetar logging/CORS/exposição de erros do NestJS —
  não investigado a fundo.
- Sem script de deploy — todo rebuild (frontend ou backend) é manual: `npm run build` + (frontend)
  cópia de `static`/`public` pro standalone + `systemctl restart`.
- Não confirmado se `prisma migrate deploy` roda automaticamente em algum pipeline nesta VPS ou se é
  sempre manual — assumir manual até confirmar o contrário.
