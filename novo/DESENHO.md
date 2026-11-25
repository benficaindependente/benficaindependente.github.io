# Plataforma nova (página separada) — desenho

Estado: em construção. A plataforma atual (`/`) continua a funcionar sem alterações até esta estar completa e testada.
Esta fica em `/novo/` (https://benficaindependente.github.io/novo/).

## Intenção
Quem vai usar a plataforma percebe pouco de informática e vai usá-la **durante os diretos**. Tem de ser óbvia, com palavras
simples, poucos botões à vista e um aspeto profissional, à altura da app. A parte técnica e os agendamentos ficam separados.

## Objetivos
1. Uma área **Direto** feita para quem está a fazer o programa: tudo o que se usa no direto numa só página.
2. Menu em 4 áreas: **Direto · Conteúdos · Agendado · Gestão**.
3. Aspeto profissional: letra Inter, ícones desenhados (SVG), botões limpos, mais espaço, o vermelho só como destaque.
4. **Quadro tático** com melhor aspeto e mais funcionalidades.
5. **Nada se perde**: cada ecrã e função da plataforma atual tem de existir na nova (ver inventário).

## Não-objetivos
- Mudar o que a app Android faz, ou o formato dos dados no GitHub/Supabase: a plataforma nova lê e grava **exatamente os mesmos
  ficheiros e funções**. As duas podem ser usadas ao mesmo tempo sem se estragarem.
- Mudar o login (a sessão é partilhada: quem está dentro da atual, já está dentro da nova).

## Decisões minhas (a rever se quiseres)
- **A lógica que funciona é copiada, não reescrita** (acesso ao GitHub, Supabase, login, formulários, fotos, aprovações). É aí que
  se perdem pormenores. O que é refeito de raiz é a **interface**: estrutura, menu, aspeto e os ecrãs, um a um.
- Mesma origem que a plataforma atual: partilha a sessão e as definições; o service worker da nova tem o seu próprio âmbito.
- Tema escuro por defeito (os diretos são à noite), com vermelho do Benfica só em ações principais e alertas.
- Letra **Inter**, guardada dentro da página (funciona sem internet).
- Telemóvel: barra de 4 separadores em baixo; computador: barra lateral. Aprovações pendentes num aviso no topo.

## Estrutura
```
🔴 Direto      Painel do direto · Quadro tático · Sondagens e MVP · Perguntas e prognósticos · Mensagens · Enviar aviso
✍  Conteúdos   Notícias · Destaques · Fotos e textos · Anúncios · Programas na app
📅 Agendado    O que vai sair e quando (avisos, sondagens, quiz, destaques) · Agendar um aviso
⚙  Gestão     Aprovações e alertas · Estatísticas · Monetização · Administradores · Versões · Atividade · Gestores · Definições · Ajuda IA
```

## Inventário — o que a plataforma atual faz (tudo tem de existir na nova)
Ecrãs: O que queres fazer? · Painel e alertas (aprovações) · Notícias · Destaques · Anúncios · Fotos e textos (publicações) ·
Avisos (notificações) · Mensagens (chat/contacto) · Ajuda (IA) · Sondagens e Homem do jogo (criar, com fotos, aprovar, fechar,
apagar, pré-visualizar; **terminar votação MVP**) · Quadro tático (editor, jogos/onzes ESPN, linha do tempo, ecrã inteiro, pôr na
app) · Participação dos adeptos (prognósticos, onzes, perguntas ao programa, quiz) · Estatísticas da app · Registo de atividade ·
Gestores (contacto) · Programas na app · Monetização (anúncios, receitas, relatórios) · Administradores (GitHub + email, dono) ·
Versões da app · Definições.
Mecanismos: entrada (Google, email e palavra-passe, primeiro acesso, recuperar, chave GitHub, modo de teste) · aprovação por 2
administradores (hoje 1 em testes: `APROVACOES`) · fotos reduzidas e carregadas · pré-visualização no telemóvel · modelos prontos ·
alertas do robô · atividade · PWA instalável e funcionar sem rede.

## Fases
1. **Base:** estilos novos, estrutura (4 áreas), login, aviso de aprovações, Direto (painel) — os ecrãs antigos já aparecem dentro,
   com o aspeto novo. ← começa aqui
2. **Quadro tático** novo (aspeto e funções).
3. **Direto completo:** sondagens/MVP, perguntas e prognósticos redesenhados para o direto, mensagens.
4. **Conteúdos e Agendado:** formulários simplificados, vista única de agendamentos.
5. **Gestão:** restantes ecrãs.
6. Revisão completa contra o inventário, teste no telemóvel e só então troca (a atual passa a `/antiga/`).

## Quadro tático — melhorias previstas (fase 2)
Aspeto: relvado com riscas e luz, jogadores como discos com foto e número, nomes legíveis, setas curvas e a tracejado, animações suaves.
Funções: formações em 1 toque para as duas equipas; ferramentas (seta, corrida a tracejado, zona, texto, bola); desfazer/refazer;
**momentos** guardados (ex.: "Golo 1", "Canto") para mostrar em sequência; modelos de bolas paradas; pré-visualização do telemóvel
e um botão grande "Pôr na app". Mantém o que já existe (onzes do ESPN, linha do tempo, ecrã inteiro).

## Fica para o construtor
Ícones exatos, textos de ajuda de cada ecrã, tamanhos e espaçamentos, ordem dos atalhos do Direto.
