import { SUPPORTED_METHODS } from '../shared/constants.js';
import { shouldSkipRequestHeaderName } from '../shared/request.js';
import { createCommandId, loadAppState, saveCommands } from '../shared/storage.js';
import { escapeHtml, formatRequestPath, getHostname, truncateText } from '../shared/utils.js';

const MAX_REQUESTS = 200;
const FETCH_XHR_FILTER_STORAGE_KEY = 'namedCurl.devtools.fetchXhrOnly';

const requestListEl = document.getElementById('requestList');
const requestSearchInput = document.getElementById('requestSearchInput');
const filterFetchXhrToggle = document.getElementById('filterFetchXhrToggle');
const captureCountEl = document.getElementById('captureCount');
const captureStatusEl = document.getElementById('captureStatus');
const clearRequestsBtn = document.getElementById('clearRequestsBtn');
const openWorkspaceBtn = document.getElementById('openWorkspaceBtn');
const emptyStateEl = document.getElementById('emptyState');
const detailViewEl = document.getElementById('detailView');
const detailMethodBadgeEl = document.getElementById('detailMethodBadge');
const detailUrlEl = document.getElementById('detailUrl');
const detailStatusEl = document.getElementById('detailStatus');
const detailTimingEl = document.getElementById('detailTiming');
const commandNameInput = document.getElementById('commandNameInput');
const requestHeadersContentEl = document.getElementById('requestHeadersContent');
const requestBodyContentEl = document.getElementById('requestBodyContent');
const saveRequestBtn = document.getElementById('saveRequestBtn');
const saveOpenRequestBtn = document.getElementById('saveOpenRequestBtn');

let requests = [];
let selectedRequestId = '';
let isNameDirty = false;
let isSaving = false;
let filterTerm = '';
let showFetchXhrOnly = readStoredBoolean(FETCH_XHR_FILTER_STORAGE_KEY);

applyTheme(chrome.devtools.panels.themeName);
chrome.devtools.panels.setThemeChangeHandler((themeName) => applyTheme(themeName));
filterFetchXhrToggle.checked = showFetchXhrOnly;

requestSearchInput.addEventListener('input', (event) => {
  filterTerm = String(event.target.value || '').trim().toLowerCase();
  renderRequestList();
  renderDetail();
});

filterFetchXhrToggle.addEventListener('change', (event) => {
  showFetchXhrOnly = Boolean(event.target.checked);
  storeBoolean(FETCH_XHR_FILTER_STORAGE_KEY, showFetchXhrOnly);
  renderRequestList();
  renderDetail();
});

clearRequestsBtn.addEventListener('click', () => {
  requests = [];
  selectedRequestId = '';
  isNameDirty = false;
  renderRequestList();
  renderDetail();
  setStatus('Cleared captured requests.', 'info');
});

openWorkspaceBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'options.html' });
});

commandNameInput.addEventListener('input', () => {
  isNameDirty = true;
});

saveRequestBtn.addEventListener('click', () => {
  saveSelectedRequest(false);
});

saveOpenRequestBtn.addEventListener('click', () => {
  saveSelectedRequest(true);
});

chrome.devtools.network.onRequestFinished.addListener((request) => {
  ingestRequest(request, false);
});

chrome.devtools.network.onNavigated.addListener((url) => {
  setStatus(`Navigated to ${truncateText(url, 80)}. Capturing new requests.`, 'info');
});

chrome.devtools.network.getHAR((harLog) => {
  const entries = Array.isArray(harLog?.entries) ? harLog.entries : [];
  entries.forEach((entry) => ingestRequest(entry, true));
  renderRequestList();
  renderDetail();

  if (entries.length > 0) {
    setStatus(`Loaded ${entries.length} request${entries.length === 1 ? '' : 's'} from the current HAR log.`, 'info');
  }
});

function applyTheme(themeName) {
  document.documentElement.dataset.theme = themeName === 'dark' ? 'dark' : 'light';
}

function ingestRequest(rawRequest, deferRender) {
  const normalized = normalizeDevtoolsRequest(rawRequest);
  if (!normalized) return;

  const existingIndex = requests.findIndex((request) => request.id === normalized.id);
  if (existingIndex >= 0) {
    requests[existingIndex] = normalized;
  } else {
    requests.unshift(normalized);
    if (requests.length > MAX_REQUESTS) {
      requests.length = MAX_REQUESTS;
    }
  }

  if (!selectedRequestId) {
    selectedRequestId = normalized.id;
    isNameDirty = false;
  }

  if (deferRender) return;

  renderRequestList();
  renderDetail();
  setStatus(`Captured ${normalized.method} ${truncateText(normalized.url, 88)}.`, 'info');
}

function normalizeDevtoolsRequest(entry) {
  const requestData = entry?.request;
  if (!requestData?.url) return null;
  if (String(requestData.url).startsWith('chrome-extension://')) return null;

  const method = normalizeMethod(requestData.method);
  const resourceType = normalizeResourceType(entry);
  const headers = Array.isArray(requestData.headers)
    ? requestData.headers.map((header) => normalizeHeader(header)).filter(Boolean)
    : [];
  const url = String(requestData.url || '').trim();
  const responseData = entry?.response || {};
  const status = Number.isFinite(responseData.status) ? responseData.status : 0;
  const timing = typeof entry.time === 'number' && Number.isFinite(entry.time)
    ? Math.max(0, Math.round(entry.time))
    : null;

  return {
    id: [String(entry.startedDateTime || ''), method, url, String(status)].join('|'),
    method,
    url,
    hostname: getHostname(url),
    status,
    statusText: String(responseData.statusText || ''),
    timing,
    resourceType,
    body: String(requestData.postData?.text || ''),
    headers,
    suggestedName: suggestCommandName(url)
  };
}

function normalizeHeader(header) {
  if (!header || typeof header !== 'object') return null;
  const name = String(header.name || '').trim();
  if (!name) return null;
  return {
    name,
    value: String(header.value || '')
  };
}

function normalizeMethod(method) {
  const upperMethod = String(method || 'GET').toUpperCase();
  return SUPPORTED_METHODS.includes(upperMethod) ? upperMethod : 'GET';
}

function renderRequestList() {
  const visibleRequests = getVisibleRequests();
  syncSelectedRequest(visibleRequests);
  captureCountEl.textContent = formatCaptureCount(visibleRequests.length);

  if (visibleRequests.length === 0) {
    requestListEl.innerHTML = `
      <div class="request-list-empty">
        <h2>No requests</h2>
        <p>${getEmptyListMessage()}</p>
      </div>
    `;
    return;
  }

  requestListEl.innerHTML = visibleRequests.map((request) => {
    const activeClass = request.id === selectedRequestId ? ' active' : '';

    return `
      <button type="button" class="request-item${activeClass}" data-request-id="${escapeHtml(request.id).replace(/'/g, '&#39;')}">
        <div class="request-item-top">
          <div class="request-domain">${escapeHtml(request.hostname || 'Unknown host')}</div>
          <div class="request-meta">
            <span class="method-badge method-${request.method}">${request.method}</span>
            <span class="status-badge ${getStatusClass(request.status)}">${formatStatusLabel(request.status)}</span>
            <span class="request-timing">${formatTiming(request.timing)}</span>
          </div>
        </div>
        <div class="request-item-bottom">
          <div class="request-url">${escapeHtml(truncateText(formatRequestPath(request.url), 120))}</div>
        </div>
      </button>
    `;
  }).join('');

  requestListEl.querySelectorAll('[data-request-id]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedRequestId = button.dataset.requestId || '';
      isNameDirty = false;
      renderRequestList();
      renderDetail();
    });
  });
}

function renderDetail() {
  const selectedRequest = requests.find((request) => request.id === selectedRequestId) || null;

  if (!selectedRequest) {
    emptyStateEl.classList.remove('hidden');
    detailViewEl.classList.add('hidden');
    saveRequestBtn.disabled = true;
    saveOpenRequestBtn.disabled = true;
    return;
  }

  emptyStateEl.classList.add('hidden');
  detailViewEl.classList.remove('hidden');

  detailMethodBadgeEl.textContent = selectedRequest.method;
  detailMethodBadgeEl.className = `method-badge method-${selectedRequest.method}`;
  detailUrlEl.textContent = selectedRequest.url;
  detailStatusEl.textContent = formatStatusLabel(selectedRequest.status);
  detailStatusEl.className = `detail-chip ${getStatusClass(selectedRequest.status)}`;
  detailTimingEl.textContent = formatTiming(selectedRequest.timing);

  if (!isNameDirty) {
    commandNameInput.value = selectedRequest.suggestedName;
  }

  requestHeadersContentEl.textContent = selectedRequest.headers.length > 0
    ? selectedRequest.headers.map((header) => `${header.name}: ${header.value}`).join('\n')
    : 'No request headers.';

  requestBodyContentEl.textContent = selectedRequest.body.trim() !== ''
    ? formatBody(selectedRequest.body)
    : 'No request body.';

  saveRequestBtn.disabled = isSaving;
  saveOpenRequestBtn.disabled = isSaving;
}

function getVisibleRequests() {
  return requests.filter((request) => {
    if (showFetchXhrOnly && !isFetchXhrRequest(request)) {
      return false;
    }

    if (!filterTerm) {
      return true;
    }

    const haystack = [
      request.method,
      request.url,
      request.hostname,
      request.suggestedName,
      request.resourceType
    ].join(' ').toLowerCase();

    return haystack.includes(filterTerm);
  });
}

async function saveSelectedRequest(openAfterSave) {
  if (isSaving) return;

  const selectedRequest = requests.find((request) => request.id === selectedRequestId);
  if (!selectedRequest) return;

  isSaving = true;
  updateSaveButtons();

  try {
    const commandName = String(commandNameInput.value || '').trim() || selectedRequest.suggestedName;
    const importableHeaders = filterImportableHeaders(selectedRequest.headers);
    const { commands } = await loadAppState({ seedSample: false });

    const nextCommand = {
      id: createCommandId(),
      name: commandName,
      method: selectedRequest.method,
      url: selectedRequest.url,
      tags: [],
      headers: importableHeaders.headers.map((header) => ({
        key: header.name,
        value: header.value
      })),
      body: selectedRequest.method === 'GET' || selectedRequest.method === 'HEAD'
        ? ''
        : selectedRequest.body
    };

    commands.push(nextCommand);
    await saveCommands(commands);

    setStatus(
      importableHeaders.skipped.length > 0
        ? `Saved ${nextCommand.name}. Skipped unsupported headers: ${importableHeaders.skipped.join(', ')}.`
        : `Saved ${nextCommand.name} to Named Curl.`,
      'success'
    );

    if (openAfterSave) {
      chrome.tabs.create({ url: `options.html?action=edit&editId=${encodeURIComponent(nextCommand.id)}` });
    }
  } catch (error) {
    setStatus(error?.message || 'Failed to save the selected request.', 'error');
  } finally {
    isSaving = false;
    updateSaveButtons();
  }
}

function updateSaveButtons() {
  saveRequestBtn.disabled = isSaving;
  saveOpenRequestBtn.disabled = isSaving;
  saveRequestBtn.textContent = isSaving ? 'Saving...' : 'Add To Named Curl';
  saveOpenRequestBtn.textContent = isSaving ? 'Saving...' : 'Add And Open';
}

function filterImportableHeaders(headers) {
  const filteredHeaders = [];
  const skipped = [];

  headers.forEach((header) => {
    const headerName = String(header?.name || '').trim();
    if (!headerName) return;

    if (shouldSkipRequestHeaderName(headerName)) {
      skipped.push(headerName);
      return;
    }

    try {
      const probeHeaders = new Headers();
      probeHeaders.append(headerName, String(header?.value ?? ''));
      filteredHeaders.push({
        name: headerName,
        value: String(header?.value ?? '')
      });
    } catch (error) {
      skipped.push(headerName);
    }
  });

  return {
    headers: filteredHeaders,
    skipped
  };
}

function suggestCommandName(url) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.pathname.split('/').filter(Boolean).pop() || parsedUrl.hostname || 'request';
  } catch (error) {
    return 'request';
  }
}

function normalizeResourceType(entry) {
  const directType = getResourceTypeCandidate(entry);
  if (directType) return directType;

  const initiatorType = getResourceTypeCandidate(entry?._initiator);
  if (initiatorType === 'PREFLIGHT') return initiatorType;

  return 'OTHER';
}

function getResourceTypeCandidate(source) {
  if (!source || typeof source !== 'object') return '';

  const candidates = [
    source._resourceType,
    source.resourceType,
    source.type,
    source.name
  ];

  for (const candidate of candidates) {
    const normalized = normalizeResourceTypeName(candidate);
    if (normalized) return normalized;
  }

  return '';
}

function normalizeResourceTypeName(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';

  const normalized = rawValue.replace(/[^a-z]/gi, '').toUpperCase();
  if (!normalized) return '';

  return normalized === 'XMLHTTPREQUEST' ? 'XHR' : normalized;
}

function isFetchXhrRequest(request) {
  return request.resourceType === 'FETCH' || request.resourceType === 'XHR';
}

function syncSelectedRequest(visibleRequests) {
  if (visibleRequests.some((request) => request.id === selectedRequestId)) return;
  selectedRequestId = visibleRequests[0] ? visibleRequests[0].id : '';
  isNameDirty = false;
}

function formatCaptureCount(visibleCount) {
  const totalCount = requests.length;
  const totalLabel = `${totalCount} request${totalCount === 1 ? '' : 's'}`;
  if (visibleCount === totalCount) return totalLabel;
  return `${visibleCount} of ${totalLabel}`;
}

function getEmptyListMessage() {
  if (showFetchXhrOnly && filterTerm) {
    return 'No fetch/XHR requests match the current filter.';
  }

  if (showFetchXhrOnly) {
    return 'No fetch/XHR requests have been captured yet.';
  }

  if (filterTerm) {
    return 'No captured requests match the current filter.';
  }

  return 'Open the Network tab and trigger requests to populate this list.';
}

function readStoredBoolean(key) {
  try {
    return window.localStorage.getItem(key) === 'true';
  } catch (error) {
    return false;
  }
}

function storeBoolean(key, value) {
  try {
    window.localStorage.setItem(key, value ? 'true' : 'false');
  } catch (error) {
    // Ignore storage failures in the panel.
  }
}

function formatTiming(timing) {
  return timing === null ? 'n/a' : `${timing} ms`;
}

function formatStatusLabel(status) {
  return status > 0 ? String(status) : 'Pending';
}

function getStatusClass(status) {
  if (status >= 200 && status < 400) return 'status-success';
  if (status >= 400) return 'status-error';
  return 'status-pending';
}

function formatBody(body) {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch (error) {
    return body;
  }
}

function setStatus(message, tone) {
  captureStatusEl.textContent = message;
  captureStatusEl.style.color = tone === 'success'
    ? 'var(--success)'
    : tone === 'error'
      ? 'var(--danger)'
      : 'var(--text-muted)';
}
