import { BLOCKED_HEADER_NAMES, SUPPORTED_METHODS } from './constants.js';
import { tryParseJson } from './utils.js';

export function buildVariableMap(variables) {
  return variables.reduce((map, variable) => {
    map[variable.key] = variable.value;
    return map;
  }, {});
}

export function resolveVariablesInString(input, variableMap) {
  if (!input) return '';

  return String(input).replace(/\\\$|\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (match, bracedName, plainName) => {
    if (match === '\\$') return '$';
    const variableName = bracedName || plainName;
    return Object.prototype.hasOwnProperty.call(variableMap, variableName) ? variableMap[variableName] : '';
  });
}

export function extractVariableNamesFromString(input) {
  if (!input) return [];

  const variableNames = new Set();
  const matcher = /\\\$|\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g;
  let match;

  while ((match = matcher.exec(input)) !== null) {
    if (match[0] === '\\$') continue;
    variableNames.add(match[1] || match[2]);
  }

  return Array.from(variableNames);
}

export function resolveCommandVariables(command, variableMap) {
  return {
    ...command,
    name: resolveVariablesInString(String(command.name || ''), variableMap),
    method: normalizeMethod(command.method),
    url: resolveVariablesInString(String(command.url || ''), variableMap),
    body: resolveVariablesInString(String(command.body || ''), variableMap),
    headers: Array.isArray(command.headers)
      ? command.headers.map((header) => ({
          key: resolveVariablesInString(String(header.key || ''), variableMap),
          value: resolveVariablesInString(String(header.value || ''), variableMap)
        }))
      : []
  };
}

export function shouldSkipRequestHeaderName(headerName) {
  const normalizedName = String(headerName || '').trim().toLowerCase();
  if (!normalizedName) return true;
  if (normalizedName.startsWith(':')) return true;
  if (normalizedName.startsWith('sec-')) return true;
  if (normalizedName.startsWith('proxy-')) return true;
  return BLOCKED_HEADER_NAMES.includes(normalizedName);
}

export function createRequestHeaders(headers) {
  const requestHeaders = new Headers();
  const skippedHeaders = [];

  headers.forEach((header) => {
    const headerName = String(header?.key || '').trim();
    if (!headerName) return;
    if (shouldSkipRequestHeaderName(headerName)) {
      skippedHeaders.push(headerName);
      return;
    }

    try {
      requestHeaders.append(headerName, String(header?.value ?? ''));
    } catch (error) {
      skippedHeaders.push(headerName);
    }
  });

  return {
    requestHeaders,
    skippedHeaders
  };
}

export async function executeCommandRequest(command, { variableMap = {} } = {}) {
  const resolvedCommand = resolveCommandVariables(command, variableMap);
  const fetchOptions = { method: normalizeMethod(resolvedCommand.method) };
  const { requestHeaders, skippedHeaders } = createRequestHeaders(resolvedCommand.headers || []);

  if ([...requestHeaders.keys()].length > 0) {
    fetchOptions.headers = requestHeaders;
  }

  if (fetchOptions.method !== 'GET' && fetchOptions.method !== 'HEAD' && resolvedCommand.body) {
    fetchOptions.body = resolvedCommand.body;
  }

  const startedAt = Date.now();

  try {
    const response = await fetch(resolvedCommand.url, fetchOptions);
    const text = await response.text();
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    const jsonAttempt = tryParseJson(text);
    const headersText = Array.from(response.headers.entries())
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    return {
      ok: true,
      resolvedCommand,
      skippedHeaders,
      response,
      timeMs: Date.now() - startedAt,
      text,
      headersText: headersText || 'No headers returned.',
      contentType,
      isHtml: contentType.includes('text/html'),
      isJson: contentType.includes('application/json') || jsonAttempt.ok,
      json: jsonAttempt.ok ? jsonAttempt.value : null
    };
  } catch (error) {
    return {
      ok: false,
      resolvedCommand,
      skippedHeaders,
      error,
      timeMs: Date.now() - startedAt,
      text: error.message,
      headersText: 'Request failed.',
      contentType: '',
      isHtml: false,
      isJson: false,
      json: null
    };
  }
}

export function getValueAtPathSegments(rootValue, segments) {
  return segments.reduce((currentValue, segment) => {
    if (typeof currentValue === 'undefined' || currentValue === null) return undefined;
    return currentValue[segment];
  }, rootValue);
}

function normalizeMethod(method) {
  const upperMethod = String(method || 'GET').toUpperCase();
  return SUPPORTED_METHODS.includes(upperMethod) ? upperMethod : 'GET';
}
