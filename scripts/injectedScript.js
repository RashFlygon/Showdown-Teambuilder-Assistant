import SimpleTeambuilder from '../js/simpleTeambuilder.js';
import DraftPlanner from '../js/draftPlanner.js';

const PREPDEX_OPEN_EVENT = 'prepdex:open';
const PREPDEX_CLEAR_EVENT = 'prepdex:clear';
const PREPDEX_PLANNER_CLEAR_EVENT = 'prepdex:planner-clear';
const HOME_BUTTON_ID = 'prepdex-home-button';
const HOME_ROOM_ID = 'prepdex-home';
const BUILDER_ROOM_ID = 'prepdex-room';
const PLANNER_ROOM_ID = 'prepdex-planner-room';
const ROOM_STATE_KEY = 'prepdex-room-state-v6';
const PLANNER_STATE_KEY = 'prepdex-draft-planner-v1';
const MUSHARNA_SPRITE_URL = new URL('../icons/spr_bw_518_scaled_2x_pngcrushed.png', import.meta.url).href;
const FLYGON_SPRITE_URL = 'https://play.pokemonshowdown.com/sprites/gen5/flygon.png';

function createHtmlRoom(id, title, options = {}) {
  if (typeof window.app?._addRoom !== 'function') {
    console.error('PrepDex: app._addRoom() is not available.');
    return null;
  }

  const { side = true, icon = 'cogs', focus = true, minWidth = 320, maxWidth = 1400 } = options;
  let room;

  if (id in app.rooms) {
    room = app.rooms[id];
    if (focus) {
      setTimeout(() => {
        if (side && typeof app.focusRoomRight === 'function') app.focusRoomRight(room.id);
        else if (typeof app.focusRoom === 'function') app.focusRoom(room.id);
      }, 100);
    }
    return room;
  }

  room = app._addRoom(id, 'html', true, title);
  if (!room?.el || !room?.$el) {
    console.error('PrepDex: room was not created correctly.');
    return null;
  }

  room.$el.html('');
  room.minWidth = minWidth;
  room.maxWidth = maxWidth;

  if (side) {
    room.isSideRoom = true;
    if (Array.isArray(app.sideRoomList) && Array.isArray(app.roomList) && app.roomList.length) {
      app.sideRoomList.push(app.roomList.pop());
    }
  }

  if (icon && app.topbar?.renderRoomTab) {
    if (!app.topbar.__prepdexWrapped) {
      const originalRenderer = app.topbar.renderRoomTab.bind(app.topbar);
      app.topbar.__prepdexIcons = {};
      app.topbar.renderRoomTab = function (appRoom, appRoomId) {
        const roomId = appRoom?.id || appRoomId;
        let buf = originalRenderer(appRoom, appRoomId);
        const roomIcon = app.topbar.__prepdexIcons?.[roomId];
        if (roomIcon && typeof buf === 'string') {
          buf = buf.replace('fa-file-text-o', `fa-${roomIcon}`);
        }
        return buf;
      };
      app.topbar.__prepdexWrapped = true;
    }
    app.topbar.__prepdexIcons[id] = icon;
  }

  if (typeof app.topbar?.updateTabbar === 'function') app.topbar.updateTabbar();

  if (focus) {
    setTimeout(() => {
      if (side && typeof app.focusRoomRight === 'function') app.focusRoomRight(room.id);
      else if (typeof app.focusRoom === 'function') app.focusRoom(room.id);
    }, 120);
  }

  return room;
}

function mountPrepDexRoom() {
  const room = createHtmlRoom(BUILDER_ROOM_ID, 'PrepDex Builder', {
    side: true,
    icon: 'cogs',
    focus: true,
  });

  if (!room) return false;
  if (room.$el.find('#prepdex-app').length) return true;

  new SimpleTeambuilder(room);
  return true;
}

function mountPlannerRoom() {
  const room = createHtmlRoom(PLANNER_ROOM_ID, 'PrepDex Planner', {
    side: true,
    icon: 'map-o',
    focus: true,
    minWidth: 760,
    maxWidth: 1600,
  });

  if (!room) return false;
  if (room.$el.find('#pdp-app').length) return true;

  new DraftPlanner(room);
  return true;
}

function renderHomeRoom() {
  return `
    <div id="prepdex-home-app">
      <section class="prepdex-home-shell">
        <div class="prepdex-home-hero">
          <div class="prepdex-home-copy">
            <div class="prepdex-home-kicker">PrepDex</div>
            <h1 class="prepdex-home-title">Dream Team Prep</h1>
            <p class="prepdex-home-text">
              Prepare Team Plans and Build matchups.
            </p>
            <div class="prepdex-home-actions">
              <button class="button prepdex-home-cta" type="button" data-prepdex-open-builder="true">Open Match Builder</button>
              <button class="button prepdex-home-cta" type="button" data-prepdex-open-planner="true">Open Planner Room</button>
            </div>
            <div class="prepdex-home-clearbox">
              <div class="prepdex-home-clear-title">Data Tools</div>
              <div class="prepdex-home-actions prepdex-home-actions-secondary">
                <button class="button prepdex-home-ghost" type="button" data-prepdex-clear-teams="true">Clear Saved Teams</button>
                <button class="button prepdex-home-ghost" type="button" data-prepdex-clear-planner="true">Clear Saved Data</button>
              </div>
            </div>
          </div>
          <div class="prepdex-home-mascot-card">
            <div class="prepdex-home-mascot-glow"></div>
            <img class="prepdex-home-mascot" src="${MUSHARNA_SPRITE_URL}" alt="Musharna mascot">
          </div>
        </div>
        <div class="prepdex-home-footer">
          <a
            class="prepdex-home-credit"
            href="https://www.smogon.com/forums/members/chrome_.397565/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img class="prepdex-home-credit-sprite" src="${FLYGON_SPRITE_URL}" alt="Flygon sprite">
            <span>Created by Rasche</span>
          </a>
        </div>
      </section>
    </div>
  `;
}

function bindHomeRoom(room) {
  const root = room?.$el?.[0];
  if (!root) return;
  root.querySelector('[data-prepdex-open-builder="true"]')?.addEventListener('click', () => mountPrepDexRoom());
  root.querySelector('[data-prepdex-open-planner="true"]')?.addEventListener('click', () => mountPlannerRoom());
  root.querySelector('[data-prepdex-clear-teams="true"]')?.addEventListener('click', () => clearPrepDexState());
  root.querySelector('[data-prepdex-clear-planner="true"]')?.addEventListener('click', () => clearPlannerState());
}

function mountPrepDexHomeRoom() {
  const room = createHtmlRoom(HOME_ROOM_ID, 'PrepDex', {
    side: true,
    icon: 'moon-o',
    focus: true,
    minWidth: 560,
    maxWidth: 1400,
  });

  if (!room) return false;

  room.$el.html(renderHomeRoom());
  bindHomeRoom(room);
  return true;
}

function clearPrepDexState() {
  localStorage.removeItem(ROOM_STATE_KEY);
  const room = app?.rooms?.[BUILDER_ROOM_ID];
  if (room?.$el) {
    room.$el.html('');
    new SimpleTeambuilder(room);
  }
}

function clearPlannerState() {
  localStorage.removeItem(PLANNER_STATE_KEY);
  const room = app?.rooms?.[PLANNER_ROOM_ID];
  if (room?.$el) {
    room.$el.html('');
    new DraftPlanner(room);
  }
}

function injectHomeButtonStyle() {
  if (document.getElementById('prepdex-home-style')) return;
  const style = document.createElement('style');
  style.id = 'prepdex-home-style';
  style.textContent = `
    #${HOME_BUTTON_ID} {
      cursor: pointer;
      border-color: rgba(99, 68, 154, .95) !important;
      background: linear-gradient(180deg, #9b7be0 0%, #6f4bbb 100%) !important;
      color: #fff !important;
      text-shadow: 0 1px 0 rgba(0, 0, 0, .4);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.3), 0 1px 2px rgba(0,0,0,.2);
    }
    #${HOME_BUTTON_ID}:hover { filter: brightness(1.05); }
    #prepdex-home-app {
      min-height: 100%;
      padding: 22px;
      color: #fbe9fb;
      background:
        radial-gradient(circle at 16% 18%, rgba(255, 170, 214, 0.22), transparent 26%),
        radial-gradient(circle at 82% 20%, rgba(255, 126, 196, 0.18), transparent 24%),
        radial-gradient(circle at 50% 100%, rgba(221, 112, 255, 0.18), transparent 34%),
        linear-gradient(180deg, #120914 0%, #1a0d1f 48%, #120914 100%);
      font: 14px/1.5 "Trebuchet MS", "Segoe UI", sans-serif;
    }
    #prepdex-home-app * { box-sizing: border-box; }
    #prepdex-home-app .prepdex-home-shell {
      max-width: 1120px;
      margin: 0 auto;
      padding: 26px;
      border: 1px solid rgba(255, 210, 236, 0.16);
      border-radius: 28px;
      background: rgba(33, 18, 37, 0.78);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(12px);
    }
    #prepdex-home-app .prepdex-home-hero {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(220px, 320px);
      gap: 24px;
      align-items: center;
    }
    #prepdex-home-app .prepdex-home-kicker {
      display: inline-flex;
      align-items: center;
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(255, 192, 226, 0.12);
      border: 1px solid rgba(255, 205, 232, 0.18);
      color: #ffc5e5;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    #prepdex-home-app .prepdex-home-title {
      margin: 16px 0 10px;
      font-size: 36px;
      line-height: 1.05;
      letter-spacing: -0.03em;
      color: #fff4fd;
    }
    #prepdex-home-app .prepdex-home-text {
      max-width: 56ch;
      margin: 0;
      color: rgba(252, 228, 247, 0.78);
      font-size: 15px;
    }
    #prepdex-home-app .prepdex-home-actions { margin-top: 20px; display:flex; flex-wrap:wrap; gap:8px; }
    #prepdex-home-app .prepdex-home-actions-secondary { margin-top: 0; }
    #prepdex-home-app .prepdex-home-clearbox {
      margin-top: 14px;
      padding: 14px;
      border-radius: 18px;
      border: 1px solid rgba(255, 209, 234, 0.12);
      background: rgba(255,255,255,.03);
      max-width: 360px;
    }
    #prepdex-home-app .prepdex-home-clear-title {
      margin-bottom: 10px;
      color: rgba(255, 215, 239, 0.82);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    #prepdex-home-app .prepdex-home-cta {
      min-width: 190px;
      padding: 11px 18px;
      border-radius: 999px;
      border: 1px solid rgba(255, 208, 232, 0.28);
      background: linear-gradient(135deg, #ff9dcf 0%, #ff73ba 48%, #d869ff 100%);
      color: #29091f;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 14px 28px rgba(255, 115, 186, 0.26), inset 0 1px 0 rgba(255,255,255,.35);
    }
    #prepdex-home-app .prepdex-home-cta:hover { filter: brightness(1.04); }
    #prepdex-home-app .prepdex-home-ghost {
      min-width: 170px;
      padding: 11px 18px;
      border-radius: 999px;
      border: 1px solid rgba(255, 208, 232, 0.18);
      background: rgba(255, 255, 255, 0.05);
      color: #fff2fc;
      font-size: 13px;
      font-weight: 700;
    }
    #prepdex-home-app .prepdex-home-secondary:hover,
    #prepdex-home-app .prepdex-home-ghost:hover { background: rgba(255,255,255,.08); }
    #prepdex-home-app .prepdex-home-mascot-card {
      position: relative;
      min-height: 270px;
      display: grid;
      place-items: center;
      padding: 20px;
      border-radius: 24px;
      border: 1px solid rgba(255, 209, 234, 0.14);
      background: linear-gradient(180deg, rgba(255, 196, 224, 0.08) 0%, rgba(255, 155, 213, 0.04) 100%);
      overflow: hidden;
    }
    #prepdex-home-app .prepdex-home-mascot-glow {
      position: absolute;
      inset: 24px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255, 171, 218, 0.38) 0%, rgba(255, 128, 194, 0.18) 42%, transparent 72%);
      filter: blur(10px);
    }
    #prepdex-home-app .prepdex-home-mascot {
      position: relative;
      width: 180px;
      max-width: 100%;
      image-rendering: pixelated;
      filter: drop-shadow(0 10px 24px rgba(255, 144, 201, 0.22));
    }
    #prepdex-home-app .prepdex-home-footer {
      margin-top: 20px;
      padding-top: 14px;
      border-top: 1px solid rgba(255, 209, 234, 0.1);
      display: flex;
      justify-content: flex-end;
    }
    #prepdex-home-app .prepdex-home-credit {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: rgba(255, 232, 247, 0.76);
      text-decoration: none;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.03em;
    }
    #prepdex-home-app .prepdex-home-credit:hover {
      color: #fff5fd;
    }
    #prepdex-home-app .prepdex-home-credit-sprite {
      width: 36px;
      height: 36px;
      image-rendering: pixelated;
      filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.28));
    }
    @media (max-width: 900px) {
      #prepdex-home-app .prepdex-home-hero { grid-template-columns: 1fr; }
      #prepdex-home-app { padding: 14px; }
      #prepdex-home-app .prepdex-home-shell { padding: 18px; border-radius: 22px; }
      #prepdex-home-app .prepdex-home-title { font-size: 30px; }
      #prepdex-home-app .prepdex-home-mascot-card { min-height: 220px; }
      #prepdex-home-app .prepdex-home-footer { justify-content: center; }
    }
  `;
  document.head.appendChild(style);
}

function addHomeButton() {
  if (document.getElementById(HOME_BUTTON_ID)) return;
  injectHomeButtonStyle();

  const menuButtons = Array.from(document.querySelectorAll('.mainmenu button'));
  const referenceButton = menuButtons.find((button) => /teambuilder/i.test(button.textContent || ''))
    || menuButtons.find((button) => /ladder/i.test(button.textContent || ''))
    || menuButtons[0];
  if (!referenceButton) return;

  const row = referenceButton.closest('p, div, li') || referenceButton.parentElement;
  if (!row?.parentElement) return;

  const clonedRow = row.cloneNode(true);
  const button = clonedRow.querySelector('button') || clonedRow;
  if (!(button instanceof HTMLButtonElement)) return;

  button.id = HOME_BUTTON_ID;
  button.type = 'button';
  button.disabled = false;
  button.removeAttribute('name');
  button.removeAttribute('value');
  button.textContent = 'PrepDex';
  button.addEventListener('click', () => mountPrepDexHomeRoom());

  row.parentElement.insertBefore(clonedRow, row);
}

function bootWhenReady() {
  if (window.__PREPDEX_BOOTING__) return;
  window.__PREPDEX_BOOTING__ = true;

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (window.app?._addRoom && window.Dex && window.jQuery) {
      clearInterval(timer);
      addHomeButton();
      mountPrepDexHomeRoom();
      const observer = new MutationObserver(() => addHomeButton());
      observer.observe(document.body, { childList: true, subtree: true });

      window.addEventListener(PREPDEX_OPEN_EVENT, () => mountPrepDexHomeRoom());
      window.addEventListener(PREPDEX_CLEAR_EVENT, () => clearPrepDexState());
      window.addEventListener(PREPDEX_PLANNER_CLEAR_EVENT, () => clearPlannerState());

      window.__PREPDEX_BOOTING__ = false;
      return;
    }
    if (attempts > 200) {
      clearInterval(timer);
      console.error('PrepDex: timed out waiting for Showdown client globals.');
      window.__PREPDEX_BOOTING__ = false;
    }
  }, 150);
}

bootWhenReady();
