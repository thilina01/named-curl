import { escapeHtml, highlightText } from '../shared/utils.js';

export function createResponseRenderer({ resBodyContent, responseSearchInput, onJsonContext }) {
  return {
    renderResponseBody
  };

  function renderResponseBody(responseState) {
    const query = responseSearchInput.value.trim();

    if (responseState.type === 'json' && responseState.json !== null) {
      resBodyContent.innerHTML = '';
      resBodyContent.classList.remove('response-body-text');
      resBodyContent.appendChild(renderJsonTree(responseState.json, query));
      return;
    }

    resBodyContent.classList.add('response-body-text');
    resBodyContent.innerHTML = highlightText(escapeHtml(responseState.text || ''), query);
  }

  function renderJsonTree(value, query) {
    const root = document.createElement('div');
    root.className = 'json-tree';
    const node = createJsonNode(value, query, 'response', true, []);

    if (node) {
      root.appendChild(node.element);
    } else {
      root.textContent = 'No matches found.';
    }

    return root;
  }

  function createJsonNode(value, query, label = '', isRoot = false, pathSegments = []) {
    const normalizedQuery = query.toLowerCase();

    if (value !== null && typeof value === 'object') {
      const isArray = Array.isArray(value);
      const details = document.createElement('details');
      details.className = `json-node${isRoot ? ' root' : ''}`;
      const summary = document.createElement('summary');
      summary.className = 'json-summary';

      const caret = document.createElement('span');
      caret.className = 'json-caret';
      caret.setAttribute('aria-hidden', 'true');
      summary.appendChild(caret);

      const labelSpan = document.createElement('span');
      labelSpan.className = 'json-key';
      labelSpan.innerHTML = highlightText(escapeHtml(label), query);
      if (label) {
        summary.appendChild(labelSpan);
        summary.appendChild(document.createTextNode(': '));
      }

      const typeSpan = document.createElement('span');
      typeSpan.className = 'json-type';
      typeSpan.textContent = isArray ? `[${value.length}]` : `{${Object.keys(value).length}}`;
      summary.appendChild(typeSpan);
      attachJsonContextTarget(summary, value, pathSegments);
      details.appendChild(summary);

      const entries = isArray ? value.map((item, index) => [String(index), item]) : Object.entries(value);
      let hasVisibleChildren = false;
      let hasMatchingDescendant = false;

      entries.forEach(([childLabel, childValue]) => {
        const childSegments = buildJsonPathSegments(pathSegments, childLabel, isArray);
        const childNode = createJsonNode(childValue, query, childLabel, false, childSegments);
        if (!childNode) return;

        hasVisibleChildren = true;
        hasMatchingDescendant = hasMatchingDescendant || childNode.matched;
        details.appendChild(childNode.element);
      });

      const selfMatches = normalizedQuery
        ? label.toLowerCase().includes(normalizedQuery)
        : false;
      const matched = !normalizedQuery || selfMatches || hasMatchingDescendant;

      if (!matched || !hasVisibleChildren) {
        if (normalizedQuery && !matched) return null;
      }

      details.open = isRoot || !normalizedQuery || selfMatches || hasMatchingDescendant;
      return { element: details, matched };
    }

    const valueString = value === null ? 'null' : String(value);
    const haystack = `${label} ${valueString}`.toLowerCase();
    if (normalizedQuery && !haystack.includes(normalizedQuery)) {
      return null;
    }

    const row = document.createElement('div');
    row.className = `json-node json-context-target${isRoot ? ' root' : ''}`;

    if (label) {
      const key = document.createElement('span');
      key.className = 'json-key';
      key.innerHTML = highlightText(escapeHtml(label), query);
      row.appendChild(key);
      row.appendChild(document.createTextNode(': '));
    }

    const valueSpan = document.createElement('span');
    valueSpan.className = getJsonValueClass(value);
    valueSpan.innerHTML = highlightText(escapeHtml(formatJsonValue(value)), query);
    row.appendChild(valueSpan);
    attachJsonContextTarget(row, value, pathSegments);

    return { element: row, matched: true };
  }

  function buildJsonPathSegments(parentSegments, childLabel, parentIsArray) {
    return [...parentSegments, parentIsArray ? Number(childLabel) : childLabel];
  }

  function attachJsonContextTarget(element, value, pathSegments) {
    element.classList.add('json-context-target');
    element.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      onJsonContext({
        clientX: event.clientX,
        clientY: event.clientY,
        pathSegments,
        value
      });
    });
  }

  function getJsonValueClass(value) {
    if (value === null) return 'json-null';
    if (typeof value === 'string') return 'json-string';
    if (typeof value === 'number') return 'json-number';
    if (typeof value === 'boolean') return 'json-boolean';
    return 'json-type';
  }

  function formatJsonValue(value) {
    if (typeof value === 'string') return `"${value}"`;
    if (value === null) return 'null';
    return String(value);
  }
}
