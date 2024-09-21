import PokemonMoveCategories from './pokemonMoveCategories.js'; // Add this import

export default class PokemonManager {
    constructor(room, speedTierManager) {
        this.room = room;
        this.speedTierManager = speedTierManager;
        this.userTeam = [];
        this.enemyTeam = [];
        this.teams = [];
        this.pokemonMoveCategories = new PokemonMoveCategories(room); // Initialize PokemonMoveCategories
        this.injectCSS();
        this.loadTeamsFromStorage();
    }

    loadTeamsFromStorage() {
        const storedData = localStorage.getItem('showdown_teams');
        if (!storedData) {
            console.error("No team data found in storage.");
            return;
        }

        this.teams = [];
        const teamLines = storedData.split('\n');
        for (const line of teamLines) {
            const team = this.unpackTeamLine(line);
            if (team) this.teams.push(team);
        }
    }

    importTeam(packedTeam) {
        //const unpackedTeam = Teams.unpack(packedTeam);

        this.userTeam = unpackedTeam.map(set => {
            const pokemon = Dex.species.get(set.species);
            
            // Log the unpacked abilities from Dex
            console.log('Abilities from Dex for:', pokemon.name, Dex.species.get(pokemon.name).abilities);
            
            // Get all abilities from Dex
            pokemon.abilities = Dex.species.get(pokemon.name).abilities;

            // Other properties (e.g., type, stats)
            pokemon.types = pokemon.types || [];
            return pokemon;
        });
        
        // Check if abilities are correctly assigned after importing the team
        console.log('User team abilities:', this.userTeam.map(pokemon => pokemon.abilities));

        this.renderPokemonList('user');
        this.speedTierManager.updateSpeedList(this.userTeam, 'user');
    }

    unpackTeamLine(line) {
        const pipeIndex = line.indexOf('|');
        if (pipeIndex < 0) return null;

        const bracketIndex = line.indexOf(']');
        const slashIndex = line.lastIndexOf('/', pipeIndex);
        const format = bracketIndex > 0 ? line.slice(0, bracketIndex) : 'gen7';
        const name = line.slice(slashIndex + 1, pipeIndex);
        return {
            name,
            format,
            packedTeam: line.slice(pipeIndex + 1),
        };
    }

    addPokemon(pokemon, teamType = 'user') {
        const team = teamType === 'enemy' ? this.enemyTeam : this.userTeam;
        console.log(pokemon);
        if (!Array.isArray(team)) {
            console.error(`${teamType} is not an array.`);
            return;
        }

        if (team.length >= 15) {
            alert('You can only add up to 15 Pokémon.');
            return;
        }

        if (pokemon && typeof pokemon.name === 'string') {
            team.push(pokemon);  // Add valid Pokémon objects only
            this.renderPokemonList(teamType);
            this.speedTierManager.addPokemon(pokemon, teamType);
            this.pokemonMoveCategories.addPokemon(pokemon, teamType);
        } else {
            console.error('Invalid Pokémon data:', pokemon);
        }
    }

    removePokemon(pokemonName, teamType = 'user') {
        const team = teamType === 'enemy' ? this.enemyTeam : this.userTeam;

        const index = team.findIndex(p => p.name.toLowerCase() === pokemonName.toLowerCase());
        if (index !== -1) {
            const removedPokemon = team.splice(index, 1)[0];
            this.renderPokemonList(teamType);
            this.speedTierManager.removePokemon(removedPokemon.name, teamType);
            this.pokemonMoveCategories.removePokemon(removedPokemon, teamType);
            this.updateMoveCategories();
        }
    }

    renderPokemonList(teamType = 'user') {
        const team = teamType === 'enemy' ? this.enemyTeam : this.userTeam;
        const pokemonList = this.room.$el.find(`#${teamType}PokemonDetails`);
        pokemonList.empty();  // Clear the list before rendering

        team.forEach(pokemon => {
            const spriteStyle = this.getPokemonIconStyle(pokemon);  // Use inline style for sprites
            const typesHtml = this.getTypesHtml(pokemon.types);
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

        this.bindRemovePokemonEvents();
    }

    getPokemonIconStyle(pokemon) {
        const iconStyle = Dex.getPokemonIcon(pokemon);  // Fetch the background position from Dex
        return `background: ${iconStyle.substr(11)}; width: 30px; height: 30px;`;  // Adjust the width and height
    }

    bindRemovePokemonEvents() {
        this.room.$el.find('.remove-pokemon-button').on('click', (event) => {
            const button = $(event.currentTarget);
            const pokemonName = button.data('name');
            const teamType = button.data('team-type');
            this.removePokemon(pokemonName, teamType);
        });
    }

    getTypesHtml(types) {
        if (!Array.isArray(types)) {
            console.error('Expected an array for types, but got:', types);
            types = [];
        }

        return types.map(type => `
            <img 
                src="https://play.pokemonshowdown.com/sprites/types/${type}.png" 
                alt="${type}" 
                height="14" 
                width="32" 
                class="pixelated"
            >
        `).join('');
    }

    updateMoveCategories() {
        const moveCategoryContainer = this.room.$el.find('#moveCategories');
        moveCategoryContainer.empty();
        const moveCategoriesManager = new PokemonMoveCategories(this.room);

        this.userTeam.forEach(pokemon => {
            moveCategoriesManager.addPokemon(pokemon, 'user');
        });

        this.enemyTeam.forEach(pokemon => {
            moveCategoriesManager.addPokemon(pokemon, 'enemy');
        });

        moveCategoriesManager.renderMoveCategories();
    }

    injectCSS() {
        const css = `
            .pokemon-entry {
                display: flex;
                flex-direction: column;
                align-items: center;
                margin-right: 5px;
                background-color: #2c2c2c;
                border: 1px solid #444;
                padding: 5px;
                text-align: center;
                width: 100px;  /* Fixed width for consistency */
                height: 150px; /* Fixed height for consistency */
                color: #ffffff;
                border-right: none;
                box-sizing: border-box; /* Ensure padding and border are included in the width and height */
            }

            .pokemon-entry.user-team {
                background-color: #264653; /* Dark turquoise */
            }

            .pokemon-entry.enemy-team {
                background-color: #8B0000; /* Dark red */
            }

            .pokemon-sprite {
                width: 40px;  /* Adjust width */
                height: 40px; /* Adjust height */
                background-size: 800px 2400px;  /* Match the sprite sheet size */
            }

            .pokemon-info {
                margin-top: 5px; /* Reduced margin */
                flex: 1; /* Allow the info section to take available space */
            }

            .pokemon-types img {
                margin-right: 3px; /* Reduced margin */
            }

            .remove-pokemon-button {
                margin-top: auto; /* Align button to the bottom */
                background-color: red;
                color: white;
                border: none;
                padding: 3px;
                cursor: pointer;
            }

            #userPokemonDetails, #enemyPokemonDetails {
                display: flex;
                flex-wrap: wrap;
                max-height: 300px; /* Set a maximum height for the container */
                overflow-y: auto; /* Enable vertical scrolling */
                border: 1px solid #444;
            }

            /* Styling for the scrollbar */
            #userPokemonDetails::-webkit-scrollbar,
            #enemyPokemonDetails::-webkit-scrollbar {
                width: 8px; /* Width of the scrollbar */
            }

            #userPokemonDetails::-webkit-scrollbar-thumb,
            #enemyPokemonDetails::-webkit-scrollbar-thumb {
                background-color: #555; /* Color of the scrollbar thumb */
                border-radius: 4px;
            }

            #userPokemonDetails::-webkit-scrollbar-track,
            #enemyPokemonDetails::-webkit-scrollbar-track {
                background-color: #2c2c2c; /* Color of the scrollbar track */
            }
        `;
        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = css;
        document.head.appendChild(styleSheet);
    }
}
