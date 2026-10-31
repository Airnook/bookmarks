# Airnook Bookmarks

[🇬🇧 English](README.md) | [🇷🇺 Русский](README.ru.md) | [🇪🇸 Español](README.es.md) | **🇧🇷 Português (Brasil)** | [🇫🇷 Français](README.fr.md) | [🇩🇪 Deutsch](README.de.md) | [🇨🇳 中文（简体）](README.zh-CN.md) | [🇯🇵 日本語](README.ja.md) | [🇮🇳 हिन्दी](README.hi.md) | [🇸🇦 العربية](README.ar.md)

[![CI](https://github.com/Airnook/bookmarks/actions/workflows/ci.yml/badge.svg)](https://github.com/Airnook/bookmarks/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/Airnook/bookmarks)](https://github.com/Airnook/bookmarks/releases/latest)
[![Chromium 141+](https://img.shields.io/badge/Chromium-141%2B-4285F4?logo=googlechrome&logoColor=white)](https://www.chromium.org/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![10 languages](https://img.shields.io/badge/languages-10-orange)](TRANSLATING.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**Favoritos** é uma extensão para navegadores Chromium (Chrome, Edge, Brave, Arc, Helium e outros): seus favoritos no
painel lateral, ao lado da página, tudo pelo teclado. Encontrar, abrir, organizar em pastas, manter os favoritos como
guias fixadas. Criado na mudança do Arc para um navegador Chromium: fazia falta o painel lateral dele.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/panel-dark.png">
    <img src="docs/panel-light.png" alt="O painel lateral de Favoritos: uma árvore de pastas com dois favoritos marcados" width="360">
  </picture>
</p>

## Sumário

- [Recursos](#recursos)
- [Instalação](#instalação)
- [Primeiros passos](#primeiros-passos)
- [Teclas padrão](#teclas-padrão)
- [Privacidade](#privacidade)
- [Traduções](#traduções)
- [Desenvolvimento](#desenvolvimento)
- [Licença](#licença)

## Recursos

- ⌨️ **Um atalho para o painel**: `Alt+B` (`⌥B` no Mac) abre o painel, traz o foco de volta da página e fecha o painel.
  Pode ser alterado em `chrome://extensions/shortcuts`.
- 📌 **Favoritos como guias fixadas**, como no Arc: um ponto nos favoritos com guia aberta (e um anel em uma pasta
  recolhida com algo aberto dentro). Abrir o favorito de novo muda para a guia dele, `Shift+Enter` devolve a guia ao
  endereço do favorito, `U` salva no favorito o endereço atual. O modo pode ser desativado nas configurações.
- 🔎 **Pesquisa**: `/` ou `⌘F`/`Ctrl+F`, por título, endereço e pasta, com destaque. `Tab` mostra o resultado no lugar
  dele na árvore.
- 🗂️ **Organizar favoritos**: marcações (`Espaço`, `Shift+↑↓`, `⌘A`), mover para uma pasta pelo nome (`M`, pastas
  recentes primeiro; se não existir, ela é criada), mover pela lista (`Alt+↑↓`), nova pasta (`N`), renomear (`R`),
  excluir (`D`), copiar endereços (`C`).
- ↩️ **Desfazer e refazer** (novidade da 2.6): `⌘Z` / `⌘⇧Z` no Mac, `Ctrl+Z` e `Ctrl+Shift+Z` ou `Ctrl+Y` nos demais
  sistemas, ou o botão “Desfazer” na mensagem. Uma pasta excluída volta com o conteúdo. O histórico guarda 50 passos e
  é compartilhado por todas as janelas até o navegador ser fechado.
- 🖱️ **Arrastar e soltar** (novidade da 2.6): arraste com o mouse favoritos, pastas e itens marcados para cima, para
  baixo ou para dentro de uma pasta. A pasta se abre quando você mantém um item sobre ela, e a lista rola perto da borda.
- 📋 **Menu do botão direito** (novidade da 2.6), como o menu de favoritos do navegador: abrir em nova guia, nova
  janela, visualização dividida ou janela anônima; editar; recortar, copiar e colar; excluir; adicionar página ou pasta;
  abrir o gerenciador de favoritos. Pelo teclado: `Shift+F10`.
- 📂 **Abrir como conjunto**: favoritos marcados ou uma pasta inteira, como grupo de guias com nome ou como guias
  comuns. Guias já abertas não são duplicadas.
- 🎛️ **Paleta de comandos**: `⌘K`/`Ctrl+K` ou `?` — todos os comandos com suas teclas.
- 🔧 **Suas próprias teclas**: qualquer comando pode ser reatribuído nas configurações. Há o conjunto Vim, sequências
  (`G G`) e toques duplos. As teclas são reconhecidas pela posição, então funcionam em qualquer layout de teclado.
- 👁️ **Visualização**: `V` alterna entre normal, com o endereço abaixo do título e compacta.
- ⚙️ **Configurações**: pasta inicial, abrir favoritos em uma nova guia, favoritos como guias fixadas, fechar o painel
  quando o foco for para a página.
- 🌍 **10 idiomas** com suporte à escrita da direita para a esquerda; a ajuda embutida (`i`) descreve todos os fluxos.

## Instalação

**Pelo GitHub Release**

1. Baixe `airnook-bookmarks-<versão>.zip` da [versão mais recente](https://github.com/Airnook/bookmarks/releases/latest).
2. Descompacte o arquivo em uma pasta permanente: o navegador lê a extensão de lá.
3. Abra `chrome://extensions` e ative o “Modo do desenvolvedor”.
4. Clique em “Carregar sem compactação” e escolha a pasta com `manifest.json`.
5. Para atualizar, substitua os arquivos na mesma pasta e clique em “Recarregar” no cartão da extensão.

**Chrome Web Store**: em breve.

É necessário o Chromium 141 ou mais recente.

## Primeiros passos

1. `Alt+B` — abrir o painel. Pressione de novo para fechar; se o foco foi para a página, o mesmo atalho o traz de volta
   ao painel. O ícone da extensão também abre o painel — fixe-o no menu de extensões do navegador.
2. `↑` `↓` — mover pela lista, `→` `←` — expandir e recolher uma pasta, `Enter` — abrir.
3. `/` — pesquisa: comece a digitar um título, site ou pasta.
4. `Espaço` — marcar vários favoritos, `M` — movê-los para uma pasta pelo nome.
5. `⌘K`/`Ctrl+K` — paleta de comandos: todos os comandos com suas teclas.
6. Clique com o botão direito em um favorito, uma pasta ou um espaço vazio para um menu como o do navegador;
   `Shift+F10` — o mesmo pelo teclado.
7. `i` — ajuda. Novos favoritos são adicionados do jeito usual do navegador — `⌘D`/`Ctrl+D`.

## Teclas padrão

`⌘` é `Ctrl` no Windows e no Linux. Qualquer tecla pode ser alterada nas configurações.

| Ação | Teclas |
| --- | --- |
| Mover pela lista / expandir, recolher pasta | `↑` `↓` / `→` `←`, `Home` `End` |
| Abrir / abrir em outra guia | `Enter` / `⌘Enter` |
| Devolver a guia ao endereço do favorito | `Shift+Enter` |
| Pesquisar favoritos | `/`, `⌘F` |
| Paleta de comandos | `⌘K`, `?` |
| Abrir menu | `Shift+F10` |
| Marcar / em sequência / marcar tudo na pasta | `Espaço` / `Shift+↑↓` / `⌘A` |
| Mover para a pasta… / mover para cima, para baixo | `M` / `Alt+↑↓` |
| Nova pasta, renomear, excluir | `N`, `R` (`F2`), `D` |
| Copiar endereço / salvar o endereço da guia | `C` / `U` |
| Recortar, copiar, colar | `⌘X`, `⌘C`, `⌘V` |
| Desfazer / refazer | `⌘Z` / `⌘⇧Z`, `⌘Y` |
| Fechar a guia do favorito | `⌫`, `Delete` |
| Alterar visualização / ajuda / configurações | `V` / `i` (`F1`) / `,` |
| Cancelar ou fechar: limpar marcações, sair da pesquisa, fechar o painel | `Esc` |

## Privacidade

A extensão funciona só localmente e não envia nada pela rede: nem seus favoritos nem seu histórico saem do navegador.
As configurações ficam no armazenamento local da extensão no navegador. As permissões servem para favoritos, painel
lateral, ícones de sites, guias e grupos de guias (modo de guias fixadas e abertura de conjuntos) e para salvar as
configurações.

## Traduções

A interface e a ajuda seguem o idioma do navegador: English, Русский, Español, Português (Brasil), Français, Deutsch,
中文（简体）, 日本語, हिन्दी, العربية. Para outros idiomas, é usado o inglês.

Quer adicionar seu idioma ou corrigir uma tradução? Veja [TRANSLATING.md](TRANSLATING.md) (em inglês) ou abra uma
[issue “Translation”](https://github.com/Airnook/bookmarks/issues/new?template=translation.yml).

## Desenvolvimento

JavaScript puro (Manifest V3) sem etapa de build: o navegador carrega os arquivos da raiz do repositório como estão.

```sh
npm ci
npm run lint
npm test
npm run test:browser   # teste de fumaça no Chromium: npx playwright install chromium
npm run package        # dist/airnook-bookmarks-<versão>.zip
```

A arquitetura, os testes e o processo de lançamento estão descritos em [CONTRIBUTING.md](CONTRIBUTING.md).

## Licença

[MIT](LICENSE) © 2026 Airnook
