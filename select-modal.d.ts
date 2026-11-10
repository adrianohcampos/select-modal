/** SelectModal v2.1.0 — tipos TypeScript. */

/** Item devolvido por uma fonte remota (`source`). */
export interface SelectModalRemoteItem {
    /** Valor da opção. `id` é aceito como alternativa. */
    value?: string | number;
    id?: string | number;
    /** Texto da opção. `label` e `name` são aceitos como alternativa. */
    text?: string;
    label?: string;
    name?: string;
    subtext?: string;
    group?: string;
    /** Classes CSS de um ícone (ex.: `"bi bi-person"`). */
    icon?: string;
    /** URL de uma imagem/avatar. */
    image?: string;
    disabled?: boolean;
    [extra: string]: unknown;
}

/** Item passado para `renderOption`. */
export interface SelectModalItem {
    value: string;
    text: string;
    subtext: string;
    group: string;
    disabled: boolean;
    selected: boolean;
    /** A `<option>` real; `null` em itens remotos ainda não selecionados. */
    option: HTMLOptionElement | null;
    /** O objeto original devolvido por `source` (só em modo remoto). */
    data: SelectModalRemoteItem | null;
}

export interface SelectModalTexts {
    placeholder: string;
    liveSearchPlaceholder: string;
    /** `{0}` = termo buscado. */
    noneResultsText: string;
    emptyText: string;
    /** `{0}` = quantidade. */
    countSelectedText: string;
    /** `{0}` = quantidade (anunciado a leitores de tela). */
    resultsText: string;
    /** `{0}` = limite. */
    maxSelectionsText: string;
    selectAllText: string;
    doneText: string;
    clearText: string;
    closeText: string;
    /** `{0}` = texto digitado. */
    createText: string;
    loadingText: string;
    errorText: string;
    /** `{0}` = mínimo de caracteres. */
    minQueryText: string;
}

export interface SelectModalOptions extends SelectModalTexts {
    /** Título do dialog. Padrão: atributo `title` do select. */
    title: string;
    /** Texto do campo sem seleção. Padrão: atributo `title` do select. */
    noneSelectedText: string;
    /** `"modal"` (padrão) ou `"dropdown"` (lista ancorada ao campo; no celular continua modal). */
    mode: 'modal' | 'dropdown';
    liveSearch: boolean;
    /** Busca ignora acentos. */
    liveSearchNormalize: boolean;
    /** Destaca o termo buscado nos resultados. */
    highlight: boolean;
    /** Ordena por relevância ("começa com" primeiro). Ignorado quando há `<optgroup>`. */
    rank: boolean;
    /** Acima disso o campo mostra "N selecionados" em vez dos nomes. */
    maxSelectedLabels: number;
    /** Limite de itens no múltiplo (0 = sem limite). */
    maxSelections: number;
    /** Mostra o botão "Todos" no múltiplo. */
    selectAll: boolean;
    /** Botão "Limpar" na seleção única. */
    allowClear: boolean;
    /** Permite criar uma opção com o texto digitado. */
    allowCreate: boolean;
    /** Mostra a mensagem de validação nativa abaixo do campo. */
    showValidationMessage: boolean;
    /** Largura máxima do dialog, ex.: `"480px"`. */
    dialogWidth: string;
    /** Quantos itens são desenhados por vez (renderização progressiva). */
    pageSize: number;
    /**
     * Fonte remota: função que recebe o termo e devolve os itens, ou uma URL
     * (`"/api/clientes?q={query}"`) que responde JSON.
     */
    source:
        | string
        | ((query: string, context: { signal: AbortSignal; select: HTMLSelectElement }) =>
            SelectModalRemoteItem[] | Promise<SelectModalRemoteItem[]>)
        | null;
    /** Espera (ms) após a digitação antes de consultar `source`. */
    sourceDelay: number;
    /** Mínimo de caracteres para consultar `source`. */
    minQueryLength: number;
    /**
     * Conteúdo personalizado do item. Devolva um `Node`, uma string (tratada como texto,
     * nunca HTML) ou `null` para usar o padrão.
     */
    renderOption:
        | ((item: SelectModalItem, context: { query: string; select: HTMLSelectElement }) => Node | string | null | undefined)
        | null;
}

export interface SelectModalInstance {
    readonly select: HTMLSelectElement;
    /** Wrapper criado em volta do select. */
    readonly wrap: HTMLDivElement;
    /** O campo visível. */
    readonly button: HTMLButtonElement;
    readonly options: SelectModalOptions;
    /** Abre o dialog, opcionalmente com a busca preenchida. */
    open(query?: string): this;
    show(query?: string): this;
    hide(): this;
    close(): this;
    /** Relê opções e atributos `data-*` e redesenha. */
    refresh(): this;
    /** Lê o valor (array quando `multiple`). */
    val(): string | string[];
    /** Define o valor e atualiza o campo. Não dispara `change`. */
    val(value: string | number | Array<string | number> | null): this;
    /** Remove o componente e devolve o select original. */
    destroy(): void;
}

export interface SelectModalActionDetail {
    value: string;
    text: string;
    /** O que estava digitado na busca. */
    query: string;
}

export interface SelectModalBeforeChangeDetail {
    action: 'select' | 'deselect' | 'selectAll' | 'clear' | 'create';
    value: string | null;
    text: string | null;
}

export interface SelectModalStatic {
    readonly version: string;
    /** Opções padrão globais (mutável). */
    defaults: SelectModalOptions;
    /** Idiomas registrados: `pt-BR`, `en`, `es`. Acrescente os seus aqui. */
    locales: Record<string, Partial<SelectModalTexts>>;
    /** `true` liga avisos extras no console (ex.: select sem label). */
    debug: boolean;
    /** Inicializa os `select.select-modal` / `select[data-select-modal]` dentro de `root`. */
    init(root?: ParentNode | string, options?: Partial<SelectModalOptions>): SelectModalInstance[];
    /** Cria ou devolve a instância de um select. */
    get(select: HTMLSelectElement | string, options?: Partial<SelectModalOptions>): SelectModalInstance;
    /** Devolve a instância existente, sem criar. */
    instance(select: HTMLSelectElement | string): SelectModalInstance | null;
    /** Inicializa selects adicionados ao DOM e destrói os removidos. */
    observe(): MutationObserver;
    /** Troca os textos padrão por um idioma registrado ou por um objeto de textos. */
    locale(nameOrTexts: string | Partial<SelectModalTexts>): SelectModalStatic;
}

declare const SelectModal: SelectModalStatic;
export default SelectModal;
export { SelectModal };

declare global {
    interface Window {
        SelectModal: SelectModalStatic;
    }
    interface HTMLElementEventMap {
        /** Cancelável: `preventDefault()` impede a abertura. */
        'selectmodal:beforeopen': CustomEvent<null>;
        'selectmodal:open': CustomEvent<null>;
        'selectmodal:close': CustomEvent<null>;
        /** Cancelável: `preventDefault()` impede a alteração. */
        'selectmodal:beforechange': CustomEvent<SelectModalBeforeChangeDetail>;
        'selectmodal:action': CustomEvent<SelectModalActionDetail>;
        /** Cancelável: `preventDefault()` impede a criação automática da opção. */
        'selectmodal:create': CustomEvent<{ query: string }>;
    }
}
