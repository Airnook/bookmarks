# Traduzir o Bookmarks

[🇬🇧 English](../../.github/TRANSLATING.md) | [🇷🇺 Русский](../ru/TRANSLATING.md) | [🇪🇸 Español](../es/TRANSLATING.md) | **🇧🇷 Português (Brasil)** | [🇫🇷 Français](../fr/TRANSLATING.md) | [🇩🇪 Deutsch](../de/TRANSLATING.md) | [🇨🇳 中文（简体）](../zh-CN/TRANSLATING.md) | [🇯🇵 日本語](../ja/TRANSLATING.md) | [🇮🇳 हिन्दी](../hi/TRANSLATING.md) | [🇸🇦 العربية](../ar/TRANSLATING.md)

Os textos da interface ficam em `_locales/<code>/messages.json` (o formato padrão `chrome.i18n` do Chrome).
Este guia trata apenas desse arquivo. O Chrome escolhe a pasta que corresponde ao idioma do navegador;
se não houver nenhuma, usa o texto em inglês (`_locales/en`).

## Adicionar um novo idioma

1. Escolha um código na [lista de localidades do Chrome](https://developer.chrome.com/docs/extensions/reference/api/i18n#locales).
   O Chrome ignora códigos que não suporta. Use sublinhado no nome da pasta: `pt_BR`, `zh_CN`, `es_419`.
2. Copie `_locales/en/messages.json` para `_locales/<code>/messages.json`.
3. Defina `locale` com o mesmo código, mas com hífen: `pt-BR`, `zh-CN`, `es-419`.
4. Defina `dir` como `ltr` ou `rtl`.
5. Traduza cada `message` e execute as verificações abaixo.

Não é preciso alterar código: os testes encontram sozinhos todas as pastas em `_locales/`.

## Chaves e campos

- **Nunca altere uma chave** (o nome antes de `"message"`). O código usa esses nomes.
- **`message`** — o texto que você traduz.
- **`description`** — contexto para tradutores, por exemplo onde o texto aparece. Não é exibido na extensão.
  Em `en`, toda mensagem com `placeholders` precisa de uma, inclusive cada forma de plural (`_one`, `_other`…): diga onde o texto aparece e o que é cada `$NAME$`.
  O `npm test` verifica isso. Os outros idiomas podem omiti-la.
- **`locale`** — o código de idioma do arquivo. Dele vêm as formas de plural e o `lang` da página.
- **`dir`** — `ltr` (da esquerda para a direita) ou `rtl` (da direita para a esquerda, por exemplo árabe, hebraico, persa, urdu).
  As páginas tiram a direção daqui.

## Marcadores

`$NAME$` em um `message` é substituído pelo valor do marcador com esse nome.
Mantenha o nome e os sinais `$` e coloque o marcador onde o seu idioma precisar:

```json
"more_results": {
  "message": "$COUNT$ more — refine the search",
  "placeholders": {
    "count": { "content": "$1" }
  }
}
```

- Use os mesmos nomes de marcador que em `en`. `content` continua `$1`, `$2`… como em `en`.
- Não traduza o texto dentro de `$…$`.
- Escreva `$$` para um cifrão literal.

## Formas de plural

Uma mensagem com número tem uma chave por categoria de plural do CLDR: `<key>_one`, `<key>_few`, `<key>_many`, `<key>_other`.
Use as categorias do seu idioma, e todas: as [regras de plural do CLDR](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html)
as listam (o inglês tem `one` e `other`; o russo tem `one`, `few`, `many`, `other`).
O `npm test` falha se faltar uma categoria e nomeia as chaves ausentes. `_other` é obrigatória.
Não deixe uma chave simples (`bookmarks`) ao lado das formas.

```json
"bookmarks_one": {
  "message": "$COUNT$ bookmark",
  "placeholders": { "count": { "content": "$1" } }
},
"bookmarks_other": {
  "message": "$COUNT$ bookmarks",
  "placeholders": { "count": { "content": "$1" } }
}
```

O russo (`ru`) para a mesma chave usa `bookmarks_one` («$COUNT$ закладка»), `_few` («$COUNT$ закладки»),
`_many` («$COUNT$ закладок»), `_other` («$COUNT$ закладки»).

## Palavras da paleta de comandos (`cmd_*_words`)

Cada comando tem `cmd_<id>` (seu nome), opcionalmente `cmd_<id>_note` (uma segunda linha) e `cmd_<id>_words`:
palavras extras para buscar na paleta, no seu idioma, separadas por espaços.
As palavras de busca em inglês sempre são usadas também, por isso `cmd_*_words` em `en` ficam vazias.
Chaves com valores vazios são permitidas, mas todas precisam existir.

```json
"cmd_search_words": {
  "message": "найти фильтр",
  "description": "Extra words to find the command in the palette, in your language; the English words always work"
}
```

## Verificar localmente

Requer Node.js 20.19+, 22.13+ ou 24+ (o CI usa 22).

```sh
npm ci            # install dependencies
npm test          # checks every language in _locales/
npm run lint
npm run package   # builds dist/*.zip; _locales/ is included
```

O `npm test` verifica, para cada idioma:

- as mesmas chaves que `en` (nenhuma faltando e nenhuma sobrando; formas de plural contam como uma chave);
- `locale` e `dir` estão definidos, e `locale` corresponde ao nome da pasta;
- formas de plural: cada categoria do idioma está presente, nenhuma outra, e `_other` existe;
- os marcadores coincidem com `en`, e cada `content` é `$1`…`$9`;
- `en` tem `description` para toda mensagem com marcadores;
- toda chave que o código usa existe em `en`.

Para ver a interface no seu idioma, carregue a extensão descompactada em um navegador nesse idioma:

1. Defina o idioma da interface do navegador para o seu (Chrome: Configurações → Idiomas; reinicie o navegador).
2. Abra `chrome://extensions`, ative o «Modo do desenvolvedor» («Developer mode»), clique em «Carregar sem compactação» («Load unpacked») e escolha a raiz do repositório.
3. Abra o painel lateral e confira os textos, as formas de plural e, para `rtl`, o layout.

O `npm run test:browser` (requer `npx playwright install chromium`) abre as páginas de ajuda, opções e painel lateral em um navegador real,
uma vez para cada pasta de idioma em `_locales/`, uma vez para hebraico (sem tradução, portanto texto em inglês) e uma vez para um hebraico fictício da direita para a esquerda.
Verifique apenas o seu idioma enquanto trabalha: `SMOKE_LOCALES=pt_BR npm run test:browser` (nomes separados por vírgulas: nomes de pastas, `he`, `he-rtl`).

## Atualizar uma tradução existente

Quando `en` ganha chaves novas ou muda, o `npm test` falha e lista as chaves ausentes em cada idioma.
Adicione-as, traduza-as e execute `npm test` de novo. Remova as chaves que não existem mais em `en`.

## Abrir um pull request

1. Crie um branch a partir de `dev` e faça commit de `_locales/<code>/messages.json`.
2. Execute as verificações acima.
3. Abra um pull request para `dev` (`gh pr create --base dev`, ou no GitHub).
   Na descrição, diga qual é o idioma e se é novo ou uma correção.
   Dúvidas e problemas: abra uma issue com o formulário **Translation**.
