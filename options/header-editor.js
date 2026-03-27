import { escapeAttribute, escapeHtml } from '../shared/utils.js';

export function createHeaderEditor(headersList) {
  return {
    appendHeaderRow,
    ensureHeaderEditorState,
    serializeHeaderRows,
    setHeaderRows
  };

  function appendHeaderRow(header = { key: '', value: '' }, startEditing = false, insertAtTop = false) {
    const row = document.createElement('div');
    row.className = 'header-row';
    row.dataset.key = header.key || '';
    row.dataset.value = header.value || '';
    renderHeaderRow(row, startEditing);

    if (insertAtTop) {
      headersList.prepend(row);
      headersList.scrollTop = 0;
    } else {
      headersList.appendChild(row);
    }

    ensureHeaderEditorState();
  }

  function setHeaderRows(headers) {
    headersList.innerHTML = '';
    if (headers.length === 0) {
      ensureHeaderEditorState();
      return;
    }

    headers.forEach((header) => appendHeaderRow(header));
  }

  function ensureHeaderEditorState() {
    const hasRows = headersList.querySelector('.header-row');
    const emptyState = headersList.querySelector('.headers-empty');

    if (hasRows && emptyState) {
      emptyState.remove();
      return;
    }

    if (!hasRows && !emptyState) {
      const placeholder = document.createElement('div');
      placeholder.className = 'headers-empty';
      placeholder.textContent = 'No headers added.';
      headersList.appendChild(placeholder);
    }
  }

  function serializeHeaderRows() {
    return Array.from(headersList.querySelectorAll('.header-row'))
      .map((row) => {
        if (row.classList.contains('editing')) {
          const keyInput = row.querySelector('.header-key-input');
          const valueInput = row.querySelector('.header-value-input');

          return {
            key: keyInput.value.trim(),
            value: valueInput.value
          };
        }

        return {
          key: (row.dataset.key || '').trim(),
          value: row.dataset.value || ''
        };
      })
      .filter((header) => header.key || header.value);
  }

  function renderHeaderRow(row, editing = false) {
    const key = row.dataset.key || '';
    const value = row.dataset.value || '';
    row.classList.toggle('editing', editing);
    row.innerHTML = editing
      ? `
        <div class="header-row-display"></div>
        <div class="header-row-edit">
          <input type="text" class="header-key-input" placeholder="Header name" value="${escapeAttribute(key)}">
          <input type="text" class="header-value-input" placeholder="Header value" value="${escapeAttribute(value)}">
          <button type="button" class="header-icon-btn header-save-btn" title="Save header" aria-label="Save header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </button>
          <button type="button" class="header-icon-btn header-delete-btn header-remove-btn" title="Remove header" aria-label="Remove header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6l-1 14H6L5 6"></path>
              <path d="M10 11v6"></path>
              <path d="M14 11v6"></path>
              <path d="M9 6V4h6v2"></path>
            </svg>
          </button>
        </div>
      `
      : `
        <div class="header-row-display">
          <div class="header-row-summary header-key">${escapeHtml(key || 'Header')}</div>
          <div class="header-value">${escapeHtml(value || '(empty)')}</div>
          <button type="button" class="header-icon-btn header-edit-btn" title="Edit header" aria-label="Edit header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
            </svg>
          </button>
          <button type="button" class="header-icon-btn header-delete-btn header-remove-btn" title="Remove header" aria-label="Remove header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6l-1 14H6L5 6"></path>
              <path d="M10 11v6"></path>
              <path d="M14 11v6"></path>
              <path d="M9 6V4h6v2"></path>
            </svg>
          </button>
        </div>
        <div class="header-row-edit"></div>
      `;

    const removeBtn = row.querySelector('.header-remove-btn');
    removeBtn.addEventListener('click', () => {
      row.remove();
      ensureHeaderEditorState();
    });

    if (editing) {
      const keyInput = row.querySelector('.header-key-input');
      const valueInput = row.querySelector('.header-value-input');
      const saveBtn = row.querySelector('.header-save-btn');

      saveBtn.addEventListener('click', () => {
        row.dataset.key = keyInput.value.trim();
        row.dataset.value = valueInput.value;

        if (!row.dataset.key && !row.dataset.value) {
          row.remove();
          ensureHeaderEditorState();
          return;
        }

        renderHeaderRow(row, false);
      });

      keyInput.focus();
    } else {
      row.querySelector('.header-edit-btn').addEventListener('click', () => {
        renderHeaderRow(row, true);
      });
    }
  }
}
