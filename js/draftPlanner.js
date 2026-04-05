const PLANNER_STATE_KEY = 'prepdex-draft-planner-v1';
const TYPE_ORDER = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];
const MOVE_CATEGORIES = {
  hazards: ['stealthrock', 'spikes', 'toxicspikes', 'stickyweb'],
  removal: ['defog', 'rapidspin', 'mortalspin', 'tidyup', 'courtchange'],
  momentum: ['uturn', 'voltswitch', 'flipturn', 'partingshot', 'batonpass', 'teleport', 'shedtail', 'chillyreception'],
  speedcontrol: ['tailwind', 'trickroom', 'thunderwave', 'icywind', 'electroweb', 'bulldoze', 'stringshot', 'scaryface', 'glare', 'stickyweb'],
  disruption: ['taunt', 'encore', 'disable', 'knockoff', 'willowisp', 'thunderwave', 'yawn'],
  sustain: ['wish', 'healingwish', 'healbell', 'aromatherapy', 'recover', 'roost', 'slackoff', 'softboiled', 'moonlight', 'synthesis'],
};
const DEFAULT_PLANNER_MOVES = ['Stealth Rock', 'Spikes', 'Toxic Spikes', 'Sticky Web', 'U-turn', 'Volt Switch', 'Flip Turn', 'Rapid Spin', 'Defog', 'Taunt'];
const ABILITY_IMMUNITY_MAP = {
  dryskin: ['Water'],
  earthater: ['Ground'],
  flashfire: ['Fire'],
  levitate: ['Ground'],
  lightningrod: ['Electric'],
  motordrive: ['Electric'],
  sapsipper: ['Grass'],
  stormdrain: ['Water'],
  voltabsorb: ['Electric'],
  waterabsorb: ['Water'],
  wellbakedbody: ['Fire'],
};

export default class DraftPlanner {
  constructor(room) {
    this.room = room;
    this.state = this.loadState();
    this.lastSuggestions = [];
    this.initialize();
  }

  loadState() {
    const fallbackPlan = this.createPlan('Draft Plan');
    try {
      const parsed = JSON.parse(localStorage.getItem(PLANNER_STATE_KEY) || 'null');
      return this.normalizeState(parsed || {
        generation: '9',
        natdex: false,
        sortStat: 'Spe',
        activePlanId: fallbackPlan.id,
        plans: [fallbackPlan],
        transferText: '',
      });
    } catch {
      return this.normalizeState({
        generation: '9',
        natdex: false,
        sortStat: 'Spe',
        activePlanId: fallbackPlan.id,
        plans: [fallbackPlan],
        transferText: '',
      });
    }
  }

  createPlan(name = 'Draft Plan') {
    return {
      id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      pointBudget: 100,
      roster: [],
    };
  }

  normalizeState(state) {
    const normalized = Object.assign({
      generation: '9',
      natdex: false,
      sortStat: 'Spe',
      activePlanId: '',
      plans: [],
      transferText: '',
    }, state || {});

    normalized.generation = String(normalized.generation || '9');
    normalized.natdex = !!normalized.natdex;
    normalized.sortStat = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe', 'BST'].includes(normalized.sortStat) ? normalized.sortStat : 'Spe';
    normalized.transferText = String(normalized.transferText || '');
    normalized.plans = Array.isArray(normalized.plans) ? normalized.plans.map((plan, index) => this.normalizePlan(plan, index)) : [];
    if (!normalized.plans.length) normalized.plans = [this.createPlan('Draft Plan')];
    if (!normalized.plans.some((plan) => plan.id === normalized.activePlanId)) normalized.activePlanId = normalized.plans[0].id;
    return normalized;
  }

  normalizePlan(plan, index = 0) {
    return {
      id: String(plan?.id || this.createPlan().id),
      name: String(plan?.name || `Draft Plan ${index + 1}`),
      pointBudget: this.clampNumber(plan?.pointBudget, 0, 999, 100),
      selectedMoves: Array.isArray(plan?.selectedMoves)
        ? [...plan.selectedMoves.map((move) => String(move || '')).slice(0, 10), ...DEFAULT_PLANNER_MOVES].slice(0, 10)
        : [...DEFAULT_PLANNER_MOVES],
      roster: Array.isArray(plan?.roster) ? plan.roster.map((entry) => this.normalizeEntry(entry)).filter(Boolean).slice(0, 18) : [],
    };
  }

  normalizeEntry(entry) {
    const species = this.getSpecies(entry?.species || entry?.name);
    if (!species || !this.isSpeciesAllowed(species)) return null;
    return {
      species: species.name,
      cost: this.clampNumber(entry?.cost, 0, 99, 0),
      toggle: ['none', 'tera', 'z'].includes(entry?.toggle) ? entry.toggle : 'none',
      ability: String(entry?.ability || ''),
      planNotes: String(entry?.planNotes || ''),
      setNotes: String(entry?.setNotes || ''),
      collapsed: !!entry?.collapsed,
    };
  }

  saveState() {
    localStorage.setItem(PLANNER_STATE_KEY, JSON.stringify(this.state));
  }

  initialize() {
    if (typeof window.loadStorage === 'function') {
      try { window.loadStorage(); } catch {}
    }
    this.room.$el.addClass('scrollable');
    this.room.$el.html(this.render());
    this.injectCSS();
    this.cacheDom();
    this.populateGenerationDropdown();
    this.syncControls();
    this.bindEvents();
    this.renderAll();
  }

  cacheDom() {
    this.root = this.room.$el[0];
    this.planSelectEl = this.root.querySelector('#pdp-plan-select');
    this.planNameEl = this.root.querySelector('#pdp-plan-name');
    this.pointBudgetEl = this.root.querySelector('#pdp-point-budget');
    this.generationEl = this.root.querySelector('#pdp-generation');
    this.natdexEl = this.root.querySelector('#pdp-natdex');
    this.sortStatEl = this.root.querySelector('#pdp-sort-stat');
    this.searchEl = this.root.querySelector('#pdp-search');
    this.addCostEl = this.root.querySelector('#pdp-add-cost');
    this.suggestionsEl = this.root.querySelector('#pdp-suggestions');
    this.rosterEl = this.root.querySelector('#pdp-roster');
    this.typeMatrixEl = this.root.querySelector('#pdp-type-matrix');
    this.statsEl = this.root.querySelector('#pdp-stats');
    this.utilityEl = this.root.querySelector('#pdp-utility');
    this.cardsEl = this.root.querySelector('#pdp-cards');
    this.transferEl = this.root.querySelector('#pdp-transfer');
    this.statusEl = this.root.querySelector('#pdp-status');
  }

  populateGenerationDropdown() {
    const html = [];
    for (let gen = 9; gen >= 1; gen -= 1) html.push(`<option value="${gen}">Gen ${gen}</option>`);
    this.generationEl.innerHTML = html.join('');
  }

  syncControls() {
    const plan = this.getActivePlan();
    this.planSelectEl.innerHTML = this.state.plans.map((item) => `<option value="${this.escapeAttr(item.id)}">${this.escapeHtml(item.name)}</option>`).join('');
    this.planSelectEl.value = plan.id;
    this.planNameEl.value = plan.name;
    this.pointBudgetEl.value = String(plan.pointBudget);
    this.generationEl.value = this.state.generation;
    this.natdexEl.checked = !!this.state.natdex;
    this.sortStatEl.value = this.state.sortStat;
    this.transferEl.value = this.state.transferText || '';
  }

  bindEvents() {
    this.planSelectEl.addEventListener('change', () => {
      this.state.activePlanId = this.planSelectEl.value;
      this.saveState();
      this.syncControls();
      this.renderAll();
    });
    this.planNameEl.addEventListener('change', () => {
      const plan = this.getActivePlan();
      plan.name = (this.planNameEl.value || '').trim() || 'Draft Plan';
      this.saveState();
      this.syncControls();
    });
    this.pointBudgetEl.addEventListener('change', () => {
      const plan = this.getActivePlan();
      plan.pointBudget = this.clampNumber(this.pointBudgetEl.value, 0, 999, plan.pointBudget);
      this.saveState();
      this.renderStatsTable();
    });
    this.generationEl.addEventListener('change', () => {
      this.state.generation = this.generationEl.value;
      this.pruneRoster();
      this.saveState();
      this.renderAll();
    });
    this.natdexEl.addEventListener('change', () => {
      this.state.natdex = this.natdexEl.checked;
      this.pruneRoster();
      this.saveState();
      this.renderAll();
    });
    this.sortStatEl.addEventListener('change', () => {
      this.state.sortStat = this.sortStatEl.value;
      this.saveState();
      this.renderStatsTable();
    });
    this.searchEl.addEventListener('input', () => this.refreshSuggestions());
    this.searchEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const first = this.lastSuggestions[0];
        if (first) this.addPokemon(first.name);
      }
    });
    this.root.querySelector('#pdp-new-plan').addEventListener('click', () => this.createNewPlan());
    this.root.querySelector('#pdp-duplicate-plan').addEventListener('click', () => this.duplicatePlan());
    this.root.querySelector('#pdp-delete-plan').addEventListener('click', () => this.deletePlan());
    this.root.querySelector('#pdp-export-plan').addEventListener('click', () => this.exportPlans(false));
    this.root.querySelector('#pdp-export-all').addEventListener('click', () => this.exportPlans(true));
    this.root.querySelector('#pdp-import-plan').addEventListener('click', () => this.importPlans());
    this.root.querySelector('#pdp-clear-transfer').addEventListener('click', () => {
      this.state.transferText = '';
      this.transferEl.value = '';
      this.saveState();
      this.setStatus('Transfer area cleared.');
    });
  }

  renderAll() {
    this.syncControls();
    this.refreshSuggestions();
    this.renderRosterTable();
    this.renderTypeMatrix();
    this.renderStatsTable();
    this.renderUtility();
    this.renderCards();
  }

  getActivePlan() {
    return this.state.plans.find((plan) => plan.id === this.state.activePlanId) || this.state.plans[0];
  }

  pruneRoster() {
    const plan = this.getActivePlan();
    plan.roster = plan.roster.map((entry) => this.normalizeEntry(entry)).filter(Boolean);
  }

  setStatus(text) {
    if (this.statusEl) this.statusEl.textContent = text || '';
  }

  createNewPlan() {
    const plan = this.createPlan(`Draft Plan ${this.state.plans.length + 1}`);
    this.state.plans.unshift(plan);
    this.state.activePlanId = plan.id;
    this.saveState();
    this.renderAll();
    this.setStatus('Created a new planner draft.');
  }

  duplicatePlan() {
    const active = this.getActivePlan();
    const clone = this.normalizePlan({ ...active, id: '', name: `${active.name} Copy` });
    this.state.plans.unshift(clone);
    this.state.activePlanId = clone.id;
    this.saveState();
    this.renderAll();
    this.setStatus('Duplicated the active plan.');
  }

  deletePlan() {
    if (this.state.plans.length <= 1) {
      this.setStatus('Keep at least one plan saved.');
      return;
    }
    this.state.plans = this.state.plans.filter((plan) => plan.id !== this.state.activePlanId);
    this.state.activePlanId = this.state.plans[0].id;
    this.saveState();
    this.renderAll();
    this.setStatus('Deleted the active plan.');
  }

  exportPlans(includeAll) {
    const payload = {
      type: 'prepdex-draft-planner',
      version: 1,
      generation: this.state.generation,
      natdex: this.state.natdex,
      exportedAt: new Date().toISOString(),
      plans: includeAll ? this.state.plans : [this.getActivePlan()],
    };
    this.state.transferText = JSON.stringify(payload, null, 2);
    this.saveState();
    this.transferEl.value = this.state.transferText;
    this.transferEl.select();
    this.transferEl.focus();
    this.setStatus(includeAll ? 'Exported all planner drafts.' : 'Exported the active plan.');
  }

  importPlans() {
    let parsed;
    try {
      parsed = JSON.parse(this.transferEl.value || 'null');
    } catch {
      this.setStatus('Paste exported planner JSON first.');
      return;
    }
    const imported = Array.isArray(parsed?.plans) ? parsed.plans.map((plan, index) => this.normalizePlan(plan, index)).filter(Boolean) : [];
    if (!imported.length) {
      this.setStatus('No valid planner drafts were found in the import data.');
      return;
    }
    const merged = [...imported];
    for (const existing of this.state.plans) {
      if (!merged.some((plan) => plan.name === existing.name)) merged.push(existing);
    }
    this.state.plans = merged.slice(0, 30);
    this.state.activePlanId = this.state.plans[0].id;
    this.state.transferText = this.transferEl.value;
    this.saveState();
    this.renderAll();
    this.setStatus(`Imported ${imported.length} planner draft${imported.length === 1 ? '' : 's'}.`);
  }

  refreshSuggestions() {
    const query = String(this.searchEl.value || '').trim().toLowerCase();
    const results = query
      ? this.getAllSearchableSpecies()
        .filter((species) => [species.name, species.baseSpecies, ...(species.types || [])].filter(Boolean).join(' ').toLowerCase().includes(query))
        .slice(0, 10)
      : [];
    this.lastSuggestions = results;

    if (!query) {
      this.suggestionsEl.innerHTML = '<div class="pdp-empty">Start typing a Pokemon name to add it to this draft plan.</div>';
      return;
    }
    if (!results.length) {
      this.suggestionsEl.innerHTML = '<div class="pdp-empty">No Pokemon match this generation/filter.</div>';
      return;
    }

    this.suggestionsEl.innerHTML = results.map((species) => `
      <button class="button pdp-suggestion" type="button" data-name="${this.escapeAttr(species.name)}">
        <span class="pdp-suggestion-sprite">${this.renderSprite(species, 'small')}</span>
        <span class="pdp-suggestion-copy">
          <span class="pdp-suggestion-name">${this.escapeHtml(species.name)}</span>
          <span class="pdp-suggestion-meta">${(species.types || []).map((type) => this.escapeHtml(type)).join(' / ')}</span>
        </span>
      </button>
    `).join('');

    for (const button of this.suggestionsEl.querySelectorAll('.pdp-suggestion')) {
      button.addEventListener('click', () => this.addPokemon(button.getAttribute('data-name')));
    }
  }

  addPokemon(name) {
    const species = this.getSpecies(name);
    if (!species) return;
    const plan = this.getActivePlan();
    if (plan.roster.some((entry) => this.toID(entry.species) === this.toID(species.name))) {
      this.setStatus(`${species.name} is already in this draft plan.`);
      return;
    }
    plan.roster.push(this.normalizeEntry({
      species: species.name,
      cost: this.clampNumber(this.addCostEl.value, 0, 99, 0),
      ability: Object.values(species.abilities || {}).find(Boolean) || '',
      toggle: 'none',
      collapsed: false,
    }));
    this.searchEl.value = '';
    this.addCostEl.value = '0';
    this.saveState();
    this.renderAll();
    this.setStatus(`${species.name} added to ${plan.name}.`);
  }

  renderRosterTable() {
    const plan = this.getActivePlan();
    const rows = plan.roster.map((entry, index) => {
      const species = this.getSpecies(entry.species) || entry;
      return `
        <tr data-index="${index}">
          <td class="pdp-roster-mon">${this.renderSprite(species, 'tiny')}${this.escapeHtml(species.name || entry.species)}</td>
          <td><input class="textbox pdp-roster-cost" type="number" min="0" max="99" value="${this.escapeAttr(entry.cost)}" data-field="cost"></td>
          <td>
            <select class="button pdp-roster-toggle" data-field="toggle">
              <option value="none"${entry.toggle === 'none' ? ' selected' : ''}>-</option>
              <option value="tera"${entry.toggle === 'tera' ? ' selected' : ''}>T</option>
              <option value="z"${entry.toggle === 'z' ? ' selected' : ''}>Z</option>
            </select>
          </td>
          <td><button class="button pdp-remove" type="button" data-remove="${index}">Remove</button></td>
        </tr>
      `;
    }).join('');

    this.rosterEl.innerHTML = `
      <table class="pdp-table">
        <thead>
          <tr>
            <th>Roster</th>
            <th>Cost</th>
            <th>T/Z</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="4" class="pdp-empty-cell">No Pokemon in this draft plan yet.</td></tr>'}</tbody>
      </table>
    `;

    for (const input of this.rosterEl.querySelectorAll('[data-field]')) {
      const row = input.closest('tr');
      const index = Number(row?.getAttribute('data-index'));
      input.addEventListener('change', () => this.updateRosterField(index, input.getAttribute('data-field'), input.value));
    }
    for (const button of this.rosterEl.querySelectorAll('[data-remove]')) {
      button.addEventListener('click', () => this.removePokemon(Number(button.getAttribute('data-remove'))));
    }
  }

  updateRosterField(index, field, value) {
    const plan = this.getActivePlan();
    const entry = plan.roster[index];
    if (!entry) return;
    if (field === 'cost') entry.cost = this.clampNumber(value, 0, 99, entry.cost);
    if (field === 'toggle') entry.toggle = ['none', 'tera', 'z'].includes(value) ? value : 'none';
    this.saveState();
    this.renderStatsTable();
    this.renderCards();
  }

  removePokemon(index) {
    const plan = this.getActivePlan();
    plan.roster.splice(index, 1);
    this.saveState();
    this.renderAll();
  }

  renderTypeMatrix() {
    const plan = this.getActivePlan();
    const rows = plan.roster.map((entry) => {
      const species = this.getSpecies(entry.species) || entry;
      const types = species.types || [];
      return `
        <tr>
          <td class="sticky pdp-matrix-mon">${this.renderSprite(species, 'tiny')}</td>
          ${TYPE_ORDER.map((attackType) => {
            const value = this.getDefensiveMultiplier(attackType, types, entry, species);
            const label = this.formatMultiplier(value);
            return `<td class="${this.getMultiplierClass(value)}" title="${this.escapeAttr(`${species.name} vs ${attackType}`)}">${label || '&nbsp;'}</td>`;
          }).join('')}
        </tr>
      `;
    }).join('');

    const totals = TYPE_ORDER.map((attackType) => {
      let weak = 0;
      let resist = 0;
      let immune = 0;
      for (const entry of plan.roster) {
        const species = this.getSpecies(entry.species) || entry;
        const value = this.getDefensiveMultiplier(attackType, species.types || [], entry, species);
        if (value === 0) immune += 1;
        else if (value > 1) weak += 1;
        else if (value < 1) resist += 1;
      }
      const bold = immune ? ' pdp-matrix-total-immune' : '';
      return `<td class="pdp-matrix-total${bold}">${weak}/${resist}/${immune}</td>`;
    }).join('');

    this.typeMatrixEl.innerHTML = `
      <table class="pdp-table pdp-matrix-table">
        <thead>
          <tr>
            <th class="sticky">Pkm.</th>
            ${TYPE_ORDER.map((type) => `<th>${this.getTypeIconHtml(type)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="${TYPE_ORDER.length + 1}" class="pdp-empty-cell">Add Pokemon to see the defensive matrix.</td></tr>`}</tbody>
        <tfoot>
          <tr>
            <th class="sticky">Totals</th>
            ${totals}
          </tr>
        </tfoot>
      </table>
      <div class="pdp-footnote">Totals are shown as weak / resist / immune. Immune totals are highlighted.</div>
    `;
  }

  renderStatsTable() {
    const plan = this.getActivePlan();
    const stat = this.state.sortStat;
    const rows = plan.roster
      .map((entry) => {
        const species = this.getSpecies(entry.species) || entry;
        const baseStats = species.baseStats || {};
        return {
          species,
          value: stat === 'BST' ? Object.values(baseStats).reduce((sum, num) => sum + Number(num || 0), 0) : Number(baseStats[stat] || 0),
        };
      })
      .sort((a, b) => b.value - a.value || a.species.name.localeCompare(b.species.name));

    const totalPoints = plan.roster.reduce((sum, entry) => sum + Number(entry.cost || 0), 0);
    const remaining = Math.max(0, plan.pointBudget - totalPoints);

    this.statsEl.innerHTML = `
      <div class="pdp-stats-layout">
        <table class="pdp-table">
          <thead>
            <tr>
              <th>Pokemon</th>
              <th>HP</th>
              <th>Atk</th>
              <th>Def</th>
              <th>SpA</th>
              <th>SpD</th>
              <th>Spe</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(({ species }) => `
              <tr>
                <td class="pdp-stats-mon">${this.renderSprite(species, 'tiny')}${this.escapeHtml(species.name)}</td>
                <td>${species.baseStats?.hp ?? '-'}</td>
                <td>${species.baseStats?.atk ?? '-'}</td>
                <td>${species.baseStats?.def ?? '-'}</td>
                <td>${species.baseStats?.spa ?? '-'}</td>
                <td>${species.baseStats?.spd ?? '-'}</td>
                <td>${species.baseStats?.spe ?? '-'}</td>
              </tr>
            `).join('') || '<tr><td colspan="7" class="pdp-empty-cell">No stat data yet.</td></tr>'}
          </tbody>
        </table>
        <div class="pdp-stat-cards">
          <div class="pdp-mini-card">
            <div class="pdp-mini-label">Total Points</div>
            <div class="pdp-mini-value">${totalPoints}</div>
          </div>
          <div class="pdp-mini-card">
            <div class="pdp-mini-label">Remaining</div>
            <div class="pdp-mini-value">${remaining}</div>
          </div>
          <div class="pdp-mini-card">
            <div class="pdp-mini-label">Sort</div>
            <div class="pdp-mini-copy">${this.escapeHtml(stat)}</div>
          </div>
        </div>
      </div>
    `;
  }

  renderUtility() {
    const plan = this.getActivePlan();
    this.utilityEl.innerHTML = `
      <section class="pdp-utility-card">
        <div class="pdp-section-title">Moves</div>
        <div class="pdp-move-picker-grid">
          ${Array.from({ length: 10 }, (_, index) => this.renderSelectedMoveRow(index, plan.selectedMoves[index] || '')).join('')}
        </div>
      </section>
    `;

    for (const input of this.utilityEl.querySelectorAll('[data-move-slot]')) {
      const index = Number(input.getAttribute('data-move-slot'));
      input.addEventListener('input', () => this.refreshMoveSuggestions(index, input.value));
      input.addEventListener('focus', () => this.refreshMoveSuggestions(index, input.value));
      input.addEventListener('blur', () => {
        setTimeout(() => this.hideMoveSuggestions(index), 120);
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          const first = this.getFilteredMoveOptions(input.value)[0];
          if (first) this.updateSelectedMove(index, first.name);
          else this.updateSelectedMove(index, input.value);
        }
      });
    }
  }

  renderSelectedMoveRow(index, moveName) {
    const plan = this.getActivePlan();
    const moveId = this.toID(moveName);
    const users = plan.roster.map((entry) => {
      const species = this.getSpecies(entry.species) || entry;
      const learnset = this.getLearnsetMoves(species);
      if (!moveId || !learnset.has(moveId)) return null;
      return `
        <span class="pdp-move-user" title="${this.escapeAttr(species.name)}">${this.renderSprite(species, 'tiny')}</span>
      `;
    }).filter(Boolean).join('');

    return `
      <div class="pdp-move-row">
        <div class="pdp-move-input-wrap">
          <input class="textbox pdp-move-input" type="text" data-move-slot="${index}" value="${this.escapeAttr(moveName)}" placeholder="Search move">
          <div class="pdp-move-suggestions" data-move-suggestions="${index}"></div>
        </div>
        <div class="pdp-move-users">${users || '<span class="pdp-empty">None</span>'}</div>
      </div>
    `;
  }

  updateSelectedMove(index, value) {
    const plan = this.getActivePlan();
    if (!plan.selectedMoves) plan.selectedMoves = Array.from({ length: 10 }, () => '');
    const exact = this.getMoveByName(value);
    plan.selectedMoves[index] = exact?.name || String(value || '').trim();
    this.saveState();
    this.renderUtility();
  }

  refreshMoveSuggestions(index, query) {
    const host = this.utilityEl.querySelector(`[data-move-suggestions="${index}"]`);
    if (!host) return;
    const results = this.getFilteredMoveOptions(query);
    if (!query.trim()) {
      host.innerHTML = '';
      host.classList.remove('is-open');
      return;
    }
    if (!results.length) {
      host.innerHTML = '<div class="pdp-move-empty">No moves found.</div>';
      host.classList.add('is-open');
      return;
    }
    host.innerHTML = results.map((move) => `
      <button class="button pdp-move-option" type="button" data-move-pick="${this.escapeAttr(move.name)}">
        ${this.escapeHtml(move.name)}
      </button>
    `).join('');
    host.classList.add('is-open');
    for (const button of host.querySelectorAll('[data-move-pick]')) {
      button.addEventListener('mousedown', (event) => {
        event.preventDefault();
        this.updateSelectedMove(index, button.getAttribute('data-move-pick'));
      });
    }
  }

  hideMoveSuggestions(index) {
    const host = this.utilityEl.querySelector(`[data-move-suggestions="${index}"]`);
    if (!host) return;
    host.innerHTML = '';
    host.classList.remove('is-open');
  }

  getFilteredMoveOptions(query) {
    const text = String(query || '').trim().toLowerCase();
    if (!text) return [];
    const allMoves = this.getAllMoveOptions();
    const starts = allMoves.filter((move) => move.name.toLowerCase().startsWith(text));
    const contains = allMoves.filter((move) => !move.name.toLowerCase().startsWith(text) && move.name.toLowerCase().includes(text));
    return [...starts, ...contains].slice(0, 10);
  }

  getMoveByName(value) {
    const target = this.toID(value);
    if (!target) return null;
    return this.getAllMoveOptions().find((move) => this.toID(move.name) === target) || null;
  }

  renderCards() {
    const plan = this.getActivePlan();
    this.cardsEl.innerHTML = plan.roster.map((entry, index) => {
      const species = this.getSpecies(entry.species) || entry;
      const abilities = Object.values(species.abilities || {}).filter(Boolean);
      const abilityOptions = abilities.map((ability) => `<option value="${this.escapeAttr(ability)}"${entry.ability === ability ? ' selected' : ''}>${this.escapeHtml(ability)}</option>`).join('');
      return `
        <article class="pdp-mon-card ${entry.collapsed ? 'is-collapsed' : ''}" data-index="${index}">
          <div class="pdp-mon-topbar">
            <button class="button pdp-card-toggle" type="button" data-card-toggle="${index}">${entry.collapsed ? 'Expand' : 'Collapse'}</button>
            <div class="pdp-mon-topcopy">${this.escapeHtml(species.name)}</div>
          </div>
          <div class="pdp-mon-body">
          <div class="pdp-mon-head">
            <div class="pdp-mon-sprite">${this.renderSprite(species, 'card')}</div>
            <div class="pdp-mon-copy">
              <div class="pdp-mon-name">${this.escapeHtml(species.name)}</div>
              <div class="pdp-mon-types">${(species.types || []).map((type) => `<span class="pdp-type-badge">${this.escapeHtml(type)}</span>`).join('')}</div>
            </div>
          </div>
          <div class="pdp-mon-grid">
            <label class="pdp-field">
              <span>Ability</span>
              <select class="button" data-card-field="ability">${abilityOptions || '<option value="">-</option>'}</select>
            </label>
            <div class="pdp-field"><span>T/Z</span><div class="pdp-card-pill">${entry.toggle === 'tera' ? 'Tera' : entry.toggle === 'z' ? 'Z-Move' : 'None'}</div></div>
          </div>
          <div class="pdp-base-stats">
            ${['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map((stat) => `
              <div class="pdp-base-stat">
                <span>${stat.toUpperCase()}</span>
                <strong>${species.baseStats?.[stat] ?? '-'}</strong>
              </div>
            `).join('')}
          </div>
          <div class="pdp-card-notes">
            <label class="pdp-field">
              <span>Plan Notes</span>
              <textarea class="textbox pdp-card-text" data-card-field="planNotes" placeholder="Draft plan, tera path, game plan...">${this.escapeHtml(entry.planNotes)}</textarea>
            </label>
            <label class="pdp-field">
              <span>Benchmarks</span>
              <textarea class="textbox pdp-card-text" data-card-field="setNotes" placeholder="Benchmarks, techs, matchup reminders...">${this.escapeHtml(entry.setNotes)}</textarea>
            </label>
          </div>
          </div>
        </article>
      `;
    }).join('') || '<div class="pdp-empty-card">Planner cards will appear here as you add Pokemon.</div>';

    for (const button of this.cardsEl.querySelectorAll('[data-card-toggle]')) {
      button.addEventListener('click', () => this.toggleCardCollapse(Number(button.getAttribute('data-card-toggle'))));
    }
    for (const control of this.cardsEl.querySelectorAll('[data-card-field]')) {
      const card = control.closest('[data-index]');
      const index = Number(card?.getAttribute('data-index'));
      const apply = () => this.updateCardField(index, control.getAttribute('data-card-field'), control.value);
      control.addEventListener('change', apply);
      if (control.tagName === 'TEXTAREA') control.addEventListener('input', apply);
    }
  }

  updateCardField(index, field, value) {
    const plan = this.getActivePlan();
    const entry = plan.roster[index];
    if (!entry) return;
    if (field === 'ability') entry.ability = String(value || '');
    if (field === 'planNotes') entry.planNotes = String(value || '');
    if (field === 'setNotes') entry.setNotes = String(value || '');
    this.saveState();
    if (field === 'ability') this.renderTypeMatrix();
  }

  toggleCardCollapse(index) {
    const plan = this.getActivePlan();
    const entry = plan.roster[index];
    if (!entry) return;
    entry.collapsed = !entry.collapsed;
    this.saveState();
    this.renderCards();
  }

  getLearnsetMoves(species) {
    const moveIds = new Set();
    const addFrom = (source) => {
      if (!source) return;
      for (const key of Object.keys(source)) moveIds.add(this.toID(key));
    };
    try { addFrom(this.getDex()?.species?.getLearnsetData?.(species.id || species.name)?.learnset); } catch {}
    try { addFrom(window.Dex?.species?.getLearnsetData?.(species.id || species.name)?.learnset); } catch {}
    try { addFrom(species.learnset); } catch {}
    try { addFrom(window.BattleTeambuilderTable?.learnsets?.[this.toID(species.name)]); } catch {}
    return moveIds;
  }

  renderSprite(species, size) {
    const iconStyle = this.getPokemonIconStyle(species);
    const spriteUrl = this.getGen5SpriteUrl(species);
    const sizeClass = size === 'card' ? 'pdp-sprite-card' : size === 'small' ? 'pdp-sprite-small' : 'pdp-sprite-tiny';
    return `
      <span class="pdp-sprite-shell ${sizeClass}">
        <img class="pdp-sprite-img ${sizeClass}" src="${this.escapeAttr(spriteUrl)}" alt="${this.escapeAttr(species.name || '')}" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-block';">
        <span class="pdp-sprite-fallback ${sizeClass}" style="${iconStyle};display:none;"></span>
      </span>
    `;
  }

  getGen5SpriteUrl(species) {
    const id = this.toID(species?.baseSpecies || species?.name || species?.id);
    return `https://play.pokemonshowdown.com/sprites/gen5/${id}.png`;
  }

  getDefensiveMultiplier(attackType, defenderTypes, entry, species) {
    let multiplier = 1;
    for (const defenderType of defenderTypes || []) multiplier *= this.getSingleTypeMultiplier(attackType, defenderType);
    if (this.hasAbilityImmunity(entry, species, attackType)) return 0;
    return multiplier;
  }

  hasAbilityImmunity(entry, species, attackType) {
    const chosen = this.toID(entry?.ability);
    if (chosen) return (ABILITY_IMMUNITY_MAP[chosen] || []).includes(attackType);
    const abilityList = Object.values(species?.abilities || {}).filter(Boolean);
    if (abilityList.length === 1) return (ABILITY_IMMUNITY_MAP[this.toID(abilityList[0])] || []).includes(attackType);
    return false;
  }

  getSingleTypeMultiplier(attackType, defenderType) {
    const typeData = this.getDex()?.types?.get?.(defenderType) || window.Dex?.types?.get?.(defenderType);
    const key = this.toID(attackType);
    const code = typeData?.damageTaken?.[key] ?? typeData?.damageTaken?.[attackType] ?? 0;
    if (code === 1) return 2;
    if (code === 2) return 0.5;
    if (code === 3) return 0;
    return 1;
  }

  formatMultiplier(value) {
    if (value === 0) return '0';
    if (value === 0.25) return '1/4';
    if (value === 0.5) return '1/2';
    if (value === 1) return '';
    if (value === 4) return '4';
    return String(value);
  }

  getMultiplierClass(value) {
    if (value === 0) return 'immune';
    if (value > 1) return 'weak';
    if (value < 1) return 'resist';
    return 'neutral';
  }

  getDex() {
    try {
      if (window.Dex?.mod) return window.Dex.mod(`gen${this.state.generation}`) || window.Dex;
    } catch {}
    return window.Dex || null;
  }

  getSpecies(name) {
    if (!name) return null;
    const dex = this.getDex();
    const tryGet = (obj) => {
      try {
        const mon = obj?.species?.get ? obj.species.get(name) : null;
        return mon?.exists ? mon : null;
      } catch {
        return null;
      }
    };
    return tryGet(dex) || tryGet(window.Dex) || this.getSpeciesFromBattlePokedex(name);
  }

  getSpeciesFromBattlePokedex(name) {
    const table = window.BattlePokedex;
    if (!table) return null;
    const id = this.toID(name);
    const raw = table[id];
    if (!raw?.name) return null;
    return {
      exists: true,
      id,
      name: raw.name,
      baseSpecies: raw.baseSpecies || raw.name,
      num: raw.num ?? 0,
      gen: raw.gen || Number(this.state.generation || '9'),
      abilities: raw.abilities || {},
      types: raw.types || [],
      baseStats: raw.baseStats || {},
      tier: raw.tier || '',
      isNonstandard: raw.isNonstandard || null,
    };
  }

  getAllSearchableSpecies() {
    const lists = [];
    const dex = this.getDex();
    try { if (dex?.species?.all) lists.push(...dex.species.all()); } catch {}
    try { if (window.Dex?.species?.all) lists.push(...window.Dex.species.all()); } catch {}
    if (!lists.length && window.BattlePokedex) {
      for (const key of Object.keys(window.BattlePokedex)) {
        const entry = this.getSpeciesFromBattlePokedex(key);
        if (entry) lists.push(entry);
      }
    }
    const deduped = [];
    const seen = new Set();
    for (const species of lists) {
      const id = this.toID(species?.name || species?.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      deduped.push(species);
    }
    return deduped
      .filter((species) => this.isSpeciesAllowed(species))
      .filter((species) => !String(species.name || '').includes('-Busted'))
      .filter((species) => !String(species.forme || '').includes('Totem'))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }

  getAllMoveOptions() {
    if (this._allMoveOptions) return this._allMoveOptions;
    const lists = [];
    try { if (this.getDex()?.moves?.all) lists.push(...this.getDex().moves.all()); } catch {}
    try { if (window.Dex?.moves?.all) lists.push(...window.Dex.moves.all()); } catch {}
    try {
      if (window.BattleMovedex) {
        for (const key of Object.keys(window.BattleMovedex)) {
          const raw = window.BattleMovedex[key];
          if (!raw?.name) continue;
          lists.push({
            id: key,
            name: raw.name,
            isNonstandard: raw.isNonstandard || null,
          });
        }
      }
    } catch {}
    if (!lists.length) {
      this._allMoveOptions = DEFAULT_PLANNER_MOVES.map((name) => ({ name, id: this.toID(name), isNonstandard: null }));
      return this._allMoveOptions;
    }
    const seen = new Set();
    this._allMoveOptions = lists
      .filter((move) => move?.name && !move.isNonstandard)
      .filter((move) => {
        const id = this.toID(move.name);
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return this._allMoveOptions;
  }

  isSpeciesAllowed(species) {
    if (!species?.name) return false;
    if (species.num === -1) return false;
    if (species.isNonstandard === 'CAP') return false;
    const selectedGen = Number(this.state.generation || '9');
    const speciesGen = Number(species.gen || selectedGen);
    if (speciesGen > selectedGen) return false;
    if (!this.state.natdex) {
      if (species.num < 1) return false;
      if (species.isNonstandard && species.isNonstandard !== null) return false;
    }
    return true;
  }

  getPokemonIconStyle(species) {
    try {
      const raw = window.Dex?.getPokemonIcon ? window.Dex.getPokemonIcon(species) : '';
      const bg = String(raw || '').startsWith('background:') ? raw : `background:${raw}`;
      return `${bg}; width:40px; height:30px; image-rendering: pixelated;`;
    } catch {
      return 'width:40px;height:30px;';
    }
  }

  getTypeIconHtml(type) {
    try {
      if (window.Dex?.getTypeIcon) return window.Dex.getTypeIcon(type);
    } catch {}
    return `<span>${this.escapeHtml(type.slice(0, 2).toUpperCase())}</span>`;
  }

  clampNumber(value, min, max, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, num));
  }

  escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  escapeAttr(value) {
    return this.escapeHtml(value);
  }

  toID(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  render() {
    return `
      <div id="pdp-app">
        <div class="pdp-toolbar pdp-card">
          <div class="pdp-brand-row">
            <div>
              <div class="pdp-kicker">PrepDex Planner</div>
              <div class="pdp-title">Dream Team Planner</div>
            </div>
            <div id="pdp-status" class="pdp-status"></div>
          </div>
          <div class="pdp-toolbar-grid">
            <label class="pdp-field"><span>Draft Plan</span><select id="pdp-plan-select" class="button"></select></label>
            <label class="pdp-field"><span>Name</span><input id="pdp-plan-name" class="textbox" type="text"></label>
            <label class="pdp-field"><span>Budget</span><input id="pdp-point-budget" class="textbox" type="number" min="0" max="999"></label>
            <label class="pdp-field"><span>Generation</span><select id="pdp-generation" class="button"></select></label>
            <label class="pdp-field pdp-check"><span>NatDex</span><input id="pdp-natdex" type="checkbox"></label>
            <label class="pdp-field">
              <span>Sort by</span>
              <select id="pdp-sort-stat" class="button">
                <option value="Spe">Speed</option>
                <option value="Atk">Attack</option>
                <option value="Def">Defense</option>
                <option value="SpA">Sp. Atk</option>
                <option value="SpD">Sp. Def</option>
                <option value="HP">HP</option>
                <option value="BST">BST</option>
              </select>
            </label>
          </div>
          <div class="pdp-toolbar-actions">
            <button id="pdp-new-plan" class="button" type="button">New Plan</button>
            <button id="pdp-duplicate-plan" class="button" type="button">Duplicate</button>
            <button id="pdp-delete-plan" class="button" type="button">Delete</button>
            <button id="pdp-export-plan" class="button" type="button">Export Plan</button>
            <button id="pdp-export-all" class="button" type="button">Export All</button>
            <button id="pdp-import-plan" class="button" type="button">Import</button>
          </div>
        </div>

        <div class="pdp-discovery pdp-card">
          <div class="pdp-discovery-grid">
            <label class="pdp-field"><span>Add Pokemon</span><input id="pdp-search" class="textbox" type="text" autocomplete="off" placeholder="Search a species"></label>
            <label class="pdp-field"><span>Cost</span><input id="pdp-add-cost" class="textbox" type="number" min="0" max="99" value="0"></label>
          </div>
          <div id="pdp-suggestions" class="pdp-suggestions"></div>
        </div>

        <div class="pdp-main-grid">
          <section class="pdp-card">
            <div class="pdp-section-title">Roster</div>
            <div id="pdp-roster" class="pdp-table-wrap"></div>
          </section>
          <section class="pdp-card">
            <div class="pdp-section-title">Typechart</div>
            <div id="pdp-type-matrix" class="pdp-table-wrap"></div>
          </section>
        </div>

        <section class="pdp-card">
          <div class="pdp-section-title">Data</div>
          <div id="pdp-stats"></div>
        </section>

        <section class="pdp-card">
          <div class="pdp-section-title">Moves</div>
          <div id="pdp-utility"></div>
        </section>

        <section class="pdp-card">
          <div class="pdp-section-title">Transfer Tool</div>
          <textarea id="pdp-transfer" class="textbox pdp-transfer" placeholder="Exported planner JSON appears here. You can also paste planner JSON here to import it."></textarea>
          <div class="pdp-transfer-actions"><button id="pdp-clear-transfer" class="button" type="button">Clear Transfer Area</button></div>
        </section>

        <section class="pdp-card">
          <div class="pdp-section-title">Planner Cards</div>
          <div id="pdp-cards" class="pdp-card-grid"></div>
        </section>
      </div>
    `;
  }

  injectCSS() {
    if (document.getElementById('prepdex-draft-planner-style')) return;
    const style = document.createElement('style');
    style.id = 'prepdex-draft-planner-style';
    style.textContent = `
      #pdp-app { padding: 10px; color: #f6eef9; font: 12px/1.4 Verdana, Arial, sans-serif; }
      #pdp-app * { box-sizing: border-box; }
      #pdp-app .pdp-card { margin-bottom: 10px; border: 1px solid rgba(255, 208, 231, 0.12); border-radius: 14px; background: radial-gradient(circle at top right, rgba(255, 145, 198, 0.1), transparent 26%), linear-gradient(180deg, rgba(36, 30, 41, 0.95) 0%, rgba(23, 20, 28, 0.96) 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,.05); }
      #pdp-app .pdp-toolbar, #pdp-app .pdp-discovery, #pdp-app .pdp-card { padding: 12px; }
      #pdp-app .pdp-brand-row { display:flex; justify-content:space-between; gap:14px; align-items:flex-end; margin-bottom: 10px; }
      #pdp-app .pdp-kicker { color:#ffb8dd; font-size:11px; text-transform:uppercase; letter-spacing:.16em; font-weight:700; }
      #pdp-app .pdp-title { font-size:24px; font-weight:700; line-height:1.05; color:#fff5fd; }
      #pdp-app .pdp-status { color:rgba(252,228,247,.72); font-size:11px; text-align:right; }
      #pdp-app .pdp-toolbar-grid, #pdp-app .pdp-discovery-grid { display:grid; grid-template-columns:repeat(6, minmax(0, 1fr)); gap:10px; }
      #pdp-app .pdp-discovery-grid { grid-template-columns:minmax(0, 1fr) 100px; }
      #pdp-app .pdp-field { display:flex; flex-direction:column; gap:4px; }
      #pdp-app .pdp-field > span, #pdp-app .pdp-section-title { font-weight:700; font-style:italic; color:#ffd7ef; }
      #pdp-app .pdp-check { flex-direction:row; align-items:center; justify-content:center; padding-top:20px; gap:8px; }
      #pdp-app .pdp-toolbar-actions, #pdp-app .pdp-transfer-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
      #pdp-app .pdp-suggestions { margin-top:10px; display:grid; gap:6px; max-height:220px; overflow:auto; }
      #pdp-app .pdp-suggestion { width:100%; display:grid; grid-template-columns:44px 1fr; gap:10px; align-items:center; text-align:left; padding:6px 10px; border-radius:12px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.06); }
      #pdp-app .pdp-suggestion-name { display:block; font-weight:700; color:#fff2fc; }
      #pdp-app .pdp-suggestion-meta { display:block; font-size:11px; color:rgba(252,228,247,.68); }
      #pdp-app .pdp-empty, #pdp-app .pdp-footnote { color:rgba(252,228,247,.62); font-style:italic; }
      #pdp-app .pdp-main-grid { display:grid; grid-template-columns:minmax(340px, 1fr) minmax(480px, 1.6fr); gap:10px; }
      #pdp-app .pdp-table-wrap { overflow:auto; }
      #pdp-app .pdp-table { width:100%; border-collapse:collapse; }
      #pdp-app .pdp-table th, #pdp-app .pdp-table td { border:1px solid rgba(255,255,255,.08); padding:4px 6px; text-align:center; vertical-align:middle; }
      #pdp-app .pdp-table th { background:#403447; color:#fff5fd; font-size:10px; text-transform:uppercase; letter-spacing:.06em; }
      #pdp-app .pdp-table .sticky { position:sticky; left:0; z-index:2; background:#2d2433; }
      #pdp-app .pdp-roster-mon, #pdp-app .pdp-stats-mon, #pdp-app .pdp-matrix-mon { display:flex; align-items:center; gap:6px; text-align:left; min-width:110px; }
      #pdp-app .pdp-empty-cell { color:rgba(252,228,247,.62); text-align:center; padding:16px; }
      #pdp-app .pdp-remove { min-width:68px; }
      #pdp-app .pdp-matrix-table td.weak { background:rgba(207, 85, 94, 0.55); color:#fff; font-weight:700; }
      #pdp-app .pdp-matrix-table td.resist { background:rgba(81, 173, 108, 0.46); color:#fff; font-weight:700; }
      #pdp-app .pdp-matrix-table td.immune { background:rgba(86, 66, 122, 0.84); color:#ffe7f8; font-weight:700; }
      #pdp-app .pdp-matrix-total { font-size:10px; color:rgba(252,228,247,.82); }
      #pdp-app .pdp-matrix-total-immune { color:#fff; font-weight:700; }
      #pdp-app .pdp-stats-layout { display:grid; grid-template-columns:minmax(0, 1fr) 180px; gap:10px; }
      #pdp-app .pdp-stat-cards { display:grid; gap:8px; }
      #pdp-app .pdp-mini-card { padding:12px; border-radius:12px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.06); }
      #pdp-app .pdp-mini-label { color:#ffbfdf; font-size:10px; text-transform:uppercase; letter-spacing:.08em; font-weight:700; }
      #pdp-app .pdp-mini-value { margin-top:4px; font-size:24px; font-weight:700; color:#fff4fd; }
      #pdp-app .pdp-mini-copy { margin-top:4px; color:rgba(252,228,247,.82); }
      #pdp-app .pdp-utility-card { padding:10px; border-radius:12px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.06); }
      #pdp-app .pdp-move-picker-grid { display:grid; gap:8px; }
      #pdp-app .pdp-move-row { display:grid; grid-template-columns:minmax(180px, 260px) 1fr; gap:8px; align-items:center; padding:4px 0; border-top:1px solid rgba(255,255,255,.05); }
      #pdp-app .pdp-move-row:first-child { border-top:0; }
      #pdp-app .pdp-move-input-wrap { position:relative; }
      #pdp-app .pdp-move-input { width:100%; }
      #pdp-app .pdp-move-suggestions { position:absolute; left:0; right:0; top:calc(100% + 4px); z-index:6; display:none; max-height:220px; overflow:auto; padding:6px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(33, 24, 38, 0.98); box-shadow:0 14px 28px rgba(0,0,0,.28); }
      #pdp-app .pdp-move-suggestions.is-open { display:grid; gap:4px; }
      #pdp-app .pdp-move-option { justify-content:flex-start; text-align:left; padding:8px 10px; border-radius:10px; background:rgba(255,255,255,.04); }
      #pdp-app .pdp-move-empty { padding:8px 10px; color:rgba(252,228,247,.62); font-style:italic; }
      #pdp-app .pdp-move-users { display:flex; flex-wrap:wrap; gap:6px; align-items:center; min-height:32px; }
      #pdp-app .pdp-move-user { display:inline-flex; align-items:center; justify-content:center; padding:2px; border-radius:999px; background:rgba(255,255,255,.06); }
      #pdp-app .pdp-card-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(310px, 1fr)); gap:10px; }
      #pdp-app .pdp-mon-card { padding:12px; border-radius:14px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.06); }
      #pdp-app .pdp-mon-card.is-collapsed .pdp-mon-body { display:none; }
      #pdp-app .pdp-mon-topbar { display:grid; grid-template-columns:auto 1fr; gap:10px; align-items:center; margin-bottom:10px; }
      #pdp-app .pdp-mon-topcopy { font-weight:700; color:#fff3fc; letter-spacing:.04em; text-transform:uppercase; }
      #pdp-app .pdp-mon-head { display:grid; grid-template-columns:88px 1fr; gap:10px; align-items:center; }
      #pdp-app .pdp-mon-name { font-size:18px; font-weight:700; color:#fff5fd; }
      #pdp-app .pdp-mon-types { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
      #pdp-app .pdp-type-badge { padding:3px 8px; border-radius:999px; background:rgba(255, 166, 214, 0.14); color:#ffd7ef; font-size:10px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
      #pdp-app .pdp-mon-grid, #pdp-app .pdp-card-notes { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px; }
      #pdp-app .pdp-card-pill { min-height:34px; display:flex; align-items:center; padding:0 12px; border-radius:10px; background:rgba(255,255,255,.05); color:#fff2fc; }
      #pdp-app .pdp-base-stats { display:grid; grid-template-columns:repeat(6, minmax(0, 1fr)); gap:6px; margin-top:10px; }
      #pdp-app .pdp-base-stat { padding:8px 6px; border-radius:10px; background:rgba(255,255,255,.05); text-align:center; }
      #pdp-app .pdp-base-stat span { display:block; font-size:10px; color:rgba(252,228,247,.7); text-transform:uppercase; }
      #pdp-app .pdp-base-stat strong { display:block; margin-top:2px; color:#fff5fd; }
      #pdp-app .pdp-card-text, #pdp-app .pdp-transfer { min-height:108px; resize:vertical; }
      #pdp-app .pdp-empty-card { padding:20px; border-radius:12px; background:rgba(255,255,255,.03); color:rgba(252,228,247,.62); font-style:italic; }
      #pdp-app .pdp-sprite-shell { display:inline-flex; align-items:center; justify-content:center; }
      #pdp-app .pdp-sprite-img, #pdp-app .pdp-sprite-fallback { image-rendering: pixelated; }
      #pdp-app .pdp-sprite-card { width:72px; height:72px; }
      #pdp-app .pdp-sprite-small { width:36px; height:36px; }
      #pdp-app .pdp-sprite-tiny { width:30px; height:30px; }
      #pdp-app .pdp-sprite-img.pdp-sprite-card { max-width:72px; max-height:72px; }
      #pdp-app .pdp-sprite-img.pdp-sprite-small { max-width:36px; max-height:36px; }
      #pdp-app .pdp-sprite-img.pdp-sprite-tiny { max-width:30px; max-height:30px; }
      @media (max-width: 1180px) { #pdp-app .pdp-toolbar-grid { grid-template-columns:repeat(3, minmax(0, 1fr)); } #pdp-app .pdp-main-grid, #pdp-app .pdp-stats-layout, #pdp-app .pdp-mon-grid, #pdp-app .pdp-card-notes, #pdp-app .pdp-move-row { grid-template-columns:1fr; } }
      @media (max-width: 760px) { #pdp-app .pdp-toolbar-grid, #pdp-app .pdp-discovery-grid, #pdp-app .pdp-base-stats { grid-template-columns:1fr 1fr; } #pdp-app .pdp-brand-row { flex-direction:column; align-items:flex-start; } #pdp-app .pdp-mon-head { grid-template-columns:1fr; } }
    `;
    document.head.appendChild(style);
  }
}
