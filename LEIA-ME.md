# BI Estúdio — plataforma de gestão

Publicada em https://benficaindependente.github.io (repositório `benficaindependente/benficaindependente.github.io`, ramo `main`).
HTML/JS simples, alojado no GitHub Pages. Instala-se no telemóvel com "Adicionar ao ecrã principal".

## Onde estão os ficheiros

| No computador | No repositório publicado |
|---|---|
| `Plataforma\novo\` | raiz (a plataforma atual) |
| ficheiros soltos de `Plataforma\` (versão antiga) | `antigo/` |
| `Plataforma\assistente\index.ts` | `assistente/index.ts` |
| `Plataforma\*.sql` e este LEIA-ME | raiz |

`/novo` no site só redireciona para a raiz.

## Publicar a plataforma

1. Alterar os ficheiros em `Plataforma\novo\` e copiar para um clone do repositório do site.
2. Subir o `?v=` dos ficheiros alterados em `index.html` e o número da cache em `servico.js` (`bi-estudio-vNN`).
3. Commit e push em `main`.

## Entrada

- Normal: **conta Google** ou **email e palavra-passe** ("Primeiro acesso" na primeira vez). Só entra quem está na tabela `admins_email` (um dono acrescenta em **Administradores**).
- Emergência (só o dono): ligação pequena **"Acesso de emergência (dono)"**, com uma chave GitHub. Esta entrada usa a lista `data/admins.json` do repositório de dados.
- Chave de emergência: GitHub → Settings → Developer settings → Fine-grained tokens; *Resource owner* `benficaindependente`; repositório `benfica-independente-dados` (e `benfica-independente-gestao`, se existir); *Contents: Read and write* e *Actions: Read-only*.

## Aprovações

- **Fase de testes (agora): basta 1 administrador.** A plataforma mostra o aviso amarelo.
- Para produção (2 aprovações): em `app.js`, `APROVACOES = 2`; no Supabase, SQL Editor:
  `create or replace function public.bi_modo_teste() returns boolean language sql immutable as $$ select false $$;`
  O assistente de IA lê este valor sozinho.

## Base de dados (Supabase)

- Correr no SQL Editor **`supabase-correcoes-2026-11-26.sql`**. Pode correr-se mais do que uma vez. No fim, cada linha deve dizer "tudo certo".
- Os outros ficheiros `supabase*.sql` estão **já incluídos: não voltar a correr** (têm um bloqueio no topo depois das correções).
- Montar uma base nova de raiz: correr primeiro os antigos pela ordem `supabase`, `assistente`, `estatisticas`, `sondagens`, `quadro-e-fotos`, `novidades`, `acesso`, `mvp`, `contas-e-participantes`, e só no fim as correções.
- Casas do Benfica: só se aceitam as da tabela `casas_oficiais`. Se o `casas.json` ganhar casas novas, é preciso acrescentá-las a essa tabela.
- Prognósticos: o servidor pergunta ao ESPN a hora do apito e recusa depois disso (tabela `jogos_apito`).

## Assistente de IA (função `bi-assistente`)

Não é publicada automaticamente. Depois de alterar `assistente\index.ts`:

1. Supabase → projeto → **Edge Functions** → `bi-assistente` → separador **Code**.
2. Substituir o conteúdo de `index.ts` por todo o ficheiro novo e carregar em **Deploy updates**.
3. Confirmar que **Verify JWT** continua desligado.

A chave `GEMINI_API_KEY` está nos Secrets do Supabase. Para gravar respostas, a função usa a chave de serviço que o Supabase lhe dá sozinho (`SUPABASE_SERVICE_ROLE_KEY`): não é preciso criar nada.
Regras: só modelos flash-lite; nunca falar do Sporting nem do FC Porto. A lista de palavras está na função e em `data/Chat.kt` na app (têm de ser iguais).

## Robô

Corre no GitHub Actions (`benfica-independente-dados`) e é lançado por um "despertador" (Cloudflare) de 10 em 10 minutos. Pode atrasar-se; o painel da plataforma mostra a idade dos dados.
