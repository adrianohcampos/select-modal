# select-modal

Transforma um `<select>` comum em um seletor com busca que abre em um `<dialog>` nativo.

- **Sem dependências** — não precisa de jQuery nem de Bootstrap.
- **`<dialog>` nativo** — foco preso, <kbd>Esc</kbd>, backdrop e empilhamento sobre outros modais por conta do navegador.
- **Progressivo** — o `<select>` original continua no DOM: formulários, `required`, `FormData` e `change` funcionam como sempre.
- **Busca de verdade** — ignora acentos, aceita várias palavras, destaca o termo e ordena por relevância.
- **Escala** — listas com dezenas de milhares de opções (renderização progressiva) ou dados remotos (`source`).
- **Modal ou dropdown** — modal por padrão, lista ancorada ao campo com `data-mode="dropdown"`, "bottom sheet" no celular.
- **CSS encapsulado** — tudo sob `.select-modal-*`, tematizável por variáveis `--sm-*`, com tema claro/escuro.
- **Tema Bootstrap opcional** — `select-modal-bootstrap.css` herda as cores e métricas do Bootstrap 5.3.
- **Para o desenvolvedor** — tipos TypeScript, build ESM/minificado, eventos canceláveis, idiomas e testes.

Abra o [index.html](index.html) no navegador para ver todos os exemplos (é também a página publicada no GitHub Pages).

## Instalação

Copie dois arquivos para o seu projeto e inclua-os na página:

```html
<link rel="stylesheet" href="select-modal.css">
<script src="select-modal.js" defer></script>
```

Marque o select com a classe `select-modal` (ou o atributo `data-select-modal`):

```html
<label for="estado">Estado</label>
<select id="estado" name="estado" class="select-modal" title="Selecione um estado">
    <option value=""></option>
    <option value="SP">São Paulo</option>
    <option value="RJ">Rio de Janeiro</option>
</select>
```

Pronto. Não há passo de inicialização: todo `select.select-modal` presente na página é ativado no carregamento.

Em produção, prefira os arquivos minificados da pasta `dist/` (`select-modal.min.js` e `select-modal.min.css`).

### Com Bootstrap 5.3+

Acrescente o tema **depois** do Bootstrap e do CSS base. O JavaScript do Bootstrap não é necessário.

```html
<link rel="stylesheet" href="bootstrap.min.css">
<link rel="stylesheet" href="select-modal.css">
<link rel="stylesheet" href="select-modal-bootstrap.css">
```

O tema usa as variáveis `--bs-*`, então acompanha `data-bs-theme="dark"` e temas customizados. Ele também cobre `.input-group`, `form-select-sm`/`-lg`, `.is-invalid`/`.is-valid`, `.was-validated` e `.invalid-feedback`. Classes de espaçamento e grid do select (`mb-3`, `w-50`, `col-md-6`…) são movidas para o wrapper automaticamente.

### Com bundler ou ES modules

```js
import SelectModal from './dist/select-modal.esm.js';
import './select-modal.css';
```

Instalado como pacote (npm, git ou pasta local), basta `import SelectModal from 'select-modal'` — o `package.json` já aponta para o build ESM, para o CommonJS (`require('select-modal')`) e para os tipos TypeScript (`select-modal.d.ts`).

### Conteúdo dinâmico (AJAX, SPA)

```js
SelectModal.init(container);  // inicializa os selects dentro de um elemento
SelectModal.observe();        // ou: chame uma vez — selects novos são inicializados e os removidos, destruídos
```

## Recursos

| Recurso | Como usar |
| --- | --- |
| Placeholder | Uma `<option value="">` vazia + atributo `title` no select. |
| Seleção múltipla | Atributo `multiple`. O dialog ganha caixas de seleção, contador, **Limpar** e **Concluir**. Clicar no contador mostra só os selecionados. |
| Selecionar todos | `data-select-all` (múltiplo). Seleciona o que está filtrado. |
| Limite de seleções | `data-max-selections="5"` (múltiplo). |
| Grupos | `<optgroup label="…">`. O nome do grupo também entra na busca. |
| Texto secundário | `<option data-subtext="…">`. Também entra na busca. |
| Imagem / ícone | `<option data-image="avatar.png">` ou `<option data-icon="bi bi-person">` (classes da sua biblioteca de ícones). |
| Conteúdo personalizado | Opção `renderOption` — veja [abaixo](#conteúdo-personalizado). |
| Modo dropdown | `data-mode="dropdown"` — veja [abaixo](#modo-dropdown). |
| Dados remotos | Opção `source` / `data-source="/api?q={query}"` — veja [abaixo](#dados-remotos). |
| Criar digitando | `data-allow-create` — veja [abaixo](#criar-opção-digitando). |
| Botão de ação ("+ Novo") | `<option value="add" data-select-modal-action>+ Novo</option>` — veja [Ações](#ações). |
| Permitir limpar (seleção única) | `data-allow-clear` (ignorado se o select for `required`). |
| Opção desabilitada | `disabled` na `<option>`, no `<optgroup>`, no select ou em um `<fieldset>`. |
| Tamanho | `data-size="sm"` ou `data-size="lg"` (ou `form-select-sm` / `form-select-lg`). |
| Validação | `required` no select. Ao enviar o formulário inválido o campo é marcado, a mensagem do navegador aparece abaixo dele e o dialog abre. |

### Teclado

| Onde | Tecla | Ação |
| --- | --- | --- |
| Campo | <kbd>Enter</kbd> <kbd>Espaço</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Abre |
| Campo | qualquer letra | Abre já com a busca preenchida |
| Lista | <kbd>↑</kbd> <kbd>↓</kbd> <kbd>PageUp</kbd> <kbd>PageDown</kbd> | Move o item ativo |
| Lista | <kbd>Enter</kbd> | Seleciona o item ativo (ou alterna, se múltiplo) |
| Lista | <kbd>Home</kbd> / <kbd>End</kbd> | Primeiro / último item (com o foco fora da busca) |
| Lista | <kbd>Esc</kbd> | Fecha |

No celular, arrastar o cabeçalho para baixo também fecha.

### Modo dropdown

```html
<select class="select-modal" data-mode="dropdown">…</select>
```

No desktop a lista abre ancorada ao campo (acima ou abaixo, conforme o espaço). Em telas com até 576px de largura o modo modal ("bottom sheet") é usado automaticamente. Todos os outros recursos funcionam igual.

### Dados remotos

Com `source` as opções vêm de uma função (ou URL) a cada busca, em vez das `<option>`s do select:

```js
SelectModal.get('#cliente', {
    minQueryLength: 2,          // só consulta com 2+ caracteres
    sourceDelay: 250,           // espera o usuário parar de digitar (ms)
    source: async (query, { signal }) => {
        const response = await fetch(`/api/clientes?q=${encodeURIComponent(query)}`, { signal });
        return response.json(); // [{ value, text, subtext?, group?, image?, icon?, disabled? }, …]
    }
});
```

Ou, sem JavaScript, uma URL que responda JSON (`{query}` é substituído pelo termo; sem ele, `?q=termo` é acrescentado):

```html
<select class="select-modal" data-source="/api/clientes?q={query}" data-min-query-length="2">
    <option value="42" selected>Cliente atual</option> <!-- valor inicial, se houver -->
</select>
```

- Cada item precisa de `value` (ou `id`) e `text` (ou `label` / `name`). A resposta pode ser o array direto ou `{ results: [...] }`, `{ items: [...] }`, `{ data: [...] }`.
- O `signal` cancela a requisição anterior quando o usuário continua digitando — repasse-o ao `fetch`.
- Ao selecionar um item, a `<option>` correspondente é criada no select, então `select.value`, `FormData` e `change` funcionam normalmente. O filtro é responsabilidade do servidor.
- Em `renderOption`, o objeto original chega em `item.data`.

### Criar opção digitando

```html
<select class="select-modal" multiple data-allow-create title="Etiquetas">…</select>
```

Quando o texto digitado não corresponde a nenhuma opção, aparece o item **Criar "texto"**. Ao escolhê-lo, uma `<option>` com esse texto é criada e selecionada. O evento `selectmodal:create` é cancelável — use `preventDefault()` para criar você mesmo (por exemplo, salvando no servidor antes):

```js
select.addEventListener('selectmodal:create', async (event) => {
    event.preventDefault();
    const novo = await salvarNoServidor(event.detail.query);
    select.add(new Option(novo.nome, novo.id, true, true));
    SelectModal.get(select).hide();   // o change é disparado ao fechar
});
```

### Conteúdo personalizado

`renderOption` recebe cada item e devolve o conteúdo da linha: um `Node`, uma string (tratada como **texto**, nunca HTML) ou `null` para manter o padrão.

```js
SelectModal.get('#cor', {
    renderOption(item) {
        const row = document.createElement('span');
        const swatch = document.createElement('span');
        swatch.style.cssText = `display:inline-block;width:1em;height:1em;border-radius:50%;background:${item.value}`;
        row.append(swatch, ' ', item.text);
        return row;
    }
});
```

`item` traz `value`, `text`, `subtext`, `group`, `disabled`, `selected`, `option` (a `<option>` real) e `data` (item remoto).

## Opções

Cada opção pode ser definida por atributo `data-*` no select, pelo JavaScript (`SelectModal.get(el, { … })`) ou globalmente em `SelectModal.defaults`. A prioridade é: JavaScript › `data-*` › `defaults`.

| Opção (JS) | Atributo | Padrão | Descrição |
| --- | --- | --- | --- |
| `title` | `data-select-modal-title` | atributo `title` | Título do dialog. |
| `noneSelectedText` | `data-none-selected-text` | atributo `title` | Texto do campo sem seleção. |
| `mode` | `data-mode` | `modal` | `modal` ou `dropdown`. |
| `liveSearch` | `data-live-search` | `true` | Mostra o campo de busca. |
| `liveSearchNormalize` | `data-live-search-normalize` | `true` | Busca ignora acentos (`sao` encontra `São`). |
| `highlight` | `data-highlight` | `true` | Destaca o termo buscado. |
| `rank` | `data-rank` | `true` | Ordena por relevância ("começa com" primeiro). Sem efeito quando há `<optgroup>`. |
| `maxSelectedLabels` | `data-max-selected-labels` | `2` | Acima disso o campo mostra o resumo em vez dos nomes. |
| `maxSelections` | `data-max-selections` | `0` | Limite de itens no múltiplo (`0` = sem limite). |
| `selectAll` | `data-select-all` | `false` | Botão **Todos** no múltiplo. |
| `allowClear` | `data-allow-clear` | `false` | Botão **Limpar** na seleção única. |
| `allowCreate` | `data-allow-create` | `false` | Criar opção com o texto digitado. |
| `showValidationMessage` | `data-show-validation-message` | `true` | Mensagem de validação abaixo do campo. |
| `dialogWidth` | `data-dialog-width` | `40rem` (CSS) | Largura máxima do dialog, ex.: `480px`. |
| `pageSize` | `data-page-size` | `100` | Itens desenhados por vez. |
| `source` | `data-source` (URL) | — | Fonte remota (função ou URL). |
| `sourceDelay` | `data-source-delay` | `250` | Espera (ms) antes de consultar `source`. |
| `minQueryLength` | `data-min-query-length` | `0` | Mínimo de caracteres para consultar `source`. |
| `renderOption` | — | — | Função de conteúdo personalizado. |

Atributos booleanos aceitam `data-live-search="false"`, `="true"` ou apenas a presença do atributo.

### Textos e idiomas

| Opção | Atributo | Padrão (pt-BR) |
| --- | --- | --- |
| `placeholder` | `data-placeholder` | `Selecione` |
| `liveSearchPlaceholder` | `data-live-search-placeholder` | `Buscar` |
| `noneResultsText` | `data-none-results-text` | `Sem resultados para {0}` |
| `emptyText` | `data-empty-text` | `Nenhuma opção disponível` |
| `countSelectedText` | `data-count-selected-text` | `{0} selecionados` |
| `resultsText` | `data-results-text` | `{0} resultados` (leitores de tela) |
| `maxSelectionsText` | `data-max-selections-text` | `máximo de {0}` |
| `selectAllText` | `data-select-all-text` | `Todos` |
| `doneText` / `clearText` / `closeText` | `data-done-text` … | `Concluir` / `Limpar` / `Fechar` |
| `createText` | `data-create-text` | `Criar "{0}"` |
| `loadingText` / `errorText` | `data-loading-text` … | `Carregando…` / `Não foi possível carregar as opções` |
| `minQueryText` | `data-min-query-text` | `Digite {0} ou mais caracteres` |

O padrão é português. Para trocar o idioma de toda a página:

```js
SelectModal.locale('en');                       // inclusos: 'pt-BR', 'en', 'es'
SelectModal.locale({ doneText: 'OK' });         // ou só alguns textos
SelectModal.locales.fr = { placeholder: 'Sélectionner', /* … */ };
SelectModal.locale('fr');                       // registre os seus
```

`locale()` atualiza também os campos já inicializados.

## API JavaScript

```js
const sm = SelectModal.get('#estado');            // cria ou devolve a instância (elemento ou seletor)
const sm2 = SelectModal.get(el, { title: 'UF' }); // com opções

sm.open();           // abre o dialog (alias: show)
sm.open('são');      // abre com a busca preenchida
sm.hide();           // fecha (alias: close)
sm.val();            // lê o valor — array quando multiple
sm.val('SP');        // define o valor e atualiza o campo (não dispara change)
sm.val(['a', 'b']);  // multiple
sm.refresh();        // relê opções/data-* e redesenha o campo
sm.destroy();        // remove o componente e devolve o select original
```

| Estático | Descrição |
| --- | --- |
| `SelectModal.init(root?, options?)` | Inicializa todo `select.select-modal` / `select[data-select-modal]` dentro de `root` (padrão: `document`). |
| `SelectModal.get(select, options?)` | Cria ou devolve a instância de um select. |
| `SelectModal.instance(select)` | Devolve a instância existente ou `null` (não cria). |
| `SelectModal.observe()` | Inicializa selects adicionados ao DOM e destrói os removidos. |
| `SelectModal.locale(nome \| textos)` | Troca os textos padrão. |
| `SelectModal.defaults` | Opções padrão globais. |
| `SelectModal.debug` | `true` liga avisos extras no console (ex.: select sem `<label>`). |

**Quando chamar `refresh()`?** Quase nunca. São detectados sozinhos: adicionar, remover, alterar ou desabilitar `<option>`s; trocar classes do select (`is-invalid`); `select.value = 'x'` e `select.selectedIndex = n`; e o `reset` do formulário. Chame `refresh()` apenas ao mudar atributos `data-*`, ao marcar `option.selected = true` diretamente (é o que o `$(select).val()` do jQuery faz) ou ao habilitar/desabilitar um `<fieldset>` pai.

**Avisos no console:** opção desconhecida passada ao `get()`/`init()` e `select-modal.css` não carregado geram um `console.warn` (uma vez cada).

### Eventos

Todos são disparados no `<select>` e propagam (`bubbles`).

| Evento | Cancelável | Quando |
| --- | --- | --- |
| `change` (e `input`) | — | Ao **fechar** o dialog, se a seleção mudou. No múltiplo dispara uma vez só, com o resultado final. |
| `selectmodal:beforeopen` | sim | Antes de abrir. `preventDefault()` impede. |
| `selectmodal:open` | — | O dialog abriu. |
| `selectmodal:beforechange` | sim | Antes de cada alteração. `detail = { action, value, text }`, com `action` igual a `select`, `deselect`, `selectAll`, `clear` ou `create`. |
| `selectmodal:create` | sim | O usuário escolheu **Criar "texto"**. `detail = { query }`. |
| `selectmodal:action` | — | Um botão de ação foi acionado. `detail = { value, text, query }`. |
| `selectmodal:close` | — | O dialog fechou. |

```js
select.addEventListener('selectmodal:beforechange', (event) => {
    if (event.detail.action === 'deselect' && event.detail.value === 'obrigatorio') event.preventDefault();
});
```

### Ações

Uma opção marcada com `data-select-modal-action` (ou com `value="add"`) não aparece na lista: vira um botão no cabeçalho do dialog. Se a busca não encontrar nada, <kbd>Enter</kbd> aciona o botão — e o texto digitado chega em `detail.query`.

```html
<select id="cliente" class="select-modal" title="Selecione um cliente">
    <option value=""></option>
    <option value="add" data-select-modal-action>+ Novo cliente</option>
    <option value="1">Ana Souza</option>
</select>
```

```js
const select = document.querySelector('#cliente');
select.addEventListener('selectmodal:action', (event) => {
    const nome = event.detail.query;                    // o que o usuário digitou na busca
    select.add(new Option(nome, 'novo', true, true));   // cria e seleciona
});
```

Ao acionar, a opção de ação fica selecionada no select (o `change` chega com `value === 'add'`), em seguida vem o `selectmodal:action`. Defina o valor final dentro do seu handler, como no exemplo. Para o caso simples de "criar com o texto digitado", `data-allow-create` dispensa esse código.

### jQuery (opcional)

O jQuery não é necessário. Mas, se ele já existir na página, a sintaxe de plugin fica disponível:

```js
$('#estado').selectModal();                 // inicializa
$('#estado').selectModal({ title: 'UF' });  // com opções
$('#estado').selectModal('val', 'SP');
$('#estado').selectModal('val');            // lê
$('#estado').selectModal('refresh');
$('#estado').on('change', handler);
```

## Personalização visual

Defina as variáveis `--sm-*` em `:root` (ou em qualquer elemento ancestral do campo; para o dialog, use `:root` ou `body`):

```css
:root {
    --sm-accent: #7c3aed;
    --sm-radius: 6px;
    --sm-width: 30rem;
}
```

| Variável | Função |
| --- | --- |
| `--sm-accent` / `--sm-accent-contrast` | Cor de destaque e o texto sobre ela. |
| `--sm-bg` / `--sm-color` / `--sm-muted` / `--sm-border` | Fundo, texto, texto secundário e bordas. |
| `--sm-hover` / `--sm-selected` / `--sm-selected-color` | Item ativo, fundo e texto do item selecionado. |
| `--sm-invalid` / `--sm-valid` | Cores de validação. |
| `--sm-focus-border` / `--sm-ring` | Borda e anel (`box-shadow`) de foco. |
| `--sm-radius` / `--sm-radius-lg` | Raio do campo/itens e do dialog. |
| `--sm-padding-y` / `--sm-padding-x` | Espaçamento interno do campo. |
| `--sm-font` / `--sm-font-size` / `--sm-line-height` | Tipografia (a fonte é herdada da página por padrão). |
| `--sm-width` | Largura máxima do dialog. |
| `--sm-shadow` / `--sm-backdrop` | Sombra do dialog e cor do fundo escurecido. |
| `--sm-speed` | Duração das animações. |

Classes úteis para CSS próprio: `.select-modal-toggle` (campo), `.select-modal-dialog` (com `[data-mode="modal|dropdown"]` e `[data-multiple]`), `.select-modal-option` (com `.is-active`, `[aria-selected="true"]`, `.is-create`), `.select-modal-mark` (termo destacado), `.select-modal-feedback` (mensagem de validação).

**Tema escuro:** as cores padrão usam `light-dark()`, então seguem o `color-scheme` da página. Para acompanhar o sistema operacional:

```css
:root { color-scheme: light dark; }
```

Sem `color-scheme` declarado o componente fica no tema claro. Com o tema Bootstrap, quem manda é o `data-bs-theme`.

## Migração da v1 (Bootstrap Modal + jQuery)

- Remova a exigência de `bootstrap.js` e jQuery — nada mais depende deles. Se usa Bootstrap, inclua `select-modal-bootstrap.css`.
- A marcação, os atributos `data-*`, `SelectModal.init`/`get`, `$(…).selectModal(…)` e o evento `selectmodal:action` continuam iguais.
- O dialog agora é um `<dialog class="select-modal-dialog">`; as classes internas do Bootstrap (`.modal-header`, `.modal-body`, `.btn-close`…) deixaram de existir. CSS customizado que mirava nelas deve usar `.select-modal-header`, `.select-modal-list`, `.select-modal-close` etc., ou as variáveis `--sm-*`.
- No múltiplo, fechar com <kbd>Esc</kbd> ou clicando fora agora também dispara `change` quando a seleção mudou (antes só o botão **Concluir** disparava).
- Os itens da lista são `div[role="option"]` com `aria-selected`, não mais `<button>`.
- Com busca ativa e sem `<optgroup>`, os resultados são ordenados por relevância; use `data-rank="false"` para manter a ordem original.

## Desenvolvimento

```bash
npm install
npm test         # testes de lógica (node:test + jsdom)
npm run build    # gera dist/ (minificados + ES module)
```

O código-fonte é `select-modal.js` (UMD, sem etapa de build para usar). Rode `npm run build` depois de alterá-lo para atualizar a pasta `dist/`. Os testes cobrem comportamento em DOM simulado; o visual deve ser conferido no `index.html`. Histórico de versões em [CHANGELOG.md](CHANGELOG.md).

## Compatibilidade

Navegadores atuais: Chrome/Edge 123+, Firefox 120+, Safari 17.5+ (requisitos: `<dialog>`, CSS nesting, `light-dark()` e `color-mix()`). A animação de abertura/fechamento usa `@starting-style` e `transition-behavior`; onde não há suporte o dialog simplesmente abre sem animar.

## Licença

[MIT](LICENSE) — uso livre, inclusive comercial, desde que o aviso de copyright seja mantido.

## Arquivos

| Arquivo | Obrigatório | Descrição |
| --- | --- | --- |
| `select-modal.js` | sim | O componente (UMD: `<script>` ou CommonJS). |
| `select-modal.css` | sim | Estilos base, independentes de framework. |
| `select-modal-bootstrap.css` | não | Tema para páginas com Bootstrap 5.3+. |
| `select-modal.d.ts` | não | Tipos TypeScript. |
| `dist/` | não | Versões minificadas (`.min.js`, `.min.css`) e ES module (`.esm.js`). |
| `index.html` | não | Página de demonstração (GitHub Pages). |
