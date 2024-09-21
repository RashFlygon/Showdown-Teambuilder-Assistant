import PokemonManager from 'js/pokemonManager.js';
import SpeedTierManager from 'js/SpeedTierManager.js';
import PokemonMoveCategories from 'js/pokemonMoveCategories.js';


export default class SimpleTeambuilder {
    constructor(room) {
        this.room = room;
        this.speedTierManager = new SpeedTierManager(room);
        this.pokemonManager = new PokemonManager(room, this.speedTierManager);
        this.moveCategoryManager = new PokemonMoveCategories(room, this.pokemonManager); // Pass the instance
        this.types = this.initializeTypes();
        this.typeChart = this.initializeTypeChart();
        this.initialize();
    }

    initializeTypes() {
        return [
            'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
            'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic',
            'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'
        ];
    }

    initializeTypeChart() {
        let typeChart = {};
        this.types.forEach(typeName => {
            const typeData = Dex.types.get(typeName);
            typeChart[typeName] = {};
            this.types.forEach(targetType => {
                typeChart[typeName][targetType] = 1;
                if (typeData && typeData.damageTaken && targetType in typeData.damageTaken) {
                    const damageTaken = typeData.damageTaken[targetType];
                    if (damageTaken === 1) typeChart[typeName][targetType] = 2; // Super effective
                    else if (damageTaken === 2) typeChart[typeName][targetType] = 0.5; // Not very effective
                    else if (damageTaken === 3) typeChart[typeName][targetType] = 0; // No effect (immune)
                }
            });
        });
        return typeChart;
    }

    initialize() {
        if (typeof loadStorage === 'function') loadStorage(); // Load teams from storage
        this.room.$el.html(this.render());  // Render the initial UI
        this.bindEvents();  // Bind necessary events
        this.injectCSS(); // Inject CSS for styling
        this.populateTeamDropdown(); // Populate the dropdown with user's teams
    }

	render() {
		return `
			<div class="simple-teambuilder">
				<h2>Matchup Viewer</h2>
            <div>
                <label for="teamSelect">Choose a Team:</label>
                <select id="teamSelect" class="dropdown"></select>
                <select id="importTeamType" class="dropdown">
                    <option value="user">My Team</option>
                    <option value="enemy">Enemy Team</option>
                </select>
                <button id="importTeam" class="button">Import Team</button>
				</div>
				<div id="userPokemonDetails" style="margin-top: 20px;">
					<div id="addPokemonPanelUser" class="add-pokemon-button user">+</div>
				</div>
				<div id="enemyPokemonDetails" style="margin-top: 20px;">
					<div id="addPokemonPanelEnemy" class="add-pokemon-button enemy">+</div>
				</div>

				<!-- Hidden Pokémon search container -->
				<div id="pokemonSearchContainer" style="display: none;">
					<input type="text" id="pokemonSelect" name="pokemon" placeholder="Enter Pokémon name" class="textbox inputform" />
					<button id="addPokemonButton" class="button">Enter</button>
				</div>

				<div style="margin-top: 20px;">
					<button id="toggleTypeChart" class="button">Show Type Charts</button>
					<div id="typeChartContainer" class="type-chart-wrapper" style="display: none;">
						<div class="type-chart-panel">
							<h3 class="user-header">My Team Type Chart</h3>
							<div id="userTypeChart" class="flex-type-chart"></div>
						</div>
						<div class="type-chart-panel">
							<h3 class="enemy-header">Enemy Team Type Chart</h3>
							<div id="enemyTypeChart" class="flex-type-chart"></div>
						</div>
					</div>
				</div>

				<div style="margin-top: 20px;">
					<button id="toggleMoveCategories" class="button">Show Move Categories</button>
					<div id="moveCategories" class="move-category-container" style="display: none;">
					</div>
				</div>

				<div style="margin-top: 20px;">
					<button id="toggleSpeedList" class="button">Show Speed Tier Comparison</button>
					<div id="speedListContainer" class="speed-list-container" style="display: none;">
						<div class="speed-list-wrapper">
							<div class="speed-list-header">My Team</div>
							<div id="userSpeedList" class="speed-list"></div>
						</div>
						<div class="speed-list-wrapper">
							<div class="speed-list-header enemy">Enemy Team</div>
							<div id="enemySpeedList" class="speed-list enemy"></div>
						</div>
					</div>
				</div>
			</div>
		`;
	}


	renderPokemonList(teamType = 'user') {
		const team = teamType === 'enemy' ? this.pokemonManager.enemyTeam : this.pokemonManager.userTeam;
		const pokemonList = this.room.$el.find(`#${teamType}PokemonDetails`);
		pokemonList.empty();  // Clear the list before rendering

		// Render the existing Pokémon in the team
		team.forEach(pokemon => {
			const spriteStyle = this.getPokemonIconStyle(pokemon);  // Use inline style for sprites
			const typesHtml = this.pokemonManager.getTypesHtml(pokemon.types);
			const teamColorClass = teamType === 'enemy' ? 'enemy-team' : 'user-team';

			pokemonList.append(`
				<div class="pokemon-entry ${teamColorClass}">
					<div class="pokemon-sprite" style="${spriteStyle}"></div>
					<div class="pokemon-info">
						<p><strong>${pokemon.name}</strong></p>
						<div class="pokemon-types">${typesHtml}</div>
						<button class="remove-pokemon-button" data-name="${pokemon.name}" data-team-type="${teamType}">X</button>
					</div>
				</div>
			`);
		});

		// Always append the "Add Pokémon" button
		const addButtonId = `addPokemonPanel${teamType.charAt(0).toUpperCase() + teamType.slice(1)}`;
		if (!pokemonList.find(`#${addButtonId}`).length) {
			pokemonList.append(`
				<div class="add-pokemon-button ${teamType}" id="${addButtonId}">
					+
				</div>
			`);
		}

		this.bindRemovePokemonEvents();
	}


	bindAddPokemonPanelEvents() {
		// Bind event listener for the "Add Pokémon" button
		this.room.$el.find('#addPokemonPanelUser').on('click', () => {
			this.showPokemonSearch('user');
		});
		this.room.$el.find('#addPokemonPanelEnemy').on('click', () => {
			this.showPokemonSearch('enemy');
		});
	}


	bindEvents() {
		const parentContainer = this.room.$el;

		// Event listener for showing the Pokémon input field
		parentContainer.on('click', '#addPokemonPanelUser', () => {
			this.showPokemonSearch('user');
		});
		parentContainer.on('click', '#addPokemonPanelEnemy', () => {
			this.showPokemonSearch('enemy');
		});

		// Event listener for the actual "Add Pokémon" button in the search panel
		parentContainer.on('click', '#addPokemonButton', () => {
			this.addPokemon(this.currentTeamType);
			this.hidePokemonSearch();
		});

		// Only one event listener for importing teams
		parentContainer.on('click', '#importTeam', () => {
			this.importTeam();
			this.updateTypeCharts();
		});

		parentContainer.on('click', '#toggleSpeedList', () => this.toggleSpeedList());
		parentContainer.on('click', '#toggleTypeChart', () => this.toggleTypeChart());
		parentContainer.on('click', '#toggleMoveCategories', () => this.toggleMoveCategories());

		// Reset and focus the search box when shown
		this.room.$el.find('#pokemonSelect').val('').focus();
	}


	bindRemovePokemonEvents() {
		this.room.$el.on('click', '.remove-pokemon-button', (e) => {
			const button = $(e.target);
			const pokemonName = button.data('name');
			const teamType = button.data('team-type');

			// Remove Pokémon from the respective team
			this.pokemonManager.removePokemon(pokemonName, teamType);

			// Refresh the Pokémon list and the type charts
			this.renderPokemonList(teamType);
			this.updateTypeCharts();  // Automatically update type chart when Pokémon is removed
		});
	}


	showPokemonSearch(teamType) {
		this.currentTeamType = teamType;
		this.room.$el.find('#pokemonSearchContainer').show();
		this.room.$el.find('#pokemonSelect').focus();
	}

	hidePokemonSearch() {
		this.room.$el.find('#pokemonSearchContainer').hide();
	}



    getPokemonIconStyle(pokemon) {
        const iconStyle = Dex.getPokemonIcon(pokemon);  // Returns the background position from Dex
        return `background: ${iconStyle.substr(11)}; width: 40px; height: 30px;`;
    }

    getTypeIconUrl(type) {
        return `https://play.pokemonshowdown.com/sprites/types/${type}.png`;  // URL-based icon
    }
    
    toggleMoveCategories() {
        const moveCategoriesContainer = this.room.$el.find('#moveCategories');
        moveCategoriesContainer.toggle();
    }


    populateTeamDropdown() {
        const teamDropdown = this.room.$el.find('#teamSelect');
        if (typeof Storage !== 'undefined' && Storage.teams && Storage.teams.length > 0) {
            const teams = Storage.teams;
            teams.forEach((team, index) => {
                const teamName = team.name || `Team ${index + 1}`;
                teamDropdown.append(new Option(teamName, index));
            });
        } else {
            console.error('No teams found or Storage is not initialized.');
        }
    }

	importTeam() {
		const selectedIndex = this.room.$el.find('#teamSelect').val();
		const selectedTeamType = this.room.$el.find('#importTeamType').val(); // Get the selected team type
		const teams = Storage.teams;
		if (teams && teams[selectedIndex]) {
			const unpackedTeam = Teams.unpack(teams[selectedIndex].team);
			unpackedTeam.forEach(pokemonData => {
				const pokemon = Dex.species.get(pokemonData.species);
				pokemon.moves = pokemonData.moves;

				// Fetch all abilities from Dex
				pokemon.abilities = Dex.species.get(pokemonData.species).abilities;

				pokemon.types = pokemon.types || pokemonData.types;
				this.pokemonManager.addPokemon(pokemon, selectedTeamType); // Use selected team type
			});
			this.updateTypeCharts();
			
			// Re-render the Pokémon list after importing the team
			this.renderPokemonList(selectedTeamType);
		} else {
			alert('Please select a valid team to import.');
		}
	}

	addPokemon(teamType) {
		const pokemonName = this.room.$el.find('#pokemonSelect').val().trim().toLowerCase();
		const pokemon = this.getPokemon(pokemonName);
		if (!pokemon || !pokemon.exists) {
			alert('Pokémon not found. Please enter a valid name.');
			return;
		}
		this.pokemonManager.addPokemon(pokemon, teamType);
		this.updateTypeCharts();

		console.log(`Added ${pokemon.name} to ${teamType} team`); // Debug: Log the addition of a Pokémon

		// Re-render the Pokémon list to ensure the "+" button is still there
		this.renderPokemonList(teamType);

		// Reset the search box for the next input
		this.room.$el.find('#pokemonSelect').val('').focus();
	}

	
    removePokemon(pokemonName, teamType) {
        this.pokemonManager.removePokemon(pokemonName, teamType);
        this.renderPokemonList(teamType); // Update the list visually after removal
    }

    getPokemon(pokemonName) {
        return Dex.species.get(pokemonName);
    }

    toggleSpeedList() {
        const speedListContainer = this.room.$el.find('#speedListContainer');
        speedListContainer.toggle();
    }

    toggleTypeChart() {
        const typeChartContainer = this.room.$el.find('#typeChartContainer');
        typeChartContainer.toggle();
        this.updateTypeCharts();
    }

    updateTypeCharts() {
        this.room.$el.find('#userTypeChart').html(this.generateTypeChartHtml(this.pokemonManager.userTeam));
        this.room.$el.find('#enemyTypeChart').html(this.generateTypeChartHtml(this.pokemonManager.enemyTeam));
    }

    generateTypeChartHtml(team) {
        let typeChartHtml = '';
        let maxSlots = 6; // Set max number of slots to be rendered

        // Calculate overall effectiveness
        let overallEffectiveness = {};
        this.types.forEach(typeName => {
            overallEffectiveness[typeName] = 1;  // Start at neutral (1x)
        });

        // If no Pokémon, render empty slots
        let numberOfPokemonToRender = team.length < maxSlots ? maxSlots : team.length;

        // Generate the effectiveness rows for each Pokémon or empty slot
        for (let i = 0; i < numberOfPokemonToRender; i++) {
            let rowHtml = `<div class="type-chart-row">`;

            // If the team has a Pokémon at this index, display it, otherwise render an empty slot
            if (team[i]) {
                const pokemon = team[i];
                const pokemonSpriteStyle = this.getPokemonIconStyle(pokemon);

                rowHtml += `
                    <div class="type-cell">
                        <div class="pokemon-sprite" style="${pokemonSpriteStyle}"></div>
                    </div>`;

                this.types.forEach(typeName => {
                    const effectiveness = this.calculateTypeEffectivenessForPokemon(pokemon, typeName);
                    overallEffectiveness[typeName] *= effectiveness;

                    let className = this.getEffectivenessClass(effectiveness);
                    rowHtml += `<div class="type-cell ${className}">${this.formatEffectiveness(effectiveness)}</div>`;
                });
            } else {
                // Empty slot with no Pokémon
                rowHtml += `<div class="type-cell empty-slot"></div>`;
                this.types.forEach(() => {
                    rowHtml += `<div class="type-cell empty-slot"></div>`;
                });
            }

            rowHtml += '</div>';
            typeChartHtml += rowHtml;
        }

        // Add overall type effectiveness row
        let overallRowHtml = `
            <div class="type-chart-row overall">
                <div class="type-cell">OVR</div>`;
        this.types.forEach(typeName => {
            const overallClass = this.getOverallEffectivenessClass(overallEffectiveness[typeName]);
            overallRowHtml += `<div class="type-cell ${overallClass}"></div>`;
        });
        overallRowHtml += '</div>';
        typeChartHtml += overallRowHtml;

        // Add the type icon row at the bottom
        let typeIconRowHtml = '<div class="type-chart-row header footer"><div class="type-cell"></div>';
        this.types.forEach(type => {
            const iconUrl = this.getTypeIconUrl(type);
            typeIconRowHtml += `<div class="type-cell"><img src="${iconUrl}" alt="${type}" class="type-icon"></div>`;
        });
        typeIconRowHtml += '</div>';

        typeChartHtml += typeIconRowHtml;

        return typeChartHtml;
    }

    calculateTypeEffectivenessForPokemon(pokemon, targetType) {
        let effectiveness = 1;
        pokemon.types.forEach(pokemonType => {
            effectiveness *= this.typeChart[pokemonType][targetType];
        });
        const abilities = Object.values(pokemon.abilities).filter(Boolean);
        abilities.forEach(ability => {
            switch (ability) {
                case 'Levitate':
                    if (targetType === 'Ground') effectiveness = 0;
                    break;
                case 'Volt Absorb':
                case 'Lightning Rod':
                case 'Motor Drive':
                    if (targetType === 'Electric') effectiveness = 0;
                    break;
                case 'Water Absorb':
                case 'Storm Drain':
                case 'Dry Skin':
                    if (targetType === 'Water') effectiveness = 0;
                    break;
                case 'Flash Fire':
                    if (targetType === 'Fire') effectiveness = 0;
                    break;
                case 'Sap Sipper':
                    if (targetType === 'Grass') effectiveness = 0;
                    break;
                case 'Wonder Guard':
                    if (effectiveness <= 1) effectiveness = 0;
                    break;
                case 'Thick Fat':
                    if (targetType === 'Ice' || targetType === 'Fire') effectiveness *= 0.5;
                    break;
                case 'Purifying Salt':
                    if (targetType === 'Ghost') effectiveness *= 0.5;
                    break;
            }
        });
        return effectiveness;
    }

    getEffectivenessClass(effectiveness) {
        if (effectiveness === 0) return 'no-effect';
        if (effectiveness < 1) return 'not-very-effective';
        if (effectiveness > 1) return effectiveness >= 4 ? 'super-duper-effective' : 'super-effective';
        return 'neutral';
    }

    formatEffectiveness(effectiveness) {
        if (effectiveness === 0.5) return '½x';
        if (effectiveness === 0.25) return '¼x';
        if (effectiveness === 2) return '2×';
        if (effectiveness === 4) return '4×';
        if (effectiveness === 0) return '0×';
        return ''; // Hide neutral 1x
    }

    getOverallEffectivenessClass(effectiveness) {
        if (effectiveness === 0) return 'immunity';  // Immunity
        if (effectiveness <= 0.25) return 'heavy-resistance';  // Strong resistance
        if (effectiveness <= 0.5) return 'resistance';  // Resistance
        if (effectiveness >= 4) return 'severe-weakness';  // Severe weakness
        if (effectiveness >= 2) return 'weakness';  // Weakness
        return 'neutral';  // Neutral
    }

	injectCSS() {
		const css = `
			.teambuilder-panels {
				display: flex;
				flex-wrap: wrap;
				margin-top: 20px;
			}
			/* Add padding around the main container */
			.simple-teambuilder {
				padding: 10px; /* Adjust the padding value as needed */
			}

			.pokemon-details-panel {
				flex: 1;
				padding: 10px;
				border: 1px solid #ccc;
				margin: 5px;
			}

			/* Type charts side by side */
			.type-chart-wrapper {
				display: flex;
				justify-content: space-between;
			}

			/* Type chart panels for user and enemy */
			.type-chart-panel {
				flex: 1;
				margin: 10px;
				text-align: center;
			}

			/* Headers for user and enemy type charts */
			.user-header {
				background-color: #4A90E2; /* Blue for user */
				color: white;
				padding: 5px;
				font-weight: bold;
				text-align: center;
			}

			.enemy-header {
				background-color: #E94E4E; /* Red for enemy */
				color: white;
				padding: 5px;
				font-weight: bold;
				text-align: center;
			}

			.flex-type-chart {
				display: flex;
				flex-direction: column;
				align-items: center;
			}

			.type-chart-row {
				display: flex;
				justify-content: center;
				align-items: center;
				margin-bottom: 2px;
			}

			.type-cell {
				width: 36px;
				height: 36px;
				display: flex;
				justify-content: center;
				align-items: center;
				border: 1px solid #444;
				font-size: 14px;
				padding: 0;
				box-sizing: border-box;
			}

			.type-chart-row.header .type-cell {
				background-color: #4a90e2;
				color: white;
			}

			.pokemon-sprite {
				width: 40px;
				height: 30px;
				background-position: center left;
				display: flex;
				align-items: center;
				justify-content: center;
				margin-left: -5px;
			}

			.type-chart-row .neutral {
				background-color: #333;
			}

			.type-chart-row .super-effective {
				background-color: #e57373;
				color: white;
			}

			.type-chart-row .super-duper-effective {
				background-color: #d32f2f;
				color: white;
			}

			.type-chart-row .not-very-effective {
				background-color: #81c784;
				color: white;
			}

			.type-chart-row .no-effect {
				background-color: #000;
				color: white;
			}

			.type-chart-row.overall .type-cell {
				font-size: 0;
			}

			.immunity {
				background-color: #4caf50; /* Strong green for immunity */
			}

			.heavy-resistance {
				background-color: #81c784; /* Lighter green for heavy resistance */
			}

			.resistance {
				background-color: #c8e6c9; /* Very light green for resistance */
			}

			.weakness {
				background-color: #ffb74d; /* Orange for weakness */
			}

			.severe-weakness {
				background-color: #ff7043; /* Darker orange for severe weakness */
			}

			.neutral {
				background-color: #333; /* Neutral matchups */
			}

			.speed-list-container {
				display: flex;
				justify-content: space-between;
				margin-top: 20px;
				align-items: flex-start;
			}

			.speed-list-wrapper {
				display: flex;
				flex-direction: column;
				align-items: center;
			}

			.speed-list {
				display: flex;
				flex-direction: column;
				align-items: center;
				width: 150px;
				padding: 10px;
				background-color: #2c2c2c;
				border-radius: 8px;
			}

			.speed-list.enemy {
				background-color: #8B0000;
				margin-left: 20px;
			}

			.speed-list-header {
				font-weight: bold;
				font-size: 16px;
				margin-bottom: 10px;
				color: white;
				text-align: center;
			}

			.speed-list-entry {
				display: flex;
				justify-content: space-between;
				align-items: center;
				width: 100%;
				margin-bottom: 5px;
				color: white;
			}

			.speed-sprite {
				width: 24px;
				height: 24px;
			}

			.speed-value {
				font-size: 16px;
				font-weight: bold;
			}
			.type-chart-row.footer {
				margin-top: 10px;
			}
			
			.type-chart-row.overall .type-cell {
				color: white;
				font-weight: bold;
				font-size: 10px;
				text-align: center;
				line-height: 36px; /* Ensure vertical alignment */
			}
			/* Styling for empty slots */
			.type-chart-row .empty-slot {
				background-color: #444; /* Dark background to show it's empty */
				color: transparent; /* Hide text for empty cells */
				border: 1px solid #555; /* Lighter border to distinguish empty cells */
			}

			/* Adjusted the header to apply to footer row as well */
			.type-chart-row.header, .type-chart-row.footer .type-cell {
				color: white;
			}
			.pokemon-entry.enemy-team {
				background-color: #8B0000; /* Dark red for enemy team */
			}
			.add-pokemon-button {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 100px;
				height: 150px;
				border: 1px solid #444;
				background-color: #333;
				color: #fff;
				font-size: 24px;
				cursor: pointer;
				margin-right: 5px;
			}
			.add-pokemon-button.user:hover {
				background-color: #264653;
			}
			.add-pokemon-button.enemy:hover {
				background-color: #8B0000;
			}
			#userPokemonDetails, #enemyPokemonDetails {
				display: flex;
				flex-wrap: wrap;
				max-height: 300px;
				overflow-y: auto;
				border: 1px solid #444;
				padding: 5px;
			}
			#pokemonSearchContainer {
				margin-top: 5px; /* Space between the button and the search box */
			}
		`;
		const styleSheet = document.createElement("style");
		styleSheet.type = "text/css";
		styleSheet.innerText = css;
		document.head.appendChild(styleSheet);
	}
}
