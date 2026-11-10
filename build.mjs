// Gera a pasta dist/ (arquivos minificados e a versão ES module). Rodar: npm run build
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const banner = (await readFile('select-modal.js', 'utf8')).match(/\/\*![\s\S]*?\*\//)[0];
// Recursos de CSS usados pelo componente (nesting etc.) são mantidos como estão.
const target = ['chrome123', 'firefox120', 'safari17.5'];

await mkdir('dist', { recursive: true });

// UMD minificado: <script src="dist/select-modal.min.js">
await build({
    entryPoints: ['select-modal.js'],
    outfile: 'dist/select-modal.min.js',
    minify: true,
    sourcemap: true,
    legalComments: 'none',
    banner: { js: banner },
    target
});

// ES module: import SelectModal from 'select-modal'
const umd = await readFile('select-modal.js', 'utf8');
const esm = `${umd.replace(
    /\(function \(root, factory\) \{[\s\S]*?\}\)\(typeof self !== 'undefined' \? self : this, function \(\) \{/,
    'const SelectModal = (function () {'
).replace(/\}\);\s*$/, '})();')}
if (typeof window !== 'undefined') window.SelectModal = SelectModal;
export default SelectModal;
export { SelectModal };
`;
if (!esm.startsWith(banner) || !esm.includes('const SelectModal = (function () {')) {
    throw new Error('build: o cabeçalho UMD de select-modal.js mudou; ajuste build.mjs.');
}
await writeFile('dist/select-modal.esm.js', esm);
await build({
    entryPoints: ['dist/select-modal.esm.js'],
    outfile: 'dist/select-modal.esm.min.js',
    format: 'esm',
    minify: true,
    sourcemap: true,
    legalComments: 'none',
    banner: { js: banner },
    target
});

for (const name of ['select-modal', 'select-modal-bootstrap']) {
    await build({
        entryPoints: [`${name}.css`],
        outfile: `dist/${name}.min.css`,
        minify: true,
        legalComments: 'inline',
        target
    });
}

console.log('dist/ gerado.');
