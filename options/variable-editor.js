import { escapeAttribute } from '../shared/utils.js';

export function createVariableEditor({
  variablesList,
  getBinding,
  onRefreshBinding,
  onRemoveBinding,
  onRenameBinding,
  onSyncVariables,
  formatBindingIndicator
}) {
  return {
    appendVariableRow,
    ensureVariableEditorState,
    serializeVariableRows,
    setVariableRows,
    updateVariableRowMeta
  };

  function appendVariableRow(variable = { key: '', value: '', sensitive: false }, focusKey = false, insertAtTop = false) {
    const row = document.createElement('div');
    row.className = 'variable-row';
    row.dataset.bindingKey = variable.key || '';
    row.dataset.sensitive = String(Boolean(variable.sensitive));
    row.dataset.revealed = String(!variable.sensitive);
    row.dataset.refreshing = 'false';
    row.innerHTML = `
      <div class="variable-main-row">
        <input type="text" class="variable-key-input" placeholder="NAME" value="${escapeAttribute(variable.key || '')}">
        <input type="text" class="variable-value-input" placeholder="value" value="${escapeAttribute(variable.value || '')}">
        <button type="button" class="variable-icon-btn variable-sensitive-btn" aria-label="Toggle sensitive variable" title="Mark variable as sensitive"></button>
        <button type="button" class="variable-icon-btn variable-visibility-btn" aria-label="Toggle value visibility" title="Show or hide variable value"></button>
        <button type="button" class="variable-icon-btn variable-refresh-btn hidden" aria-label="Refresh bound variable" title="Refresh bound variable"></button>
        <button type="button" class="variable-delete-btn" aria-label="Remove variable" title="Remove variable">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6l-1 14H6L5 6"></path>
            <path d="M10 11v6"></path>
            <path d="M14 11v6"></path>
            <path d="M9 6V4h6v2"></path>
          </svg>
        </button>
      </div>
      <div class="variable-meta hidden">
        <span class="variable-binding-badge">Auto</span>
        <span class="variable-binding-text"></span>
      </div>
    `;

    const keyInput = row.querySelector('.variable-key-input');
    const valueInput = row.querySelector('.variable-value-input');
    const sensitiveButton = row.querySelector('.variable-sensitive-btn');
    const visibilityButton = row.querySelector('.variable-visibility-btn');
    const refreshButton = row.querySelector('.variable-refresh-btn');
    const deleteButton = row.querySelector('.variable-delete-btn');

    const handleInput = () => {
      updateVariableRowMeta(row);
      onSyncVariables();
    };

    keyInput.addEventListener('input', () => {
      const previousKey = row.dataset.bindingKey || '';
      const nextKey = keyInput.value.trim();
      if (previousKey !== nextKey) {
        onRenameBinding(previousKey, nextKey);
        row.dataset.bindingKey = nextKey;
      }
      handleInput();
    });

    valueInput.addEventListener('input', handleInput);

    sensitiveButton.addEventListener('click', () => {
      const isSensitive = row.dataset.sensitive === 'true';
      row.dataset.sensitive = String(!isSensitive);
      row.dataset.revealed = String(isSensitive);
      updateVariableRowMeta(row);
      onSyncVariables();
    });

    visibilityButton.addEventListener('click', () => {
      if (row.dataset.sensitive !== 'true') return;
      row.dataset.revealed = String(!(row.dataset.revealed === 'true'));
      updateVariableRowMeta(row);
    });

    refreshButton.addEventListener('click', () => {
      const variableKey = keyInput.value.trim();
      if (!variableKey) return;
      onRefreshBinding(variableKey, row);
    });

    deleteButton.addEventListener('click', () => {
      const currentKey = keyInput.value.trim() || row.dataset.bindingKey || '';
      onRemoveBinding(currentKey);
      row.remove();
      ensureVariableEditorState();
      onSyncVariables();
    });

    const placeholder = variablesList.querySelector('.variables-empty');
    if (placeholder) placeholder.remove();

    if (insertAtTop) {
      variablesList.prepend(row);
      variablesList.scrollTop = 0;
    } else {
      variablesList.appendChild(row);
    }

    if (focusKey) {
      keyInput.focus();
    }

    updateVariableRowMeta(row);
  }

  function setVariableRows(nextVariables) {
    variablesList.innerHTML = '';
    if (!nextVariables.length) {
      ensureVariableEditorState();
      return;
    }

    nextVariables.forEach((variable) => appendVariableRow(variable));
  }

  function ensureVariableEditorState() {
    const hasRows = variablesList.querySelector('.variable-row');
    const emptyState = variablesList.querySelector('.variables-empty');

    if (hasRows && emptyState) {
      emptyState.remove();
      return;
    }

    if (!hasRows && !emptyState) {
      const placeholder = document.createElement('div');
      placeholder.className = 'variables-empty';
      placeholder.textContent = 'No variables defined.';
      variablesList.appendChild(placeholder);
    }
  }

  function serializeVariableRows() {
    return Array.from(variablesList.querySelectorAll('.variable-row'))
      .map((row) => ({
        key: row.querySelector('.variable-key-input').value.trim(),
        value: row.querySelector('.variable-value-input').value,
        sensitive: row.dataset.sensitive === 'true'
      }))
      .filter((variable) => variable.key);
  }

  function updateVariableRowMeta(row) {
    const keyInput = row.querySelector('.variable-key-input');
    const valueInput = row.querySelector('.variable-value-input');
    const sensitiveButton = row.querySelector('.variable-sensitive-btn');
    const visibilityButton = row.querySelector('.variable-visibility-btn');
    const refreshButton = row.querySelector('.variable-refresh-btn');
    const meta = row.querySelector('.variable-meta');
    const bindingText = row.querySelector('.variable-binding-text');
    const isSensitive = row.dataset.sensitive === 'true';
    const isRevealed = row.dataset.revealed === 'true';
    const isRefreshing = row.dataset.refreshing === 'true';
    const binding = getBinding(keyInput.value.trim());

    valueInput.type = isSensitive && !isRevealed ? 'password' : 'text';
    sensitiveButton.classList.toggle('active', isSensitive);
    sensitiveButton.title = isSensitive ? 'Sensitive variable enabled' : 'Mark variable as sensitive';
    sensitiveButton.innerHTML = getSensitiveVariableIcon(isSensitive);
    visibilityButton.classList.toggle('hidden', !isSensitive);
    visibilityButton.title = isRevealed ? 'Hide variable value' : 'Show variable value';
    visibilityButton.innerHTML = getVisibilityIcon(isRevealed);
    refreshButton.classList.toggle('hidden', !binding);
    refreshButton.classList.toggle('loading', isRefreshing);
    refreshButton.title = isRefreshing ? 'Refreshing variable...' : 'Refresh bound variable';
    refreshButton.innerHTML = getRefreshIcon();

    if (!binding) {
      meta.classList.add('hidden');
      bindingText.textContent = '';
      return;
    }

    meta.classList.remove('hidden');
    bindingText.textContent = formatBindingIndicator(binding);
  }

  function getSensitiveVariableIcon(isSensitive) {
    return isSensitive
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M15 11V8a3 3 0 1 0-6 0"></path></svg>`;
  }

  function getVisibilityIcon(isRevealed) {
    return isRevealed
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-8 0.74-2.1 1.96-3.92 3.52-5.32"></path><path d="M1 1l22 22"></path><path d="M9.53 9.53A3 3 0 0 0 14.47 14.47"></path><path d="M14.12 5.88A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8a11.65 11.65 0 0 1-4.13 5.94"></path></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
  }

  function getRefreshIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10"></path><path d="M20.49 15a9 9 0 0 1-14.13 3.36L1 14"></path></svg>`;
  }
}
