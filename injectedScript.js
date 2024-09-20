import SimpleTeambuilder from './simpleTeambuilder.js';

function createHtmlRoom(id, title, options = {}) {
    if (typeof app?._addRoom !== 'function') {
        console.error('Cannot create a room because app._addRoom() is not available.');
        return null;
    }

    const { side, icon, focus, minWidth = 320, maxWidth = 1024 } = options;

    let room;
    if (id in app.rooms) {
        // Room already exists, focus on it instead of recreating
        room = app.rooms[id];
        if (focus) {
            setTimeout(() => {
                if (side) {
                    app.focusRoomRight(room.id); // Focus on side rooms
                } else {
                    app.focusRoom(room.id); // Focus on main rooms
                }
            }, 100); // Delay to ensure everything is loaded
        }
        return room;  // Return the existing room
    }

    // Otherwise, create a new room
    room = app._addRoom(id, 'html', true, title);
    room.$el.html('');  // Clear any existing content

    if (side) {
        room.isSideRoom = true;
        app.sideRoomList.push(app.roomList.pop());
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
        setTimeout(() => {
            if (side) {
                app.focusRoomRight(room.id); // Focus on side rooms
            } else {
                app.focusRoom(room.id); // Focus on main rooms
            }
        }, 100); // Delay to ensure everything is loaded
    }

    app.topbar.updateTabbar();

    return room;
}

function createTeambuilderAssistant() {
    const room = createHtmlRoom('custom-room', 'MatchUp Viewer', {
        side: true,
        icon: 'cogs',
        focus: true,  // Ensure it focuses after creation
    });

    // If the room already exists, just return to avoid resetting
    if (!room || room.$el.find('#panel-buttons').length > 0) return;

    const teambuilder = new SimpleTeambuilder(room);

    // Insert buttons for switching between fullscreen and windowed (dual panel) mode
    const panelButtonsHTML = `
        <div id="panel-buttons" style="position: absolute; right: 10px; top: 10px;">
            <button id="fullscreen-button" class="button">⛶ FullScreen</button>
            <button id="windowed-button" class="button" style="display:none;">◫ Windowed</button>
        </div>
    `;

    // Add these buttons to your room’s content
    room.$el.append(panelButtonsHTML);

    // Function to simulate clicking the custom room tab to ensure focus
    function simulateClickOnRoomTab() {
        const roomTab = app.topbar.$(`a[href="/${room.id}"]`); // Get the tab element for the room
        if (roomTab.length) {
            roomTab[0].click(); // Simulate the click event
        }
    }

    // Bind functionality for Fullscreen button
    document.getElementById('fullscreen-button').addEventListener('click', function() {
        app.singlePanelMode = true;  // Enable fullscreen mode
        app.updateLayout();  // Update the layout

        // Switch button visibility
        document.getElementById('fullscreen-button').style.display = 'none';
        document.getElementById('windowed-button').style.display = 'inline';

        // Ensure the custom room remains focused
        simulateClickOnRoomTab();
    });

    // Bind functionality for Windowed (Dual Panel) button
    document.getElementById('windowed-button').addEventListener('click', function() {
        app.singlePanelMode = false;  // Disable fullscreen mode (dual panel mode)
        app.updateLayout();  // Update the layout

        // Switch button visibility
        document.getElementById('windowed-button').style.display = 'none';
        document.getElementById('fullscreen-button').style.display = 'inline';
    });
}

function addTeambuilderAssistantButton() {
    // Ensure the main menu is loaded
    const mainMenu = document.querySelector('.mainmenu');
    if (!mainMenu) {
        console.error('Main menu not found.');
        return;
    }

    // Find the Teambuilder button as a reference
    const teambuilderButton = mainMenu.querySelector('button[name="joinRoom"][value="teambuilder"]');
    if (!teambuilderButton) {
        console.error('Teambuilder button not found.');
        return;
    }

    // Create the new "Teambuilder Assistant" button
    const assistantButton = document.createElement('button');
    assistantButton.className = 'button mainmenu6';
    assistantButton.name = 'openTeambuilderAssistant';
    assistantButton.innerText = 'Teambuilder Assistant';

    // Apply some margin for consistent spacing between the buttons
    assistantButton.style.marginTop = '10px';  // Adjust the value if needed

    // Append the button under the Teambuilder button
    teambuilderButton.insertAdjacentElement('afterend', assistantButton);

    // Bind the action to open the Teambuilder Assistant room
    assistantButton.addEventListener('click', function () {
        // Assuming createTeambuilderAssistant is a global function that creates the room
        if (typeof createTeambuilderAssistant === 'function') {
            createTeambuilderAssistant();
        } else {
            console.error('createTeambuilderAssistant function not found.');
        }
    });
}

// Use setInterval to check when the DOM has fully loaded
const intervalId = setInterval(() => {
    const mainMenu = document.querySelector('.mainmenu');

    if (mainMenu) {
        // Stop checking once the main menu is found
        clearInterval(intervalId);
        // Call the function to add the Teambuilder Assistant button
        addTeambuilderAssistantButton();
    }
}, 100);  // Check every 100ms

createTeambuilderAssistant();
