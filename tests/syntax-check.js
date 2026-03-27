import fs from 'fs/promises';
import vm from 'vm';

const files = [
  'shared/constants.js',
  'shared/curl.js',
  'shared/request.js',
  'shared/storage.js',
  'shared/utils.js',
  'options/header-editor.js',
  'options/index.js',
  'options/response-renderer.js',
  'options/variable-editor.js',
  'popup/index.js',
  'devtools/index.js',
  'devtools/panel.js'
];

await Promise.all(files.map(async (file) => {
  const source = await fs.readFile(file, 'utf8');
  new vm.SourceTextModule(source, {
    context: vm.createContext({}),
    identifier: file
  });
}));

console.log(`Syntax check passed for ${files.length} module files.`);
