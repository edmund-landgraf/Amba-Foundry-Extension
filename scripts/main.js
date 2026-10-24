import { makeAmbaClient, asArray, itemId, itemLabel } from './ambaApi.js';

const MODULE_ID = 'amba-foundry-extension';

Hooks.once('init', () => {
  game.settings.register(MODULE_ID, 'baseUrl', {
    name: 'AMBA API URL',
    hint: 'Origin serving the AMBA API, e.g. http://localhost:5190. Authentication/CORS must allow this Foundry origin.',
    scope: 'world', config: true, type: String, default: 'http://localhost:5190', restricted: true
  });
});

Hooks.once('ready', () => {
  if (!game.user?.isGM) return;
  // Intentionally read-only for the first vertical slice: no world Documents are mutated.
  game.ambaBridge = { open: openBrowser };
  console.info('AMBA Foundry Bridge ready. Run game.ambaBridge.open() in the Foundry console.');
});

async function openBrowser() {
  if (!game.user?.isGM) throw new Error('Only a GM can use the AMBA bridge.');
  const api = makeAmbaClient(game.settings.get(MODULE_ID, 'baseUrl'));
  const modules = asArray(await api.listModules(), ['modules', 'items']);
  if (!modules.length) return ui.notifications.warn('AMBA returned no modules. Check login/API settings.');
  const moduleOptions = modules.filter(m => itemId(m) != null).map(m =>
    `<option value="${foundry.utils.escapeHTML(String(itemId(m)))}">${foundry.utils.escapeHTML(itemLabel(m))}</option>`).join('');
  const content = `<form><div class="form-group"><label>AMBA module</label><select name="moduleId">${moduleOptions}</select></div>
    <p>This preview lists encounters; scene import is the next milestone.</p><div data-amba-results>Choose a module and click List encounters.</div></form>`;
  new foundry.applications.api.DialogV2({
    window: { title: 'AMBA — Encounter Browser' },
    content,
    buttons: [{ action: 'list', label: 'List encounters', default: true, callback: async (_event, _button, dialog) => {
      const form = dialog.element.querySelector('form');
      const moduleId = form.querySelector('[name="moduleId"]').value;
      const target = form.querySelector('[data-amba-results]');
      target.textContent = 'Loading encounters…';
      try {
        const encounters = asArray(await api.listEncounters(moduleId), ['encounters', 'items']);
        target.replaceChildren();
        if (!encounters.length) { target.textContent = 'No encounters returned.'; return false; }
        const list = document.createElement('ul');
        for (const encounter of encounters) {
          const li = document.createElement('li');
          li.textContent = itemLabel(encounter);
          list.append(li);
        }
        target.append(list);
      } catch (error) {
        target.textContent = `Unable to load encounters: ${error.message}`;
      }
      return false;
    }}, { action: 'close', label: 'Close' }]
  }).render({ force: true });
}
