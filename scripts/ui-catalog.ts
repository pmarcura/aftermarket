import * as ts from 'typescript/unstable/ast';
import { API, type Program } from 'typescript/unstable/sync';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { screens } from '../apps/web/src/devlab/screens';
import { labFixtureFingerprint } from './lib/lab-fingerprint';

const root = resolve('.');
const web = resolve('apps/web/src');
const slash = (s: string) => s.replaceAll('\\', '/');
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const parsed = new Map<string, ReturnType<typeof inspect>>();
let program: Program;
let commandTypes = new Set<string>();
function inspect(file: string) {
  const text = readFileSync(file, 'utf8');
  const ast = /\.tsx?$/.test(file) ? program.getSourceFile(file) : undefined;
  const literals: { kind: string; text: string; line: number }[] = [];
  const commands: { type: string; line: number }[] = [];
  const components = new Set<string>();
  const imports: string[] = [];
  const add = (kind: string, text: string, node: ts.Node) => {
    const value = clean(text);
    if (value && ast)
      literals.push({
        kind,
        text: value,
        line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
      });
  };
  const visit = (node: ts.Node) => {
    if (!ast) return;
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const name = node.moduleSpecifier.text;
      if (name.startsWith('.')) {
        const base = resolve(dirname(file), name);
        const target = [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`].find(
          (p) => existsSync(p) && /\.[cm]?[jt]sx?$/.test(p),
        );
        if (target && target.startsWith(web) && !slash(target).includes('/devlab/'))
          imports.push(target);
      }
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(ast);
      if (/^[A-Z]/.test(tag)) components.add(tag);
      for (const a of node.attributes.properties) {
        if (
          ts.isJsxAttribute(a) &&
          a.initializer &&
          ts.isStringLiteral(a.initializer) &&
          ['aria-label', 'placeholder', 'title', 'role'].includes(a.name.getText(ast))
        )
          add(a.name.getText(ast), a.initializer.text, a);
      }
    }
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText(ast);
      if (/^(h[1-6]|button|label|summary|option|th|Tab|Modal)$/.test(tag)) {
        const value = node.children
          .map((c) => (ts.isJsxText(c) ? c.text : ts.isJsxExpression(c) ? '{dinâmico}' : ''))
          .join(' ');
        add(tag, value, node);
      }
    }
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(ast).replaceAll(/['"]/g, '') === 'type' &&
      ts.isStringLiteral(node.initializer) &&
      commandTypes.has(node.initializer.text)
    )
      commands.push({
        type: node.initializer.text,
        line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
      });
    node.forEachChild(visit);
  };
  if (ast) visit(ast);
  return {
    path: slash(relative(root, file)),
    hash: hash(text),
    components: [...components].sort(),
    literals,
    commands,
    imports,
  };
}
function source(file: string) {
  if (!parsed.has(file)) parsed.set(file, inspect(file));
  return parsed.get(file)!;
}
export function generateUiCatalog() {
  parsed.clear();
  const api = new API({ cwd: root });
  const snapshot = api.updateSnapshot({ openProjects: [resolve('tsconfig.json')] });
  try {
    program = snapshot.getProject(resolve('tsconfig.json'))!.program;
    commandTypes = new Set<string>();
    const model = program.getSourceFile(resolve('packages/simulation/src/model.ts'))!;
    const collectCommandTypes = (node: ts.Node) => {
      if (
        ts.isPropertySignatureDeclaration(node) &&
        node.name.getText(model).replaceAll(/['"]/g, '') === 'type' &&
        node.type &&
        ts.isLiteralTypeNode(node.type) &&
        ts.isStringLiteral(node.type.literal)
      )
        commandTypes.add(node.type.literal.text);
      node.forEachChild(collectCommandTypes);
    };
    for (const statement of model.statements)
      if (ts.isTypeAliasDeclaration(statement) && statement.name.text === 'Command')
        collectCommandTypes(statement);
    if (!commandTypes.size)
      throw Error('Não foi possível identificar o contrato de comandos em model.ts.');
    const ast = program.getSourceFile(resolve(web, 'App.tsx'))!;
    let actual: string[] = [];
    const visit = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node) &&
        node.name.getText(ast) === 'views' &&
        node.initializer &&
        ts.isObjectLiteralExpression(node.initializer)
      )
        actual = node.initializer.properties.map((p) =>
          'name' in p ? (p.name?.getText(ast) ?? '') : '',
        );
      node.forEachChild(visit);
    };
    visit(ast);
    if (
      [...actual].sort().join() !==
      screens
        .map((s) => s.id)
        .sort()
        .join()
    )
      throw Error('Registro de telas diverge das views reais de App.tsx. Atualize screens.ts.');
    const shared = [
      'App.tsx',
      'main.tsx',
      'devlab/screens.ts',
      'lib/game.tsx',
      'components/ui.tsx',
      ...readdirSync(web).filter((s) => s.endsWith('.css')),
    ].map((p) => resolve(web, p));
    const entries = screens.map((screen) => {
      const seen = new Set<string>();
      const walk = (file: string) => {
        if (seen.has(file)) return;
        seen.add(file);
        source(file).imports.forEach(walk);
      };
      walk(resolve(web, screen.source));
      shared.forEach(walk);
      const files = [...seen].sort().map((file) => {
        const { imports: _imports, ...entry } = source(file);
        return entry;
      });
      return {
        ...screen,
        fingerprint: hash(files.map((f) => `${f.path}:${f.hash}`).join('\n')),
        files: files.map((f) => f.path),
      };
    });
    const tests = readdirSync(resolve('tests/e2e'))
      .filter((f) => f.endsWith('.spec.ts'))
      .map((name) => {
        const path = `tests/e2e/${name}`;
        const text = readFileSync(resolve(path), 'utf8');
        return {
          path,
          hash: hash(text),
          cases: [...text.matchAll(/test\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]),
        };
      });
    const files = [...parsed.values()]
      .sort((a, b) => a.path.localeCompare(b.path))
      .map(({ imports: _imports, ...file }) => file);
    return {
      schemaVersion: 1,
      fixtureFingerprint: labFixtureFingerprint(),
      note: 'Inventário estático alcançável por tela; inclui componentes compartilhados e ramos condicionais. Textos dinâmicos e estados visíveis precisam da evidência de navegador. Comandos type são candidatos, não prova de execução.',
      screens: entries,
      files,
      tests,
    };
  } finally {
    snapshot.dispose();
    api.close();
  }
}
export function writeUiCatalog(check = false) {
  const catalog = generateUiCatalog();
  const path = resolve('docs/design/UI-CATALOG.json');
  const text = JSON.stringify(catalog, null, 2) + '\n';
  if (check) {
    if (!existsSync(path) || readFileSync(path, 'utf8') !== text)
      throw Error('Catálogo desatualizado. Execute npm run lab:catalog.');
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  }
  return catalog;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const catalog = writeUiCatalog(process.argv.includes('--check'));
  console.log(
    JSON.stringify({
      screens: catalog.screens.length,
      files: catalog.files.length,
      catalog: 'docs/design/UI-CATALOG.json',
    }),
  );
}
