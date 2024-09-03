import SimpleTeambuilder from './simpleTeambuilder.js';

function createHtmlRoom(id, title, options = {}) {
    if (typeof app?._addRoom !== 'function') {
        console.error('Cannot create a room because app._addRoom() is not available.');
        return null;
    }

    const { side, icon, focus, minWidth = 320, maxWidth = 1024 } = options;

    let room;
    if (id in app.rooms) {
        room = app.rooms[id];
    } else {
        room = app._addRoom(id, 'html', true, title);
        room.$el.html('');  // Clear any existing content

        if (side) {
            room.isSideRoom = true;
            app.sideRoomList.push(app.roomList.pop());
        }
    }

    if (!room?.el) {
        console.error('Failed to create or find the room.');
        return null;
    }

    room.minWidth = minWidth;
    room.maxWidth = maxWidth;

    if (icon) {
        const originalRenderer = app.topbar.renderRoomTab.bind(app.topbar);
        app.topbar.renderRoomTab = function (appRoom, appRoomId) {
            const roomId = appRoom?.id || appRoomId;
            const buf = originalRenderer(appRoom, appRoomId);
            if (roomId === id) {
                return buf.replace('fa-file-text-o', `fa-${icon}`);
            }
            return buf;
        };
    }

    if (focus) {
        app[side ? 'focusRoomRight' : 'focusRoom'](room.id);
    }

    app.topbar.updateTabbar();

    return room;
}

function createTeambuilderAssistant() {
    const room = createHtmlRoom('custom-room', 'Custom Teambuilder Assistant', {
        side: true,
        icon: 'cogs',
        focus: true,
    });

    if (!room) return;

    const teambuilder = new SimpleTeambuilder(room);
}

createTeambuilderAssistant();