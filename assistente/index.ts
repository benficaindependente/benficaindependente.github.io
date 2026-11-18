// =====================================================================
// Benfica Independente — assistente de IA (função "bi-assistente" do Supabase)
//
// Responde:
//   * aos adeptos no chat da app   → { modo: "adepto", id, token }
//   * aos gestores na plataforma   → { modo: "gestor", gh, mensagens: [{ eu: true|false, texto }] }
//
// Usa o Gemini grátis. A chave fica nos segredos do Supabase com o nome
// GEMINI_API_KEY (Edge Functions → Secrets). Nunca está na app nem na plataforma.
// Limites diários e verificação de quem pede: Plataforma/supabase-assistente.sql
//
// REGRA DO BI: nunca falar dos adversários (Sporting, FC Porto e nomes
// associados). Isto é travado aqui em código, antes e depois do Gemini.
// =====================================================================

const SUPABASE_URL = "https://rpqqucqxgjkisoimstfh.supabase.co";
const CHAVE_PUBLICA = "sb_publishable_InvgB931-Wc8vFs65WWXxw_KVpMLGhH";
const DADOS = "https://raw.githubusercontent.com/JoaoRebola/benfica-independente-dados/main/data/";
const GEMINI = Deno.env.get("GEMINI_API_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ------------------------------------------------------------ adversários

const RIVAIS = new RegExp(
  [
    "sporting(?!\\s+(?:clube\\s+)?(?:de\\s+braga|da\\s+covilh))", "\\bscp\\b", "sportinguist", "lagart", "alvalade",
    "le[õo]es\\s+de\\s+alvalade", "\\bverde[\\s-]e[\\s-]branc", "varandas",
    "f\\.?\\s?c\\.?\\s?porto", "\\bfcp\\b", "futebol\\s+clube\\s+do\\s+porto", "portist", "drag[ãa]o", "drag[õo]es",
    "tripeir", "\\bazul[\\s-]e[\\s-]branc", "pinto\\s+da\\s+costa", "villas[\\s-]?boas", "estádio\\s+do\\s+drag",
    // "Porto" sozinho (o clube), mas não "Casa do Benfica do Porto" nem "Porto Salvo", "Porto de Mós"...
    "(?<!benfica\\s(?:do|de)\\s)\\bporto\\b(?!\\s+(?:salvo|de\\s+m[óo]s|santo|alegre|moniz|covo|brand))",
  ].join("|"),
  "i",
);
const falaDeRivais = (t: string) => RIVAIS.test(t);

const SEM_RIVAIS = "Desse assunto não falamos aqui. 😉 Pergunta-me antes sobre o Benfica, a app ou o Benfica Independente.";

// ------------------------------------------------------------ conhecimento

const APP = `
A APP BENFICA INDEPENDENTE (Android, grátis):
- Separadores em baixo: Início, Artigos, Podcasts, Vídeos e Benfica.
- Início: destaque do momento (ou "Quem somos"), direto do YouTube quando há, últimos episódios, "Continuar a ouvir", cartão do Patreon, avisos e eventos do BI.
- Artigos: todos os artigos do site benficaindependente.com, por temas, e as notícias do BI no topo.
- Podcasts: os programas do BI. Ao tocar, ouve-se o vídeo correspondente do YouTube (o som continua com o ecrã desligado). Tem barra de tempo para avançar.
- Vídeos: vídeos do canal do Benfica Independente no YouTube, tocam dentro da app; botão de ecrã inteiro.
- Benfica: história e dados do clube, botões "Agenda" (todos os jogos marcados de todas as modalidades) e "Resultados Modalidades" (basquetebol, futsal, hóquei, andebol, voleibol…, com vitórias/empates/derrotas e forma), jogos e classificações do futebol.
- Jogo do dia: marcador em direto, golos e onzes, com notificações.
- Menu ⋮ (canto de cima): Alertas e toques (escolher que notificações receber, horário de silêncio, esconder texto no ecrã bloqueado), Quem somos, Site, Redes sociais, Falar connosco (este chat), Contacto (formulário).
- Android Auto: no carro aparece a pasta "Vídeos" com o Direto em primeiro lugar, e os programas.
- Barra por cima do menu: alterna entre o Patreon e anúncios de parceiros.
- Problemas comuns: se o som parar com o ecrã desligado, tirar a app da poupança de bateria nas definições do Android; para notificações, ver "Alertas e toques" e permitir notificações à app. Atualizações: quando há versão nova aparece um cartão "Há uma versão nova" no Início.
- Apoiar o BI: Patreon ${"https://www.patreon.com/c/slbindependente/home"}. Site: https://www.benficaindependente.com. YouTube: https://www.youtube.com/@slbindependente. Email: info@benficaindependente.com.
`;

const PLATAFORMA = `
A PLATAFORMA DE GESTÃO (https://benficaindependente.github.io) — para os gestores do BI:
- Entrada: com a conta GitHub de cada pessoa (botão "Entrar com GitHub" e uma chave de acesso do GitHub). Só entra quem está em Administradores. Instala-se no telemóvel com "Adicionar ao ecrã principal".
- REGRA DAS 2 APROVAÇÕES: tudo o que se cria, altera ou apaga (notícias, destaques, anúncios, publicações, avisos) só chega à app depois de 2 administradores diferentes aprovarem. Quem cria já conta como 1. Uma alteração a algo publicado só muda na app quando for aprovada; até lá a app mostra a versão antiga. Para aprovar: abrir o item e carregar em "Aprovar" (aparece uma pré-visualização e pede confirmação).
- Painel e alertas: o que espera pela tua aprovação, mensagens por responder, alertas (robô parado há mais de 12 horas, robô com erros, agente do robô sem chave, menos de 2 administradores, campanhas pagas que chegaram ao máximo).
- Notícias: título, resumo, texto completo, foto opcional (é reduzida automaticamente), ligação, assinatura. Aparecem no topo de Artigos.
- Destaques: substituem o "Quem somos" no topo do Início entre as datas escolhidas (campos "Começa em" e "Termina em"); foto opcional (sem foto ficam as fotos do estádio) e botão com ligação.
- Anúncios: texto curto, logótipo quadrado, ligação e frequência de 1 a 5 (2 = aparece o dobro). Aparecem na barra por cima do menu da app, a alternar com o Patreon.
- Publicações: foto com texto e botão, e escolhe-se em que ecrãs da app aparecem (Início, Artigos, Podcasts, Vídeos, Benfica, Agenda).
- Avisos: "mensagem" (só texto), "publicidade" (imagem com legenda e ligação) ou "evento" (data e hora, local, ligação para inscrição). Podem enviar notificação para os telemóveis (caixa "Notificação").
- Todos os conteúdos têm datas opcionais de início e fim e a caixa "Ativo".
- Publicidade paga (dentro de anúncios, publicações, destaques e avisos): marcar "É publicidade paga?", anunciante, contacto, como paga (valor fixo, CPM = € por 1000 visualizações, CPC = € por clique, CPA = € por venda), preço, máximo a cobrar, vendas conseguidas, notas internas. Estes dados são privados (ficam no Supabase, nunca aparecem na app).
- Monetização: visualizações, cliques, pessoas diferentes, valor ganho por anúncio e total, receitas de outras origens (Patreon, YouTube…), relatório para enviar ao anunciante. As ligações dos anúncios levam a marca "benficaindependente" para o anunciante ver as visitas no Google Analytics dele.
- Mensagens: conversas do chat e do formulário da app. Responder aparece na app do adepto com notificação. Estados: nova, respondida, fechada; pode-se apagar.
- Gestores (contacto): as pessoas que o adepto pode escolher no chat e no formulário (nome, função, email, ativo, ordem).
- Programas dos vídeos: corrigir em que programa fica cada vídeo.
- Administradores: donos e administradores (nomes de utilizador do GitHub). Cada novo administrador também tem de ser convidado como colaborador do repositório "benfica-independente-dados" no GitHub (Settings → Collaborators).
- Versões da app: número da versão, notas, ligação para descarregar o APK e se é obrigatória. A app mostra "Há uma versão nova".
- Definições: repositório, ramo, modo de teste. Não mexer sem certeza.
- O "robô" corre no GitHub de 30 em 30 minutos e atualiza agenda, resultados e vídeos sozinho. As alterações demoram uns minutos a aparecer na app.
- Fotos: a plataforma reduz e comprime automaticamente; preferir fotos na horizontal.
`;

const REGRAS_COMUNS = `
REGRAS OBRIGATÓRIAS:
- Escreve sempre em português de Portugal, de forma simples, simpática e curta (normalmente 1 a 4 frases).
- NUNCA fales do Sporting Clube de Portugal nem do Futebol Clube do Porto, nem de nada associado (nomes, alcunhas, abreviaturas, estádios, presidentes, jogadores, jogos contra eles). Se perguntarem, responde só: "${SEM_RIVAIS}" — sem mais nada e sem dizer que passas a mensagem a alguém.
- Não inventes. Se não souberes, diz que não sabes.
- Não dês opiniões polémicas, não insultes ninguém, não fales de política nem de apostas.
- Não peças dados pessoais (morada, número de cartão, palavras-passe).
`;

function regrasAdepto(gestores: { nome: string; funcao: string }[], contexto: string) {
  const g = gestores.length ? gestores.map((x) => `${x.nome}${x.funcao ? " (" + x.funcao + ")" : ""}`).join(", ") : "a equipa do BI";
  return `És o assistente automático do Benfica Independente (BI), um projeto de adeptos do Sport Lisboa e Benfica
(site, podcasts, vídeos no YouTube e esta app). Estás no chat "Falar com o BI" da app.
És uma IA: nunca digas que és uma pessoa. Quem pode responder pessoalmente: ${g}.
Quando a pessoa precisar de algo que só a equipa resolve (parcerias, publicidade, propostas, queixas, entrevistas,
assuntos pessoais), diz que a mensagem fica guardada e que um elemento do BI responde aqui no chat assim que puder.
Não prometas prazos nem decisões em nome do BI.
${REGRAS_COMUNS}
${APP}
DADOS DE HOJE (agenda e resultados do Benfica, para responder a perguntas sobre jogos):
${contexto}`;
}

const REGRAS_GESTOR = `És o assistente de ajuda dos gestores do Benfica Independente (BI). Ajudas a usar a plataforma de gestão e
a perceber a app. Os gestores não são técnicos: explica passo a passo, com os nomes exatos dos botões e ecrãs, em frases curtas.
Também podes ajudar a escrever textos (notícias, avisos, destaques, anúncios, respostas a adeptos) em bom português de Portugal.
Se a dúvida for sobre algo que a plataforma não faz, diz isso claramente e sugere falar com quem montou a app.
${REGRAS_COMUNS}
${PLATAFORMA}
${APP}`;

// ------------------------------------------------------------ dados do dia

async function contextoDoDia(): Promise<string> {
  const ler = async (f: string) => {
    try {
      const r = await fetch(DADOS + f, { signal: AbortSignal.timeout(6000) });
      return r.ok ? await r.json() : [];
    } catch { return []; }
  };
  const [agenda, resultados] = await Promise.all([ler("agenda.json"), ler("results.json")]);
  const agora = Date.now();
  const fmt = new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const prox = (Array.isArray(agenda) ? agenda : [])
    .filter((j: any) => j.t > agora - 3 * 3600_000 && !falaDeRivais(`${j.title} ${j.detail} ${j.loc}`))
    .sort((a: any, b: any) => (a.sport === "Futebol" ? 0 : 1) - (b.sport === "Futebol" ? 0 : 1) || a.t - b.t)
    .slice(0, 15)
    .map((j: any) => `- ${j.sport}: ${j.title} — ${fmt.format(new Date(j.t))}${j.detail ? " — " + j.detail : ""}${j.loc ? " — " + j.loc : ""}`);
  const res = (Array.isArray(resultados) ? resultados : [])
    .filter((r: any) => !falaDeRivais(`${r.h} ${r.a} ${r.v}`))
    .slice(0, 15)
    .map((r: any) => `- ${r.s}: ${r.h} ${r.hg}–${r.ag} ${r.a} (${r.c}, ${r.d})`);
  return `Hoje é ${fmt.format(new Date())}.\nPróximos jogos:\n${prox.join("\n") || "- (sem dados)"}\nÚltimos resultados:\n${res.join("\n") || "- (sem dados)"}`;
}

// ------------------------------------------------------------ Supabase

async function rpc(fn: string, args: unknown) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: CHAVE_PUBLICA, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const t = await r.text();
  const j = t ? JSON.parse(t) : null;
  if (!r.ok) throw new Error((j && j.message) || `Supabase ${r.status}`);
  return j;
}

// ------------------------------------------------------------ Gemini

let modelos: string[] | null = null;
/** O que aconteceu na última pergunta (para os registos; nunca inclui a chave). */
let tentativas: string[] = [];

/** Escolhe sozinho os modelos "flash" mais recentes (os nomes mudam com o tempo). */
async function escolherModelos(): Promise<string[]> {
  if (modelos) return modelos;
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": GEMINI } });
    const lista = ((await r.json()).models ?? []) as any[];
    const nomes = lista
      .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m) => String(m.name).split("/").pop()!)
      .filter((n) => n.includes("flash") && !/lite|image|tts|audio|live|exp|thinking/.test(n))
      .map((n) => ({ n, v: parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) ?? [])[1] ?? "0"), estavel: !n.includes("preview") }))
      .sort((a, b) => b.v - a.v || Number(b.estavel) - Number(a.estavel));
    if (nomes.length) modelos = nomes.slice(0, 4).map((x) => x.n);
  } catch { /* usa o de reserva */ }
  return modelos ?? ["gemini-2.5-flash"];
}

type Turno = { role: "user" | "model"; parts: { text: string }[] };

async function perguntar(sistema: string, turnos: Turno[]): Promise<string | null> {
  tentativas = [];
  for (const modelo of await escolherModelos()) {
    for (const rapido of [true, false]) {
      const config: Record<string, unknown> = { temperature: 0.4, maxOutputTokens: 700 };
      if (rapido) config.thinkingConfig = { thinkingLevel: "low" };
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI },
          body: JSON.stringify({ system_instruction: { parts: [{ text: sistema }] }, contents: turnos, generationConfig: config }),
          signal: AbortSignal.timeout(20_000),
        });
        tentativas.push(`${modelo}${rapido ? "" : "/normal"}: ${r.status}${r.ok ? "" : " " + (await r.clone().text()).slice(0, 160)}`);
        if (r.status === 400 && rapido) continue;           // modelo sem a opção "pensar pouco"
        if (!r.ok) break;                                    // 429 sem pedidos grátis / 503 ocupado: modelo seguinte
        const d = await r.json();
        const texto = (d.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("").trim();
        if (texto) return texto;
        break;
      } catch (e) { tentativas.push(`${modelo}: ${e instanceof Error ? e.name : "erro"}`); break; }
    }
  }
  return null;
}

/** Junta mensagens seguidas do mesmo lado e garante que começa no utilizador. */
function arrumar(turnos: Turno[]): Turno[] {
  const out: Turno[] = [];
  for (const t of turnos) {
    if (!t.parts[0].text.trim()) continue;
    const ult = out[out.length - 1];
    if (ult && ult.role === t.role) ult.parts[0].text += "\n" + t.parts[0].text;
    else out.push({ role: t.role, parts: [{ text: t.parts[0].text }] });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

// ------------------------------------------------------------ pedidos

const resposta = (corpo: unknown, estado = 200) =>
  new Response(JSON.stringify(corpo), { status: estado, headers: { ...CORS, "Content-Type": "application/json" } });

async function adepto(id: string, token: string) {
  const c = await rpc("bi_ia_conversa", { p_id: id, p_token: token });
  if (c.limite) return resposta({ limite: true });
  const msgs = (c.mensagens ?? []) as { autor: string; nome: string; texto: string }[];
  const ultima = [...msgs].reverse().find((m) => m.autor === "adepto")?.texto ?? "";
  let texto: string | null;
  let rival = false;
  if (falaDeRivais(ultima)) {
    texto = SEM_RIVAIS;
    rival = true;
  } else {
    // Mensagens antigas sobre adversários não vão para a IA.
    const turnos = arrumar(msgs.filter((m) => !falaDeRivais(m.texto)).map((m) => ({
      role: m.autor === "adepto" ? "user" : "model",
      parts: [{ text: m.autor === "gestor" ? `[Resposta de ${m.nome || "um gestor"} do BI] ${m.texto}` : m.texto }],
    } as Turno)));
    texto = await perguntar(regrasAdepto(c.gestores ?? [], await contextoDoDia()), turnos);
    if (texto && falaDeRivais(texto)) { texto = SEM_RIVAIS; rival = true; }
  }
  if (!texto) { console.log("sem resposta:", tentativas.join(" | ")); return resposta({ erro: "sem resposta", tentativas }, 503); }
  await rpc("bi_enviar", { p_id: id, p_token: token, p_texto: texto, p_autor: "assistente" });
  return resposta({ texto, rival });
}

async function gestor(gh: string, mensagens: { eu: boolean; texto: string }[]) {
  const g = await rpc("bi_ia_gestor", { p_gh: gh });
  if (g.limite) return resposta({ limite: true });
  const lista = (mensagens ?? []).slice(-16).map((m) => ({ eu: !!m.eu, texto: String(m.texto ?? "").slice(0, 4000) }));
  const ultima = [...lista].reverse().find((m) => m.eu)?.texto ?? "";
  if (falaDeRivais(ultima)) return resposta({ texto: SEM_RIVAIS, rival: true });
  const turnos = arrumar(lista.filter((m) => !falaDeRivais(m.texto))
    .map((m) => ({ role: m.eu ? "user" : "model", parts: [{ text: m.texto }] } as Turno)));
  let texto = await perguntar(REGRAS_GESTOR, turnos);
  if (!texto) { console.log("sem resposta:", tentativas.join(" | ")); return resposta({ erro: "sem resposta", tentativas }, 503); }
  if (falaDeRivais(texto)) texto = SEM_RIVAIS;
  return resposta({ texto });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ erro: "só POST" }, 405);
  if (!GEMINI) return resposta({ erro: "falta a chave GEMINI_API_KEY nos segredos do Supabase" }, 503);
  try {
    const b = await req.json();
    if (b.modo === "adepto" && b.id && b.token) return await adepto(String(b.id), String(b.token));
    if (b.modo === "gestor" && b.gh) return await gestor(String(b.gh), b.mensagens);
    if (b.modo === "diag") {
      // Diagnóstico (sem dados de ninguém): que modelos há e quanto demora uma pergunta mínima.
      const ms = await escolherModelos();
      const t = Date.now();
      const r = await perguntar("Responde só: ok", [{ role: "user", parts: [{ text: "Teste" }] }]);
      return resposta({ modelos: ms, resposta: r, segundos: (Date.now() - t) / 1000, tentativas });
    }
    return resposta({ erro: "pedido inválido" }, 400);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    return resposta({ erro: m === "sem acesso" ? "sem acesso" : m }, m === "sem acesso" || m.includes("não encontrada") ? 403 : 500);
  }
});
