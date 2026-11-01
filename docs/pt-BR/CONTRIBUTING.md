# Contribuindo

[🇬🇧 English](../../.github/CONTRIBUTING.md) | [🇷🇺 Русский](../ru/CONTRIBUTING.md) | [🇪🇸 Español](../es/CONTRIBUTING.md) | **🇧🇷 Português (Brasil)** | [🇫🇷 Français](../fr/CONTRIBUTING.md) | [🇩🇪 Deutsch](../de/CONTRIBUTING.md) | [🇨🇳 中文（简体）](../zh-CN/CONTRIBUTING.md) | [🇯🇵 日本語](../ja/CONTRIBUTING.md) | [🇮🇳 हिन्दी](../hi/CONTRIBUTING.md) | [🇸🇦 العربية](../ar/CONTRIBUTING.md)

A extensão é JavaScript puro (Manifest V3) sem etapa de build: o navegador carrega como estão os arquivos da raiz do
repositório. As páginas (`panel.html`, `options.html`, `help.html`) carregam módulos ES (`<script type="module">`) com
imports explícitos; o que elas compartilham fica em `commands.js`. O script em segundo plano `background.js` é um
service worker comum, não um módulo. O código do painel é dividido em módulos em `panel/`; a inicialização e a ordem das
assinaturas de eventos estão em `panel/main.js`, e o estado mutável compartilhado em `panel/state.js`. O texto da
interface fica em `_locales/<idioma>/messages.json` (`chrome.i18n` padrão) e é exibido por `i18n.js` (`t`, plurais,
direção da página). As ferramentas de desenvolvimento (`package.json`, `eslint.config.js`, `test/`, `scripts/`) não
fazem parte do release. Na raiz ficam também o tema (`theme.js`, compartilhado pelo painel e pelas configurações) e o formato dos arquivos de configurações (`settings-file.js`: envelope e cadeia de migrações por `format`, para importar e exportar atalhos e tema).

### Módulos do painel

Os módulos de `panel/` importam uns aos outros apenas de cima para baixo, sem ciclos — o `test/panel-imports.test.js`
verifica isso (e imprime o caminho do ciclo, se houver). As camadas, de baixo para cima:

1. sem dependências do painel: `demo`, `util`, `dom`, `url`, `search`, `place` (onde um item movido vai parar), depois `state`,
   `nodes`, `history` (histórico de edições para desfazer e refazer: toda alteração de favoritos feita pelo painel passa
   pelo seu `begin()`);
2. `ui` (diálogo de confirmação, mensagens, foco), `keymap` (dicas de teclas), `tree` (leitura da árvore, cache de nós);
3. `search-index` (índice de busca), `tabs`, `marks`, `undo-buttons` (botões Desfazer e Refazer no cabeçalho);
4. `render`, depois `find` (entrar e sair da busca), `open`, `edit`, `palette` (escolha em uma lista);
5. `move-to`, `link`, `search-input`;
6. `actions` (o que cada comando faz);
7. `keys`, `mouse`, `drag` (arrastar e soltar com o mouse), depois `main`.

`demo` não depende de outros módulos do painel, mas deve ser a primeira importação de `main.js`: no modo demo (`panel.html?demo`, a prévia do tema nas configurações) ele substitui `chrome` por dados fixos na memória antes que qualquer outro módulo o leia.

Um módulo importa apenas de camadas inferiores. Quando um módulo inferior precisa chamar um superior, ele não o importa,
mas recebe a chamada de fora: `tree` chama `onTreeApplied(callback)` após cada leitura da árvore (`main.js` define o
redesenho), e `openPalette(run)` executa o comando escolhido por meio do `run` que recebe. O estado necessário a várias
camadas fica em `state` (por exemplo, `state.pending` — uma sequência de teclas em andamento: `keys` a conduz, e
`palette` também a cancela). Não há barramento de eventos: um callback é definido explicitamente, em um só lugar, na
inicialização. `main.js` define a ordem das assinaturas de eventos, e ela importa quando vários handlers escutam o mesmo
evento.

## Desenvolvimento

É necessário Node.js 20.19+, 22.13+ ou 24+ (um requisito do ESLint 10).

```sh
npm ci            # install dependencies
npm run lint      # ESLint
npm test          # tests (node --test)
npm run package   # build dist/airnook-bookmarks-<version>.zip and check the archive
npm run test:browser  # smoke test in Chromium (needs npx playwright install chromium)
```

Para executar a extensão: `chrome://extensions` → «Modo do desenvolvedor» → «Carregar sem compactação» → a raiz do repositório.

### Linter

As páginas são módulos ES: tudo o que um arquivo pega de outro (`COMMANDS`, `chordOf` de `commands.js` etc.) ele importa
explicitamente; caso contrário, o linter relata um nome desconhecido. O linter não permite um `catch {}` vazio:
escreva dentro dele por que o erro pode ser ignorado.

### Testes

Os testes importam diretamente módulos sem DOM (`commands.js`, funções puras do painel em `panel/`). O `background.js`
não é um módulo, então os testes o carregam por `node:vm` com um stub de `chrome` (veja `test/load.js`); a página de
opções também é carregada por `node:vm` com stubs do DOM (veja `test/options-page.js`).

O `npm run test:browser` gera o arquivo, carrega a extensão no Chromium do Playwright e verifica as páginas e as
principais teclas do painel: uma execução para cada idioma em `_locales/`, mais hebraico sem tradução e um hebraico
fictício da direita para a esquerda. Apenas alguns idiomas: `SMOKE_LOCALES=ru,en npm run test:browser` (os nomes são
pastas de `_locales`, `he`, `he-rtl`). Ele não faz parte do `npm test` nem do CI: lá pode não haver navegador.

### Empacotamento

O conteúdo do arquivo é um fecho de referências: `manifest.json` → tudo o que ele referencia (service worker, páginas,
ícones) → para cada página html seus `<script src>`, `<link href>` e `<img src>`, para cada script seus `import`
estáticos e `export … from` → recursivamente. Mais a pasta `_locales/`, se existir, e as páginas de `EXTRA_PAGES` em
`scripts/package.mjs`: o código as abre pelo nome (por exemplo, `help.html`), então as referências não as encontram.
Nada além disso, incluindo quaisquer novos arquivos auxiliares na raiz, entra no arquivo.

Se um `.js` da extensão passar a referenciar uma nova página html que não está no arquivo, o build falha com a sugestão
de adicioná-la a `EXTRA_PAGES`. Depois do build, uma verificação separada garante que o arquivo não tenha
`package.json`, configurações do linter, `test/`, `scripts/`, `.github/`, `README*.md`, `docs/` (imagens do README),
`LICENSE`, `TODO.md`, `CONTRIBUTING*.md` nem arquivos ocultos, e que todas as referências estejam no lugar; em caso de
erro, o comando termina com código diferente de zero.

O CI (`.github/workflows/ci.yml`) faz o mesmo em cada push e pull request para `main`.

## Traduções

A tradução da interface fica em `_locales/<idioma>/messages.json`. Como adicionar um idioma ou corrigir uma tradução, e
o que o `npm test` verifica, está em [TRANSLATING.md](TRANSLATING.md). Uma nova pasta em `_locales/` é detectada
automaticamente; não é preciso alterar código.

## Publicando uma versão

1. Aumente `version` em `manifest.json` e faça o merge da alteração em `main`.
2. Em `main`, crie a tag `vX.Y.Z`, em que `X.Y.Z` é exatamente a versão de `manifest.json`:

   ```sh
   git checkout main && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

3. O workflow `release.yml` verifica se a tag corresponde à versão, executa lint e testes, gera o arquivo e publica um
   GitHub Release com `airnook-bookmarks-X.Y.Z.zip`.

Se a tag e a versão não corresponderem, o workflow falha antes do build: exclua a tag
(`git push --delete origin vX.Y.Z`), corrija a versão e tente de novo.
