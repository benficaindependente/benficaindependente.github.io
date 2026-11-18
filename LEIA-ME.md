# Benfica Independente — o que mudou (17/11/2026)

Trabalho começado no TRAE e terminado/corrigido no Claude. A pasta `TRAE` ficou intacta, só como registo.
Antes de juntar tudo, o projeto anterior foi guardado em `Backups/BenficaIndependente_antes_TRAE_2026-11-17_2252.zip`.

## App Android (pasta `BenficaIndependente`)

Feito pelo TRAE e verificado:
- **Podcasts:** abrem o vídeo do YouTube correspondente. Os episódios sem vídeo ficam escondidos e a visualização conta.
- **Barra Patreon / publicidade:** por cima do menu, em todos os ecrãs, alterna de 5 em 5 segundos. O ecrã do Patreon abre ao tocar.
- **Contacto e chat:**
  - O formulário de contacto deixa escolher os gestores e abre o email já preenchido.
  - O mini chat responde automaticamente e pergunta "com quem gostava de falar?".
- **Notificações:** horário de silêncio e opção de esconder o texto no ecrã bloqueado.
- **Vídeos:** barra de avanço e retoma no ponto onde se parou, mesmo depois de fechar a app.
- **Aviso dos anúncios do YouTube:** um cartão explicativo, mostrado só uma vez. Não há salto automático de anúncios.
- **Android Auto:** a pasta "Vídeos" aparece primeiro e tem o Direto à frente.
- **Jogos:** a pílula "Classificação" saiu deste ecrã e continua no separador Benfica.

Corrigido / acabado agora:
- Dois erros que impediam a compilação: barra de avanço no carro e botão das publicações.
- A barra de avanço já não aparece no direto. Na lista de vídeos só aparece no vídeo que está a tocar.
- **A app passou a ler o que se publica na plataforma:**
  - destaque no Início (substitui o "Quem somos" entre datas);
  - anúncios pagos na barra, com logótipo e frequência;
  - publicações nos separadores Início, Artigos, Podcasts, Vídeos, Benfica e Agenda;
  - notícias do BI no topo de Artigos;
  - avisos, que chegam como notificação e como cartão no Início;
  - cartão "Há uma versão nova".
- **Cartão do Patreon no Início.**
- **Novo tipo de alerta "Avisos do Benfica Independente"** em Alertas e toques.

Ainda por preencher (conteúdo, não código):
- Emails próprios de cada gestor em `ui/screens/ContactScreens.kt` → `Managers`. Hoje vão todos para o email geral.
- Imagem do anúncio do Patreon em `AdsConfig.PATREON_IMAGE_URL`.

## Plataforma de gestão (pasta `Plataforma`)

HTML/JS simples, sem servidor. Instala-se no telemóvel como app ("Adicionar ao ecrã principal").
Grava no GitHub, no repositório `benfica-independente-dados`, que é o mesmo que a app lê.

Corrigido em relação à versão do TRAE:
- **Entrada:** era um email escrito à mão, que qualquer pessoa podia inventar. Passou a ser a conta GitHub verdadeira de cada pessoa.
- **Duas aprovações para tudo:** notícias, destaques, anúncios, publicações e avisos. Isto vale para criar, alterar e apagar.
  - O botão "Publicar" que saltava a aprovação foi tirado.
  - Uma alteração a algo já publicado não mexe na app até ser aprovada.
- **Dados privados fora do repositório público:** os contactos e valores dos anunciantes, as notas internas e a monetização passam para um repositório privado à parte, `benfica-independente-gestao`. Esse repositório tem de ser criado no GitHub.
- **Ecrã de Chat retirado:** a app não consegue escrever no GitHub sem um servidor, por isso nunca chegaria lá nenhuma mensagem. O chat da app continua a funcionar por email.
- **Ecrãs da app possíveis para publicações:** agora correspondem aos da app. Antes havia "Loja", "Sócios", etc., que não existem.
- **Painel com alertas:**
  - o robô sem atualizar há mais de 12 horas;
  - execuções do robô falhadas no GitHub Actions;
  - o agente de IA inativo;
  - menos de 2 administradores.
- **Gravações em conflito:** quando duas pessoas gravam ao mesmo tempo, já não se apaga o trabalho de ninguém.
- **Instalação:** passa a apanhar logo as versões novas da plataforma. Antes ficava presa na versão antiga.
- **Robô:** já não falha quando a plataforma grava ao mesmo tempo que ele.

## O que ainda não existe
- **Agente de IA no chat da app.** Precisa de um pequeno servidor para não pôr a chave do Gemini dentro da app.
- **Versão iPhone / App Store.** Precisa de Mac, conta Apple Developer e reescrever a app.
- **Responder ao chat a partir da plataforma.** Precisa de servidor.
