import { DEFAULT_THEME, STORAGE_KEYS, SUPPORTED_METHODS } from './constants.js';
import { suggestCommandNameFromUrl } from './curl.js';
import { formatJsonPath } from './utils.js';

export function createCommandId() {
  return `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeMethod(method) {
  const upperMethod = String(method || 'GET').toUpperCase();
  return SUPPORTED_METHODS.includes(upperMethod) ? upperMethod : 'GET';
}

export function normalizeHeaderEntry(header) {
  if (!header) return null;

  if (Array.isArray(header)) {
    if (header.length < 2) return null;
    return {
      key: String(header[0] ?? '').trim(),
      value: String(header[1] ?? '')
    };
  }

  if (typeof header !== 'object') return null;

  const key = String(header.key ?? header.name ?? '').trim();
  const value = String(header.value ?? '');
  if (!key && !value) return null;

  return { key, value };
}

export function normalizeHeaders(rawHeaders) {
  if (!rawHeaders) return [];

  if (Array.isArray(rawHeaders)) {
    return rawHeaders.map((header) => normalizeHeaderEntry(header)).filter(Boolean);
  }

  if (typeof rawHeaders === 'object') {
    return Object.entries(rawHeaders).map(([key, value]) => ({
      key,
      value: String(value ?? '')
    }));
  }

  if (typeof rawHeaders !== 'string' || rawHeaders.trim() === '') {
    return [];
  }

  try {
    const parsed = JSON.parse(rawHeaders);
    return normalizeHeaders(parsed);
  } catch (error) {
    return rawHeaders
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separatorIndex = line.indexOf(':');
        if (separatorIndex <= 0) return null;
        return {
          key: line.slice(0, separatorIndex).trim(),
          value: line.slice(separatorIndex + 1).trim()
        };
      })
      .filter(Boolean);
  }
}

export function normalizeVariables(rawVariables) {
  if (!Array.isArray(rawVariables)) return [];

  return rawVariables
    .map((variable) => {
      if (!variable || typeof variable !== 'object') return null;
      const key = String(variable.key ?? variable.name ?? '').trim();
      if (!key) return null;
      return {
        key,
        value: String(variable.value ?? ''),
        sensitive: Boolean(variable.sensitive)
      };
    })
    .filter(Boolean);
}

export function normalizeTags(rawTags) {
  const source = Array.isArray(rawTags)
    ? rawTags
    : typeof rawTags === 'string'
      ? rawTags.split(/[\n,]/)
      : [];

  const seen = new Set();

  return source
    .map((tag) => String(tag ?? '').trim().replace(/\s+/g, ' '))
    .filter((tag) => {
      if (!tag) return false;
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function normalizePathSegments(rawPath) {
  if (Array.isArray(rawPath)) {
    return rawPath
      .map((segment) => typeof segment === 'number' ? segment : String(segment))
      .filter((segment) => segment !== '');
  }

  if (typeof rawPath !== 'string') return [];

  const normalized = [];
  const matcher = /(?:\.([A-Za-z_$][A-Za-z0-9_$]*))|(?:\[(\d+)\])/g;
  let match;

  while ((match = matcher.exec(rawPath.trim())) !== null) {
    if (match[1]) {
      normalized.push(match[1]);
    } else if (match[2]) {
      normalized.push(Number(match[2]));
    }
  }

  return normalized;
}

export function normalizeVariableBindings(rawBindings, sourceCommands = []) {
  if (!Array.isArray(rawBindings)) return [];

  return rawBindings
    .map((binding) => normalizeVariableBinding(binding, sourceCommands))
    .filter(Boolean);
}

export function normalizeCommand(command, { legacyCollectionsById = null } = {}) {
  if (!command || typeof command !== 'object') return null;

  const name = String(command.name || '').trim();
  const url = String(command.url || '').trim();
  if (!name || !url) return null;

  const tags = normalizeTags(command.tags);
  const legacyCollectionId = String(command.collectionId ?? '').trim();
  if (tags.length === 0 && legacyCollectionsById instanceof Map && legacyCollectionId) {
    const legacyTag = String(legacyCollectionsById.get(legacyCollectionId) || '').trim();
    if (legacyTag) {
      tags.push(legacyTag);
    }
  }

  return {
    id: String(command.id || createCommandId()),
    name,
    method: normalizeMethod(command.method),
    url,
    tags,
    headers: normalizeHeaders(command.headers),
    body: String(command.body || '')
  };
}

export function normalizeImportedCommand(command, options = {}) {
  return normalizeCommand(command, options);
}

export async function loadAppState({ seedSample = true } = {}) {
  const rawState = await chrome.storage.local.get([
    STORAGE_KEYS.commands,
    'collections',
    STORAGE_KEYS.variables,
    STORAGE_KEYS.variableBindings,
    STORAGE_KEYS.theme
  ]);

  let shouldPersist = false;
  const legacyCollectionsById = buildLegacyCollectionsById(rawState.collections);

  let commands = Array.isArray(rawState.commands)
    ? rawState.commands
      .map((command) => normalizeCommand(command, { legacyCollectionsById }))
      .filter(Boolean)
    : [];
  let variables = normalizeVariables(rawState.variables);
  let variableBindings = normalizeVariableBindings(rawState.variableBindings, commands);
  const theme = rawState.theme === 'light' ? 'light' : DEFAULT_THEME;

  if (!isCanonicalCommandList(rawState.commands)) shouldPersist = true;
  if (!isCanonicalVariablesList(rawState.variables)) shouldPersist = true;
  if (!isCanonicalBindingList(rawState.variableBindings)) shouldPersist = true;

  if (!commands.length && seedSample) {
    commands = [createSampleCommand()];
    shouldPersist = true;
  }

  if (shouldPersist) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.commands]: commands,
      [STORAGE_KEYS.variables]: variables,
      [STORAGE_KEYS.variableBindings]: variableBindings
    });
  }

  return {
    commands,
    variables,
    variableBindings,
    theme
  };
}

export function saveCommands(commands) {
  return chrome.storage.local.set({
    [STORAGE_KEYS.commands]: commands
  });
}

export function saveVariables(variables) {
  return chrome.storage.local.set({
    [STORAGE_KEYS.variables]: variables
  });
}

export function saveVariableBindings(variableBindings) {
  return chrome.storage.local.set({
    [STORAGE_KEYS.variableBindings]: variableBindings
  });
}

export function saveTheme(theme) {
  return chrome.storage.local.set({
    [STORAGE_KEYS.theme]: theme === 'light' ? 'light' : DEFAULT_THEME
  });
}

function createSampleCommand() {
  return {
    id: createCommandId(),
    name: 'Sample User List',
    url: 'https://jsonplaceholder.typicode.com/users',
    method: 'GET',
    tags: [],
    headers: [
      {
        key: 'Accept',
        value: 'application/json'
      }
    ],
    body: ''
  };
}

function normalizeVariableBinding(binding, sourceCommands = []) {
  if (!binding || typeof binding !== 'object') return null;

  const variableKey = String(binding.variableKey ?? binding.key ?? '').trim();
  const segments = normalizePathSegments(binding.segments ?? binding.pathSegments ?? binding.path);
  const commandId = resolveBindingCommandId(binding, sourceCommands);
  if (!variableKey || segments.length === 0) return null;

  return {
    variableKey,
    segments,
    path: formatJsonPath(segments),
    commandId,
    sourceRequestName: String(binding.sourceRequestName ?? '').trim(),
    sourceRequestUrl: String(binding.sourceRequestUrl ?? '').trim()
  };
}

function resolveBindingCommandId(binding, sourceCommands = []) {
  const explicitCommandId = String(binding.commandId ?? '').trim();
  if (explicitCommandId) return explicitCommandId;

  const sourceName = String(binding.sourceRequestName ?? '').trim();
  const sourceUrl = String(binding.sourceRequestUrl ?? '').trim();
  if (!sourceName && !sourceUrl) return '';

  const match = sourceCommands.find((command) => {
    const commandName = String(command.name || '').trim();
    const commandUrl = String(command.url || '').trim();
    return (!sourceName || commandName === sourceName) && (!sourceUrl || commandUrl === sourceUrl);
  });

  return match ? String(match.id || '') : '';
}

function buildLegacyCollectionsById(rawCollections) {
  const collectionsById = new Map();
  if (!Array.isArray(rawCollections)) return collectionsById;

  rawCollections.forEach((collection) => {
    if (!collection || typeof collection !== 'object') return;
    const id = String(collection.id || '').trim();
    const name = String(collection.name || '').trim();
    if (!id || !name) return;
    collectionsById.set(id, name);
  });

  return collectionsById;
}

function isCanonicalCommandList(rawCommands) {
  return Array.isArray(rawCommands) && rawCommands.every((command) => (
    command
    && typeof command === 'object'
    && typeof command.id === 'string'
    && typeof command.name === 'string'
    && typeof command.url === 'string'
    && typeof command.body === 'string'
    && Array.isArray(command.tags)
    && command.tags.every((tag) => typeof tag === 'string')
    && Array.isArray(command.headers)
    && !('responseBindings' in command)
  ));
}

function isCanonicalVariablesList(rawVariables) {
  return Array.isArray(rawVariables) && rawVariables.every((variable) => (
    variable
    && typeof variable === 'object'
    && typeof variable.key === 'string'
    && typeof variable.value === 'string'
    && typeof variable.sensitive === 'boolean'
  ));
}

function isCanonicalBindingList(rawBindings) {
  return Array.isArray(rawBindings) && rawBindings.every((binding) => (
    binding
    && typeof binding === 'object'
    && typeof binding.variableKey === 'string'
    && Array.isArray(binding.segments)
    && typeof binding.path === 'string'
    && typeof binding.commandId === 'string'
    && typeof binding.sourceRequestName === 'string'
    && typeof binding.sourceRequestUrl === 'string'
  ));
}
