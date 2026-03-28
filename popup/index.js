import { loadAppState } from '../shared/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
  const listContainer = document.getElementById('listContainer');
  const template = document.getElementById('itemTemplate');
  const searchInput = document.getElementById('searchInput');
  const settingsBtn = document.getElementById('settingsBtn');
  const addNewBtn = document.getElementById('addNewBtn');

  const { commands, theme } = await loadAppState();
  let visibleCommands = [...commands];

  document.documentElement.setAttribute('data-theme', theme);
  focusSearchInput();

  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  addNewBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'options.html?action=new' });
  });

  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusCommandItem(0);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusCommandItem(getCommandItems().length - 1);
    }
  });

  searchInput.addEventListener('input', (event) => {
    const term = String(event.target.value || '').trim().toLowerCase();
    visibleCommands = commands.filter((command) => (
      command.name.toLowerCase().includes(term)
      || command.url.toLowerCase().includes(term)
      || (Array.isArray(command.tags) && command.tags.some((tag) => String(tag).toLowerCase().includes(term)))
    ));
    renderList(visibleCommands);
  });

  renderList(visibleCommands);

  function renderList(nextCommands) {
    listContainer.innerHTML = '';

    if (nextCommands.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <p>No commands found.</p>
          <button id="addFirstBtn">Add Command</button>
        </div>
      `;

      const addFirstBtn = document.getElementById('addFirstBtn');
      if (addFirstBtn) {
        addFirstBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
      }
      return;
    }

    nextCommands.forEach((command) => {
      const clone = template.content.cloneNode(true);
      const itemEl = clone.querySelector('.command-item');
      const methodEl = clone.querySelector('.item-method');
      const editBtn = clone.querySelector('.edit-btn');

      clone.querySelector('.item-name').textContent = command.name;
      clone.querySelector('.item-url').textContent = command.url;
      methodEl.textContent = command.method;
      methodEl.classList.add(`method-${command.method}`);

      editBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        chrome.tabs.create({ url: `options.html?action=edit&editId=${encodeURIComponent(command.id)}` });
      });

      itemEl.addEventListener('click', () => executeCommand(command.id));
      itemEl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          executeCommand(command.id);
          return;
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          focusAdjacentCommandItem(itemEl, 1);
          return;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          focusAdjacentCommandItem(itemEl, -1);
        }
      });

      listContainer.appendChild(clone);
    });
  }

  function executeCommand(commandId) {
    chrome.tabs.create({ url: `options.html?action=edit&editId=${encodeURIComponent(commandId)}&run=1` });
  }

  function getCommandItems() {
    return Array.from(listContainer.querySelectorAll('.command-item'));
  }

  function focusCommandItem(index) {
    const items = getCommandItems();
    if (!items.length) return;

    const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
    const item = items[clampedIndex];
    item.focus();
    item.scrollIntoView({ block: 'nearest' });
  }

  function focusAdjacentCommandItem(currentItem, offset) {
    const items = getCommandItems();
    const currentIndex = items.indexOf(currentItem);
    if (currentIndex === -1) return;

    const nextIndex = currentIndex + offset;
    if (nextIndex < 0) {
      focusSearchInput(false);
      return;
    }

    if (nextIndex >= items.length) {
      focusCommandItem(items.length - 1);
      return;
    }

    focusCommandItem(nextIndex);
  }

  function focusSearchInput(shouldSelect = true) {
    requestAnimationFrame(() => {
      searchInput.focus();
      if (shouldSelect) {
        searchInput.select();
      } else {
        const valueLength = searchInput.value.length;
        searchInput.setSelectionRange(valueLength, valueLength);
      }
    });
  }
});
