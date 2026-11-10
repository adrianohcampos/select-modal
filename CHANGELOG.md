# Changelog

## 2.1.0

### Novos recursos
- **Dados remotos**: opção `source` (função ou URL via `data-source`), com espera entre teclas (`sourceDelay`), `minQueryLength`, estado de carregamento e cancelamento da requisição anterior.
- **Modo dropdown**: `data-mode="dropdown"` ancora a lista ao campo no desktop; no celular continua modal.
- **Criar opção digitando**: `data-allow-create` e evento cancelável `selectmodal:create`.
- **Busca**: várias palavras, destaque do termo (`highlight`) e ordenação por relevância (`rank`).
- **Múltiplo**: `data-select-all`, `data-max-selections` e filtro "só selecionados" (clique no contador).
- **Conteúdo do item**: `data-image`, `data-icon` e função `renderOption`.
- **Teclado**: setas e digitação no campo abrem o seletor; <kbd>PageUp</kbd>/<kbd>PageDown</kbd> na lista.
- **Celular**: arrastar o cabeçalho para baixo fecha; a folha acompanha o teclado virtual.
- **Acessibilidade**: quantidade de resultados anunciada a leitores de tela; `aria-invalid` no campo.
- **Eventos canceláveis**: `selectmodal:beforeopen` e `selectmodal:beforechange`.
- **Idiomas**: `SelectModal.locale('en' | 'es' | 'pt-BR' | {...})` e `SelectModal.locales`.
- **Para o desenvolvedor**: tipos TypeScript, build ESM e minificado em `dist/`, testes (`npm test`), avisos no console e `SelectModal.debug`.

### Desempenho
- Renderização progressiva (`pageSize`): só os primeiros itens são desenhados; o restante entra conforme a rolagem.
- Texto de busca normalizado uma única vez por opção (cache até o select mudar).

### Correções
- `<fieldset disabled>` agora desabilita o campo.
- `select.value = 'x'` e `select.selectedIndex = n` atualizam o campo sem `refresh()`.
- A mensagem de validação do navegador aparece abaixo do campo.
- `SelectModal.observe()` destrói instâncias de selects removidos do DOM.
- Eventos `input`/`change` do campo de busca não vazam mais para listeners da página.

### Mudanças de comportamento
- Com busca ativa e sem `<optgroup>`, os resultados são ordenados por relevância (`data-rank="false"` desliga).

## 2.0.0

- Reescrito sem jQuery e sem Bootstrap, usando `<dialog>` nativo.
- CSS encapsulado com variáveis `--sm-*`, tema claro/escuro e "bottom sheet" no celular.
- `select-modal-bootstrap.css` como tema opcional para Bootstrap 5.3+.
- Navegação por teclado, `data-subtext`, `data-allow-clear`, eventos `selectmodal:open`/`close`.

## 1.x

- Versão original baseada em Bootstrap Modal e jQuery.
