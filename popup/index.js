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

  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  addNewBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'options.html?action=new' });
  });

  searchInput.addEventListener('input', (event) => {
    const term = String(event.target.value || '').trim().toLowerCase();
    visibleCommands = commands.filter((command) => (
      command.name.toLowerCase().includes(term) || command.url.toLowerCase().includes(term)
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
        }
      });

      listContainer.appendChild(clone);
    });
  }

  function executeCommand(commandId) {
    chrome.tabs.create({ url: `options.html?action=edit&editId=${encodeURIComponent(commandId)}&run=1` });
  }
});
