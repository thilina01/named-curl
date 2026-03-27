import { SUPPORTED_METHODS } from './constants.js';

export function looksLikeCurlCommand(input) {
  return /^\s*curl(?:\s|$)/i.test(String(input || ''));
}

export function suggestCommandNameFromUrl(url) {
  if (!url) return 'Parsed Command';

  try {
    const parsedUrl = new URL(url);
    return parsedUrl.pathname.split('/').filter(Boolean).pop() || parsedUrl.hostname || 'Parsed Command';
  } catch (error) {
    return 'Parsed Command';
  }
}

export function parseCurlCommand(rawCurl) {
  const tokens = tokenizeCurlCommand(String(rawCurl || '').trim());
  const headers = [];
  let method = 'GET';
  let body = '';
  let url = '';

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const nextToken = tokens[index + 1];

    if (!token || token === 'curl') continue;

    if ((token === '-X' || token === '--request') && nextToken) {
      method = String(nextToken).toUpperCase();
      index += 1;
      continue;
    }

    if ((token === '-H' || token === '--header') && nextToken) {
      const splitIndex = nextToken.indexOf(':');
      if (splitIndex > 0) {
        headers.push({
          key: nextToken.slice(0, splitIndex).trim(),
          value: nextToken.slice(splitIndex + 1).trim()
        });
      }
      index += 1;
      continue;
    }

    if ((token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') && nextToken) {
      body = nextToken;
      index += 1;
      continue;
    }

    if ((token === '--url' || token === '-L') && nextToken && /^https?:\/\//i.test(nextToken)) {
      url = nextToken;
      index += 1;
      continue;
    }

    if (!url && /^https?:\/\//i.test(token)) {
      url = token;
    }
  }

  if (body && method === 'GET') {
    method = 'POST';
  }

  if (!SUPPORTED_METHODS.includes(method)) {
    method = 'GET';
  }

  return {
    url,
    method,
    body,
    headers,
    name: suggestCommandNameFromUrl(url)
  };
}

function tokenizeCurlCommand(rawCommand) {
  const tokens = [];
  let current = '';
  let quote = '';

  for (let index = 0; index < rawCommand.length; index += 1) {
    const character = rawCommand[index];
    const nextCharacter = rawCommand[index + 1];

    if (quote) {
      if (character === '\\' && nextCharacter) {
        current += nextCharacter;
        index += 1;
        continue;
      }

      if (character === quote) {
        quote = '';
        continue;
      }

      current += character;
      continue;
    }

    if (character === '"' || character === '\'') {
      quote = character;
      continue;
    }

    if (character === '\\' && nextCharacter) {
      current += nextCharacter;
      index += 1;
      continue;
    }

    if (/\s/.test(character)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += character;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}
