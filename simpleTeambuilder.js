import PokemonManager from './pokemonManager.js'; // Adjust the path as needed
import SpeedTierManager from './SpeedTierManager.js'; // Adjust the path as needed

export default class SimpleTeambuilder {
    constructor(room) {
        this.room = room;
        this.speedTierManager = new SpeedTierManager(room); // Instantiate SpeedTierManager within SimpleTeambuilder
        this.pokemonManager = new PokemonManager(room, this.speedTierManager); // Instantiate PokemonManager within SimpleTeambuilder
        this.types = this.initializeTypes(); // Initialize types here
        this.typeChart = this.initializeTypeChart(); // Initialize type chart here
        this.teams = PS.teams.list; // Fetch the teams from the user's teambuilder
        this.initialize();
    }

    initializeTypes() {
        // Initialize the array of types
        return [
            'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
            'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic',
            'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'
        ];
    }

    initializeTypeChart() {
        // Initialize the type effectiveness chart from Dex types data
        let typeChart = {};

        this.types.forEach(typeName => {
            const typeData = Dex.types.get(typeName);
            typeChart[typeName] = {};
            this.types.forEach(targetType => {
                typeChart[typeName][targetType] = 1; // Default to neutral
                if (typeData && typeData.damageTaken && targetType in typeData.damageTaken) {
                    const damageTaken = typeData.damageTaken[targetType];
                    if (damageTaken === 1) {
                        typeChart[typeName][targetType] = 2; // Super effective
                    } else if (damageTaken === 2) {
                        typeChart[typeName][targetType] = 0.5; // Not very effective
                    } else if (damageTaken === 3) {
                        typeChart[typeName][targetType] = 0; // No effect (immune)
                    }
                }
            });
        });

        return typeChart;
    }

    initialize() {
        this.room.$el.html(this.render());  // Render the initial UI
        this.bindEvents();  // Bind necessary events
        this.injectCSS(); // Inject CSS for styling the type chart
    }

    render() {
        // Render the main structure of the teambuilder
        return `
            <div class="simple-teambuilder">
                <h2>Custom Teambuilder</h2>
                <div>
                    <label for="teamSelect">Select a Team:</label>
                    <select id="teamSelect" class="textbox inputform">
                        ${this.teams.map(team => `<option value="${team.key}">${team.name}</option>`).join('')}
                    </select>
                    <button id="importTeam" class="button">Import Team</button>
                </div>
                <div>
                    <label for="pokemonSelect">Choose a Pokémon:</label>
                    <input type="text" id="pokemonSelect" name="pokemon" placeholder="Enter Pokémon name" class="textbox inputform" />
                    <button id="chooseUserPokemon" class="button">Add to My Team</button>
                    <button id="chooseEnemyPokemon" class="button">Add to Enemy Team</button>
                </div>
                <div id="userPokemonDetails" style="margin-top: 20px;">
                    <!-- User Pokémon details will be displayed here -->
                </div>
                <div id="enemyPokemonDetails" style="margin-top: 20px;">
                    <!-- Enemy Pokémon details will be displayed here -->
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
                <div style="margin-top: 20px;">
                    <button id="toggleTypeChart" class="button">Show Type Charts</button>
                    <div id="typeChartContainer" style="display: none;">
                        <h3>My Team Type Chart</h3>
                        <div id="userTypeChart" class="flex-type-chart"></div>
                        <h3>Enemy Team Type Chart</h3>
                        <div id="enemyTypeChart" class="flex-type-chart"></div>
                    </div>
                </div>
            </div>
        `;
    }
	
    bindEvents() {
        this.room.$el.find('#chooseUserPokemon').on('click', () => this.addPokemon('user'));
        this.room.$el.find('#chooseEnemyPokemon').on('click', () => this.addPokemon('enemy'));
        this.room.$el.find('#toggleSpeedList').on('click', () => this.toggleSpeedList());
        this.room.$el.find('#toggleTypeChart').on('click', () => this.toggleTypeChart());
        this.room.$el.find('#importTeam').on('click', () => this.importTeam());
    }

    addPokemon(teamType) {
        const pokemonName = this.room.$el.find('#pokemonSelect').val().trim().toLowerCase();
        const pokemon = this.getPokemon(pokemonName);

        if (!pokemon || !pokemon.exists) {
            alert('Pokémon not found. Please enter a valid name.');
            return;
        }

        // Use PokemonManager to manage the selected Pokémon
        this.pokemonManager.addPokemon(pokemon, teamType);

        // Update the speed lists and type charts
        this.updateTypeCharts();
    }

    importTeam() {
        const selectedTeamKey = this.room.$el.find('#teamSelect').val();
        const selectedTeam = this.teams.find(team => team.key === selectedTeamKey);

        if (selectedTeam) {
            this.pokemonManager.importTeam(selectedTeam.packedTeam); // Import the team using PokemonManager
            this.updateTypeCharts();
        } else {
            alert('Team not found.');
        }
    }

    getPokemon(pokemonName) {
        // Fetch the Pokémon data using the dex
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
        if (!team.length) return '';

        let typeChartHtml = '<div class="type-chart-row header"><div class="type-cell"></div>';

        this.types.forEach(type => {
            const iconUrl = `https://play.pokemonshowdown.com/sprites/types/${type}.png`;
            typeChartHtml += `<div class="type-cell"><img src="${iconUrl}" alt="${type}" title="${type}" class="type-icon"></div>`;
        });
        typeChartHtml += '</div>';

        let overallEffectiveness = {};
        this.types.forEach(typeName => {
            overallEffectiveness[typeName] = 1;
        });

        team.forEach(pokemon => {
            const spriteUrl = this.pokemonManager.getSprite(pokemon);
            let rowHtml = `<div class="type-chart-row"><div class="type-cell"><img src="${spriteUrl}" alt="${pokemon.name}" class="small-sprite"></div>`;
            this.types.forEach(typeName => {
                const effectiveness = this.calculateTypeEffectivenessForPokemon(pokemon, typeName);
                overallEffectiveness[typeName] *= effectiveness;
                let className = this.getEffectivenessClass(effectiveness);
                const displayValue = this.formatEffectiveness(effectiveness);
                rowHtml += `<div class="type-cell ${className}">${displayValue}</div>`;
            });
            rowHtml += '</div>';
            typeChartHtml += rowHtml;
        });

        // Add the overall effectiveness summary row
        let overallRowHtml = '<div class="type-chart-row overall"><div class="type-cell">Overall</div>';
        this.types.forEach(type => {
            const overallValue = overallEffectiveness[type];
            let overallClassName = this.getEffectivenessClass(overallValue);
            overallRowHtml += `<div class="type-cell ${overallClassName}"></div>`; // Just color, no text
        });
        overallRowHtml += '</div>';
        typeChartHtml += overallRowHtml;

        return typeChartHtml;
    }

    calculateTypeEffectivenessForPokemon(pokemon, targetType) {
        let effectiveness = 1;
        pokemon.types.forEach(pokemonType => {
            effectiveness *= this.typeChart[pokemonType][targetType];
        });

        // Get abilities correctly from the Pokémon object
        const abilities = Object.values(pokemon.abilities).filter(Boolean); // Remove any undefined/null values

        // Check for abilities that grant immunities
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
                case 'Filter':
                case 'Solid Rock':
                    if (effectiveness > 1) effectiveness *= 0.75;
                    break;
                case 'Friend Guard':
                    effectiveness *= 0.75;
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
        return `${effectiveness}×`;
    }

    injectCSS() {
        const css = `
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
                width: 30px;
                height: 30px;
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
            .type-icon {
                width: 24px;
                height: 24px;
            }
            .small-sprite {
                width: 48px;
                height: auto;
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
                font-size: 0; /* Hide text in the overall row */
            }

            /* Speed list styles */
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
        `;
        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = css;
        document.head.appendChild(styleSheet);
    }
}
