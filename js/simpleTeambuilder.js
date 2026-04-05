const ROOM_STATE_KEY = 'prepdex-room-state-v6';
const MAX_TEAM_SIZE = 12;
const PANEL_ORDER_DEFAULT = ['overview', 'teaminfo', 'movecats', 'speedcompare', 'typechart'];
const TYPE_ORDER = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];
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

const MOVE_CATEGORIES = {
  hazards: ['stealthrock', 'spikes', 'toxicspikes', 'stickyweb'],
  removal: ['defog', 'rapidspin', 'mortalspin', 'tidyup', 'courtchange'],
  momentum: ['uturn', 'voltswitch', 'flipturn', 'partingshot', 'batonpass', 'teleport', 'shedtail', 'chillyreception'],
  cleric: ['wish', 'healingwish', 'healbell', 'aromatherapy', 'revivalblessing', 'lunarblessing', 'junglehealing', 'lifedew'],
  priority: ['aquajet', 'bulletpunch', 'iceshard', 'machpunch', 'extremespeed', 'shadowsneak', 'suckerpunch', 'thunderclap', 'vacuumwave', 'quickattack', 'accelerock', 'grassyglide', 'firstimpression'],
  speedcontrol: ['tailwind', 'trickroom', 'thunderwave', 'icywind', 'electroweb', 'bulldoze', 'stringshot', 'scaryface', 'glare', 'stickyweb'],
};

export default class SimpleTeambuilder {
  constructor(room) {
    this.room = room;
    this.state = this.loadState();
    this.currentTarget = 'my';
    this.lastSuggestions = [];
    this.dragPanelId = null;
    this.imageCache = new Map();
    this.initialize();
  }

  loadState() {
    const fallback = {
      generation: '9',
      natdex: false,
      myTeam: [],
      oppTeam: [],
      savedMatchups: [],
      panelOrder: [...PANEL_ORDER_DEFAULT],
      panelCollapsed: {},
      speedConfigs: [
        { title: 'Speed Compare', level: 100, ev: 252, iv: 31, boost: 0, nature: 'neutral' },
      ],
    };

    try {
      const parsed = JSON.parse(localStorage.getItem(ROOM_STATE_KEY) || 'null');
      return this.normalizeUiState(Object.assign({}, fallback, parsed || {}));
    } catch {
      return this.normalizeUiState(fallback);
    }
  }

  normalizeUiState(state) {
    const normalized = Object.assign({}, state || {});
    const panelOrder = Array.isArray(normalized.panelOrder) ? normalized.panelOrder.filter((id) => PANEL_ORDER_DEFAULT.includes(id) && id !== 'overview') : [];
    normalized.panelOrder = ['overview', ...panelOrder, ...PANEL_ORDER_DEFAULT.filter((id) => id !== 'overview' && !panelOrder.includes(id))];
    normalized.panelCollapsed = normalized.panelCollapsed && typeof normalized.panelCollapsed === 'object' ? normalized.panelCollapsed : {};

    const speedDefaults = [
      { title: 'Speed Compare', level: 100, ev: 252, iv: 31, boost: 0, nature: 'neutral' },
    ];
    normalized.speedConfigs = speedDefaults.map((defaults, index) => {
      const current = normalized.speedConfigs?.[index] || {};
      return {
        title: defaults.title,
        level: this.clampNumber(current.level, 1, 100, defaults.level),
        ev: this.clampNumber(current.ev, 0, 252, defaults.ev),
        iv: this.clampNumber(current.iv, 0, 31, defaults.iv),
        boost: this.clampNumber(current.boost, -6, 6, defaults.boost),
        nature: ['positive', 'neutral', 'negative'].includes(current.nature) ? current.nature : defaults.nature,
      };
    });

    return normalized;
  }

  saveState() {
    localStorage.setItem(ROOM_STATE_KEY, JSON.stringify(this.state));
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
    this.syncControlsFromState();
    this.bindEvents();
    this.renderAll();
  }

  cacheDom() {
    this.root = this.room.$el[0];
    this.generationEl = this.root.querySelector('#pd-generation');
    this.natdexEl = this.root.querySelector('#pd-natdex');
    this.searchEl = this.root.querySelector('#pd-search');
    this.targetEl = this.root.querySelector('#pd-target');
    this.savedTargetEl = this.root.querySelector('#pd-saved-target');
    this.suggestionsEl = this.root.querySelector('#pd-suggestions');
    this.myPasteEl = this.root.querySelector('#pd-paste-my');
    this.oppPasteEl = this.root.querySelector('#pd-paste-opp');
    this.savedMatchupsEl = this.root.querySelector('#pd-saved-matchups');
    this.savedTeamsEl = this.root.querySelector('#pd-saved-teams');
    this.panelsEl = this.root.querySelector('#pd-panels');
  }

  populateGenerationDropdown() {
    const html = [];
    for (let gen = 9; gen >= 1; gen -= 1) html.push(`<option value="${gen}">Gen ${gen}</option>`);
    this.generationEl.innerHTML = html.join('');
  }

  syncControlsFromState() {
    this.generationEl.value = String(this.state.generation || '9');
    this.natdexEl.checked = !!this.state.natdex;
    this.targetEl.value = this.currentTarget;
    this.savedTargetEl.value = 'my';
    this.refreshSavedMatchupsDropdown();
    this.refreshSavedTeamsDropdown();
  }

  bindEvents() {
    this.generationEl.addEventListener('change', () => {
      this.state.generation = this.generationEl.value;
      this.saveState();
      this.renderAll();
    });

    this.natdexEl.addEventListener('change', () => {
      this.state.natdex = this.natdexEl.checked;
      this.saveState();
      this.renderAll();
    });

    this.targetEl.addEventListener('change', () => {
      this.currentTarget = this.targetEl.value;
      this.refreshSuggestions();
    });

    this.searchEl.addEventListener('input', () => this.refreshSuggestions());
    this.searchEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const first = this.lastSuggestions[0];
        if (first) this.addPokemonByName(first.name, this.currentTarget);
      }
    });

    this.root.querySelector('#pd-add-first').addEventListener('click', (event) => {
      event.preventDefault();
      const first = this.lastSuggestions[0];
      if (first) this.addPokemonByName(first.name, this.currentTarget);
    });

    this.root.querySelector('#pd-import-my').addEventListener('click', (event) => {
      event.preventDefault();
      this.importFromText('my', this.myPasteEl.value);
    });

    this.root.querySelector('#pd-import-opp').addEventListener('click', (event) => {
      event.preventDefault();
      this.importFromText('opp', this.oppPasteEl.value);
    });

    this.root.querySelector('#pd-clear-my').addEventListener('click', (event) => {
      event.preventDefault();
      this.clearTeam('my');
    });

    this.root.querySelector('#pd-clear-opp').addEventListener('click', (event) => {
      event.preventDefault();
      this.clearTeam('opp');
    });

    this.root.querySelector('#pd-load-team').addEventListener('click', (event) => {
      event.preventDefault();
      this.importSavedShowdownTeam();
    });

    this.root.querySelector('#pd-load-matchup').addEventListener('click', (event) => {
      event.preventDefault();
      this.loadSelectedMatchup();
    });

    this.root.querySelector('#pd-save-matchup').addEventListener('click', (event) => {
      event.preventDefault();
      this.saveCurrentMatchup();
    });

    this.root.querySelector('#pd-delete-matchup').addEventListener('click', (event) => {
      event.preventDefault();
      this.deleteSelectedMatchup();
    });
  }

  renderAll() {
    this.state = this.normalizeUiState(this.state);
    this.state.myTeam = this.normalizeTeamEntries(this.state.myTeam);
    this.state.oppTeam = this.normalizeTeamEntries(this.state.oppTeam);
    this.renderPanels();
    this.renderTeamOverview();
    this.renderTeamInfo();
    this.renderMoveCategories();
    this.renderSpeedComparePanels();
    this.renderTypeChartPanel();
    this.refreshSuggestions();
    this.refreshSavedMatchupsDropdown();
    this.refreshSavedTeamsDropdown();
  }

  clampNumber(value, min, max, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, num));
  }

  renderPanels() {
    if (!this.panelsEl) return;
    this.panelsEl.innerHTML = this.state.panelOrder.map((panelId) => this.renderPanelCard(panelId)).join('');
    this.overviewEl = this.root.querySelector('#pd-overview');
    this.gridEl = this.root.querySelector('#pd-team-grid');
    this.moveCatsEl = this.root.querySelector('#pd-move-cats');
    this.speedCompareEls = [this.root.querySelector('#pd-speed-compare-0')];
    this.typeChartEl = this.root.querySelector('#pd-type-chart');
    this.bindPanelEvents();
  }

  renderPanelCard(panelId) {
    const collapsed = !!this.state.panelCollapsed?.[panelId];
    const content = {
      overview: { title: 'Team Overview', body: '<div id="pd-overview" class="pd-overview"></div>' },
      teaminfo: { title: 'Team Information View', body: '<div class="pd-team-shell"><div id="pd-team-grid" class="pd-team-grid"></div></div>' },
      movecats: { title: 'Move Categories', body: '<div id="pd-move-cats" class="pd-move-cats"></div>' },
      speedcompare: { title: 'Speed Compare', body: `<div id="pd-speed-compare-0">${this.renderSpeedCompareSkeleton(0)}</div>` },
      typechart: { title: 'Type Chart', body: '<div id="pd-type-chart"></div>' },
    }[panelId];
    if (!content) return '';

    return `
      <section class="pd-card pd-panel-card ${collapsed ? 'is-collapsed' : ''}" data-panel-id="${panelId}" draggable="true">
        <div class="pd-panel-head">
          <button class="button pd-panel-toggle" type="button" data-panel-toggle="${panelId}" aria-expanded="${collapsed ? 'false' : 'true'}">${collapsed ? 'Expand' : 'Collapse'}</button>
          <div class="pd-panel-title">${this.escapeHtml(content.title)}</div>
          <div class="pd-panel-grip" title="Drag to reorder">::</div>
        </div>
        <div class="pd-panel-body">${content.body}</div>
      </section>
    `;
  }

  renderSpeedCompareSkeleton(index) {
    const cfg = this.state.speedConfigs?.[index] || {};
    return `
      <div class="pd-speed-controls" data-speed-index="${index}">
        <label class="pd-inline-field"><span>Lv</span><input class="textbox pd-speed-input" type="number" min="1" max="100" step="1" data-speed-field="level" value="${this.escapeAttr(cfg.level ?? 100)}"></label>
        <label class="pd-inline-field"><span>EV</span><input class="textbox pd-speed-input" type="number" min="0" max="252" step="4" data-speed-field="ev" value="${this.escapeAttr(cfg.ev ?? 252)}"></label>
        <label class="pd-inline-field"><span>IV</span><input class="textbox pd-speed-input" type="number" min="0" max="31" step="1" data-speed-field="iv" value="${this.escapeAttr(cfg.iv ?? 31)}"></label>
        <label class="pd-inline-field"><span>Boost</span><input class="textbox pd-speed-input" type="number" min="-6" max="6" step="1" data-speed-field="boost" value="${this.escapeAttr(cfg.boost ?? 0)}"></label>
        <label class="pd-inline-field"><span>Nature</span><select class="button pd-speed-select" data-speed-field="nature"><option value="positive"${cfg.nature === 'positive' ? ' selected' : ''}>Positive</option><option value="neutral"${cfg.nature !== 'positive' && cfg.nature !== 'negative' ? ' selected' : ''}>Neutral</option><option value="negative"${cfg.nature === 'negative' ? ' selected' : ''}>Negative</option></select></label>
      </div>
      <div class="pd-speed-board-wrap"></div>
    `;
  }

  bindPanelEvents() {
    for (const button of this.root.querySelectorAll('[data-panel-toggle]')) {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const panelId = button.getAttribute('data-panel-toggle');
        this.state.panelCollapsed[panelId] = !this.state.panelCollapsed[panelId];
        this.saveState();
        this.renderAll();
      });
    }

    for (const card of this.root.querySelectorAll('.pd-panel-card')) {
      card.addEventListener('dragstart', (event) => {
        this.dragPanelId = card.getAttribute('data-panel-id');
        event.dataTransfer.effectAllowed = 'move';
        try { event.dataTransfer.setData('text/plain', this.dragPanelId || ''); } catch {}
      });
      card.addEventListener('dragover', (event) => {
        event.preventDefault();
        card.classList.add('is-drop-target');
      });
      card.addEventListener('dragleave', () => {
        card.classList.remove('is-drop-target');
      });
      card.addEventListener('drop', (event) => {
        event.preventDefault();
        card.classList.remove('is-drop-target');
        const targetId = card.getAttribute('data-panel-id');
        this.reorderPanels(this.dragPanelId, targetId);
      });
      card.addEventListener('dragend', () => {
        this.dragPanelId = null;
        for (const panel of this.root.querySelectorAll('.pd-panel-card')) panel.classList.remove('is-drop-target');
      });
    }

    for (const input of this.root.querySelectorAll('.pd-speed-controls [data-speed-field]')) {
      const apply = () => {
        const wrap = input.closest('.pd-speed-controls');
        const index = Number(wrap?.getAttribute('data-speed-index'));
        if (!Number.isFinite(index) || !this.state.speedConfigs?.[index]) return;
        const field = input.getAttribute('data-speed-field');
        const config = this.state.speedConfigs[index];
        if (field === 'nature') config.nature = ['positive', 'neutral', 'negative'].includes(input.value) ? input.value : 'neutral';
        if (field === 'level') config.level = this.clampNumber(input.value, 1, 100, 100);
        if (field === 'ev') config.ev = this.clampNumber(input.value, 0, 252, 252);
        if (field === 'iv') config.iv = this.clampNumber(input.value, 0, 31, 31);
        if (field === 'boost') config.boost = this.clampNumber(input.value, -6, 6, 0);
        this.saveState();
        this.renderSpeedComparePanels();
      };

      input.addEventListener('change', apply);
      if (input.tagName === 'INPUT') input.addEventListener('input', apply);
    }
  }

  reorderPanels(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId || sourceId === 'overview' || targetId === 'overview') return;
    const order = [...this.state.panelOrder];
    const sourceIndex = order.indexOf(sourceId);
    const targetIndex = order.indexOf(targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    order.splice(sourceIndex, 1);
    const insertAt = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    order.splice(insertAt, 0, sourceId);
    this.state.panelOrder = order;
    this.saveState();
    this.renderAll();
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

    try {
      if (dex?.species?.all) lists.push(...dex.species.all());
    } catch {}
    try {
      if (window.Dex?.species?.all) lists.push(...window.Dex.species.all());
    } catch {}

    if ((!lists.length) && window.BattlePokedex) {
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

  refreshSuggestions() {
    const query = String(this.searchEl.value || '').trim().toLowerCase();
    const matches = this.getAllSearchableSpecies().filter((species) => {
      if (!query) return false;
      const hay = [species.name, species.baseSpecies, ...(species.types || [])].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(query);
    });

    const starts = matches.filter((mon) => mon.name.toLowerCase().startsWith(query));
    const contains = matches.filter((mon) => !mon.name.toLowerCase().startsWith(query));
    const results = (query ? [...starts, ...contains] : []).slice(0, 12);
    this.lastSuggestions = results;

    if (!query) {
      this.suggestionsEl.innerHTML = '<div class="pd-empty">Start typing a Pokémon name to see suggestions.</div>';
      return;
    }
    if (!results.length) {
      this.suggestionsEl.innerHTML = '<div class="pd-empty">No Pokémon found for this generation/filter.</div>';
      return;
    }

    this.suggestionsEl.innerHTML = results.map((species, index) => `
      <button class="button pd-suggestion ${index === 0 ? 'is-primary' : ''}" type="button" data-name="${this.escapeAttr(species.name)}">
        <span class="pd-sprite" style="${this.getPokemonIconStyle(species)}"></span>
        <span class="pd-suggestion-main">
          <span class="pd-suggestion-name">${this.escapeHtml(species.name)}</span>
          <span class="pd-suggestion-meta">Gen ${species.gen || '?'} · ${(species.types || []).join(' / ') || 'Unknown type'}</span>
        </span>
        <span class="pd-suggestion-plus">Add</span>
      </button>
    `).join('');

    for (const button of this.suggestionsEl.querySelectorAll('.pd-suggestion')) {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        this.addPokemonByName(button.getAttribute('data-name'), this.currentTarget);
      });
    }
  }

  addPokemonByName(name, target) {
    const species = this.getSpecies(name);
    if (!species || !this.isSpeciesAllowed(species)) {
      alert('PrepDex could not add that Pokémon for the selected generation/filter.');
      return;
    }

    const list = target === 'opp' ? this.state.oppTeam : this.state.myTeam;
    if (list.length >= MAX_TEAM_SIZE) {
      alert(`PrepDex supports up to ${MAX_TEAM_SIZE} Pokémon per side.`);
      return;
    }

    list.push(this.makeTeamEntry(species));
    this.saveState();
    this.searchEl.value = '';
    this.renderAll();
  }

  makeTeamEntry(species, set = null) {
    const moves = (set?.moves || []).map((move) => {
      const resolved = this.getMove(move);
      return resolved?.name || move;
    });
    return {
      name: species.name,
      species: species.name,
      ability: set?.ability || '',
      captainRole: ['tera', 'z'].includes(set?.captainRole) ? set.captainRole : '',
      abilities: species.abilities || {},
      types: species.types || [],
      baseStats: species.baseStats || {},
      moves,
      validMoves: this.getValidMovesForSpecies(species, moves),
    };
  }

  clearTeam(target) {
    if (target === 'opp') this.state.oppTeam = [];
    else this.state.myTeam = [];
    this.saveState();
    this.renderAll();
  }

  getMove(name) {
    try {
      const move = this.getDex()?.moves?.get?.(name) || window.Dex?.moves?.get?.(name);
      return move?.exists ? move : null;
    } catch {
      return null;
    }
  }

  getValidMovesForSpecies(species, knownMoves = []) {
    const learnedIds = this.getLearnsetMoveIds(species);
    const names = [];
    const seen = new Set();

    for (const moveName of knownMoves || []) {
      const move = this.getMove(moveName);
      const moveId = this.toID(move?.name || moveName);
      if (!moveId || seen.has(moveId)) continue;
      seen.add(moveId);
      names.push(move?.name || moveName);
    }

    for (const moveId of learnedIds) {
      if (!moveId || seen.has(moveId)) continue;
      const move = this.getMove(moveId);
      if (!move?.name) continue;
      seen.add(moveId);
      names.push(move.name);
    }

    return names.sort((a, b) => a.localeCompare(b));
  }

  getLearnsetMoveIds(species) {
    const resolved = this.getSpecies(species?.name || species?.species || species);
    if (!resolved?.name) return [];

    const learnsetTables = this.getLearnsetTables();
    const collected = new Set();
    const visited = new Set();
    const queue = [resolved];

    while (queue.length) {
      const current = queue.shift();
      if (!current?.name) continue;
      const id = this.toID(current.name);
      if (!id || visited.has(id)) continue;
      visited.add(id);

      const learnset = this.getLearnsetForId(id, learnsetTables);
      if (learnset) {
        for (const moveId of Object.keys(learnset)) {
          if (moveId) collected.add(moveId);
        }
      }

      const relatives = [current.baseSpecies, current.prevo, current.changesFrom];
      for (const relative of relatives) {
        const next = relative ? this.getSpecies(relative) : null;
        if (next?.name) queue.push(next);
      }
    }

    return Array.from(collected);
  }

  getLearnsetTables() {
    const dex = this.getDex();
    const tables = [];
    const maybePush = (table) => {
      if (table && typeof table === 'object') tables.push(table);
    };

    maybePush(dex?.data?.Learnsets);
    maybePush(window.Dex?.data?.Learnsets);
    maybePush(window.BattleTeambuilderTable?.learnsets);
    maybePush(window.BattleLearnsets);

    return tables;
  }

  getLearnsetForId(id, tables) {
    for (const table of tables || []) {
      const raw = table?.[id];
      if (!raw) continue;
      if (raw.learnset && typeof raw.learnset === 'object') return raw.learnset;
      if (typeof raw === 'object') return raw;
    }

    const speciesTables = [this.getDex()?.species, window.Dex?.species];
    for (const speciesTable of speciesTables) {
      try {
        const learnsetData = speciesTable?.getLearnsetData?.(id);
        if (learnsetData?.learnset && typeof learnsetData.learnset === 'object') return learnsetData.learnset;
      } catch {}
    }

    return null;
  }

  normalizeTeamEntries(team) {
    return (team || []).map((entry) => {
      const species = this.getSpecies(entry?.species || entry?.name);
      if (!species) return entry;
      const moves = Array.isArray(entry?.moves) ? entry.moves : [];
      return {
        ...entry,
        name: species.name,
        species: species.name,
        ability: entry?.ability || '',
        captainRole: ['tera', 'z'].includes(entry?.captainRole) ? entry.captainRole : '',
        abilities: entry?.abilities || species.abilities || {},
        types: entry?.types || species.types || [],
        baseStats: entry?.baseStats || species.baseStats || {},
        moves,
        validMoves: this.getValidMovesForSpecies(species, moves),
      };
    });
  }

  getNatureMultiplier(nature) {
    if (nature === 'positive') return 1.1;
    if (nature === 'negative') return 0.9;
    return 1;
  }

  getBoostMultiplier(boost) {
    const stage = this.clampNumber(boost, -6, 6, 0);
    if (stage >= 0) return (2 + stage) / 2;
    return 2 / (2 - stage);
  }

  calculateSpeedStat(baseSpeed, config = {}) {
    const level = this.clampNumber(config.level, 1, 100, 100);
    const ev = this.clampNumber(config.ev, 0, 252, 252);
    const iv = this.clampNumber(config.iv, 0, 31, 31);
    const base = Math.floor((((2 * Number(baseSpeed || 0)) + iv + Math.floor(ev / 4)) * level) / 100) + 5;
    const natureAdjusted = Math.floor(base * this.getNatureMultiplier(config.nature));
    return Math.floor(natureAdjusted * this.getBoostMultiplier(config.boost));
  }

  getTeamSpeedRows(team, config = null) {
    return (team || []).map((entry, teamIndex) => {
      const species = this.getSpecies(entry.species || entry.name) || entry;
      const baseSpeed = Number(entry.baseStats?.spe ?? species.baseStats?.spe ?? 0);
      const speed = config ? this.calculateSpeedStat(baseSpeed, config) : baseSpeed;
      return { entry, species, baseSpeed, speed, teamIndex };
    }).sort((a, b) => b.speed - a.speed || b.baseSpeed - a.baseSpeed || String(a.species.name).localeCompare(String(b.species.name)));
  }

  getTeamRows(team) {
    return (team || []).map((entry, teamIndex) => {
      const species = this.getSpecies(entry.species || entry.name) || entry;
      const baseSpeed = Number(entry.baseStats?.spe ?? species.baseStats?.spe ?? 0);
      return { entry, species, baseSpeed, speed: baseSpeed, teamIndex };
    });
  }

  renderTeamOverview() {
    if (!this.overviewEl) return;
    const myRows = this.getTeamSpeedRows(this.state.myTeam);
    const oppRows = this.getTeamSpeedRows(this.state.oppTeam);
    this.overviewEl.innerHTML = `
      <div class="pd-overview-actions">
        <button class="button pd-export-overview" type="button" data-export-overview="copy">Copy PNG</button>
        <button class="button pd-export-overview" type="button" data-export-overview="download">Download PNG</button>
      </div>
      <div class="pd-overview-shell">
        <section class="pd-overview-side my">
          <div class="pd-overview-head">
            <span class="pd-overview-title">My Team</span>
            <span class="pd-overview-count">${myRows.length}</span>
          </div>
          <div class="pd-overview-grid">${this.renderOverviewSprites(myRows, 'my')}</div>
        </section>
        <section class="pd-overview-mid">
          <div class="pd-overview-mid-title">Speed</div>
          ${this.renderOverviewSpeedRows(myRows, oppRows)}
        </section>
        <section class="pd-overview-side opp">
          <div class="pd-overview-head">
            <span class="pd-overview-title">Opponent</span>
            <span class="pd-overview-count">${oppRows.length}</span>
          </div>
          <div class="pd-overview-grid">${this.renderOverviewSprites(oppRows, 'opp')}</div>
        </section>
      </div>
    `;

    for (const button of this.overviewEl.querySelectorAll('[data-export-overview]')) {
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        const mode = button.getAttribute('data-export-overview');
        try {
          await this.exportOverviewImage(mode);
        } catch (error) {
          alert(error?.message || 'PrepDex could not export the team overview.');
        }
      });
    }

    for (const button of this.overviewEl.querySelectorAll('[data-captain-role]')) {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const side = button.getAttribute('data-captain-side');
        const index = Number(button.getAttribute('data-captain-index'));
        const role = button.getAttribute('data-captain-role');
        this.setCaptainRole(side, index, role);
      });
    }
  }

  renderOverviewSprites(rows, side) {
    if (!rows.length) return '<div class="pd-empty">No Pokemon loaded.</div>';
    return rows.map((row, index) => `
      <div class="pd-overview-mon ${side}" title="${this.escapeAttr(`${row.species.name} · Speed ${row.baseSpeed}`)}">
        <span class="pd-sprite pd-overview-sprite" style="${this.getPokemonIconStyle(row.species)}"></span>
      </div>
    `).join('');
  }

  renderOverviewSpeedRows(myRows, oppRows) {
    const len = Math.max(myRows.length, oppRows.length, 6);
    return Array.from({ length: len }, (_, index) => {
      const my = myRows[index];
      const opp = oppRows[index];
      return `
        <div class="pd-overview-speed-row">
          <span class="pd-overview-mini my">${my ? `<span class="pd-sprite" style="${this.getPokemonIconStyle(my.species)}"></span>` : '&nbsp;'}</span>
          <span class="pd-overview-speed my">${my ? my.baseSpeed : '&mdash;'}</span>
          <span class="pd-overview-speed opp">${opp ? opp.baseSpeed : '&mdash;'}</span>
          <span class="pd-overview-mini opp">${opp ? `<span class="pd-sprite" style="${this.getPokemonIconStyle(opp.species)}"></span>` : '&nbsp;'}</span>
        </div>
      `;
    }).join('');
  }

  async exportOverviewImage(mode = 'download') {
    const canvas = await this.renderOverviewCanvas();
    if (mode === 'copy') {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('Clipboard image copy is not supported in this browser.');
      }
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('PrepDex could not build the overview image.');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return;
    }

    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = 'prepdex-team-overview.png';
    link.click();
  }

  async renderOverviewCanvas() {
    const myRows = this.getTeamSpeedRows(this.state.myTeam);
    const oppRows = this.getTeamSpeedRows(this.state.oppTeam);
    const totalRows = Math.max(myRows.length, oppRows.length, 6);
    const cols = 3;
    const cellW = 108;
    const cellH = 82;
    const sideW = 3 * cellW + 36;
    const midW = 118;
    const headerH = 54;
    const gridRows = Math.max(Math.ceil(myRows.length / cols), Math.ceil(oppRows.length / cols), 3);
    const sideGridH = gridRows * cellH + 28;
    const speedRowH = 28;
    const speedBlockH = totalRows * speedRowH;
    const contentH = Math.max(sideGridH, speedBlockH);
    const width = sideW * 2 + midW;
    const height = headerH + contentH;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('PrepDex could not create an image canvas.');

    ctx.fillStyle = '#202733';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#32445f';
    ctx.fillRect(0, 0, sideW, height);
    ctx.fillStyle = '#5a4148';
    ctx.fillRect(sideW + midW, 0, sideW, height);
    ctx.fillStyle = '#0f3a68';
    ctx.fillRect(sideW, 0, midW, height);

    this.drawOverviewHeader(ctx, 0, 0, sideW, 'MY TEAM', '#8fc4ff', myRows.length);
    this.drawOverviewHeader(ctx, sideW, 0, midW, 'SPEED', '#ffffff');
    this.drawOverviewHeader(ctx, sideW + midW, 0, sideW, 'OPPONENT', '#ffb39f', oppRows.length);

    await this.drawOverviewGrid(ctx, myRows, 0, headerH, sideW, cols, cellW, cellH);
    await this.drawOverviewSpeedCanvas(ctx, myRows, oppRows, sideW, headerH, midW, totalRows, speedRowH);
    await this.drawOverviewGrid(ctx, oppRows, sideW + midW, headerH, sideW, cols, cellW, cellH);
    return canvas;
  }

  drawOverviewHeader(ctx, x, y, w, label, color, count = null) {
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(x, y, w, 54);
    ctx.fillStyle = color;
    ctx.font = 'italic 700 24px Verdana';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 16, y + 27);

    if (count !== null) {
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.beginPath();
      ctx.arc(x + w - 28, y + 27, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 12px Verdana';
      ctx.textAlign = 'center';
      ctx.fillText(String(count), x + w - 28, y + 27);
      ctx.textAlign = 'left';
    }
  }

  async drawOverviewGrid(ctx, rows, x, y, width, cols, cellW, cellH) {
    for (let i = 0; i < rows.length; i += 1) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const cellX = x + 12 + col * cellW;
      const cellY = y + 14 + row * cellH;
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      this.roundRect(ctx, cellX, cellY, cellW - 12, cellH - 18, 14);
      ctx.fill();
      await this.drawPokemonSpriteOnCanvas(ctx, rows[i].species, cellX + 18, cellY + 12, 2);
    }
  }

  async drawOverviewSpeedCanvas(ctx, myRows, oppRows, x, y, width, totalRows, rowH) {
    for (let i = 0; i < totalRows; i += 1) {
      const rowY = y + i * rowH;
      ctx.strokeStyle = 'rgba(255,255,255,.08)';
      ctx.beginPath();
      ctx.moveTo(x, rowY);
      ctx.lineTo(x + width, rowY);
      ctx.stroke();
      const my = myRows[i];
      const opp = oppRows[i];
      if (my) await this.drawPokemonSpriteOnCanvas(ctx, my.species, x + 3, rowY + 2, 0.82);
      if (opp) await this.drawPokemonSpriteOnCanvas(ctx, opp.species, x + width - 36, rowY + 2, 0.82);
      ctx.fillStyle = '#9dd0ff';
      ctx.font = '700 10px Verdana';
      ctx.textAlign = 'center';
      ctx.fillText(my ? String(my.baseSpeed) : '—', x + 48, rowY + 15);
      ctx.fillStyle = '#ffb2a8';
      ctx.fillText(opp ? String(opp.baseSpeed) : '—', x + width - 48, rowY + 15);
    }
    ctx.textAlign = 'left';
  }

  async drawPokemonSpriteOnCanvas(ctx, species, x, y, scale = 1) {
    const icon = this.getPokemonIconData(species);
    if (!icon?.url) return;
    const image = await this.loadCanvasImage(icon.url);
    if (!image) return;
    const destW = icon.width * scale;
    const destH = icon.height * scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, icon.x, icon.y, icon.width, icon.height, x, y, destW, destH);
  }

  getPokemonIconData(species) {
    try {
      const raw = String(window.Dex?.getPokemonIcon ? window.Dex.getPokemonIcon(species) : '');
      const urlMatch = raw.match(/url\(([^)]+)\)/i);
      if (!urlMatch) return null;
      const pos = raw.match(/(-?\d+)px\s+(-?\d+)px/i);
      return {
        url: urlMatch[1].replace(/["']/g, ''),
        x: Math.abs(Number(pos?.[1] || 0)),
        y: Math.abs(Number(pos?.[2] || 0)),
        width: 40,
        height: 30,
      };
    } catch {
      return null;
    }
  }

  async loadCanvasImage(src) {
    if (!src) return null;
    if (!this.imageCache.has(src)) {
      const promise = new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      }).catch(() => null);
      this.imageCache.set(src, promise);
    }
    return this.imageCache.get(src);
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  setCaptainRole(side, index, role) {
    const list = side === 'opp' ? this.state.oppTeam : this.state.myTeam;
    const entry = list?.[index];
    if (!entry) return;
    entry.captainRole = entry.captainRole === role ? '' : role;
    this.saveState();
    this.renderAll();
  }

  renderOverviewSprites(rows, side) {
    if (!rows.length) return '<div class="pd-empty">No Pokemon loaded.</div>';
    return rows.map((row, index) => {
      const role = row.entry?.captainRole || '';
      const roleClass = role ? ` is-${role}` : '';
      return `
        <div class="pd-overview-mon ${side}${roleClass}" title="${this.escapeAttr(`${row.species.name} - Speed ${row.baseSpeed}`)}">
          <div class="pd-overview-captainbar">
            <button class="button pd-captain-btn ${role === 'tera' ? 'is-active tera' : ''}" type="button" data-captain-side="${side}" data-captain-index="${row.teamIndex}" data-captain-role="tera" title="Toggle Tera captain">${this.getTeraIconHtml(true)}</button>
            <button class="button pd-captain-btn ${role === 'z' ? 'is-active z' : ''}" type="button" data-captain-side="${side}" data-captain-index="${row.teamIndex}" data-captain-role="z" title="Toggle Z captain">Z</button>
          </div>
          <span class="pd-sprite pd-overview-sprite" style="${this.getPokemonIconStyle(row.species)}"></span>
        </div>
      `;
    }).join('');
  }

  getTeraIconUrl() {
    return '';
  }

  getTeraIconHtml(compact = false) {
    return `<span class="pd-tera-fallback${compact ? ' compact' : ''}">T</span>`;
  }

  getCaptainFill(role, side) {
    if (role === 'tera') {
      return side === 'my'
        ? 'linear-gradient(135deg, rgba(255,102,196,.42), rgba(120,214,255,.42), rgba(247,229,101,.44))'
        : 'linear-gradient(135deg, rgba(255,130,113,.42), rgba(167,117,255,.4), rgba(120,214,255,.38))';
    }
    if (role === 'z') {
      return side === 'my' ? 'rgba(126,88,224,.45)' : 'rgba(149,83,210,.42)';
    }
    return 'rgba(255,255,255,.08)';
  }

  async drawOverviewGrid(ctx, rows, x, y, width, cols, cellW, cellH) {
    for (let i = 0; i < rows.length; i += 1) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const cellX = x + 12 + col * cellW;
      const cellY = y + 14 + row * cellH;
      const role = rows[i].entry?.captainRole || '';
      if (role === 'tera') {
        const grad = ctx.createLinearGradient(cellX, cellY, cellX + cellW, cellY + cellH);
        grad.addColorStop(0, 'rgba(255,102,196,.42)');
        grad.addColorStop(.5, 'rgba(120,214,255,.42)');
        grad.addColorStop(1, 'rgba(247,229,101,.44)');
        ctx.fillStyle = grad;
      } else if (role === 'z') {
        ctx.fillStyle = 'rgba(131,89,221,.46)';
      } else {
        ctx.fillStyle = 'rgba(255,255,255,.08)';
      }
      this.roundRect(ctx, cellX, cellY, cellW - 12, cellH - 18, 14);
      ctx.fill();
      if (role === 'tera') await this.drawTeraBadgeOnCanvas(ctx, cellX + cellW - 36, cellY + 6);
      if (role === 'z') this.drawZBadgeOnCanvas(ctx, cellX + cellW - 30, cellY + 10);
      await this.drawPokemonSpriteOnCanvas(ctx, rows[i].species, cellX + 18, cellY + 12, 2);
    }
  }

  async drawTeraBadgeOnCanvas(ctx, x, y) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 11px Verdana';
    ctx.fillText('T', x + 4, y + 10);
  }

  drawZBadgeOnCanvas(ctx, x, y) {
    ctx.fillStyle = '#f6ecff';
    ctx.font = '700 13px Verdana';
    ctx.fillText('Z', x, y);
  }

  async drawOverviewSpeedCanvas(ctx, myRows, oppRows, x, y, width, totalRows, rowH) {
    for (let i = 0; i < totalRows; i += 1) {
      const rowY = y + i * rowH;
      ctx.strokeStyle = 'rgba(255,255,255,.08)';
      ctx.beginPath();
      ctx.moveTo(x, rowY);
      ctx.lineTo(x + width, rowY);
      ctx.stroke();
      const my = myRows[i];
      const opp = oppRows[i];
      if (my) await this.drawPokemonSpriteOnCanvas(ctx, my.species, x + 3, rowY + 2, 0.82);
      if (opp) await this.drawPokemonSpriteOnCanvas(ctx, opp.species, x + width - 36, rowY + 2, 0.82);
      ctx.fillStyle = '#9dd0ff';
      ctx.font = '700 10px Verdana';
      ctx.textAlign = 'center';
      ctx.fillText(my ? String(my.baseSpeed) : '-', x + 46, rowY + 15);
      ctx.fillStyle = '#ffb2a8';
      ctx.fillText(opp ? String(opp.baseSpeed) : '-', x + width - 46, rowY + 15);
    }
    ctx.textAlign = 'left';
  }

  renderSpeedComparePanels() {
    (this.speedCompareEls || []).forEach((el, index) => {
      if (!el) return;
      const shell = el.querySelector('.pd-speed-board-wrap');
      if (!shell) return;
      const cfg = this.state.speedConfigs?.[index] || {};
      shell.innerHTML = this.renderSpeedBoardPair(cfg.title || 'Speed Compare', this.getTeamSpeedRows(this.state.myTeam, cfg), this.getTeamSpeedRows(this.state.oppTeam, cfg), false);
    });
  }

  renderSpeedBoardPair(title, myRows, oppRows, showBaseLabel) {
    return `
      <div class="pd-speed-pair">
        <div class="pd-speed-side my">
          <div class="pd-speed-side-title">My Team ${showBaseLabel ? '' : `| ${this.escapeHtml(title)}`}</div>
          ${this.renderSpeedList(myRows, showBaseLabel ? 'Base' : 'Speed')}
        </div>
        <div class="pd-speed-side opp">
          <div class="pd-speed-side-title">Opponent ${showBaseLabel ? '' : `| ${this.escapeHtml(title)}`}</div>
          ${this.renderSpeedList(oppRows, showBaseLabel ? 'Base' : 'Speed')}
        </div>
      </div>
    `;
  }

  renderSpeedList(rows, valueLabel) {
    if (!rows.length) return '<div class="pd-empty">Add Pokemon to see speed tiers.</div>';
    return `
      <div class="pd-speed-table">
        <div class="pd-speed-table-head">
          <span>Pokemon</span>
          <span>${this.escapeHtml(valueLabel)}</span>
        </div>
        ${rows.map((row) => `
          <div class="pd-speed-row">
            <span class="pd-speed-mon">
              <span class="pd-sprite" style="${this.getPokemonIconStyle(row.species)}"></span>
              <span class="pd-speed-name">${this.escapeHtml(row.species.name)}</span>
            </span>
            <span class="pd-speed-value">${row.speed}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderTypeChartPanel() {
    if (!this.typeChartEl) return;
    const myRows = this.getTeamRows(this.state.myTeam);
    const oppRows = this.getTeamRows(this.state.oppTeam);
    this.typeChartEl.innerHTML = `
      <div class="pd-typechart-wrap">
        <div class="pd-typechart-side my">
          <div class="pd-typechart-title">My Type Chart</div>
          ${this.renderTypeChartTable(myRows, 'my')}
        </div>
        <div class="pd-typechart-side opp">
          <div class="pd-typechart-title">Opponent Type Chart</div>
          ${this.renderTypeChartTable(oppRows, 'opp')}
        </div>
      </div>
    `;
  }

  renderTypeChartTable(rows, side) {
    if (!rows.length) return '<div class="pd-empty">Add Pokemon to see type matchups.</div>';
    return `
      <div class="pd-typechart-scroll">
        <table class="pd-typechart-table ${side}">
          <thead>
            <tr>
              <th class="sticky sprite">SPR</th>
              ${TYPE_ORDER.map((type) => `<th title="${this.escapeAttr(type)}">${this.getTypeIconHtml(type)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => this.renderTypeChartRow(row)).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderTypeChartRow(row) {
    const types = row.entry.types || row.species.types || [];
    return `
      <tr>
        <td class="sticky sprite" title="${this.escapeAttr(row.species.name)}"><span class="pd-sprite" style="${this.getPokemonIconStyle(row.species)}"></span></td>
        ${TYPE_ORDER.map((attackType) => {
          const value = this.getDefensiveMultiplier(attackType, types, row.entry, row.species);
          const label = this.formatMultiplier(value);
          return `<td class="${this.getMultiplierClass(value)}" title="${this.escapeAttr(`${row.species.name} vs ${attackType}`)}">${label}</td>`;
        }).join('')}
      </tr>
    `;
  }

  getDefensiveMultiplier(attackType, defenderTypes, entry, species) {
    let multiplier = 1;
    for (const defenderType of defenderTypes || []) {
      multiplier *= this.getSingleTypeMultiplier(attackType, defenderType);
    }

    if (this.hasAbilityImmunity(entry, species, attackType)) return 0;
    return multiplier;
  }

  hasAbilityImmunity(entry, species, attackType) {
    const chosen = this.toID(entry?.ability);
    if (chosen) return (ABILITY_IMMUNITY_MAP[chosen] || []).includes(attackType);

    const abilityList = Object.values(entry?.abilities || species?.abilities || {}).filter(Boolean);
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

  importFromText(target, text) {
    const imported = this.parseTeamText(text);
    if (!imported.length) {
      alert('PrepDex could not find any Pokémon in that text.');
      return;
    }

    const list = this.normalizeTeamEntries(imported.slice(0, MAX_TEAM_SIZE));
    if (target === 'opp') this.state.oppTeam = list;
    else this.state.myTeam = list;

    this.saveState();
    this.renderAll();
  }

  parseTeamText(text) {
    if (!text || !text.trim()) return [];

    if (window.Teams?.import) {
      try {
        const imported = window.Teams.import(text);
        if (Array.isArray(imported) && imported.length) {
          return imported
            .map((set) => {
              const species = this.getSpecies(set?.species || set?.name);
              return species && this.isSpeciesAllowed(species) ? this.makeTeamEntry(species, set) : null;
            })
            .filter(Boolean);
        }
      } catch {}
    }

    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const results = [];
    const seen = new Set();
    for (const line of lines) {
      const cleaned = line.replace(/^[-*]\s*/, '').replace(/\s*@.*$/, '').trim();
      if (!cleaned || /^(ability:|level:|tera type:|shiny:|evs:|ivs:|nature|happiness:|pokepaste)/i.test(cleaned)) continue;
      const aliasMatch = cleaned.match(/\(([^)]+)\)$/);
      const candidate = aliasMatch ? aliasMatch[1] : cleaned;
      const species = this.getSpecies(candidate);
      if (!species || !this.isSpeciesAllowed(species)) continue;
      const id = this.toID(species.name);
      if (seen.has(id)) continue;
      seen.add(id);
      results.push(this.makeTeamEntry(species));
    }
    return results;
  }

  getAllSavedTeams() {
    const teams = [];

    if (Array.isArray(window.Storage?.teams)) teams.push(...window.Storage.teams);

    const raw = localStorage.getItem('showdown_teams');
    if (raw) {
      for (const line of raw.split('\n')) {
        const parsed = this.unpackStoredTeamLine(line);
        if (parsed) teams.push(parsed);
      }
    }

    const deduped = [];
    const seen = new Set();
    for (const team of teams) {
      const key = `${team?.format || ''}|${team?.name || ''}|${team?.team || team?.packedTeam || ''}`;
      if (!team?.name || seen.has(key)) continue;
      seen.add(key);
      deduped.push(team);
    }

    return deduped;
  }

  unpackStoredTeamLine(line) {
    const pipeIndex = line.indexOf('|');
    if (pipeIndex < 0) return null;
    const bracketIndex = line.indexOf(']');
    const slashIndex = line.lastIndexOf('/', pipeIndex);
    const format = bracketIndex > 0 ? line.slice(1, bracketIndex) : 'gen9';
    const name = slashIndex >= 0 ? line.slice(slashIndex + 1, pipeIndex) : `Team ${pipeIndex}`;
    return { name, format, team: line.slice(pipeIndex + 1) };
  }

  getSelectedFormatKey() {
    const gen = `gen${this.state.generation}`;
    return this.state.natdex ? `${gen}nationaldex` : gen;
  }

  isTeamFormatMatch(formatText) {
    const fmt = this.toID(formatText || '');
    const genId = `gen${this.state.generation}`;
    if (!fmt) return true;
    if (!fmt.includes(genId)) return false;
    const isNat = fmt.includes('nationaldex') || fmt.includes('natdex');
    return this.state.natdex ? isNat : !isNat;
  }

  refreshSavedTeamsDropdown() {
    const teams = this.getAllSavedTeams().filter((team) => this.isTeamFormatMatch(team.format));
    const opts = ['<option value="">Choose a saved Showdown team</option>'];
    teams.forEach((team, index) => {
      opts.push(`<option value="${index}">${this.escapeHtml(team.name)}${team.format ? ` · ${this.escapeHtml(team.format)}` : ''}</option>`);
    });
    this.filteredSavedTeams = teams;
    this.savedTeamsEl.innerHTML = opts.join('');
  }

  importSavedShowdownTeam() {
    const idx = Number(this.savedTeamsEl.value);
    const target = this.savedTargetEl.value || 'my';
    const team = this.filteredSavedTeams?.[idx];
    if (!team) {
      alert('Select a saved Showdown team first.');
      return;
    }

    const packed = team.team || team.packedTeam || '';
    let imported = [];

    if (window.Teams?.unpack) {
      try {
        imported = window.Teams.unpack(packed) || [];
      } catch {}
    }

    const list = imported
      .map((set) => {
        const species = this.getSpecies(set?.species || set?.name);
        return species && this.isSpeciesAllowed(species) ? this.makeTeamEntry(species, set) : null;
      })
      .filter(Boolean)
      .slice(0, MAX_TEAM_SIZE);

    if (!list.length) {
      alert('PrepDex could not load that saved team for the selected generation/filter.');
      return;
    }

    const normalized = this.normalizeTeamEntries(list);
    if (target === 'opp') this.state.oppTeam = normalized;
    else this.state.myTeam = normalized;

    this.saveState();
    this.renderAll();
  }

  refreshSavedMatchupsDropdown() {
    const opts = ['<option value="">Saved matchups</option>'];
    (this.state.savedMatchups || []).forEach((item, index) => {
      opts.push(`<option value="${index}">${this.escapeHtml(item.name)}</option>`);
    });
    this.savedMatchupsEl.innerHTML = opts.join('');
  }

  saveCurrentMatchup() {
    const name = prompt('Name this matchup:', `Gen ${this.state.generation}${this.state.natdex ? ' NatDex' : ''} matchup`);
    if (!name) return;

    const payload = {
      name,
      generation: this.state.generation,
      natdex: this.state.natdex,
      myTeam: this.state.myTeam,
      oppTeam: this.state.oppTeam,
    };

    const others = (this.state.savedMatchups || []).filter((item) => item.name !== name);
    this.state.savedMatchups = [payload, ...others].slice(0, 30);
    this.saveState();
    this.refreshSavedMatchupsDropdown();
  }

  loadSelectedMatchup() {
    const idx = Number(this.savedMatchupsEl.value);
    const matchup = this.state.savedMatchups?.[idx];
    if (!matchup) return;
    this.state.generation = String(matchup.generation || '9');
    this.state.natdex = !!matchup.natdex;
    this.state.myTeam = this.normalizeTeamEntries(Array.isArray(matchup.myTeam) ? matchup.myTeam : []);
    this.state.oppTeam = this.normalizeTeamEntries(Array.isArray(matchup.oppTeam) ? matchup.oppTeam : []);
    this.saveState();
    this.syncControlsFromState();
    this.renderAll();
  }

  deleteSelectedMatchup() {
    const idx = Number(this.savedMatchupsEl.value);
    if (!Number.isFinite(idx) || idx < 0) return;
    this.state.savedMatchups.splice(idx, 1);
    this.saveState();
    this.refreshSavedMatchupsDropdown();
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
    return `<span class="pd-type-mini ${this.toID(type)}">${this.escapeHtml(type.slice(0, 2).toUpperCase())}</span>`;
  }

  getTypesHtml(types) {
    return (types || []).map((type) => `<span class="pd-type-icon-wrap">${this.getTypeIconHtml(type)}</span>`).join('');
  }

  getAbilitiesHtml(abilities) {
    const vals = Object.values(abilities || {}).filter(Boolean);
    return vals.length ? vals.map((value) => this.escapeHtml(value)).join('<br>') : '&mdash;';
  }

  renderTeamInfo() {
    if (!this.gridEl) return;
    const myTeam = this.state.myTeam || [];
    const oppTeam = this.state.oppTeam || [];
    this.gridEl.innerHTML = `
      <section class="pd-team-section my">
        <div class="pd-team-section-title">My Team</div>
        <div class="pd-team-columns">${myTeam.length ? myTeam.map((entry) => this.renderColumn(entry, 'my')).join('') : this.renderEmptyTeamRow('my')}</div>
      </section>
      <section class="pd-team-section opp">
        <div class="pd-team-section-title">Opponent Team</div>
        <div class="pd-team-columns">${oppTeam.length ? oppTeam.map((entry) => this.renderColumn(entry, 'opp')).join('') : this.renderEmptyTeamRow('opp')}</div>
      </section>
    `;

    for (const btn of this.gridEl.querySelectorAll('.pd-remove-mon')) {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        const team = btn.getAttribute('data-team');
        const index = Number(btn.getAttribute('data-index'));
        const list = team === 'opp' ? this.state.oppTeam : this.state.myTeam;
        list.splice(index, 1);
        this.saveState();
        this.renderAll();
      });
    }
  }

  renderEmptyTeamRow(side) {
    return Array.from({ length: 6 }, () => this.renderColumn(null, side)).join('');
  }

  renderColumn(entry, side) {
    if (!entry) {
      return `
        <div class="pd-col ${side} empty">
          <div class="pd-pokemon-cell empty"><span class="pd-empty-slot"></span></div>
          <div class="pd-row-cell">&mdash;</div>
          <div class="pd-row-cell">&mdash;</div>
        </div>
      `;
    }

    const species = this.getSpecies(entry.species || entry.name) || entry;
    const abilities = entry.abilities || species.abilities || {};
    const types = entry.types || species.types || [];
    const list = side === 'opp' ? this.state.oppTeam : this.state.myTeam;
    const index = list.indexOf(entry);

    return `
      <div class="pd-col ${side}">
        <div class="pd-pokemon-cell">
          <button class="button pd-remove-mon" type="button" data-team="${side}" data-index="${index}">×</button>
          <span class="pd-sprite pd-large" style="${this.getPokemonIconStyle(species)}"></span>
          <div class="pd-pokemon-name">${this.escapeHtml(species.name || entry.name)}</div>
        </div>
        <div class="pd-row-cell pd-types-row">${this.getTypesHtml(types) || '&mdash;'}</div>
        <div class="pd-row-cell pd-mono">${this.getAbilitiesHtml(abilities)}</div>
      </div>
    `;
  }

  renderMoveCategories() {
    if (!this.moveCatsEl) return;
    this.moveCatsEl.innerHTML = this.renderMoveCategoryBlock();
  }

  renderMoveCategoryBlock() {
    const sections = [
      ['Hazards', 'hazards'],
      ['Removal', 'removal'],
      ['Momentum', 'momentum'],
      ['Healing / Cleric', 'cleric'],
      ['Priority', 'priority'],
      ['Speed Control', 'speedcontrol'],
    ];

    return sections.map(([label, key]) => {
      const left = this.renderMoveCategorySide(this.state.myTeam, key, 'my');
      const right = this.renderMoveCategorySide(this.state.oppTeam, key, 'opp');
      return `
        <div class="pd-movecat-row">
          <div class="pd-movecat-side my">${left}</div>
          <div class="pd-movecat-label">${this.escapeHtml(label)}</div>
          <div class="pd-movecat-side opp">${right}</div>
        </div>
      `;
    }).join('');
  }

  renderMoveCategorySide(team, key, side) {
    const moveIds = new Set(MOVE_CATEGORIES[key]);
    const hits = [];
    for (const entry of team || []) {
      const movePool = (entry.validMoves?.length ? entry.validMoves : entry.moves) || [];
      const matchedMoves = movePool
        .filter((move) => moveIds.has(this.toID(move)))
        .sort((a, b) => a.localeCompare(b));
      if (!matchedMoves.length) continue;
      const species = this.getSpecies(entry.species || entry.name) || entry;
      hits.push(`
        <span class="pd-cat-chip ${side}" title="${this.escapeAttr(`${species.name}: ${matchedMoves.join(', ')}`)}">
          <span class="pd-sprite" style="${this.getPokemonIconStyle(species)}"></span>
          <span class="pd-cat-copy">
            <span class="pd-cat-name">${this.escapeHtml(species.name)}</span>
            <span class="pd-cat-moves">${matchedMoves.map((move) => this.escapeHtml(move)).join(', ')}</span>
          </span>
        </span>
      `);
    }
    return hits.length ? hits.join('') : '<span class="pd-cat-empty">&nbsp;</span>';
  }

  render() {
    return `
      <div id="prepdex-app">
        <div class="pd-card pd-toolbar">
          <div class="pd-brand-row">
            <div class="pd-title">PrepDex</div>
            <div class="pd-subtitle">Matchup Builder</div>
          </div>

          <div class="pd-toolbar-grid">
            <label class="pd-field">
              <span>Generation</span>
              <select id="pd-generation" class="button"></select>
            </label>

            <label class="pd-field pd-check">
              <span>NatDex</span>
              <input id="pd-natdex" type="checkbox">
            </label>

            <label class="pd-field">
              <span>Target</span>
              <select id="pd-target" class="button">
                <option value="my">My Team</option>
                <option value="opp">Opponent Team</option>
              </select>
            </label>

            <label class="pd-field">
              <span>Search Pokémon</span>
              <div class="pd-search-row">
                <input id="pd-search" class="textbox" type="text" autocomplete="off" placeholder="Start typing a Pokémon name">
                <button id="pd-add-first" class="button" type="button">Add</button>
              </div>
            </label>
          </div>

          <div class="pd-suggestions-wrap">
            <div id="pd-suggestions" class="pd-suggestions"></div>
          </div>

          <div class="pd-saved-row">
            <div class="pd-actions">
              <select id="pd-saved-teams" class="button"></select>
              <select id="pd-saved-target" class="button">
                <option value="my">Load to My Team</option>
                <option value="opp">Load to Opponent Team</option>
              </select>
              <button id="pd-load-team" class="button" type="button">Load Saved Team</button>
            </div>
            <div class="pd-actions">
              <select id="pd-saved-matchups" class="button"></select>
              <button id="pd-load-matchup" class="button" type="button">Load</button>
              <button id="pd-save-matchup" class="button" type="button">Save</button>
              <button id="pd-delete-matchup" class="button" type="button">Delete</button>
            </div>
          </div>
        </div>

        <div class="pd-import-grid">
          <div class="pd-card pd-import-box">
            <div class="pd-section-title">My Team Import</div>
            <textarea id="pd-paste-my" class="textbox" placeholder="Paste Showdown export or Poképaste text here..."></textarea>
            <div class="pd-inline-actions">
              <button id="pd-import-my" class="button" type="button">Import My Team</button>
              <button id="pd-clear-my" class="button" type="button">Clear My Team</button>
            </div>
          </div>

          <div class="pd-card pd-import-box">
            <div class="pd-section-title">Opponent Team Import</div>
            <textarea id="pd-paste-opp" class="textbox" placeholder="Paste opponent export, Poképaste, or type a team list here..."></textarea>
            <div class="pd-inline-actions">
              <button id="pd-import-opp" class="button" type="button">Import Opponent</button>
              <button id="pd-clear-opp" class="button" type="button">Clear Opponent</button>
            </div>
          </div>
        </div>

        <div id="pd-panels" class="pd-panels"></div>
      </div>
    `;
  }

  injectCSS() {
    if (document.getElementById('prepdex-room-style')) return;
    const style = document.createElement('style');
    style.id = 'prepdex-room-style';
    style.textContent = `
      #prepdex-app { padding: 10px; color: inherit; font: 12px/1.35 Verdana, Arial, sans-serif; }
      #prepdex-app * { box-sizing: border-box; }
      #prepdex-app .pd-card {
        margin-bottom: 10px; border: 1px solid var(--pd-border, rgba(0,0,0,.18));
        border-radius: 6px; background: var(--pd-bg, rgba(255,255,255,.72));
        box-shadow: inset 0 1px 0 rgba(255,255,255,.35);
      }
      body.dark #prepdex-app .pd-card, .dark #prepdex-app .pd-card {
        --pd-bg: rgba(38,24,43,.82); --pd-border: rgba(255,208,231,.12); box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
      }
      #prepdex-app .pd-toolbar { padding: 12px; }
      #prepdex-app .pd-brand-row { display:flex; align-items:baseline; gap:10px; margin-bottom: 10px; }
      #prepdex-app .pd-title { font-size: 23px; font-weight:700; font-style:italic; color:#9f4a80; }
      body.dark #prepdex-app .pd-title, .dark #prepdex-app .pd-title { color:#ff9fd2; }
      #prepdex-app .pd-subtitle { opacity:.72; text-transform:uppercase; letter-spacing:.08em; }
      #prepdex-app .pd-toolbar-grid { display:grid; grid-template-columns: minmax(110px, 150px) minmax(90px, 110px) minmax(160px, 220px) minmax(0, 1fr); gap:10px; align-items:end; }
      #prepdex-app .pd-field { display:flex; flex-direction:column; gap:4px; }
      #prepdex-app .pd-field > span, #prepdex-app .pd-section-title { font-weight:700; font-style:italic; }
      #prepdex-app .pd-check { flex-direction:row; align-items:center; gap:8px; padding-top:22px; }
      #prepdex-app input.textbox, #prepdex-app textarea.textbox { width:100%; }
      #prepdex-app .pd-search-row { display:grid; grid-template-columns: minmax(0, 1fr) 72px; gap:8px; }
      #prepdex-app .pd-suggestions { margin-top:8px; display:grid; gap:6px; max-height:246px; overflow:auto; }
      #prepdex-app .pd-suggestion { width:100%; display:grid; grid-template-columns:40px 1fr auto; gap:10px; align-items:center; text-align:left; padding:6px 10px; }
      #prepdex-app .pd-suggestion-main { display:flex; flex-direction:column; min-width:0; }
      #prepdex-app .pd-suggestion-name { font-weight:700; }
      #prepdex-app .pd-suggestion-meta { opacity:.72; font-size:11px; }
      #prepdex-app .pd-suggestion-plus { font-weight:700; opacity:.8; }
      #prepdex-app .pd-empty { opacity:.75; font-style:italic; padding:6px 2px; }
      #prepdex-app .pd-saved-row, #prepdex-app .pd-import-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px; }
      #prepdex-app .pd-actions, #prepdex-app .pd-inline-actions { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
      #prepdex-app .pd-actions select { min-width: 210px; }
      #prepdex-app textarea.textbox { min-height:110px; resize:vertical; margin:8px 0 10px; }
      #prepdex-app .pd-import-box { padding:10px; }
      #prepdex-app .pd-panels { display:grid; gap:10px; }
      #prepdex-app .pd-panel-card { padding:10px; }
      #prepdex-app .pd-panel-card[draggable="true"] { cursor:grab; }
      #prepdex-app .pd-panel-card.is-drop-target { outline:2px dashed rgba(47,93,143,.65); outline-offset:2px; }
      #prepdex-app .pd-panel-card.is-collapsed .pd-panel-body { display:none; }
      #prepdex-app .pd-panel-head { display:grid; grid-template-columns:auto 1fr auto; gap:8px; align-items:center; margin-bottom:10px; }
      #prepdex-app .pd-panel-card.is-collapsed .pd-panel-head { margin-bottom:0; }
      #prepdex-app .pd-panel-toggle { min-width:74px; }
      #prepdex-app .pd-panel-title {
        display:flex; align-items:center; justify-content:center; min-height:30px;
        padding:4px 14px; border:1px solid rgba(0,0,0,.24); background:#6f3c64; color:#fff;
        font-style:italic; font-weight:700; text-transform:uppercase; letter-spacing:.03em;
      }
      #prepdex-app .pd-panel-grip { padding:0 8px; font-weight:700; letter-spacing:.2em; opacity:.72; user-select:none; color:#ffc3e2; }
      body.dark #prepdex-app .pd-panel-title, .dark #prepdex-app .pd-panel-title { border-color: rgba(255,208,231,.18); background:linear-gradient(135deg, #6e3a63 0%, #4b294e 100%); }
      #prepdex-app .pd-overview-actions { display:flex; justify-content:flex-end; gap:8px; margin-bottom:8px; }
      #prepdex-app .pd-overview-shell { display:grid; grid-template-columns:1fr 108px 1fr; gap:0; border:1px solid rgba(0,0,0,.16); overflow:hidden; }
      #prepdex-app .pd-overview-side { min-width:0; padding:0; background:rgba(70,70,70,.18); }
      #prepdex-app .pd-overview-side.my { background:linear-gradient(180deg, rgba(115,171,245,.22), rgba(61,112,179,.18)); }
      #prepdex-app .pd-overview-side.opp { background:linear-gradient(180deg, rgba(245,120,120,.22), rgba(171,64,64,.18)); }
      #prepdex-app .pd-overview-head { display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-bottom:1px solid rgba(0,0,0,.16); }
      #prepdex-app .pd-overview-title { font-size:15px; font-style:italic; font-weight:700; text-transform:uppercase; letter-spacing:.06em; }
      #prepdex-app .pd-overview-count { min-width:24px; height:24px; border-radius:999px; display:grid; place-items:center; font-size:11px; font-weight:700; background:rgba(255,255,255,.22); }
      #prepdex-app .pd-overview-grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px 10px; padding:14px 12px 16px; min-height:188px; }
      #prepdex-app .pd-overview-mon { position:relative; display:flex; align-items:center; justify-content:center; min-height:42px; border-radius:12px; background:rgba(255,255,255,.08); overflow:hidden; }
      #prepdex-app .pd-overview-mon.is-tera { background: linear-gradient(135deg, rgba(255,102,196,.42), rgba(120,214,255,.42), rgba(247,229,101,.44)); box-shadow: inset 0 0 0 1px rgba(255,255,255,.18); }
      #prepdex-app .pd-overview-mon.is-z { background: rgba(131,89,221,.42); box-shadow: inset 0 0 0 1px rgba(255,255,255,.14); }
      #prepdex-app .pd-overview-captainbar { position:absolute; top:4px; right:4px; display:flex; gap:4px; z-index:2; }
      #prepdex-app .pd-captain-btn { min-width:20px; width:20px; height:20px; padding:0; border-radius:999px; display:grid; place-items:center; background:rgba(18,22,31,.6); border:1px solid rgba(255,255,255,.12); }
      #prepdex-app .pd-captain-btn.is-active.tera { background:rgba(255,255,255,.18); border-color:rgba(255,255,255,.36); }
      #prepdex-app .pd-captain-btn.is-active.z { background:rgba(113,76,204,.72); border-color:rgba(222,206,255,.45); color:#fff; }
      #prepdex-app .pd-tera-fallback { font-size:10px; font-weight:700; color:#fff; }
      #prepdex-app .pd-tera-fallback.compact { font-size:9px; }
      #prepdex-app .pd-overview-sprite { transform:scale(1.45); }
      #prepdex-app .pd-overview-mid { background:linear-gradient(180deg, #6f3b69 0%, #402241 100%); color:#fff; border-left:1px solid rgba(0,0,0,.18); border-right:1px solid rgba(0,0,0,.18); }
      #prepdex-app .pd-overview-mid-title { padding:8px 0; text-align:center; text-transform:uppercase; font-style:italic; font-weight:700; letter-spacing:.08em; border-bottom:1px solid rgba(255,255,255,.12); }
      #prepdex-app .pd-overview-speed-row { display:grid; grid-template-columns:28px 1fr 1fr 28px; align-items:center; min-height:28px; padding:0 2px; border-bottom:1px solid rgba(255,255,255,.08); }
      #prepdex-app .pd-overview-mini { width:28px; height:18px; display:flex; align-items:center; justify-content:center; overflow:hidden; }
      #prepdex-app .pd-overview-mini .pd-sprite { transform:translateX(-1px) scale(.8); transform-origin:top left; }
      #prepdex-app .pd-overview-speed { text-align:center; font-size:10px; font-weight:700; }
      #prepdex-app .pd-overview-speed.my { color:#ffd4ec; }
      #prepdex-app .pd-overview-speed.opp { color:#ffc0d9; }
      #prepdex-app .pd-team-shell { overflow-x:auto; }
      #prepdex-app .pd-team-grid { display:grid; gap:10px; }
      #prepdex-app .pd-team-section { display:grid; gap:6px; }
      #prepdex-app .pd-team-section-title { padding:5px 10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; font-style:italic; color:#fff; }
      #prepdex-app .pd-team-section.my .pd-team-section-title { background:#7a3d6b; }
      #prepdex-app .pd-team-section.opp .pd-team-section-title { background:#94415d; }
      #prepdex-app .pd-team-columns { display:grid; grid-template-columns:repeat(auto-fit, minmax(98px, 1fr)); gap:6px; }
      #prepdex-app .pd-col { display:grid; grid-template-rows: 88px 24px 36px; min-width:0; }
      #prepdex-app .pd-col.my .pd-pokemon-cell, #prepdex-app .pd-col.my .pd-row-cell { background: rgba(228,151,200,.38); }
      #prepdex-app .pd-col.opp .pd-pokemon-cell, #prepdex-app .pd-col.opp .pd-row-cell { background: rgba(214,128,165,.42); }
      body.dark #prepdex-app .pd-col.my .pd-pokemon-cell, body.dark #prepdex-app .pd-col.my .pd-row-cell,
      .dark #prepdex-app .pd-col.my .pd-pokemon-cell, .dark #prepdex-app .pd-col.my .pd-row-cell { background: rgba(103,49,88,.82); }
      body.dark #prepdex-app .pd-col.opp .pd-pokemon-cell, body.dark #prepdex-app .pd-col.opp .pd-row-cell,
      .dark #prepdex-app .pd-col.opp .pd-pokemon-cell, .dark #prepdex-app .pd-col.opp .pd-row-cell { background: rgba(126,54,84,.82); }
      #prepdex-app .pd-pokemon-cell, #prepdex-app .pd-row-cell { border-right:1px solid rgba(0,0,0,.12); border-bottom:1px solid rgba(0,0,0,.12); }
      body.dark #prepdex-app .pd-pokemon-cell, body.dark #prepdex-app .pd-row-cell, .dark #prepdex-app .pd-pokemon-cell, .dark #prepdex-app .pd-row-cell { border-color: rgba(255,255,255,.08); }
      #prepdex-app .pd-pokemon-cell { position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; padding:6px 4px; }
      #prepdex-app .pd-pokemon-name { text-align:center; font-size:10px; font-weight:700; line-height:1.05; }
      #prepdex-app .pd-row-cell { display:flex; align-items:center; justify-content:center; gap:3px; text-align:center; padding:2px 3px; font-size:10px; }
      #prepdex-app .pd-mono { line-height:1.1; }
      #prepdex-app .pd-types-row { flex-wrap:wrap; }
      #prepdex-app .pd-type-icon-wrap { display:inline-flex; align-items:center; justify-content:center; min-width:24px; }
      #prepdex-app .pd-types-row img { display:block; height:12px; width:auto; }
      #prepdex-app .pd-remove-mon { position:absolute; top:2px; right:2px; min-width:18px; width:18px; height:18px; padding:0; line-height:16px; text-align:center; font-size:12px; }
      #prepdex-app .pd-sprite { display:inline-block; vertical-align:middle; }
      #prepdex-app .pd-large { transform: scale(1.2); }
      #prepdex-app .pd-empty-slot { width:42px; height:32px; }
      #prepdex-app .pd-move-cats { display:grid; gap:3px; }
      #prepdex-app .pd-movecat-row { display:grid; grid-template-columns: 1fr 118px 1fr; align-items:stretch; }
      #prepdex-app .pd-movecat-side { min-height:22px; padding:2px 4px; border:1px solid rgba(0,0,0,.12); display:flex; flex-wrap:wrap; gap:4px; align-items:center; }
      #prepdex-app .pd-movecat-side.my { background: rgba(122,170,228,.35); }
      #prepdex-app .pd-movecat-side.opp { background: rgba(229,144,144,.42); }
      body.dark #prepdex-app .pd-movecat-side.my, .dark #prepdex-app .pd-movecat-side.my { background: rgba(44,73,117,.65); }
      body.dark #prepdex-app .pd-movecat-side.opp, .dark #prepdex-app .pd-movecat-side.opp { background: rgba(111,49,49,.72); }
      #prepdex-app .pd-movecat-label { display:flex; align-items:center; justify-content:center; padding:2px 6px; font-weight:700; font-style:italic; text-transform:uppercase; background:#6b3d64; color:#fff; border:1px solid rgba(0,0,0,.18); font-size:10px; }
      #prepdex-app .pd-cat-chip { display:inline-flex; align-items:center; gap:3px; padding:2px 5px 2px 3px; border-radius:12px; background:rgba(255,255,255,.23); max-width:100%; }
      body.dark #prepdex-app .pd-cat-chip, .dark #prepdex-app .pd-cat-chip { background:rgba(255,255,255,.08); }
      #prepdex-app .pd-cat-copy { display:flex; flex-direction:column; min-width:0; }
      #prepdex-app .pd-cat-name { font-size:10px; font-weight:700; line-height:1; }
      #prepdex-app .pd-cat-moves { font-size:9px; line-height:1.05; opacity:.82; white-space:normal; overflow-wrap:anywhere; }
      #prepdex-app .pd-cat-empty { display:inline-block; min-height:18px; opacity:.45; }
      #prepdex-app .pd-speed-controls { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px; }
      #prepdex-app .pd-inline-field { display:flex; align-items:center; gap:6px; }
      #prepdex-app .pd-inline-field > span { font-weight:700; font-style:italic; }
      #prepdex-app .pd-speed-input { width:58px; }
      #prepdex-app .pd-speed-select { min-width:84px; }
      #prepdex-app .pd-speed-pair { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
      #prepdex-app .pd-speed-side { border:1px solid rgba(0,0,0,.16); }
      #prepdex-app .pd-speed-side.my { background:rgba(122,170,228,.2); }
      #prepdex-app .pd-speed-side.opp { background:rgba(229,144,144,.22); }
      body.dark #prepdex-app .pd-speed-side.my, .dark #prepdex-app .pd-speed-side.my { background:rgba(44,73,117,.38); }
      body.dark #prepdex-app .pd-speed-side.opp, .dark #prepdex-app .pd-speed-side.opp { background:rgba(111,49,49,.4); }
      #prepdex-app .pd-speed-side-title { padding:4px 8px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; background:rgba(255,132,193,.18); color:#fff; font-size:10px; }
      #prepdex-app .pd-speed-table { display:grid; }
      #prepdex-app .pd-speed-table-head, #prepdex-app .pd-speed-row { display:grid; grid-template-columns:1fr 46px; gap:6px; align-items:center; padding:3px 6px; border-top:1px solid rgba(0,0,0,.12); }
      #prepdex-app .pd-speed-table-head { font-weight:700; font-style:italic; background:rgba(255,255,255,.18); font-size:10px; }
      #prepdex-app .pd-speed-mon { display:flex; align-items:center; gap:6px; min-width:0; }
      #prepdex-app .pd-speed-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      #prepdex-app .pd-speed-value { font-weight:700; text-align:right; }
      #prepdex-app .pd-typechart-wrap { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
      #prepdex-app .pd-typechart-side { min-width:0; }
      #prepdex-app .pd-typechart-title { margin-bottom:4px; font-weight:700; text-transform:uppercase; font-style:italic; font-size:10px; }
      #prepdex-app .pd-typechart-scroll { overflow:auto; border:1px solid rgba(0,0,0,.16); }
      #prepdex-app .pd-typechart-table { width:max-content; min-width:100%; border-collapse:collapse; font-size:9px; }
      #prepdex-app .pd-typechart-table th, #prepdex-app .pd-typechart-table td { min-width:24px; padding:2px 3px; text-align:center; border:1px solid rgba(0,0,0,.14); }
      #prepdex-app .pd-typechart-table th { background:#6b3d64; color:#fff; font-style:italic; font-size:9px; }
      #prepdex-app .pd-typechart-table .sticky { position:sticky; left:0; z-index:2; background:inherit; }
      #prepdex-app .pd-typechart-table .sticky.sprite { left:0; min-width:28px; background:#d9e6f6; }
      #prepdex-app .pd-typechart-table.opp .sticky.sprite { background:#f3d6d6; }
      body.dark #prepdex-app .pd-typechart-table .sticky.sprite,
      .dark #prepdex-app .pd-typechart-table .sticky.sprite { background:#273042; }
      body.dark #prepdex-app .pd-typechart-table.opp .sticky.sprite,
      .dark #prepdex-app .pd-typechart-table.opp .sticky.sprite { background:#3b2529; }
      #prepdex-app .pd-typechart-table td.weak { background:rgba(208,60,60,.55); font-weight:700; }
      #prepdex-app .pd-typechart-table td.resist { background:rgba(129,185,88,.55); font-weight:700; }
      #prepdex-app .pd-typechart-table td.immune { background:rgba(25,25,25,.86); color:#ffd36c; font-weight:700; }
      #prepdex-app .pd-typechart-table td.neutral { background:rgba(0,0,0,.08); }
      #prepdex-app .pd-typechart-table th img { display:block; margin:0 auto; height:12px; }
      #prepdex-app .pd-type-mini { display:inline-flex; align-items:center; justify-content:center; min-width:20px; height:12px; border-radius:999px; padding:0 3px; font-size:8px; color:#fff; }
      #prepdex-app .pd-type-mini.normal { background:#a8a77a; } #prepdex-app .pd-type-mini.fire { background:#ee8130; }
      #prepdex-app .pd-type-mini.water { background:#6390f0; } #prepdex-app .pd-type-mini.electric { background:#f7d02c; color:#222; }
      #prepdex-app .pd-type-mini.grass { background:#7ac74c; } #prepdex-app .pd-type-mini.ice { background:#96d9d6; color:#222; }
      #prepdex-app .pd-type-mini.fighting { background:#c22e28; } #prepdex-app .pd-type-mini.poison { background:#a33ea1; }
      #prepdex-app .pd-type-mini.ground { background:#e2bf65; color:#222; } #prepdex-app .pd-type-mini.flying { background:#a98ff3; }
      #prepdex-app .pd-type-mini.psychic { background:#f95587; } #prepdex-app .pd-type-mini.bug { background:#a6b91a; }
      #prepdex-app .pd-type-mini.rock { background:#b6a136; } #prepdex-app .pd-type-mini.ghost { background:#735797; }
      #prepdex-app .pd-type-mini.dragon { background:#6f35fc; } #prepdex-app .pd-type-mini.dark { background:#705746; }
      #prepdex-app .pd-type-mini.steel { background:#b7b7ce; color:#222; } #prepdex-app .pd-type-mini.fairy { background:#d685ad; }
      @media (max-width: 1020px) {
        #prepdex-app .pd-toolbar-grid, #prepdex-app .pd-saved-row, #prepdex-app .pd-import-grid, #prepdex-app .pd-overview-shell { grid-template-columns:1fr; }
        #prepdex-app .pd-search-row { grid-template-columns:1fr; }
        #prepdex-app .pd-movecat-row { grid-template-columns:1fr; gap:4px; }
        #prepdex-app .pd-speed-pair, #prepdex-app .pd-typechart-wrap { grid-template-columns:1fr; }
        #prepdex-app .pd-panel-head { grid-template-columns:1fr; }
        #prepdex-app .pd-overview-grid { grid-template-columns:repeat(4, minmax(0, 1fr)); min-height:0; }
      }
    `;
    document.head.appendChild(style);
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
}
