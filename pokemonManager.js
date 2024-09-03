export default class PokemonManager {
    constructor(room, speedTierManager) {
        this.room = room;
        this.speedTierManager = speedTierManager; // Pass in the SpeedTierManager instance
        this.userTeam = []; // Array to hold up to 6 selected Pokémon for the user's team
        this.enemyTeam = []; // Array to hold up to 6 selected Pokémon for the enemy's team
        this.teams = []; // Array to hold the user's teams from the teambuilder
        this.injectCSS(); // Inject the CSS directly from this class
        this.loadTeamsFromStorage(); // Load teams from storage upon initialization
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
        const unpackedTeam = Teams.unpack(packedTeam);
        this.userTeam = unpackedTeam.map(set => {
            const pokemon = Dex.species.get(set.species);
            pokemon.abilities = set.ability ? {0: set.ability} : {};
            pokemon.types = pokemon.types || [];
            return pokemon;
        });
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

        if (team.length >= 6) {
            alert('You can only add up to 6 Pokémon.');
            return;
        }
        team.push(pokemon);
        this.renderPokemonList(teamType);
        this.speedTierManager.addPokemon(pokemon, teamType); // Update SpeedTierManager
    }

    removePokemon(pokemonName, teamType = 'user') {
        const team = teamType === 'enemy' ? this.enemyTeam : this.userTeam;

        // Remove the Pokémon from the team list by name
        const index = team.findIndex(p => p.name.toLowerCase() === pokemonName.toLowerCase());
        if (index !== -1) {
            const removedPokemon = team.splice(index, 1)[0];
            this.renderPokemonList(teamType);
            this.speedTierManager.removePokemon(removedPokemon.name, teamType); // Remove from SpeedTierManager
        }
    }

    importTeam(teamName, teamType = 'user') {
        const team = this.teams.find(t => t.name === teamName);
        if (!team) {
            alert('Team not found.');
            return;
        }

        const pokemonData = Dex.unpackTeam(team.packedTeam); // Unpack the Pokémon data from the packed team
        if (teamType === 'user') {
            this.userTeam = pokemonData;
        } else {
            this.enemyTeam = pokemonData;
        }
        this.renderPokemonList(teamType);
        pokemonData.forEach(pokemon => this.speedTierManager.addPokemon(pokemon, teamType));
    }

    renderPokemonList(teamType = 'user') {
        const team = teamType === 'enemy' ? this.enemyTeam : this.userTeam;
        const pokemonList = this.room.$el.find(`#${teamType}PokemonDetails`);
        pokemonList.empty();  // Clear the list before rendering

        team.forEach(pokemon => {
            const spriteUrl = this.getSprite(pokemon);
            const typesHtml = this.getTypesHtml(pokemon.types);
            const abilitiesHtml = this.getAbilitiesHtml(pokemon);

            pokemonList.append(`
                <div class="pokemon-entry">
                    <div class="pokemon-sprite">
                        <img src="${spriteUrl}" alt="${pokemon.name}" />
                    </div>
                    <div class="pokemon-info">
                        <p><strong>${pokemon.name}</strong></p>
                        <div class="pokemon-types">${typesHtml}</div>
                        <div class="pokemon-abilities">${abilitiesHtml}</div>
                        <button class="remove-pokemon-button" data-name="${pokemon.name}" data-team-type="${teamType}">X</button>
                    </div>
                </div>
            `);
        });

        // Bind the remove button event
        this.bindRemovePokemonEvents();
    }

    bindRemovePokemonEvents() {
        this.room.$el.find('.remove-pokemon-button').on('click', (event) => {
            const button = $(event.currentTarget);
            const pokemonName = button.data('name');
            const teamType = button.data('team-type');
            this.removePokemon(pokemonName, teamType);
        });
    }

    getSprite(pokemon) {
        // Return the URL for the Pokémon's sprite
        const spriteDir = `https://play.pokemonshowdown.com/sprites/dex`;
        return `${spriteDir}/${toID(pokemon.id)}.png`;
    }

    getTypesHtml(types) {
        // Generate the HTML for the Pokémon's types using the given icon URLs
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

    getAbilitiesHtml(pokemon) {
        // Fetch and display the Pokémon's abilities
        const abilities = Object.values(pokemon.abilities).filter(Boolean);
        return abilities.map(ability => `<p>${ability}</p>`).join('');
    }

    injectCSS() {
        const css = `
            .pokemon-entry {
                display: flex;
                flex-direction: column;
                align-items: center;
                margin-right: 0;
                background-color: #2c2c2c;
                border: 1px solid #444;
                padding: 10px;
                text-align: center;
                width: 120px;
                color: #ffffff; /* Changed text color for better visibility */
                border-right: none; /* Remove right border to connect boxes */
            }

            .pokemon-entry:last-child {
                border-right: 1px solid #444; /* Add right border to the last box */
            }

            .pokemon-sprite img {
                width: auto;
                height: auto;
            }

            .pokemon-info {
                margin-top: 10px;
            }

            .pokemon-types img {
                margin-right: 5px;
            }

            .pokemon-abilities p {
                margin: 0;
                font-size: 12px;
            }

            .remove-pokemon-button {
                margin-top: 5px;
                background-color: red;
                color: white;
                border: none;
                padding: 5px;
                cursor: pointer;
            }

            #userPokemonDetails, #enemyPokemonDetails {
                display: flex;
                justify-content: flex-start;
                flex-wrap: nowrap;
                border: 1px solid #444; /* Add a border around the entire row */
            }
        `;
        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = css;
        document.head.appendChild(styleSheet);
    }
}
