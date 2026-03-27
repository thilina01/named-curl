import { DEFAULT_THEME } from '../shared/constants.js';
import { looksLikeCurlCommand as isCurlCommand, parseCurlCommand as parseCurlCommandInput } from '../shared/curl.js';
import {
  buildVariableMap as buildRequestVariableMap,
  executeCommandRequest as executeRequest,
  extractVariableNamesFromString as extractReferencedVariableNames,
  getValueAtPathSegments as getJsonValueAtPathSegments
} from '../shared/request.js';
import {
  createCommandId,
  loadAppState as loadNormalizedAppState,
  normalizeImportedCommand as normalizeImportedCommandShape,
  normalizeVariableBindings as normalizeStoredBindings,
  normalizeVariables as normalizeStoredVariables,
  saveCommands as persistCommands,
  saveTheme as persistTheme,
  saveVariableBindings as persistVariableBindings,
  saveVariables as persistVariables
} from '../shared/storage.js';
import { createHeaderEditor } from './header-editor.js';
import { createResponseRenderer } from './response-renderer.js';
import { createVariableEditor } from './variable-editor.js';
import {
  escapeHtml,
  formatJsonPath,
  serializeJsonValue
} from '../shared/utils.js';

document.addEventListener('DOMContentLoaded', async () => {
  let commands = [];
  let variables = [];
  let variableBindings = [];
  let currentCmdId = null;
  let searchTerm = '';
  let lastExecutedCommandId = null;
  let lastExecutedCommandSnapshot = null;
  let lastExecutedRequestInfo = {
    name: '',
    url: '',
    method: 'GET'
  };
  let isResponseRequestRunning = false;
  let isResponseVarRefreshRunning = false;

  const commandListEl = document.getElementById('commandList');
  const editorPanel = document.getElementById('editorPanel');
  const responsePanel = document.getElementById('responsePanel');
  const panelResizer = document.getElementById('panelResizer');
  const emptySelectMsg = document.getElementById('emptySelectMsg');
  const jsonVariableMenu = document.getElementById('jsonVariableMenu');
  const jsonVariableModal = document.getElementById('jsonVariableModal');
  const jsonVariableModalTitle = document.getElementById('jsonVariableModalTitle');
  const cancelJsonVariableBtn = document.getElementById('cancelJsonVariableBtn');
  const saveJsonVariableBtn = document.getElementById('saveJsonVariableBtn');
  const jsonVariablePath = document.getElementById('jsonVariablePath');
  const jsonVariableValuePreview = document.getElementById('jsonVariableValuePreview');
  const jsonVariableExistingGroup = document.getElementById('jsonVariableExistingGroup');
  const jsonVariableNewGroup = document.getElementById('jsonVariableNewGroup');
  const jsonVariableSelect = document.getElementById('jsonVariableSelect');
  const jsonVariableName = document.getElementById('jsonVariableName');
  const jsonVariableAutoPopulate = document.getElementById('jsonVariableAutoPopulate');
  const jsonVariableAutoHint = document.getElementById('jsonVariableAutoHint');
  const jsonVariableModalMsg = document.getElementById('jsonVariableModalMsg');
  const copyJsonValueBtn = document.getElementById('copyJsonValueBtn');
  const saveToExistingVariableBtn = document.getElementById('saveToExistingVariableBtn');
  const editorTitle = document.getElementById('editorTitle');
  const editorContent = document.getElementById('editorContent');
  const closeEditorModalBtn = document.getElementById('closeEditorModalBtn');
  const commandForm = document.getElementById('commandForm');
  const deleteBtn = document.getElementById('deleteBtn');
  const saveMsg = document.getElementById('saveMsg');
  const themeToggle = document.getElementById('themeToggle');
  const searchInput = document.getElementById('searchInput');
  const sendBtn = document.getElementById('sendBtn');
  const variablesModal = document.getElementById('variablesModal');
  const openVariablesModalBtn = document.getElementById('openVariablesModalBtn');
  const closeVariablesModalBtn = document.getElementById('closeVariablesModalBtn');
  const importCommandsBtn = document.getElementById('importCommandsBtn');
  const exportCommandsBtn = document.getElementById('exportCommandsBtn');
  const importFileInput = document.getElementById('importFileInput');
  const importExportMsg = document.getElementById('importExportMsg');
  const variablesList = document.getElementById('variablesList');
  const addVariableBtn = document.getElementById('addVariableBtn');
  const responseSearchInput = document.getElementById('responseSearchInput');
  const responseEditToggleBtn = document.getElementById('responseEditToggleBtn');
  const responseResendBtn = document.getElementById('responseResendBtn');
  const responseRefreshVarsBtn = document.getElementById('responseRefreshVarsBtn');
  const previewTab = document.getElementById('previewTab');
  const executedRequestName = document.getElementById('executedRequestName');
  const executedRequestUrl = document.getElementById('executedRequestUrl');
  const executedMethodBadge = document.getElementById('executedMethodBadge');
  const statusBadge = document.getElementById('statusBadge');
  const responseTime = document.getElementById('responseTime');
  const resBodyContent = document.getElementById('resBodyContent');
  const resHeadersContent = document.getElementById('resHeadersContent');
  const reqHeadersContent = document.getElementById('reqHeadersContent');
  const reqBodyContent = document.getElementById('reqBodyContent');
  const resPreviewFrame = document.getElementById('resPreviewFrame');

  let responseState = {
    type: 'text',
    text: '',
    json: null,
    headers: ''
  };
  let pendingJsonVariableSelection = null;
  let jsonVariableMode = 'new';

  const headersList = document.getElementById('headersList');
  const addHeaderBtn = document.getElementById('addHeaderBtn');

  const nameInp = document.getElementById('name');
  const methodInp = document.getElementById('method');
  const urlInp = document.getElementById('url');
  const bodyInp = document.getElementById('body');
  let persistVariablesTimeoutId = 0;
  const {
    appendHeaderRow,
    ensureHeaderEditorState,
    serializeHeaderRows,
    setHeaderRows
  } = createHeaderEditor(headersList);
  const {
    appendVariableRow,
    ensureVariableEditorState,
    serializeVariableRows,
    setVariableRows,
    updateVariableRowMeta
  } = createVariableEditor({
    variablesList,
    getBinding: (variableKey) => getVariableBinding(variableKey),
    onRefreshBinding: (variableKey, row) => refreshBoundVariable(variableKey, row),
    onRemoveBinding: (variableKey) => removeVariableBinding(variableKey),
    onRenameBinding: (previousKey, nextKey) => renameVariableBinding(previousKey, nextKey),
    onSyncVariables: () => syncVariablesFromEditor(),
    formatBindingIndicator: (binding) => formatVariableBindingIndicator(binding)
  });
  const { renderResponseBody } = createResponseRenderer({
    resBodyContent,
    responseSearchInput,
    onJsonContext: ({ clientX, clientY, pathSegments, value }) => {
      pendingJsonVariableSelection = {
        path: formatJsonPath(pathSegments),
        segments: [...pathSegments],
        value: serializeJsonValue(value)
      };
      showJsonVariableMenu(clientX, clientY);
    }
  });

  panelResizer.classList.add('hidden');
  emptySelectMsg.classList.add('hidden');
  responsePanel.classList.remove('hidden');
  responseEditToggleBtn.classList.add('hidden');
  updateResponseHeaderActions();

  // ========== THEME ==========
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggle.checked = theme === 'dark';
  }

  themeToggle.addEventListener('change', () => {
    const theme = themeToggle.checked ? 'dark' : 'light';
    applyTheme(theme);
    persistTheme(theme);
  });

  function showSidebarMessage(message, type = '') {
    importExportMsg.textContent = message;
    importExportMsg.className = type ? `sidebar-msg ${type}` : 'sidebar-msg';
    if (message) {
      window.clearTimeout(showSidebarMessage.timeoutId);
      showSidebarMessage.timeoutId = window.setTimeout(() => {
        importExportMsg.textContent = '';
        importExportMsg.className = 'sidebar-msg';
      }, 3000);
    }
  }

  // ========== DEEP LINKING ==========
  const urlParams = new URLSearchParams(window.location.search);
  const action = urlParams.get('action');
  const editId = urlParams.get('editId');
  const autoRun = urlParams.get('run') === '1';

  // ========== LOAD COMMANDS ==========
  async function loadCommands() {
    const state = await loadNormalizedAppState();
    commands = state.commands;
    variables = state.variables;
    variableBindings = state.variableBindings;

    applyTheme(state.theme || DEFAULT_THEME);
    setVariableRows(variables);
    updateResponseHeaderActions();
    renderList();

    if (action === 'new') {
      document.getElementById('newCommandBtn').click();
      return;
    }

    if (action === 'edit' && editId) {
      const cmd = commands.find((command) => command.id === editId);
      if (cmd) {
        selectCommand(cmd.id);
        if (autoRun) {
          sendRequest(cmd);
          closeEditorModal();
        }
      }
    }
  }
  await loadCommands();

  // ========== SEARCH ==========
  searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value.toLowerCase();
    renderList();
  });

  responseSearchInput.addEventListener('input', () => {
    renderResponseBody(responseState);
  });

  // ========== RENDER LIST ==========
  function renderList() {
    commandListEl.innerHTML = '';
    const filtered = searchTerm
      ? commands.filter(c => c.name.toLowerCase().includes(searchTerm) || c.url.toLowerCase().includes(searchTerm))
      : commands;

    filtered.forEach(cmd => {
      const li = document.createElement('li');
      li.className = `list-item ${cmd.id === currentCmdId ? 'active' : ''}`;
      li.innerHTML = `
        <div class="list-item-info">
          <span class="item-title">${escapeHtml(cmd.name)}</span>
          <span class="item-url">${escapeHtml(cmd.url || '')}</span>
        </div>
        <span class="item-badge item-method-badge badge-${cmd.method}">${cmd.method}</span>
        <div class="list-item-actions">
          <button class="item-action-btn item-edit-btn" title="Edit command" aria-label="Edit command">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
            </svg>
          </button>
          <button class="item-action-btn item-delete-btn" title="Delete command" aria-label="Delete command">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6l-1 14H6L5 6"></path>
              <path d="M10 11v6"></path>
              <path d="M14 11v6"></path>
              <path d="M9 6V4h6v2"></path>
            </svg>
          </button>
          <button class="item-action-btn item-run-btn" title="Send request" aria-label="Send request">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <polygon points="5,3 19,12 5,21"></polygon>
            </svg>
          </button>
        </div>
      `;
      li.addEventListener('click', (e) => {
        if (!e.target.closest('.item-action-btn')) {
          setCurrentCommand(cmd);
          closeEditorModal();
          sendRequest(cmd);
        }
      });
      li.querySelector('.item-edit-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        selectCommand(cmd.id);
      });
      li.querySelector('.item-delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCommandById(cmd.id);
      });
      li.querySelector('.item-run-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        setCurrentCommand(cmd);
        closeEditorModal();
        sendRequest(cmd);
      });
      commandListEl.appendChild(li);
    });
  }

  function setCurrentCommand(cmd) {
    currentCmdId = cmd.id;
    renderList();
    responseEditToggleBtn.classList.remove('hidden');
    deleteBtn.classList.remove('hidden');
    editorTitle.textContent = 'Edit Command';

    nameInp.value = cmd.name || '';
    methodInp.value = cmd.method || 'GET';
    urlInp.value = cmd.url || '';
    setHeaderRows(cmd.headers || []);
    bodyInp.value = cmd.body || '';
  }

  // ========== SELECT COMMAND ==========
  function selectCommand(id) {
    const cmd = commands.find(c => c.id === id);
    if (!cmd) return;

    setCurrentCommand(cmd);
    showEditor();
  }

  function showEditor() {
    openEditorModal();
  }

  function openEditorModal() {
    editorPanel.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function closeEditorModal() {
    editorPanel.classList.add('hidden');
    updateModalBodyState();
  }

  function openVariablesModal() {
    variablesModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function closeVariablesModal() {
    variablesModal.classList.add('hidden');
    updateModalBodyState();
  }

  function openJsonVariableModal(mode) {
    if (!pendingJsonVariableSelection) return;

    jsonVariableMode = mode;
    jsonVariableModalTitle.textContent = mode === 'existing' ? 'Update Variable From Response' : 'Save Response Value';
    jsonVariablePath.value = pendingJsonVariableSelection.path;
    jsonVariableValuePreview.value = pendingJsonVariableSelection.value;
    jsonVariableModalMsg.textContent = '';
    jsonVariableModalMsg.className = 'modal-inline-msg';
    jsonVariableExistingGroup.classList.toggle('hidden', mode !== 'existing');
    jsonVariableNewGroup.classList.toggle('hidden', mode !== 'new');

    if (mode === 'existing') {
      populateVariableSelect();
      if (variables.length === 0) {
        openJsonVariableModal('new');
        return;
      }
      updateJsonVariableAutoPopulateState();
      jsonVariableSelect.focus();
    } else {
      jsonVariableName.value = suggestVariableNameFromPath(pendingJsonVariableSelection.path);
      updateJsonVariableAutoPopulateState();
      jsonVariableName.focus();
      jsonVariableName.select();
    }

    jsonVariableModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function closeJsonVariableModal() {
    jsonVariableModal.classList.add('hidden');
    updateModalBodyState();
  }

  function updateModalBodyState() {
    const hasOpenModal = !editorPanel.classList.contains('hidden')
      || !variablesModal.classList.contains('hidden')
      || !jsonVariableModal.classList.contains('hidden');
    document.body.classList.toggle('modal-open', hasOpenModal);
  }

  function showJsonVariableMenu(clientX, clientY) {
    const hasExistingVariables = variables.length > 0;
    saveToExistingVariableBtn.disabled = !hasExistingVariables;
    jsonVariableMenu.classList.remove('hidden');

    const { innerWidth, innerHeight } = window;
    const menuWidth = jsonVariableMenu.offsetWidth;
    const menuHeight = jsonVariableMenu.offsetHeight;
    const left = Math.min(clientX, innerWidth - menuWidth - 10);
    const top = Math.min(clientY, innerHeight - menuHeight - 10);

    jsonVariableMenu.style.left = `${Math.max(10, left)}px`;
    jsonVariableMenu.style.top = `${Math.max(10, top)}px`;
  }

  function hideJsonVariableMenu() {
    jsonVariableMenu.classList.add('hidden');
  }

  async function copyPendingJsonValue() {
    if (!pendingJsonVariableSelection) return;

    hideJsonVariableMenu();

    try {
      await copyTextToClipboard(pendingJsonVariableSelection.value);
      showSidebarMessage('Copied response value.', 'success');
    } catch (error) {
      showSidebarMessage('Failed to copy response value.', 'error');
    }
  }

  async function copyTextToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand?.('copy');
    document.body.removeChild(textarea);

    if (!copied) {
      throw new Error('Clipboard copy failed.');
    }
  }

  function populateVariableSelect() {
    jsonVariableSelect.innerHTML = '';
    variables.forEach((variable) => {
      const option = document.createElement('option');
      option.value = variable.key;
      option.textContent = variable.key;
      jsonVariableSelect.appendChild(option);
    });
  }

  closeEditorModalBtn.addEventListener('click', closeEditorModal);
  closeVariablesModalBtn.addEventListener('click', closeVariablesModal);
  cancelJsonVariableBtn.addEventListener('click', closeJsonVariableModal);
  copyJsonValueBtn.addEventListener('click', () => {
    copyPendingJsonValue();
  });
  openVariablesModalBtn.addEventListener('click', openVariablesModal);
  jsonVariableSelect.addEventListener('change', updateJsonVariableAutoPopulateState);
  jsonVariableName.addEventListener('input', updateJsonVariableAutoPopulateState);

  jsonVariableMenu.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      hideJsonVariableMenu();
      openJsonVariableModal(button.dataset.mode);
    });
  });

  editorPanel.addEventListener('click', (event) => {
    if (event.target === editorPanel) {
      closeEditorModal();
    }
  });

  variablesModal.addEventListener('click', (event) => {
    if (event.target === variablesModal) {
      closeVariablesModal();
    }
  });

  jsonVariableModal.addEventListener('click', (event) => {
    if (event.target === jsonVariableModal) {
      closeJsonVariableModal();
    }
  });

  document.addEventListener('click', (event) => {
    if (!jsonVariableMenu.classList.contains('hidden') && !jsonVariableMenu.contains(event.target)) {
      hideJsonVariableMenu();
    }
  });

  document.addEventListener('scroll', hideJsonVariableMenu, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!jsonVariableMenu.classList.contains('hidden')) {
      hideJsonVariableMenu();
      return;
    }
    if (!jsonVariableModal.classList.contains('hidden')) {
      closeJsonVariableModal();
      return;
    }
    if (!variablesModal.classList.contains('hidden')) {
      closeVariablesModal();
      return;
    }
    if (!editorPanel.classList.contains('hidden')) {
      closeEditorModal();
    }
  });

  responseEditToggleBtn.addEventListener('click', () => {
    if (!currentCmdId) return;
    openEditorModal();
  });

  responseResendBtn.addEventListener('click', () => {
    if (!lastExecutedCommandSnapshot || isResponseRequestRunning || isResponseVarRefreshRunning) return;
    sendRequest(cloneCommandSnapshot(lastExecutedCommandSnapshot));
  });

  responseRefreshVarsBtn.addEventListener('click', async () => {
    if (!lastExecutedCommandSnapshot || isResponseRequestRunning || isResponseVarRefreshRunning) return;

    const refreshableKeys = getRefreshableVariableKeysForCommand(lastExecutedCommandSnapshot);
    if (refreshableKeys.length === 0) {
      showSidebarMessage('This request does not use any bound variables.', 'error');
      updateResponseHeaderActions();
      return;
    }

    isResponseVarRefreshRunning = true;
    updateResponseHeaderActions();

    const refreshedKeys = [];
    const failedKeys = [];

    try {
      for (const variableKey of refreshableKeys) {
        try {
          await executeBoundVariableRefresh(variableKey);
          refreshedKeys.push(variableKey);
        } catch (error) {
          failedKeys.push({ key: variableKey, message: error.message || `Failed to refresh $${variableKey}.` });
        }
      }

      if (failedKeys.length === 0) {
        showSidebarMessage(`Refreshed ${refreshedKeys.length} bound variable${refreshedKeys.length === 1 ? '' : 's'} for this request.`, 'success');
      } else if (refreshedKeys.length === 0) {
        showSidebarMessage(failedKeys[0].message, 'error');
      } else {
        showSidebarMessage(`Refreshed ${refreshedKeys.length} variable${refreshedKeys.length === 1 ? '' : 's'}; ${failedKeys.length} failed.`, 'error');
      }
    } finally {
      isResponseVarRefreshRunning = false;
      updateResponseHeaderActions();
    }
  });

  // ========== NEW COMMAND ==========
  document.getElementById('newCommandBtn').addEventListener('click', () => {
    currentCmdId = null;
    renderList();
    showEditor();
    responseEditToggleBtn.classList.add('hidden');
    deleteBtn.classList.add('hidden');
    editorTitle.textContent = 'New Command';
    commandForm.reset();
    setHeaderRows([]);
  });

  addVariableBtn.addEventListener('click', () => {
    appendVariableRow({ key: '', value: '', sensitive: false }, true, true);
    syncVariablesFromEditor();
  });

  saveJsonVariableBtn.addEventListener('click', () => {
    if (!pendingJsonVariableSelection) return;

    const variableKey = jsonVariableMode === 'existing'
      ? jsonVariableSelect.value
      : jsonVariableName.value.trim();

    if (!variableKey) {
      setJsonVariableModalMessage('Variable name is required.', 'error');
      return;
    }

    if (!isValidVariableName(variableKey)) {
      setJsonVariableModalMessage('Use letters, numbers, and underscores, starting with a letter or underscore.', 'error');
      return;
    }

    upsertVariable(variableKey, pendingJsonVariableSelection.value);
    if (jsonVariableAutoPopulate.checked) {
      if (!lastExecutedCommandId) {
        setJsonVariableModalMessage('Auto-populate requires a saved command. Save the request first, then run it again.', 'error');
        return;
      }
      upsertVariableBinding(variableKey, pendingJsonVariableSelection.segments, lastExecutedRequestInfo, lastExecutedCommandId);
    } else {
      removeVariableBinding(variableKey, lastExecutedCommandId);
    }
    setVariableRows(variables);
    setJsonVariableModalMessage(`Saved to $${variableKey}.`, 'success');
    showSidebarMessage(`Saved ${pendingJsonVariableSelection.path} to $${variableKey}.`, 'success');
    window.setTimeout(() => {
      closeJsonVariableModal();
    }, 180);
  });

  addHeaderBtn.addEventListener('click', () => {
    appendHeaderRow({ key: '', value: '' }, true, true);
  });

  importCommandsBtn.addEventListener('click', () => {
    importFileInput.value = '';
    importFileInput.click();
  });

  exportCommandsBtn.addEventListener('click', () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      theme: themeToggle.checked ? 'dark' : 'light',
      commands,
      variables: serializeVariableRows(),
      variableBindings
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `named-curl-${dateStamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showSidebarMessage('Commands exported.', 'success');
  });

  importFileInput.addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const importedCommands = Array.isArray(parsed) ? parsed : parsed.commands;

      if (!Array.isArray(importedCommands)) {
        throw new Error('JSON must contain a commands array.');
      }

      const normalizedCommands = importedCommands
        .map(normalizeImportedCommandShape)
        .filter(Boolean);

      if (normalizedCommands.length === 0) {
        throw new Error('No valid commands found in the file.');
      }

      commands = normalizedCommands;
      variables = normalizeStoredVariables(parsed && typeof parsed === 'object' ? parsed.variables : []);
      variableBindings = normalizeStoredBindings(parsed && typeof parsed === 'object' ? parsed.variableBindings : [], normalizedCommands);
      currentCmdId = null;
      renderList();
      responseEditToggleBtn.classList.add('hidden');
      closeEditorModal();
      setVariableRows(variables);

      const importedTheme = parsed && typeof parsed === 'object' && typeof parsed.theme === 'string'
        ? (parsed.theme === 'light' ? 'light' : 'dark')
        : null;

      Promise.all([
        persistCommands(commands),
        persistVariables(variables),
        persistVariableBindings(variableBindings),
        importedTheme ? persistTheme(importedTheme) : Promise.resolve()
      ]).then(() => {
        if (importedTheme) {
          applyTheme(importedTheme);
        }
        showSidebarMessage(`Imported ${commands.length} command${commands.length === 1 ? '' : 's'}.`, 'success');
      });
    } catch (error) {
      showSidebarMessage(error.message || 'Import failed.', 'error');
    }
  });

  // ========== SAVE ==========
  commandForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const cmd = {
      id: currentCmdId || createCommandId(),
      name: nameInp.value,
      method: methodInp.value,
      url: urlInp.value,
      headers: serializeHeaderRows(),
      body: bodyInp.value
    };

    if (currentCmdId) {
      const idx = commands.findIndex(c => c.id === currentCmdId);
      if (idx !== -1) commands[idx] = cmd;
    } else {
      commands.push(cmd);
      currentCmdId = cmd.id;
    }

    syncBindingMetadataForCommand(cmd);

    Promise.all([
      persistCommands(commands),
      persistVariableBindings(variableBindings)
    ]).then(() => {
      renderList();
      setVariableRows(variables);
      deleteBtn.classList.remove('hidden');
      editorTitle.textContent = 'Edit Command';
      responseEditToggleBtn.classList.remove('hidden');
      saveMsg.classList.add('show');
      setTimeout(() => saveMsg.classList.remove('show'), 2000);
      closeEditorModal();
    });
  });

  // ========== DELETE ==========
  deleteBtn.addEventListener('click', () => {
    deleteCommandById(currentCmdId);
  });

  function deleteCommandById(commandId) {
    if (!commandId) return;
    if (!confirm('Delete this command?')) return;

    const wasCurrent = currentCmdId === commandId;
    commands = commands.filter((command) => command.id !== commandId);
    variableBindings = variableBindings.filter((binding) => binding.commandId !== commandId);

    Promise.all([
      persistCommands(commands),
      persistVariableBindings(variableBindings)
    ]).then(() => {
      if (wasCurrent) {
        currentCmdId = null;
        renderList();
        responseEditToggleBtn.classList.add('hidden');
        closeEditorModal();
        return;
      }

      renderList();
    });
  }

  urlInp.addEventListener('paste', (event) => {
    const clipboardText = event.clipboardData?.getData('text') || '';
    if (!isCurlCommand(clipboardText)) return;

    event.preventDefault();
    applyCurlCommandToEditor(clipboardText);
  });

  urlInp.addEventListener('input', () => {
    urlInp.setCustomValidity('');
  });

  urlInp.addEventListener('blur', () => {
    if (!isCurlCommand(urlInp.value)) return;
    applyCurlCommandToEditor(urlInp.value);
  });

  // ========== SEND REQUEST ==========
  sendBtn.addEventListener('click', () => {
    const cmd = {
      id: currentCmdId || '',
      name: nameInp.value,
      method: methodInp.value,
      url: urlInp.value,
      headers: serializeHeaderRows(),
      body: bodyInp.value
    };
    if (!cmd.url) return;
    closeEditorModal();
    sendRequest(cmd);
  });

  async function sendRequest(cmd) {
    // Show response panel
    responsePanel.classList.remove('hidden');
    lastExecutedCommandId = cmd.id || null;
    lastExecutedCommandSnapshot = cloneCommandSnapshot(cmd);
    isResponseRequestRunning = true;
    updateResponseHeaderActions();

    // Loading state
    sendBtn.classList.add('loading');
    statusBadge.textContent = 'Sending...';
    statusBadge.className = 'status-badge loading';
    statusBadge.classList.remove('hidden');
    responseTime.classList.add('hidden');
    responseState = { type: 'text', text: 'Fetching...', json: null, headers: 'Fetching...' };
    responseSearchInput.value = '';
    responseSearchInput.disabled = true;
    previewTab.classList.add('hidden');
    if (previewTab.classList.contains('active')) {
      setActiveTab('resBody');
    }
    resPreviewFrame.srcdoc = '';
    renderResponseBody(responseState);
    resHeadersContent.textContent = 'Fetching...';

    const variableMap = buildRequestVariableMap(variables);
    const executionResult = await executeRequest(cmd, { variableMap });
    const resolvedCommand = executionResult.resolvedCommand;
    lastExecutedRequestInfo = {
      name: String(resolvedCommand.name || cmd.name || '').trim(),
      url: String(resolvedCommand.url || cmd.url || '').trim(),
      method: String(resolvedCommand.method || cmd.method || 'GET').toUpperCase()
    };
    renderRequestSnapshot(resolvedCommand, resolvedCommand.headers);

    if (executionResult.skippedHeaders.length > 0) {
      showSidebarMessage(`Skipped invalid request headers: ${executionResult.skippedHeaders.join(', ')}.`, 'error');
    }

    if (executionResult.ok) {
      const { response, timeMs, text, headersText, isHtml, isJson, json } = executionResult;

      statusBadge.textContent = `${response.status} ${response.statusText}`;
      statusBadge.className = `status-badge ${response.ok ? 'success' : 'error'}`;
      responseTime.textContent = timeMs + 'ms';
      responseTime.classList.remove('hidden');

      responseState = {
        type: isJson ? 'json' : (isHtml ? 'html' : 'text'),
        text,
        json,
        headers: headersText
      };

      if (isJson && json !== null && lastExecutedCommandId) {
        applyVariableBindings(json, lastExecutedCommandId);
      }

      responseSearchInput.disabled = false;
      previewTab.classList.toggle('hidden', !isHtml);
      if (isHtml) {
        resPreviewFrame.srcdoc = text;
        setActiveTab('resPreview');
      } else {
        resPreviewFrame.srcdoc = '';
        if (previewTab.classList.contains('active')) {
          setActiveTab('resBody');
        }
      }

      renderResponseBody(responseState);
      resHeadersContent.textContent = responseState.headers;
    } else {
      statusBadge.textContent = 'FETCH ERROR';
      statusBadge.className = 'status-badge error';
      responseTime.textContent = executionResult.timeMs + 'ms';
      responseTime.classList.remove('hidden');
      responseState = {
        type: 'text',
        text: executionResult.text,
        json: null,
        headers: 'Request failed.'
      };
      responseSearchInput.disabled = false;
      previewTab.classList.add('hidden');
      if (previewTab.classList.contains('active')) {
        setActiveTab('resBody');
      }
      resPreviewFrame.srcdoc = '';
      renderResponseBody(responseState);
      resHeadersContent.textContent = responseState.headers;
    }

    sendBtn.classList.remove('loading');
    isResponseRequestRunning = false;
    updateResponseHeaderActions();
  }

  // ========== RESPONSE TABS ==========
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      setActiveTab(e.currentTarget.dataset.target);
    });
  });

  // ========== HELPERS ==========
  function syncVariablesFromEditor() {
    variables = serializeVariableRows();
    window.clearTimeout(persistVariablesTimeoutId);
    persistVariablesTimeoutId = window.setTimeout(() => {
      persistVariables(variables);
    }, 120);
  }

  function upsertVariable(key, value, options = {}) {
    const normalizedKey = String(key).trim();
    const nextValue = String(value ?? '');
    const existingIndex = variables.findIndex((variable) => variable.key === normalizedKey);
    const nextSensitive = typeof options.sensitive === 'boolean'
      ? options.sensitive
      : (existingIndex >= 0 ? Boolean(variables[existingIndex].sensitive) : false);

    if (existingIndex >= 0) {
      variables[existingIndex] = { key: normalizedKey, value: nextValue, sensitive: nextSensitive };
    } else {
      variables = [{ key: normalizedKey, value: nextValue, sensitive: nextSensitive }, ...variables];
    }

    setVariableRows(variables);
    window.clearTimeout(persistVariablesTimeoutId);
    persistVariables(variables);
  }

  function upsertVariableBinding(variableKey, segments, sourceRequest = {}, commandId = '') {
    const normalizedBindings = normalizeStoredBindings(variableBindings, commands);
    const path = formatJsonPath(segments);
    const nextBinding = {
      variableKey,
      segments: [...segments],
      path,
      commandId: String(commandId || '').trim(),
      sourceRequestName: String(sourceRequest.name || '').trim(),
      sourceRequestUrl: String(sourceRequest.url || '').trim()
    };
    const existingIndex = normalizedBindings.findIndex((binding) => binding.variableKey === variableKey);

    if (existingIndex >= 0) {
      normalizedBindings[existingIndex] = nextBinding;
    } else {
      normalizedBindings.push(nextBinding);
    }

    variableBindings = normalizedBindings;
    persistVariableBindings(variableBindings);
    updateResponseHeaderActions();
  }

  function removeVariableBinding(variableKey, commandId = null) {
    const normalizedBindings = normalizeStoredBindings(variableBindings, commands);
    const nextBindings = normalizedBindings.filter((binding) => {
      if (binding.variableKey !== variableKey) return true;
      if (!commandId) return false;
      return binding.commandId !== commandId;
    });
    if (nextBindings.length === normalizedBindings.length) return;

    variableBindings = nextBindings;
    persistVariableBindings(variableBindings);
    updateResponseHeaderActions();
  }

  function renameVariableBinding(previousKey, nextKey) {
    if (!previousKey || previousKey === nextKey) return;

    const normalizedBindings = normalizeStoredBindings(variableBindings, commands);
    const existingBinding = normalizedBindings.find((binding) => binding.variableKey === previousKey);
    if (!existingBinding) return;

    if (!nextKey) {
      variableBindings = normalizedBindings.filter((binding) => binding.variableKey !== previousKey);
      persistVariableBindings(variableBindings);
      updateResponseHeaderActions();
      return;
    }

    variableBindings = normalizedBindings
      .filter((binding) => binding.variableKey !== previousKey && binding.variableKey !== nextKey)
      .concat({ ...existingBinding, variableKey: nextKey });
    persistVariableBindings(variableBindings);
    updateResponseHeaderActions();
  }

  function getVariableBinding(variableKey, commandId = null) {
    return normalizeStoredBindings(variableBindings, commands).find((binding) => {
      if (binding.variableKey !== variableKey) return false;
      if (!commandId) return true;
      return binding.commandId === commandId;
    }) || null;
  }

  async function refreshBoundVariable(variableKey, row) {
    row.dataset.refreshing = 'true';
    updateVariableRowMeta(row);

    try {
      const refreshResult = await executeBoundVariableRefresh(variableKey);
      showSidebarMessage(`Refreshed $${variableKey} from ${refreshResult.sourceLabel}.`, 'success');
    } catch (error) {
      showSidebarMessage(error.message || `Failed to refresh $${variableKey}.`, 'error');
    } finally {
      if (row.isConnected) {
        row.dataset.refreshing = 'false';
        updateVariableRowMeta(row);
      }
    }
  }

  async function executeBoundVariableRefresh(variableKey) {
    const binding = getVariableBinding(variableKey);
    if (!binding) {
      throw new Error(`No binding found for $${variableKey}.`);
    }

    const sourceCommand = getBindingSourceCommand(binding);
    if (!sourceCommand) {
      throw new Error(`The saved source request for $${variableKey} is no longer available.`);
    }

    const executionResult = await executeRequest(sourceCommand, {
      variableMap: buildRequestVariableMap(variables)
    });

    if (!executionResult.ok) {
      throw new Error(executionResult.text || `Failed to refresh $${variableKey}.`);
    }
    if (!executionResult.response.ok) {
      throw new Error(`Refresh failed: ${executionResult.response.status} ${executionResult.response.statusText}`);
    }
    if (!executionResult.isJson || executionResult.json === null) {
      throw new Error('Refresh failed: source request did not return valid JSON.');
    }

    const nextValue = getJsonValueAtPathSegments(executionResult.json, binding.segments);
    if (typeof nextValue === 'undefined') {
      throw new Error(`Refresh failed: ${binding.path} was not found in the response.`);
    }

    applyVariableBindings(executionResult.json, binding.commandId);
    return {
      variableKey,
      sourceLabel: String(sourceCommand.name || '').trim() || 'its source request'
    };
  }

  function applyVariableBindings(responseJson, commandId) {
    const bindings = normalizeStoredBindings(variableBindings, commands).filter((binding) => binding.commandId === commandId);
    if (bindings.length === 0) return;

    let didUpdate = false;
    const nextVariables = [...variables];

    bindings.forEach((binding) => {
      const nextValue = getJsonValueAtPathSegments(responseJson, binding.segments);
      if (typeof nextValue === 'undefined') return;

      const serializedValue = serializeJsonValue(nextValue);
      const existingIndex = nextVariables.findIndex((variable) => variable.key === binding.variableKey);
      if (existingIndex >= 0) {
        if (nextVariables[existingIndex].value === serializedValue) return;
        nextVariables[existingIndex] = { ...nextVariables[existingIndex], value: serializedValue };
      } else {
        nextVariables.unshift({ key: binding.variableKey, value: serializedValue, sensitive: false });
      }
      didUpdate = true;
    });

    if (!didUpdate) return;
    variables = nextVariables;
    setVariableRows(variables);
    window.clearTimeout(persistVariablesTimeoutId);
    persistVariables(variables);
  }

  function applyCurlCommandToEditor(rawCurl) {
    const parsedCurl = parseCurlCommandInput(rawCurl);
    if (!parsedCurl.url) {
      urlInp.setCustomValidity('Could not detect a URL in the pasted cURL command.');
      urlInp.reportValidity();
      return false;
    }

    urlInp.setCustomValidity('');
    urlInp.value = parsedCurl.url;
    methodInp.value = parsedCurl.method;
    bodyInp.value = parsedCurl.body;
    setHeaderRows(parsedCurl.headers);

    if (!nameInp.value.trim()) {
      nameInp.value = parsedCurl.name;
    }

    showSidebarMessage('Parsed cURL into request fields.', 'success');
    return true;
  }

  function updateResponseHeaderActions() {
    const hasLastRequest = Boolean(lastExecutedCommandSnapshot && String(lastExecutedCommandSnapshot.url || '').trim());
    const refreshableKeys = hasLastRequest ? getRefreshableVariableKeysForCommand(lastExecutedCommandSnapshot) : [];

    responseResendBtn.classList.toggle('hidden', !hasLastRequest);
    responseRefreshVarsBtn.classList.toggle('hidden', refreshableKeys.length === 0);

    responseResendBtn.disabled = !hasLastRequest || isResponseRequestRunning || isResponseVarRefreshRunning;
    responseRefreshVarsBtn.disabled = refreshableKeys.length === 0 || isResponseRequestRunning || isResponseVarRefreshRunning;

    responseResendBtn.classList.toggle('loading', isResponseRequestRunning);
    responseRefreshVarsBtn.classList.toggle('loading', isResponseVarRefreshRunning);

    responseResendBtn.textContent = isResponseRequestRunning ? 'Sending...' : 'Resend';
    responseRefreshVarsBtn.textContent = isResponseVarRefreshRunning ? 'Refreshing...' : 'Refresh Vars';
    responseRefreshVarsBtn.title = refreshableKeys.length > 0
      ? `Refresh ${refreshableKeys.length} bound variable${refreshableKeys.length === 1 ? '' : 's'} used in this request`
      : 'No bound variables used in this request';
  }

  function getRefreshableVariableKeysForCommand(cmd) {
    if (!cmd) return [];

    const referencedKeys = new Set();
    extractReferencedVariableNames(String(cmd.url || '')).forEach((key) => referencedKeys.add(key));
    extractReferencedVariableNames(String(cmd.body || '')).forEach((key) => referencedKeys.add(key));

    (Array.isArray(cmd.headers) ? cmd.headers : []).forEach((header) => {
      extractReferencedVariableNames(String(header.key || '')).forEach((key) => referencedKeys.add(key));
      extractReferencedVariableNames(String(header.value || '')).forEach((key) => referencedKeys.add(key));
    });

    return Array.from(referencedKeys).filter((variableKey) => Boolean(getVariableBinding(variableKey)));
  }

  function cloneCommandSnapshot(cmd) {
    return {
      ...cmd,
      id: String(cmd?.id || ''),
      name: String(cmd?.name || ''),
      method: String(cmd?.method || 'GET').toUpperCase(),
      url: String(cmd?.url || ''),
      headers: Array.isArray(cmd?.headers)
        ? cmd.headers.map((header) => ({ key: String(header?.key || ''), value: String(header?.value || '') }))
        : [],
      body: String(cmd?.body || '')
    };
  }

  function setActiveTab(targetId) {
    document.querySelectorAll('.tab').forEach((button) => {
      button.classList.toggle('active', button.dataset.target === targetId);
    });
    document.querySelectorAll('.tab-content').forEach((content) => {
      content.classList.toggle('hidden', content.id !== targetId);
    });
  }

  function suggestVariableNameFromPath(path) {
    const lastToken = path.split(/\.|\[/).pop() || 'VALUE';
    const sanitized = lastToken.replace(/\]$/g, '').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^\d+/, 'VALUE_');
    return (sanitized || 'VALUE').toUpperCase();
  }

  function isValidVariableName(name) {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
  }

  function updateJsonVariableAutoPopulateState() {
    const selectedVariableKey = getJsonVariableTargetKey();
    if (!lastExecutedCommandId) {
      jsonVariableAutoPopulate.checked = false;
      jsonVariableAutoPopulate.disabled = true;
      jsonVariableAutoHint.textContent = 'Auto-populate is available only after running a saved command.';
      return;
    }

    const existingBinding = selectedVariableKey
      ? getVariableBinding(selectedVariableKey, lastExecutedCommandId)
      : null;

    jsonVariableAutoPopulate.checked = Boolean(existingBinding);
    jsonVariableAutoPopulate.disabled = false;
    jsonVariableAutoHint.textContent = selectedVariableKey
      ? `When enabled, $${selectedVariableKey} will refresh only when ${lastExecutedRequestInfo.name || 'this command'} runs again.`
      : 'When enabled, the selected variable will refresh only when this saved command runs again.';
  }

  function formatVariableBindingIndicator(binding) {
    const sourceCommand = getBindingSourceCommand(binding);
    const sourceLabel = sourceCommand
      ? (String(sourceCommand.name || '').trim() || formatVariableBindingSourceUrl(String(sourceCommand.url || '').trim()))
      : (binding.sourceRequestName || formatVariableBindingSourceUrl(binding.sourceRequestUrl) || 'saved response');
    return `${sourceLabel} · ${binding.path}`;
  }

  function getBindingSourceCommand(binding) {
    const bindingCommandId = String(binding.commandId || '').trim();
    if (!bindingCommandId) return null;
    return commands.find((command) => String(command.id || '').trim() === bindingCommandId) || null;
  }

  function syncBindingMetadataForCommand(command) {
    const commandId = String(command?.id || '').trim();
    if (!commandId) return;

    const nextBindings = normalizeStoredBindings(variableBindings, commands).map((binding) => {
      if (binding.commandId !== commandId) return binding;
      return {
        ...binding,
        sourceRequestName: String(command.name || '').trim(),
        sourceRequestUrl: String(command.url || '').trim()
      };
    });

    variableBindings = nextBindings;
  }

  function formatVariableBindingSourceUrl(url) {
    if (!url) return '';

    try {
      const parsedUrl = new URL(url);
      return `${parsedUrl.hostname}${parsedUrl.pathname}`;
    } catch (error) {
      return url;
    }
  }

  function getJsonVariableTargetKey() {
    return jsonVariableMode === 'existing'
      ? jsonVariableSelect.value
      : jsonVariableName.value.trim();
  }

  function setJsonVariableModalMessage(message, type = '') {
    jsonVariableModalMsg.textContent = message;
    jsonVariableModalMsg.className = type ? `modal-inline-msg ${type}` : 'modal-inline-msg';
  }

  function renderRequestSnapshot(cmd, headers) {
    const method = String(cmd.method || 'GET').toUpperCase();
    const methodForBadge = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'].includes(method) ? method : 'GET';
    const name = String(cmd.name || '').trim() || 'Ad-hoc Request';
    const url = String(cmd.url || '').trim();
    const requestBody = String(cmd.body || '');

    executedRequestName.textContent = name;
    executedRequestUrl.textContent = url || '-';
    executedRequestUrl.title = url || '';
    executedMethodBadge.textContent = methodForBadge;
    executedMethodBadge.className = `item-badge executed-method-badge badge-${methodForBadge}`;

    if (headers.length > 0) {
      reqHeadersContent.textContent = headers
        .filter((header) => header.key)
        .map((header) => `${header.key}: ${header.value || ''}`)
        .join('\n');
    } else {
      reqHeadersContent.textContent = 'No request headers.';
    }

    if (requestBody.trim() !== '' && method !== 'GET' && method !== 'HEAD') {
      try {
        reqBodyContent.textContent = JSON.stringify(JSON.parse(requestBody), null, 2);
      } catch (error) {
        reqBodyContent.textContent = requestBody;
      }
    } else {
      reqBodyContent.textContent = 'No request body.';
    }
  }
});
