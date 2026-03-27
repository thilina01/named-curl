export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

export function truncateText(text, maxLength) {
  const normalizedText = String(text || '');
  if (normalizedText.length <= maxLength) return normalizedText;
  return `${normalizedText.slice(0, maxLength - 1)}...`;
}

export function highlightText(text, query) {
  if (!query) return text;
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escapedQuery})`, 'gi'), '<mark class="response-highlight">$1</mark>');
}

export function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (error) {
    return '';
  }
}

export function formatRequestPath(url) {
  try {
    const parsedUrl = new URL(url);
    return `${parsedUrl.pathname || '/'}${parsedUrl.search || ''}`;
  } catch (error) {
    return String(url || '');
  }
}

export function formatJsonPath(pathSegments) {
  return pathSegments.reduce((path, segment) => {
    if (typeof segment === 'number') {
      return `${path}[${segment}]`;
    }

    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment)
      ? `${path}.${segment}`
      : `${path}[${JSON.stringify(segment)}]`;
  }, 'response');
}

export function serializeJsonValue(value) {
  if (typeof value === 'string') return value;
  if (value === null) return 'null';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

export function tryParseJson(text) {
  try {
    return {
      ok: true,
      value: JSON.parse(text)
    };
  } catch (error) {
    return {
      ok: false,
      value: null
    };
  }
}
