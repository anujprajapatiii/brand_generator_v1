import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';

const buildVersion = (process.env.GITHUB_SHA || 'local-dev').slice(0, 12);

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await Promise.all([
  cp('index.html', 'dist/index.html'),
  cp('src', 'dist/src', { recursive: true }),
]);

const sourceFiles = (await readdir('dist/src')).filter((file) => file.endsWith('.js'));
await Promise.all(sourceFiles.map(async (file) => {
  const path = `dist/src/${file}`;
  const source = await readFile(path, 'utf8');
  const versioned = source.replace(
    /(from\s+['"])(\.\/[^'"]+\.js)(?:\?v=[^'"]+)?(['"])/g,
    `$1$2?v=${buildVersion}$3`,
  );
  await writeFile(path, versioned);
}));

const indexPath = 'dist/index.html';
const indexSource = await readFile(indexPath, 'utf8');
const versionedIndex = indexSource
  .replace(/(\.\/src\/styles\.css)(?:\?v=[^"]+)?/g, `$1?v=${buildVersion}`)
  .replace(/(\.\/src\/main\.js)(?:\?v=[^"]+)?/g, `$1?v=${buildVersion}`);
await writeFile(indexPath, versionedIndex);

console.log(`Static site built in dist/ · ${buildVersion}`);
