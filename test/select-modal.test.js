/*
 * Testes de lógica do SelectModal em DOM simulado (jsdom).
 * Rodar: npm test
 *
 * O jsdom não implementa <dialog>.showModal() nem layout, então estes testes cobrem
 * comportamento (seleção, busca, eventos, API) — não o visual. Para o visual, abra demo.html.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'select-modal.js'), 'utf8');
// Objetos criados dentro do jsdom têm outro Array/Object.prototype; normaliza antes de comparar.
const plain = (value) => JSON.parse(JSON.stringify(value));
const tick = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

async function setup(body) {
    const dom = new JSDOM(`<!doctype html><body>${body}</body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window;
    const proto = w.HTMLDialogElement.prototype;
    if (!proto.showModal) {
        proto.showModal = function () { this.setAttribute('open', ''); };
        proto.close = function () {
            if (!this.open) return;
            this.removeAttribute('open');
            setTimeout(() => this.dispatchEvent(new w.Event('close')));
        };
    }
    w.Element.prototype.scrollIntoView = function () {};
    w.matchMedia = () => ({ matches: false });
    w.console.warn = () => {};
    w.eval(SOURCE);
    await tick();
    const doc = w.document;
    const events = [];
    ['change', 'input', 'selectmodal:open', 'selectmodal:close', 'selectmodal:action', 'selectmodal:create'].forEach((name) => {
        doc.addEventListener(name, (e) => events.push(`${e.target.id}:${name}${e.detail ? ':' + JSON.stringify(e.detail) : ''}`));
    });
    return {
        w, doc, events, SM: w.SelectModal,
        $: (selector) => doc.querySelector(selector),
        $$: (selector) => Array.from(doc.querySelectorAll(selector)),
        key: (el, key) => el.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })),
        type(value) {
            const search = doc.querySelector('.select-modal-search');
            search.value = value;
            search.dispatchEvent(new w.Event('input', { bubbles: true }));
        }
    };
}

const SINGLE = `
<form id="f"><label for="a">A</label>
<select id="a" class="select-modal mb-3 form-select-sm" title="Escolha" required>
  <option value=""></option>
  <option value="add" data-select-modal-action>+ Novo</option>
  <optgroup label="G1">
    <option value="1" data-subtext="sub">São Paulo</option>
    <option value="2" disabled>Dois</option>
  </optgroup>
  <option value="3">Três</option>
</select></form>`;

const MULTI = `
<select id="m" data-select-modal multiple data-select-all data-max-selections="3">
  <option value="x" selected>X</option><option value="y">Y</option><option value="z">Z</option><option value="w">W</option>
</select>`;

test('inicializa sozinho, move classes de layout e mostra o placeholder', async () => {
    const t = await setup(SINGLE);
    const a = t.$('#a');
    const instance = t.SM.instance(a);
    assert.ok(instance);
    assert.ok(instance.wrap.classList.contains('mb-3') && !a.classList.contains('mb-3'));
    assert.ok(instance.button.classList.contains('select-modal-sm'));
    assert.equal(instance.label.textContent, 'Escolha');
    assert.ok(instance.button.classList.contains('is-placeholder'));
});

test('seleção única: teclado, busca sem acento, destaque e eventos', async () => {
    const t = await setup(SINGLE);
    const a = t.$('#a');
    const instance = t.SM.instance(a);
    instance.button.click();
    const dialog = t.$('dialog.select-modal-dialog');
    assert.ok(dialog.open);
    assert.equal(t.$('.select-modal-title').textContent, 'Escolha');
    assert.equal(t.$$('.select-modal-option').length, 3);
    assert.equal(t.$$('.select-modal-group').length, 1);
    assert.equal(t.$$('.select-modal-add').length, 1);
    assert.equal(t.$$('.select-modal-option')[1].getAttribute('aria-disabled'), 'true');

    t.key(t.$('.select-modal-search'), 'ArrowDown'); // pula o desabilitado
    assert.ok(t.$$('.select-modal-option')[2].classList.contains('is-active'));

    t.type('sao');
    assert.equal(t.$$('.select-modal-option').length, 1);
    assert.equal(t.$('.select-modal-mark').textContent, 'São');
    assert.equal(t.$('.select-modal-status').textContent, '1 resultados');

    t.key(t.$('.select-modal-search'), 'Enter');
    assert.ok(!dialog.open);
    assert.equal(a.value, '1');
    await tick();
    assert.deepEqual(t.events, ['a:selectmodal:open', 'a:input', 'a:change', 'a:selectmodal:close']);
    assert.equal(instance.label.textContent, 'São Paulo');
});

test('busca por várias palavras e ordenação por relevância', async () => {
    const t = await setup(`<select id="s" class="select-modal">
        <option>Campo Grande</option><option>Rio Grande do Sul</option><option>Grande Rio</option></select>`);
    t.SM.instance(t.$('#s')).open();
    t.type('gra rio');
    assert.deepEqual(t.$$('.select-modal-option').map((el) => el.textContent), ['Rio Grande do Sul', 'Grande Rio']);
    t.type('grande');
    assert.deepEqual(t.$$('.select-modal-option').map((el) => el.textContent),
        ['Grande Rio', 'Campo Grande', 'Rio Grande do Sul']);
});

test('sem resultados + Enter aciona a ação com o texto digitado', async () => {
    const t = await setup(SINGLE);
    t.SM.instance(t.$('#a')).open();
    t.type('zzz');
    assert.equal(t.$('.select-modal-empty').textContent, 'Sem resultados para zzz');
    t.key(t.$('.select-modal-search'), 'Enter');
    await tick();
    assert.deepEqual(t.events, ['a:selectmodal:open', 'a:input', 'a:change',
        'a:selectmodal:action:{"value":"add","text":"+ Novo","query":"zzz"}', 'a:selectmodal:close']);
});

test('múltiplo: alterna, respeita o máximo, filtra selecionados e dispara change ao fechar', async () => {
    const t = await setup(MULTI);
    const instance = t.SM.instance(t.$('#m'));
    instance.open();
    const dialog = t.$('dialog.select-modal-dialog');
    assert.ok(dialog.hasAttribute('data-multiple'));
    let rows = t.$$('.select-modal-option');
    rows[1].click();
    rows[2].click();
    assert.ok(dialog.open);
    assert.equal(rows[1].getAttribute('aria-selected'), 'true');
    assert.equal(instance.label.textContent, '3 selecionados');
    assert.equal(t.$('.select-modal-count').textContent, '3 selecionados · máximo de 3');
    assert.ok(rows[3].classList.contains('is-blocked'));
    rows[3].click(); // bloqueado pelo máximo
    assert.deepEqual(plain(instance.val()),['x', 'y', 'z']);

    t.$('.select-modal-count').click(); // só selecionados
    assert.equal(t.$$('.select-modal-option').length, 3);
    t.$('.select-modal-count').click();
    assert.equal(t.$$('.select-modal-option').length, 4);

    t.$('.select-modal-clear').click();
    assert.deepEqual(plain(instance.val()),[]);
    t.$('.select-modal-all').click(); // "Todos" para no máximo
    assert.deepEqual(plain(instance.val()),['x', 'y', 'z']);

    t.$('.select-modal-done').click();
    await tick();
    assert.deepEqual(t.events, ['m:selectmodal:open', 'm:input', 'm:change', 'm:selectmodal:close']);
});

test('abrir sem mudar nada não dispara change; trocar de dono fecha o anterior', async () => {
    const t = await setup(SINGLE + MULTI);
    const a = t.SM.instance(t.$('#a'));
    const m = t.SM.instance(t.$('#m'));
    m.open();
    a.open();
    assert.equal(t.$('.select-modal-title').textContent, 'Escolha');
    a.hide();
    await tick();
    assert.deepEqual(t.events, ['m:selectmodal:open', 'm:selectmodal:close', 'a:selectmodal:open', 'a:selectmodal:close']);
});

test('eventos canceláveis: beforeopen e beforechange', async () => {
    const t = await setup(SINGLE);
    const a = t.$('#a');
    const instance = t.SM.instance(a);
    const block = (e) => e.preventDefault();
    a.addEventListener('selectmodal:beforeopen', block);
    instance.open();
    assert.equal(t.$('dialog.select-modal-dialog'), null);
    a.removeEventListener('selectmodal:beforeopen', block);

    let detail = null;
    a.addEventListener('selectmodal:beforechange', (e) => { detail = e.detail; e.preventDefault(); });
    instance.open();
    t.$$('.select-modal-option')[2].click();
    assert.deepEqual(plain(detail),{ action: 'select', value: '3', text: 'Três' });
    assert.equal(a.value, '');
    assert.ok(t.$('dialog.select-modal-dialog').open);
});

test('fieldset disabled, val() e mutações atualizam o campo', async () => {
    const t = await setup(`<fieldset id="fs">${SINGLE}</fieldset>${MULTI}`);
    const a = t.$('#a');
    const instance = t.SM.instance(a);
    // A interceptação de select.value = 'x' não é testável aqui: o jsdom implementa o select como Proxy.
    instance.val('3');
    assert.equal(instance.label.textContent, 'Três');

    t.$('#fs').disabled = true;
    instance.refresh();
    assert.ok(instance.button.disabled);
    instance.open();
    assert.equal(t.$('dialog.select-modal-dialog'), null);
    t.$('#fs').disabled = false;

    const m = t.SM.instance(t.$('#m'));
    m.val(['w']);
    assert.equal(m.label.textContent, 'W');

    a.add(new t.w.Option('Novo', '9', true, true));
    await tick();
    assert.equal(instance.label.textContent, 'Novo');
});

test('validação: marca o campo, mostra a mensagem e limpa ao corrigir', async () => {
    const t = await setup(SINGLE);
    const a = t.$('#a');
    const instance = t.SM.instance(a);
    assert.equal(t.$('#f').checkValidity(), false);
    assert.ok(instance.button.classList.contains('is-invalid'));
    assert.equal(instance.feedback.hidden, false);
    assert.ok(instance.feedback.textContent.length > 0);
    assert.ok(t.$('dialog.select-modal-dialog').open);
    t.$$('.select-modal-option')[0].click();
    await tick();
    assert.ok(!instance.button.classList.contains('is-invalid'));
    assert.equal(instance.feedback.hidden, true);
});

test('allowCreate cria a opção digitada', async () => {
    const t = await setup(`<select id="c" class="select-modal" data-allow-create>
        <option value=""></option><option>Ana</option></select>`);
    const c = t.$('#c');
    t.SM.instance(c).open();
    t.type('ana');
    assert.equal(t.$('.is-create'), null, 'não oferece criar o que já existe');
    t.type('Bia');
    assert.equal(t.$('.is-create').textContent, 'Criar "Bia"');
    t.$('.is-create').click();
    await tick();
    assert.equal(c.value, 'Bia');
    assert.ok(t.events.includes('c:selectmodal:create:{"query":"Bia"}'));
    assert.ok(t.events.includes('c:change'));
});

test('fonte remota: carrega, seleciona criando a <option> e descarta as não usadas', async () => {
    const t = await setup('<select id="r" title="Cliente"><option value=""></option></select>');
    const r = t.$('#r');
    const calls = [];
    const instance = t.SM.get(r, {
        sourceDelay: 5,
        source(query) {
            calls.push(query);
            return Promise.resolve([{ id: 10, name: 'Ana ' + query }, { value: '11', text: 'Bruno', subtext: 'SP' }]);
        }
    });
    instance.open();
    assert.equal(t.$('.select-modal-empty').textContent, 'Carregando…');
    await tick(20);
    assert.deepEqual(t.$$('.select-modal-option').map((el) => el.textContent), ['Ana ', 'BrunoSP']);
    t.type('x');
    t.type('xy'); // a primeira digitação é cancelada pelo atraso
    await tick(40);
    assert.deepEqual(calls, ['', 'xy']);
    t.$$('.select-modal-option')[0].click();
    await tick();
    assert.equal(r.value, '10');
    assert.equal(instance.label.textContent, 'Ana xy');
    assert.equal(r.options.length, 2);
});

test('renderização progressiva: desenha por páginas e End desenha tudo', async () => {
    const options = Array.from({ length: 500 }, (_, i) => `<option value="${i}">Item ${i}</option>`).join('');
    const t = await setup(`<select id="big" class="select-modal" data-page-size="50">${options}</select>`);
    t.SM.instance(t.$('#big')).open();
    assert.equal(t.$$('.select-modal-option').length, 50);
    t.key(t.$('.select-modal-list'), 'End');
    assert.equal(t.$$('.select-modal-option').length, 500);
    assert.ok(t.$$('.select-modal-option')[499].classList.contains('is-active'));
});

test('teclado no campo: seta abre e digitar abre com a busca preenchida', async () => {
    const t = await setup(SINGLE);
    const instance = t.SM.instance(t.$('#a'));
    t.key(instance.button, 's');
    assert.equal(t.$('.select-modal-search').value, 's');
    assert.equal(t.$$('.select-modal-option').length, 3); // São Paulo, Dois, Três
});

test('locale() troca os textos; observe() inicializa e destrói; destroy() restaura o select', async () => {
    const t = await setup(SINGLE);
    const a = t.$('#a');
    t.SM.locale('en');
    a.removeAttribute('title');
    t.SM.instance(a).refresh();
    assert.equal(t.SM.instance(a).label.textContent, 'Select');

    t.SM.observe();
    const extra = t.doc.createElement('select');
    extra.className = 'select-modal';
    extra.innerHTML = '<option>Q</option>';
    t.doc.body.appendChild(extra);
    await tick();
    assert.ok(t.SM.instance(extra));
    extra.closest('.select-modal-wrap').remove();
    await tick();
    assert.equal(t.SM.instance(extra), null);

    t.SM.instance(a).destroy();
    assert.equal(t.SM.instance(a), null);
    assert.equal(a.parentNode.id, 'f');
    assert.ok(a.classList.contains('mb-3'));
    assert.ok(!a.hasAttribute('tabindex'));
});
