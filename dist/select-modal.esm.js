/*!
 * SelectModal v2.1.0
 * Transforma um <select> em um seletor com busca dentro de um <dialog> nativo.
 * Sem dependências. Documentação: README.md
 */
const SelectModal = (function () {
    'use strict';

    var VERSION = '2.1.0';
    var SELECTOR = 'select.select-modal, select[data-select-modal]';
    var LAYOUT_CLASS = /^(m|p)[trblxyse]?-|^w-|^flex-|^col-|^order-/;
    var COMBINING = /[̀-ͯ]/g;

    var locales = {
        'pt-BR': {
            placeholder: 'Selecione',
            liveSearchPlaceholder: 'Buscar',
            noneResultsText: 'Sem resultados para {0}',
            emptyText: 'Nenhuma opção disponível',
            countSelectedText: '{0} selecionados',
            resultsText: '{0} resultados',
            maxSelectionsText: 'máximo de {0}',
            selectAllText: 'Todos',
            doneText: 'Concluir',
            clearText: 'Limpar',
            closeText: 'Fechar',
            createText: 'Criar "{0}"',
            loadingText: 'Carregando…',
            errorText: 'Não foi possível carregar as opções',
            minQueryText: 'Digite {0} ou mais caracteres'
        },
        en: {
            placeholder: 'Select',
            liveSearchPlaceholder: 'Search',
            noneResultsText: 'No results for {0}',
            emptyText: 'No options available',
            countSelectedText: '{0} selected',
            resultsText: '{0} results',
            maxSelectionsText: 'maximum of {0}',
            selectAllText: 'All',
            doneText: 'Done',
            clearText: 'Clear',
            closeText: 'Close',
            createText: 'Create "{0}"',
            loadingText: 'Loading…',
            errorText: 'Could not load the options',
            minQueryText: 'Type {0} or more characters'
        },
        es: {
            placeholder: 'Seleccione',
            liveSearchPlaceholder: 'Buscar',
            noneResultsText: 'Sin resultados para {0}',
            emptyText: 'No hay opciones disponibles',
            countSelectedText: '{0} seleccionados',
            resultsText: '{0} resultados',
            maxSelectionsText: 'máximo de {0}',
            selectAllText: 'Todos',
            doneText: 'Listo',
            clearText: 'Limpiar',
            closeText: 'Cerrar',
            createText: 'Crear "{0}"',
            loadingText: 'Cargando…',
            errorText: 'No se pudieron cargar las opciones',
            minQueryText: 'Escriba {0} o más caracteres'
        }
    };

    var defaults = {
        title: '',
        noneSelectedText: '',
        mode: 'modal',
        liveSearch: true,
        liveSearchNormalize: true,
        highlight: true,
        rank: true,
        maxSelectedLabels: 2,
        maxSelections: 0,
        selectAll: false,
        allowClear: false,
        allowCreate: false,
        showValidationMessage: true,
        dialogWidth: '',
        pageSize: 100,
        source: null,
        sourceDelay: 250,
        minQueryLength: 0,
        renderOption: null
    };
    Object.keys(locales['pt-BR']).forEach(function (key) { defaults[key] = locales['pt-BR'][key]; });

    // Atributos data-* cujo nome difere da opção.
    var DATA_KEYS = { title: 'selectModalTitle' };

    var instances = new WeakMap();
    var shared = null;
    var uid = 0;
    var warned = {};
    var api;

    function warn(key, message) {
        if (warned[key] || typeof console === 'undefined') return;
        warned[key] = true;
        console.warn('[SelectModal] ' + message);
    }

    function coerce(value, sample) {
        if (sample === null) return value;
        if (typeof sample === 'boolean') {
            if (typeof value === 'boolean') return value;
            return value === '' || value === 'true' || value === '1';
        }
        if (typeof sample === 'number') {
            var number = Number(value);
            return isNaN(number) ? sample : number;
        }
        return String(value);
    }

    function configFrom(select, overrides) {
        var data = select.dataset;
        var config = {};
        Object.keys(defaults).forEach(function (key) {
            var value = defaults[key];
            var dataKey = DATA_KEYS[key] || key;
            if (data[dataKey] !== undefined) value = data[dataKey];
            if (overrides && overrides[key] !== undefined && overrides[key] !== null) value = overrides[key];
            config[key] = coerce(value, defaults[key]);
        });
        if (overrides) {
            Object.keys(overrides).forEach(function (key) {
                if (!(key in defaults)) warn('opt:' + key, 'opção desconhecida "' + key + '".');
            });
        }
        var fallback = select.getAttribute('title') || '';
        if (!config.noneSelectedText) config.noneSelectedText = fallback;
        if (!config.title) config.title = fallback;
        if (typeof config.source === 'string' && config.source) config.source = urlSource(config.source);
        if (typeof config.source !== 'function') config.source = null;
        if (typeof config.renderOption !== 'function') config.renderOption = null;
        config.pageSize = Math.max(10, config.pageSize);
        return config;
    }

    /** data-source="/api/clientes?q={query}" → função que busca JSON. */
    function urlSource(url) {
        return function (query, context) {
            var target = url.indexOf('{query}') !== -1
                ? url.replace('{query}', encodeURIComponent(query))
                : url + (url.indexOf('?') === -1 ? '?' : '&') + 'q=' + encodeURIComponent(query);
            return fetch(target, { signal: context.signal, headers: { Accept: 'application/json' } })
                .then(function (response) {
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    return response.json();
                })
                .then(function (json) {
                    return Array.isArray(json) ? json : (json && (json.results || json.items || json.data)) || [];
                });
        };
    }

    function fold(text, strip) {
        var value = (text || '').toLowerCase();
        return strip ? value.normalize('NFD').replace(COMBINING, '') : value;
    }

    /** Versão "dobrada" caractere a caractere, com o índice original de cada posição (para o destaque). */
    function foldMap(text, strip) {
        var norm = '';
        var map = [];
        for (var i = 0; i < text.length; i++) {
            var piece = fold(text[i], strip);
            for (var j = 0; j < piece.length; j++) {
                norm += piece[j];
                map.push(i);
            }
        }
        return { norm: norm, map: map };
    }

    function highlightRanges(label, tokens, strip) {
        var folded = foldMap(label, strip);
        var ranges = [];
        tokens.forEach(function (token) {
            var at = folded.norm.indexOf(token);
            if (at === -1) return;
            var start = folded.map[at];
            var end = folded.map[at + token.length - 1] + 1;
            // Inclui acentos combinantes que vêm logo depois.
            while (end < label.length && fold(label[end], strip) === '') end++;
            ranges.push([start, end]);
        });
        ranges.sort(function (a, b) { return a[0] - b[0]; });
        var merged = [];
        ranges.forEach(function (range) {
            var last = merged[merged.length - 1];
            if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
            else merged.push(range);
        });
        return merged;
    }

    function isAction(option) {
        return option.hasAttribute('data-select-modal-action')
            || option.classList.contains('no-results')
            || option.value === 'add';
    }

    function actionLabel(label) {
        return label.replace(/^\s*(\[\+\]|\+)\s*/, '').trim() || label;
    }

    function selectedIndexes(select) {
        return Array.prototype.map.call(select.selectedOptions, function (option) {
            return option.index;
        }).join(',');
    }

    function emit(select, name, detail, cancelable) {
        return select.dispatchEvent(new CustomEvent(name, {
            bubbles: true,
            cancelable: !!cancelable,
            detail: detail || null
        }));
    }

    function media(query) {
        return typeof window.matchMedia === 'function' ? window.matchMedia(query) : { matches: false };
    }

    function isSelected(item) {
        return !!(item.option && item.option.selected);
    }

    /* ---------------------------------------------------------------- dialog */

    function ensureDialog() {
        if (shared) return shared;
        var el = document.createElement('dialog');
        el.className = 'select-modal-dialog';
        el.setAttribute('aria-labelledby', 'select-modal-title');
        el.innerHTML = ''
            + '<div class="select-modal-panel">'
            + '  <header class="select-modal-header">'
            + '    <h2 class="select-modal-title" id="select-modal-title"></h2>'
            + '    <div class="select-modal-actions" hidden></div>'
            + '    <button type="button" class="select-modal-close"></button>'
            + '  </header>'
            + '  <div class="select-modal-search-box">'
            + '    <input type="search" class="select-modal-search" autocomplete="off" autocapitalize="off"'
            + '      spellcheck="false" enterkeyhint="done" aria-controls="select-modal-list">'
            + '  </div>'
            + '  <div class="select-modal-list" id="select-modal-list" role="listbox" tabindex="-1"></div>'
            + '  <div class="select-modal-empty" hidden></div>'
            + '  <div class="select-modal-status" role="status" aria-live="polite"></div>'
            + '  <footer class="select-modal-footer" hidden>'
            + '    <button type="button" class="select-modal-count" aria-pressed="false"></button>'
            + '    <button type="button" class="select-modal-btn select-modal-all"></button>'
            + '    <button type="button" class="select-modal-btn select-modal-clear"></button>'
            + '    <button type="button" class="select-modal-btn select-modal-done"></button>'
            + '  </footer>'
            + '</div>';

        function q(name) { return el.querySelector('.select-modal-' + name); }
        var d = shared = {
            el: el,
            header: q('header'),
            title: q('title'),
            actions: q('actions'),
            close: q('close'),
            searchBox: q('search-box'),
            search: q('search'),
            list: q('list'),
            empty: q('empty'),
            status: q('status'),
            footer: q('footer'),
            count: q('count'),
            all: q('all'),
            clear: q('clear'),
            done: q('done'),
            owner: null
        };

        function onViewport(event) {
            var owner = d.owner;
            if (!owner || !el.open) return;
            if (event && event.type === 'scroll' && el.contains(event.target)) return;
            owner._place();
        }

        d.attach = function () {
            window.addEventListener('resize', onViewport);
            window.addEventListener('scroll', onViewport, true);
            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', onViewport);
                window.visualViewport.addEventListener('scroll', onViewport);
            }
        };

        d.finalize = function () {
            var owner = d.owner;
            d.owner = null;
            window.removeEventListener('resize', onViewport);
            window.removeEventListener('scroll', onViewport, true);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', onViewport);
                window.visualViewport.removeEventListener('scroll', onViewport);
            }
            if (owner) owner._afterClose();
        };

        // O evento "close" é assíncrono: se outro select já reabriu o dialog, ignora.
        el.addEventListener('close', function () {
            if (!el.open) d.finalize();
        });

        // Clique no backdrop (o painel cobre todo o dialog, então target === dialog é o backdrop).
        var downOnBackdrop = false;
        el.addEventListener('pointerdown', function (event) {
            downOnBackdrop = event.target === el;
        });
        el.addEventListener('click', function (event) {
            if (event.target === el && downOnBackdrop) el.close();
        });

        // Celular: arrastar o cabeçalho para baixo fecha a "bottom sheet".
        var drag = null;
        var mobile = media('(max-width: 36rem)');
        d.header.addEventListener('pointerdown', function (event) {
            if (event.pointerType !== 'touch' || !mobile.matches || event.target.closest('button')) return;
            drag = { y: event.clientY, dy: 0 };
        });
        el.addEventListener('pointermove', function (event) {
            if (!drag) return;
            drag.dy = Math.max(0, event.clientY - drag.y);
            el.style.transition = 'none';
            el.style.translate = '0 ' + drag.dy + 'px';
        });
        function endDrag() {
            if (!drag) return;
            var dy = drag.dy;
            drag = null;
            el.style.transition = '';
            el.style.translate = '';
            if (dy > 80) el.close();
        }
        el.addEventListener('pointerup', endDrag);
        el.addEventListener('pointercancel', endDrag);

        d.close.addEventListener('click', function () { el.close(); });
        d.done.addEventListener('click', function () { el.close(); });
        d.clear.addEventListener('click', function () { if (d.owner) d.owner._clear(); });
        d.all.addEventListener('click', function () { if (d.owner) d.owner._selectAll(); });
        d.count.addEventListener('click', function () { if (d.owner) d.owner._toggleOnlySelected(); });
        d.search.addEventListener('input', function () { if (d.owner) d.owner._search(); });

        // Os eventos do campo de busca não devem chegar a listeners da página/formulário.
        ['input', 'change'].forEach(function (name) {
            el.addEventListener(name, function (event) { event.stopPropagation(); });
        });

        d.list.addEventListener('click', function (event) {
            var record = d.owner && d.owner._recordFrom(event.target);
            if (record) d.owner._pick(record);
        });
        d.list.addEventListener('pointermove', function (event) {
            var record = d.owner && d.owner._recordFrom(event.target);
            if (record && !record.disabled) d.owner._setActive(record, false);
        });
        // Renderização progressiva: desenha mais itens ao chegar perto do fim.
        d.list.addEventListener('scroll', function () {
            var list = d.list;
            if (d.owner && list.scrollTop + list.clientHeight > list.scrollHeight - 240) d.owner._renderMore();
        }, { passive: true });
        d.actions.addEventListener('click', function (event) {
            var button = event.target.closest('button');
            if (button && d.owner) d.owner.choose(button._selectModalItem);
        });

        el.addEventListener('keydown', function (event) {
            var owner = d.owner;
            if (!owner || event.isComposing) return;
            if (event.key === 'Escape') {
                // Evita que um modal pai (ex.: Bootstrap) também feche.
                event.stopPropagation();
                return;
            }
            var inSearch = event.target === d.search;
            var onButton = !!event.target.closest('button');
            switch (event.key) {
                case 'ArrowDown': owner._move(1); break;
                case 'ArrowUp': owner._move(-1); break;
                case 'PageDown': owner._move(8); break;
                case 'PageUp': owner._move(-8); break;
                case 'Home':
                    if (inSearch) return;
                    owner._move(0, 'first');
                    break;
                case 'End':
                    if (inSearch) return;
                    owner._move(0, 'last');
                    break;
                case 'Enter':
                    if (onButton) return;
                    owner._enter();
                    break;
                case ' ':
                    if (inSearch || onButton) return;
                    owner._enter();
                    break;
                default: return;
            }
            event.preventDefault();
        });

        return d;
    }

    /* -------------------------------------------------------------- instance */

    function SelectModal(select, overrides) {
        this.select = select;
        this._overrides = overrides || null;
        this._id = ++uid;
        this._action = null;
        this._snapshot = '';
        this._invalid = false;
        this._cache = null;
        this._hasGroups = false;
        this._matched = [];
        this._records = [];
        this._shown = 0;
        this._active = null;
        this._tokens = [];
        this._onlySelected = false;
        this._remoteItems = [];
        this._state = '';
        this._timer = 0;
        this._abort = null;
        this._tabIndex = select.getAttribute('tabindex');

        this.wrap = document.createElement('div');
        this.wrap.className = 'select-modal-wrap';
        // Classes utilitárias de layout (ex.: Bootstrap) passam para o wrapper.
        this._layoutClasses = Array.prototype.filter.call(select.classList, function (name) {
            return LAYOUT_CLASS.test(name);
        });
        this._layoutClasses.forEach(function (name) {
            select.classList.remove(name);
            this.wrap.classList.add(name);
        }, this);
        select.parentNode.insertBefore(this.wrap, select);
        this.wrap.appendChild(select);

        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.className = 'select-modal-toggle';
        this.button.id = 'select-modal-toggle-' + this._id;
        this.button.setAttribute('aria-haspopup', 'dialog');
        this.button.setAttribute('aria-expanded', 'false');
        this.label = document.createElement('span');
        this.label.className = 'select-modal-value';
        this.button.appendChild(this.label);
        this.wrap.appendChild(this.button);

        this.feedback = document.createElement('div');
        this.feedback.className = 'select-modal-feedback';
        this.feedback.id = 'select-modal-feedback-' + this._id;
        this.feedback.setAttribute('role', 'alert');
        this.feedback.hidden = true;
        this.wrap.appendChild(this.feedback);

        var fieldLabel = select.labels && select.labels[0];
        if (fieldLabel) {
            if (!fieldLabel.id) fieldLabel.id = 'select-modal-label-' + this._id;
            this.button.setAttribute('aria-labelledby', fieldLabel.id + ' ' + this.button.id);
        } else if (select.getAttribute('aria-label')) {
            this.button.setAttribute('aria-label', select.getAttribute('aria-label'));
        } else if (api.debug && !select.getAttribute('aria-labelledby') && !select.title) {
            warn('label:' + this._id, 'select sem <label>, aria-label ou title: ' + (select.id || select.name || '(sem id)'));
        }

        select.classList.add('select-modal-native');
        select.tabIndex = -1;

        var self = this;
        this._onClick = function () { self.open(); };
        this._onKeydown = function (event) {
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                self.open();
            } else if (event.key.length === 1 && event.key !== ' ' && self.options.liveSearch) {
                // Digitar no campo já abre com a busca preenchida.
                event.preventDefault();
                self.open(event.key);
            }
        };
        this._onInvalid = function (event) {
            event.preventDefault();
            self._invalid = true;
            self.syncButton();
            // Só o primeiro campo inválido do formulário abre o dialog.
            var form = select.form;
            var first = form && Array.prototype.filter.call(form.elements, function (field) {
                return field.willValidate && !field.validity.valid;
            })[0];
            if (!form || first === select) self.open();
        };
        this._onFocus = function () { self.button.focus(); };
        this._onChange = function () {
            if (select.validity.valid) self._invalid = false;
            self.syncButton();
        };
        this._onReset = function () {
            setTimeout(function () {
                self._invalid = false;
                self._external();
            });
        };
        this.button.addEventListener('click', this._onClick);
        this.button.addEventListener('keydown', this._onKeydown);
        select.addEventListener('invalid', this._onInvalid);
        select.addEventListener('focus', this._onFocus);
        select.addEventListener('change', this._onChange);
        this._form = select.form;
        if (this._form) this._form.addEventListener('reset', this._onReset);

        // select.value = 'x' e select.selectedIndex = n passam a atualizar o campo sozinhos.
        // (O jsdom implementa o select como Proxy e não suporta isso; lá use refresh().)
        var interceptable = !/jsdom/i.test(window.navigator.userAgent);
        ['value', 'selectedIndex'].forEach(function (prop) {
            if (!interceptable) return;
            var desc = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, prop);
            if (!desc || !desc.set) return;
            Object.defineProperty(select, prop, {
                configurable: true,
                enumerable: true,
                get: function () { return desc.get.call(this); },
                set: function (value) {
                    desc.set.call(this, value);
                    self._external();
                }
            });
        });

        this.observer = new MutationObserver(function () {
            self._cache = null;
            self._external();
        });
        this.observer.observe(select, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['disabled', 'label', 'class', 'data-subtext', 'data-icon', 'data-image']
        });

        instances.set(select, this);
        this.refresh();
    }

    var P = SelectModal.prototype;

    P._isOpen = function () {
        return !!shared && shared.owner === this && shared.el.open;
    };

    /** O select mudou por fora (código, mutação, reset): atualiza campo e lista aberta. */
    P._external = function () {
        if (!instances.has(this.select)) return;
        this.syncButton();
        if (this._isOpen()) {
            if (this.options.source) this._draw(true);
            else this._filter(true);
        }
    };

    P.refresh = function () {
        var select = this.select;
        this.options = configFrom(select, this._overrides);
        this._cache = null;
        var size = select.dataset.size || '';
        var match = /(?:^|\s)(?:form-select|form-control|select-modal)-(sm|lg)(?:\s|$)/.exec(select.className);
        if (!size && match) size = match[1];
        this.button.classList.toggle('select-modal-sm', size === 'sm');
        this.button.classList.toggle('select-modal-lg', size === 'lg');
        this._external();
        return this;
    };

    P.syncButton = function () {
        var select = this.select;
        var options = this.options;
        var fallback = options.noneSelectedText || options.placeholder;
        var selected = Array.prototype.slice.call(select.selectedOptions);
        var text;
        var placeholder = false;
        if (!select.multiple) {
            var current = selected[0];
            placeholder = !current || current.value === '';
            text = (current && current.textContent.trim()) || fallback;
        } else {
            var real = selected.filter(function (option) { return option.value !== ''; });
            placeholder = real.length === 0;
            if (placeholder) text = fallback;
            else if (real.length > options.maxSelectedLabels) {
                text = options.countSelectedText.replace('{0}', String(real.length));
            } else {
                text = real.map(function (option) { return option.textContent.trim(); }).join(', ');
            }
        }
        var invalid = this._invalid || select.classList.contains('is-invalid');
        this.label.textContent = text;
        this.button.title = text;
        this.button.classList.toggle('is-placeholder', placeholder);
        this.button.classList.toggle('is-invalid', invalid);
        this.button.classList.toggle('is-valid', select.classList.contains('is-valid'));
        // :disabled também cobre <fieldset disabled>.
        this.button.disabled = select.matches(':disabled');

        var message = this._invalid && options.showValidationMessage ? select.validationMessage : '';
        this.feedback.textContent = message;
        this.feedback.hidden = !message;
        if (message) this.button.setAttribute('aria-describedby', this.feedback.id);
        else this.button.removeAttribute('aria-describedby');
        if (invalid) this.button.setAttribute('aria-invalid', 'true');
        else this.button.removeAttribute('aria-invalid');
    };

    /** Opções do select, com o texto de busca já normalizado (cache até a próxima mutação). */
    P._items = function () {
        if (this._cache) return this._cache;
        var strip = this.options.liveSearchNormalize;
        var hasGroups = false;
        var items = Array.prototype.map.call(this.select.options, function (option) {
            var group = option.parentNode.tagName === 'OPTGROUP' ? option.parentNode : null;
            var label = option.textContent.trim();
            var subtext = option.getAttribute('data-subtext') || '';
            var groupLabel = group ? group.getAttribute('label') || '' : '';
            if (groupLabel) hasGroups = true;
            var labelNorm = fold(label, strip);
            return {
                option: option,
                value: option.value,
                label: label,
                subtext: subtext,
                group: groupLabel,
                icon: option.getAttribute('data-icon') || '',
                image: option.getAttribute('data-image') || '',
                disabled: option.disabled || !!(group && group.disabled),
                action: isAction(option),
                data: null,
                labelNorm: labelNorm,
                norm: labelNorm + '\n' + fold(subtext + '\n' + groupLabel, strip)
            };
        });
        this._hasGroups = hasGroups;
        return (this._cache = items);
    };

    /** Compatibilidade com a v2.0. */
    P.items = function () {
        return this._items().slice();
    };

    P._remoteItem = function (raw) {
        var strip = this.options.liveSearchNormalize;
        var label = String(raw.text != null ? raw.text : raw.label != null ? raw.label : raw.name != null ? raw.name : raw.value);
        var labelNorm = fold(label, strip);
        return {
            option: null,
            value: String(raw.value != null ? raw.value : raw.id != null ? raw.id : label),
            label: label,
            subtext: raw.subtext ? String(raw.subtext) : '',
            group: raw.group ? String(raw.group) : '',
            icon: raw.icon || '',
            image: raw.image || '',
            disabled: !!raw.disabled,
            action: false,
            data: raw,
            labelNorm: labelNorm,
            norm: labelNorm
        };
    };

    P.open = function (query) {
        var select = this.select;
        if (select.matches(':disabled') || !select.isConnected) return this;
        var d = ensureDialog();
        if (d.owner === this && d.el.open) return this;
        if (!emit(select, 'selectmodal:beforeopen', null, true)) return this;
        // Fecha (e dispara os eventos de) quem estava usando o dialog compartilhado.
        if (d.owner) {
            if (d.el.open) d.el.close();
            d.finalize();
        }
        if (window.getComputedStyle(this.button).position !== 'relative') {
            warn('css', 'select-modal.css não parece estar carregado.');
        }

        // Dentro de outro modal/dialog o nosso dialog precisa ser descendente dele,
        // senão o "focus trap" do modal pai rouba o foco da busca.
        var host = select.closest('dialog, .modal') || document.body;
        if (d.el.parentNode !== host) host.appendChild(d.el);

        var options = this.options;
        var dropdown = options.mode === 'dropdown' && !media('(max-width: 36rem)').matches;
        d.owner = this;
        d.el.setAttribute('data-mode', dropdown ? 'dropdown' : 'modal');
        d.el.toggleAttribute('data-multiple', select.multiple);
        d.el.removeAttribute('data-loading');
        if (options.dialogWidth) d.el.style.setProperty('--sm-width', options.dialogWidth);
        else d.el.style.removeProperty('--sm-width');
        d.title.textContent = options.title || options.noneSelectedText || options.placeholder;
        d.close.setAttribute('aria-label', options.closeText);
        d.close.title = options.closeText;
        d.search.value = typeof query === 'string' && options.liveSearch ? query : '';
        d.search.placeholder = options.liveSearchPlaceholder;
        d.search.setAttribute('aria-label', options.liveSearchPlaceholder);
        d.searchBox.hidden = !options.liveSearch;
        d.list.setAttribute('aria-multiselectable', String(select.multiple));
        d.status.textContent = '';
        d.done.textContent = options.doneText;
        d.clear.textContent = options.clearText;
        d.all.textContent = options.selectAllText;
        d.done.hidden = !select.multiple;
        d.count.hidden = !select.multiple;
        d.all.hidden = !(select.multiple && options.selectAll);
        d.clear.hidden = !this._canClear();
        d.footer.hidden = d.done.hidden && d.clear.hidden;

        this._action = null;
        this._onlySelected = false;
        this._remoteItems = [];
        this._state = '';
        this._snapshot = selectedIndexes(select);
        this._place();
        this._search(true);
        this.button.setAttribute('aria-expanded', 'true');
        d.el.showModal();
        d.attach();

        // Em telas de toque não foca a busca para o teclado virtual não cobrir a lista.
        var touch = media('(pointer: coarse)').matches;
        if (options.liveSearch && (!touch || d.search.value)) d.search.focus();
        else d.list.focus();
        if (this._active && !d.search.value) this._active.el.scrollIntoView({ block: 'center' });
        emit(select, 'selectmodal:open');
        return this;
    };

    P.show = P.open;

    P.hide = function () {
        if (this._isOpen()) shared.el.close();
        return this;
    };

    P.close = P.hide;

    /** Posiciona o dropdown junto ao campo e compensa o teclado virtual no celular. */
    P._place = function () {
        var el = shared.el;
        var style = el.style;
        var viewport = window.visualViewport;
        if (viewport) {
            var hidden = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
            style.setProperty('--sm-vv-height', viewport.height + 'px');
            style.setProperty('--sm-vv-bottom', hidden + 'px');
        }
        if (el.getAttribute('data-mode') !== 'dropdown') return;
        var rect = this.button.getBoundingClientRect();
        var vw = document.documentElement.clientWidth;
        var vh = window.innerHeight;
        var gap = 6;
        var margin = 8;
        var width = Math.min(Math.max(rect.width, 256), vw - margin * 2);
        var left = Math.min(Math.max(margin, rect.left), vw - width - margin);
        var below = vh - rect.bottom - gap - margin;
        var above = rect.top - gap - margin;
        var up = below < 280 && above > below;
        style.setProperty('--sm-dd-left', left + 'px');
        style.setProperty('--sm-dd-width', width + 'px');
        style.setProperty('--sm-dd-max', Math.max(160, up ? above : below) + 'px');
        style.setProperty('--sm-dd-top', up ? 'auto' : (rect.bottom + gap) + 'px');
        style.setProperty('--sm-dd-bottom', up ? (vh - rect.top + gap) + 'px' : 'auto');
    };

    P._canClear = function () {
        if (this.select.multiple) return true;
        return this.options.allowClear && !this.select.required;
    };

    /** Reage à digitação: filtra localmente ou consulta a fonte remota. */
    P._search = function (immediate) {
        var self = this;
        var d = shared;
        var options = this.options;
        if (!options.source) {
            this._filter();
            return;
        }
        var raw = d.search.value.trim();
        clearTimeout(this._timer);
        if (this._abort) this._abort.abort();
        this._abort = null;
        if (raw.length < options.minQueryLength) {
            // Abaixo do mínimo mostra o que já está selecionado.
            this._remoteItems = this._items().filter(function (item) { return item.option.selected; });
            this._state = 'hint';
            d.el.removeAttribute('data-loading');
            this._filter();
            return;
        }
        this._state = 'loading';
        d.el.setAttribute('data-loading', '');
        if (immediate || !this._records.length) this._filter();
        this._timer = setTimeout(function () {
            var controller = typeof AbortController === 'function' ? new AbortController() : { signal: null, abort: function () {} };
            self._abort = controller;
            new Promise(function (resolve) { resolve(options.source(raw, { signal: controller.signal, select: self.select })); })
                .then(function (list) {
                    if (self._abort !== controller) return;
                    self._remoteItems = (list || []).map(self._remoteItem, self);
                    self._state = '';
                }, function (error) {
                    if (self._abort !== controller) return;
                    self._remoteItems = [];
                    self._state = 'error';
                    if (typeof console !== 'undefined') console.error('[SelectModal] source:', error);
                })
                .then(function () {
                    if (self._abort !== controller) return;
                    self._abort = null;
                    if (!self._isOpen()) return;
                    d.el.removeAttribute('data-loading');
                    self._filter();
                });
        }, immediate ? 0 : options.sourceDelay);
    };

    /** Calcula os itens que casam com a busca e redesenha. */
    P._filter = function (keep) {
        var d = shared;
        var options = this.options;
        var raw = d.search.value.trim();
        var folded = fold(raw, options.liveSearchNormalize);
        var tokens = this._tokens = folded ? folded.split(/\s+/) : [];
        var remote = !!options.source;
        var onlySelected = this._onlySelected;
        var source = remote ? this._remoteItems : this._items();

        var matched = source.filter(function (item) {
            if (item.action || item.value === '') return false;
            if (onlySelected && !isSelected(item)) return false;
            if (remote) return true;
            for (var i = 0; i < tokens.length; i++) {
                if (item.norm.indexOf(tokens[i]) === -1) return false;
            }
            return true;
        });

        // "Começa com" antes de "palavra começa com" antes de "contém" (só sem grupos, para não embaralhá-los).
        if (!remote && tokens.length && options.rank && !this._hasGroups) {
            var first = tokens[0];
            matched = matched
                .map(function (item, index) {
                    var rank = item.labelNorm.indexOf(folded) === 0 ? 0
                        : (' ' + item.labelNorm).indexOf(' ' + first) !== -1 ? 1 : 2;
                    return { item: item, rank: rank, index: index };
                })
                .sort(function (a, b) { return a.rank - b.rank || a.index - b.index; })
                .map(function (entry) { return entry.item; });
        }
        this._matched = matched;

        this._createQuery = '';
        if (options.allowCreate && raw && this._state !== 'loading') {
            var exists = source.concat(remote ? this._items() : []).some(function (item) {
                return item.labelNorm === folded;
            });
            if (!exists) this._createQuery = raw;
        }

        this._draw(keep);

        if (tokens.length || remote) {
            d.status.textContent = this._state === 'loading' ? options.loadingText
                : matched.length ? options.resultsText.replace('{0}', String(matched.length))
                : d.empty.textContent;
        } else {
            d.status.textContent = '';
        }
    };

    /** Desenha ações, a primeira página da lista e o rodapé. */
    P._draw = function (keep) {
        var d = shared;
        var options = this.options;
        var previous = keep ? this._active : null;
        var previousKey = previous ? (previous.create ? '\u0000create' : previous.item.value) : null;
        var scrollTop = d.list.scrollTop;
        var want = Math.max(options.pageSize, keep ? this._shown : 0);
        var matched = this._matched;

        // Em modo remoto os itens são religados às <option> que já existem no select.
        if (options.source) {
            var byValue = {};
            Array.prototype.forEach.call(this.select.options, function (option) { byValue[option.value] = option; });
            matched.forEach(function (item) { item.option = byValue[item.value] || null; });
        }

        // Ações (ex.: "+ Novo") viram botões no cabeçalho.
        d.actions.textContent = '';
        this._items().forEach(function (item) {
            if (!item.action) return;
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'select-modal-btn select-modal-add';
            button.textContent = actionLabel(item.label);
            button.disabled = item.disabled;
            button._selectModalItem = item;
            d.actions.appendChild(button);
        });
        d.actions.hidden = !d.actions.firstChild;

        var selectedAt = -1;
        if (!this._tokens.length) {
            for (var i = 0; i < matched.length; i++) {
                if (isSelected(matched[i]) && !matched[i].disabled) { selectedAt = i; break; }
            }
            if (!keep && selectedAt !== -1) want = Math.max(want, selectedAt + Math.ceil(options.pageSize / 2));
        }

        d.list.textContent = '';
        this._records = [];
        this._shown = 0;
        this._lastGroup = '';
        this._createAdded = false;
        this._active = null;
        this._renderMore(want);

        var records = this._records;
        var raw = d.search.value.trim();
        var none = records.length === 0;
        d.list.hidden = none;
        d.empty.hidden = !none;
        d.empty.textContent = !none ? ''
            : this._state === 'loading' ? options.loadingText
            : this._state === 'error' ? options.errorText
            : this._state === 'hint' ? options.minQueryText.replace('{0}', String(options.minQueryLength))
            : raw ? options.noneResultsText.replace('{0}', raw)
            : options.emptyText;

        // Item ativo: o anterior (se ainda existe), o selecionado ou o primeiro habilitado.
        var active = null;
        var firstEnabled = null;
        for (var r = 0; r < records.length; r++) {
            var record = records[r];
            if (record.disabled) continue;
            if (!firstEnabled) firstEnabled = record;
            var key = record.create ? '\u0000create' : record.item.value;
            if (previousKey !== null && key === previousKey) { active = record; break; }
        }
        if (!active && selectedAt !== -1 && records[selectedAt]) active = records[selectedAt];
        this._setActive(active || firstEnabled, false);
        if (keep) d.list.scrollTop = scrollTop;
        else if (this._tokens.length) d.list.scrollTop = 0;
        this._syncFooter();
    };

    /** Acrescenta mais uma página de itens à lista (renderização progressiva). */
    P._renderMore = function (count) {
        var d = shared;
        var matched = this._matched;
        if (this._shown >= matched.length && (this._createAdded || !this._createQuery)) return false;
        var end = Math.min(matched.length, this._shown + (count || this.options.pageSize));
        var full = this._isFull();
        var fragment = document.createDocumentFragment();
        for (var i = this._shown; i < end; i++) {
            var item = matched[i];
            if (item.group !== this._lastGroup) {
                this._lastGroup = item.group;
                if (item.group) {
                    var heading = document.createElement('div');
                    heading.className = 'select-modal-group';
                    heading.setAttribute('role', 'presentation');
                    heading.textContent = item.group;
                    fragment.appendChild(heading);
                }
            }
            var el = this._row(item, this._records.length);
            if (full && !isSelected(item)) el.classList.add('is-blocked');
            fragment.appendChild(el);
            this._records.push({ el: el, item: item, disabled: item.disabled, create: false });
        }
        this._shown = end;
        if (end >= matched.length && this._createQuery && !this._createAdded) {
            this._createAdded = true;
            var create = document.createElement('div');
            create.className = 'select-modal-option is-create';
            create.id = 'select-modal-option-' + this._records.length;
            create.setAttribute('role', 'option');
            create.setAttribute('aria-selected', 'false');
            var text = document.createElement('span');
            text.className = 'select-modal-text';
            text.textContent = this.options.createText.replace('{0}', this._createQuery);
            create.appendChild(text);
            fragment.appendChild(create);
            this._records.push({ el: create, item: null, disabled: false, create: true });
        }
        d.list.appendChild(fragment);
        return true;
    };

    P._row = function (item, index) {
        var options = this.options;
        var el = document.createElement('div');
        el.className = 'select-modal-option';
        el.id = 'select-modal-option-' + index;
        el.setAttribute('role', 'option');
        el.setAttribute('aria-selected', String(isSelected(item)));
        if (item.disabled) el.setAttribute('aria-disabled', 'true');

        var check = document.createElement('span');
        check.className = 'select-modal-check';
        check.setAttribute('aria-hidden', 'true');
        el.appendChild(check);

        if (item.image) {
            var image = document.createElement('img');
            image.className = 'select-modal-image';
            image.src = item.image;
            image.alt = '';
            image.loading = 'lazy';
            el.appendChild(image);
        } else if (item.icon) {
            var icon = document.createElement('i');
            icon.className = 'select-modal-icon ' + item.icon;
            icon.setAttribute('aria-hidden', 'true');
            el.appendChild(icon);
        }

        var text = document.createElement('span');
        text.className = 'select-modal-text';
        var custom = options.renderOption ? options.renderOption({
            value: item.value,
            text: item.label,
            subtext: item.subtext,
            group: item.group,
            disabled: item.disabled,
            selected: isSelected(item),
            option: item.option,
            data: item.data
        }, { query: shared.search.value.trim(), select: this.select }) : null;
        if (custom != null) {
            // String é tratada como texto (nunca HTML); para marcação devolva um Node.
            if (typeof custom === 'string') text.textContent = custom;
            else text.appendChild(custom);
        } else {
            var ranges = options.highlight && this._tokens.length
                ? highlightRanges(item.label, this._tokens, options.liveSearchNormalize)
                : [];
            if (!ranges.length) {
                text.textContent = item.label;
            } else {
                var cursor = 0;
                ranges.forEach(function (range) {
                    if (range[0] > cursor) text.appendChild(document.createTextNode(item.label.slice(cursor, range[0])));
                    var mark = document.createElement('mark');
                    mark.className = 'select-modal-mark';
                    mark.textContent = item.label.slice(range[0], range[1]);
                    text.appendChild(mark);
                    cursor = range[1];
                });
                if (cursor < item.label.length) text.appendChild(document.createTextNode(item.label.slice(cursor)));
            }
            if (item.subtext) {
                var sub = document.createElement('small');
                sub.className = 'select-modal-subtext';
                sub.textContent = item.subtext;
                text.appendChild(sub);
            }
        }
        el.appendChild(text);
        return el;
    };

    P._count = function () {
        return Array.prototype.filter.call(this.select.selectedOptions, function (option) {
            return option.value !== '';
        }).length;
    };

    P._isFull = function () {
        var max = this.select.multiple ? this.options.maxSelections : 0;
        return max > 0 && this._count() >= max;
    };

    P._syncFooter = function () {
        var d = shared;
        var options = this.options;
        var multiple = this.select.multiple;
        var count = this._count();
        var full = this._isFull();
        var text = count ? options.countSelectedText.replace('{0}', String(count)) : '';
        if (full) text += ' · ' + options.maxSelectionsText.replace('{0}', String(options.maxSelections));
        d.count.textContent = multiple ? text : '';
        d.count.disabled = count === 0 && !this._onlySelected;
        d.count.setAttribute('aria-pressed', String(this._onlySelected));
        d.clear.disabled = count === 0;
        d.all.disabled = full;
        this._records.forEach(function (record) {
            if (!record.item) return;
            var selected = isSelected(record.item);
            record.el.setAttribute('aria-selected', String(selected));
            record.el.classList.toggle('is-blocked', full && !selected);
        });
    };

    P._recordFrom = function (target) {
        var el = target.closest && target.closest('.select-modal-option');
        if (!el) return null;
        for (var i = 0; i < this._records.length; i++) {
            if (this._records[i].el === el) return this._records[i];
        }
        return null;
    };

    P._setActive = function (record, scroll) {
        var d = shared;
        if (record && this._active === record) return;
        if (this._active) this._active.el.classList.remove('is-active');
        this._active = record || null;
        if (record) {
            record.el.classList.add('is-active');
            d.search.setAttribute('aria-activedescendant', record.el.id);
            d.list.setAttribute('aria-activedescendant', record.el.id);
            if (scroll) record.el.scrollIntoView({ block: 'nearest' });
        } else {
            d.search.removeAttribute('aria-activedescendant');
            d.list.removeAttribute('aria-activedescendant');
        }
    };

    P._move = function (step, edge) {
        if (edge === 'last') while (this._renderMore(1000)) { /* desenha tudo */ }
        function enabledOf(records) {
            return records.filter(function (record) { return !record.disabled; });
        }
        var enabled = enabledOf(this._records);
        var current = enabled.indexOf(this._active);
        if (!edge && step > 0 && current + step >= enabled.length && this._renderMore()) {
            enabled = enabledOf(this._records);
        }
        if (!enabled.length) return;
        var index;
        if (edge === 'first') index = 0;
        else if (edge === 'last') index = enabled.length - 1;
        else {
            index = current === -1
                ? (step > 0 ? 0 : enabled.length - 1)
                : Math.max(0, Math.min(enabled.length - 1, current + step));
        }
        this._setActive(enabled[index], true);
    };

    P._enter = function () {
        if (this._active) {
            this._pick(this._active);
            return;
        }
        // Sem resultados: Enter aciona a primeira ação disponível (ex.: "+ Novo").
        var add = shared.actions.querySelector('button:not(:disabled)');
        if (add && shared.search.value.trim() !== '') this.choose(add._selectModalItem);
    };

    P._pick = function (record) {
        if (record.create) this._create(this._createQuery);
        else this.choose(record.item);
    };

    /** Garante que o item (remoto) tenha uma <option> real no select. */
    P._ensureOption = function (item) {
        if (item.option) return item.option;
        var option = document.createElement('option');
        option.value = item.value;
        option.textContent = item.label;
        if (item.subtext) option.setAttribute('data-subtext', item.subtext);
        if (item.icon) option.setAttribute('data-icon', item.icon);
        if (item.image) option.setAttribute('data-image', item.image);
        option._selectModalRemote = true;
        this.select.appendChild(option);
        this._cache = null;
        item.option = option;
        return option;
    };

    P._before = function (action, item) {
        return emit(this.select, 'selectmodal:beforechange', {
            action: action,
            value: item ? item.value : null,
            text: item ? item.label : null
        }, true);
    };

    P.choose = function (item) {
        if (!item || item.disabled) return;
        var select = this.select;
        if (item.action) {
            this._action = {
                value: item.value,
                text: item.label,
                query: shared ? shared.search.value.trim() : ''
            };
            item.option.selected = true;
            this.syncButton();
            this.hide();
            return;
        }
        if (select.multiple) {
            var selecting = !isSelected(item);
            if (selecting && this._isFull()) return;
            if (!this._before(selecting ? 'select' : 'deselect', item)) return;
            this._ensureOption(item).selected = selecting;
            this.syncButton();
            this._syncFooter();
            return;
        }
        if (!this._before('select', item)) return;
        this._ensureOption(item).selected = true;
        this.syncButton();
        this.hide();
    };

    /** Cria uma opção nova a partir do texto digitado (allowCreate). */
    P._create = function (text) {
        if (!text) return;
        var select = this.select;
        if (select.multiple && this._isFull()) return;
        if (!emit(select, 'selectmodal:create', { query: text }, true)) return;
        if (!this._before('create', { value: text, label: text })) return;
        var option = document.createElement('option');
        option.value = text;
        option.textContent = text;
        option.setAttribute('data-select-modal-created', '');
        select.appendChild(option);
        option.selected = true;
        this._cache = null;
        this.syncButton();
        if (select.multiple) {
            shared.search.value = '';
            this._search(true);
            shared.search.focus();
        } else {
            this.hide();
        }
    };

    P._selectAll = function () {
        var select = this.select;
        if (!select.multiple || !this._before('selectAll', null)) return;
        var max = this.options.maxSelections;
        var count = this._count();
        for (var i = 0; i < this._matched.length; i++) {
            var item = this._matched[i];
            if (item.disabled || isSelected(item)) continue;
            if (max > 0 && count >= max) break;
            this._ensureOption(item).selected = true;
            count++;
        }
        this.syncButton();
        this._syncFooter();
    };

    P._toggleOnlySelected = function () {
        this._onlySelected = !this._onlySelected;
        if (this.options.source && this._onlySelected) {
            this._remoteBackup = this._remoteItems;
            this._remoteItems = this._items().filter(function (item) { return item.option.selected; });
        } else if (this.options.source && this._remoteBackup) {
            this._remoteItems = this._remoteBackup;
            this._remoteBackup = null;
        }
        this._filter();
    };

    P._clear = function () {
        var select = this.select;
        if (!this._before('clear', null)) return;
        if (select.multiple) {
            Array.prototype.forEach.call(select.options, function (option) { option.selected = false; });
            this.syncButton();
            if (this._onlySelected) this._toggleOnlySelected();
            else this._syncFooter();
            return;
        }
        var blank = Array.prototype.filter.call(select.options, function (option) {
            return option.value === '';
        })[0];
        if (blank) blank.selected = true;
        else select.selectedIndex = -1;
        this.syncButton();
        this.hide();
    };

    P._afterClose = function () {
        var select = this.select;
        var action = this._action;
        this._action = null;
        clearTimeout(this._timer);
        if (this._abort) this._abort.abort();
        this._abort = null;
        this._remoteBackup = null;
        this.button.setAttribute('aria-expanded', 'false');
        if (!instances.has(select)) return;
        // Opções criadas a partir de dados remotos que não ficaram selecionadas são descartadas.
        Array.prototype.slice.call(select.options).forEach(function (option) {
            if (option._selectModalRemote && !option.selected) option.remove();
        });
        if (selectedIndexes(select) !== this._snapshot) {
            select.dispatchEvent(new Event('input', { bubbles: true }));
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (action) emit(select, 'selectmodal:action', action);
        emit(select, 'selectmodal:close');
    };

    P.val = function (value) {
        var select = this.select;
        if (arguments.length === 0) {
            if (!select.multiple) return select.value;
            return Array.prototype.map.call(select.selectedOptions, function (option) { return option.value; });
        }
        if (select.multiple) {
            var wanted = (Array.isArray(value) ? value : value == null ? [] : [value]).map(String);
            Array.prototype.forEach.call(select.options, function (option) {
                option.selected = wanted.indexOf(option.value) !== -1;
            });
        } else {
            select.value = value == null ? '' : value;
        }
        this._external();
        return this;
    };

    P.destroy = function () {
        var select = this.select;
        if (!instances.has(select)) return;
        if (shared && shared.owner === this) {
            instances.delete(select);
            if (shared.el.open) shared.el.close();
            shared.finalize();
        }
        instances.delete(select);
        this.observer.disconnect();
        this.button.removeEventListener('click', this._onClick);
        this.button.removeEventListener('keydown', this._onKeydown);
        select.removeEventListener('invalid', this._onInvalid);
        select.removeEventListener('focus', this._onFocus);
        select.removeEventListener('change', this._onChange);
        if (this._form) this._form.removeEventListener('reset', this._onReset);
        delete select.value;
        delete select.selectedIndex;
        select.classList.remove('select-modal-native');
        this._layoutClasses.forEach(function (name) { select.classList.add(name); });
        if (this._tabIndex === null) select.removeAttribute('tabindex');
        else select.setAttribute('tabindex', this._tabIndex);
        if (this.wrap.parentNode) this.wrap.parentNode.insertBefore(select, this.wrap);
        this.wrap.remove();
    };

    /* ------------------------------------------------------------ public API */

    function resolve(target) {
        return typeof target === 'string' ? document.querySelector(target) : target;
    }

    /** Cria (ou retorna) a instância de um <select>. */
    function get(target, overrides) {
        var select = resolve(target);
        if (!select || select.tagName !== 'SELECT') {
            throw new TypeError('SelectModal: informe um elemento <select> ou um seletor CSS válido.');
        }
        var instance = instances.get(select);
        if (!instance) return new SelectModal(select, overrides);
        if (overrides) {
            instance._overrides = overrides;
            instance.refresh();
        }
        return instance;
    }

    /** Inicializa todos os select.select-modal / select[data-select-modal] dentro de root. */
    function init(root, overrides) {
        var scope = resolve(root) || document;
        var nodes = scope.matches && scope.matches(SELECTOR) ? [scope] : scope.querySelectorAll(SELECTOR);
        return Array.prototype.map.call(nodes, function (select) {
            return instances.get(select) || new SelectModal(select, overrides);
        });
    }

    function each(root, callback) {
        if (root.nodeType !== 1) return;
        var nodes = root.querySelectorAll('select.select-modal-native');
        if (root.matches('select.select-modal-native')) callback(root);
        Array.prototype.forEach.call(nodes, callback);
    }

    var domObserver = null;

    /** Inicializa selects inseridos depois (AJAX, SPA) e destrói os que saem do DOM. */
    function observe() {
        if (domObserver) return domObserver;
        domObserver = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                Array.prototype.forEach.call(mutation.addedNodes, function (node) {
                    if (node.nodeType === 1 && node.isConnected) init(node);
                });
                Array.prototype.forEach.call(mutation.removedNodes, function (node) {
                    each(node, function (select) {
                        var instance = instances.get(select);
                        if (instance && !select.isConnected) instance.destroy();
                    });
                });
            });
        });
        domObserver.observe(document.documentElement, { childList: true, subtree: true });
        return domObserver;
    }

    /** Troca os textos padrão: SelectModal.locale('en') ou SelectModal.locale({ doneText: 'OK' }). */
    function locale(nameOrTexts) {
        var texts = typeof nameOrTexts === 'string' ? locales[nameOrTexts] : nameOrTexts;
        if (!texts) throw new Error('SelectModal: idioma "' + nameOrTexts + '" não registrado em SelectModal.locales.');
        Object.keys(texts).forEach(function (key) { defaults[key] = texts[key]; });
        if (typeof document !== 'undefined') {
            each(document.documentElement, function (select) {
                var instance = instances.get(select);
                if (instance) instance.refresh();
            });
        }
        return api;
    }

    api = {
        version: VERSION,
        defaults: defaults,
        locales: locales,
        debug: false,
        init: init,
        get: get,
        observe: observe,
        locale: locale,
        instance: function (target) { return instances.get(resolve(target)) || null; }
    };

    if (typeof document === 'undefined') return api;

    // Ponte opcional: se o jQuery existir na página, $(el).selectModal(...) continua funcionando.
    function attachJQuery() {
        var jq = window.jQuery;
        if (!jq || !jq.fn || jq.fn.selectModal) return;
        jq.fn.selectModal = function (option) {
            var args = Array.prototype.slice.call(arguments, 1);
            if (option === 'val' && args.length === 0) {
                return this[0] ? get(this[0]).val() : undefined;
            }
            return this.each(function () {
                var instance = get(this, option && typeof option === 'object' ? option : undefined);
                if (typeof option !== 'string') return;
                if (typeof instance[option] !== 'function' || option.charAt(0) === '_') {
                    throw new Error('SelectModal.' + option + ' não existe. Use refresh, destroy, val, open ou hide.');
                }
                instance[option].apply(instance, args);
            });
        };
    }

    function boot() {
        attachJQuery();
        init(document);
    }

    attachJQuery();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

    return api;
})();
if (typeof window !== 'undefined') window.SelectModal = SelectModal;
export default SelectModal;
export { SelectModal };
