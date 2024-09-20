export default class PokemonMoveCategories {
    constructor(room) {
        this.room = room;
        this.moves = [];  // Unified move list for both user and enemy
        this.moveCategories = this.initializeMoveCategories();
        this.getMoveCategories = this.getMoveCategories.bind(this);
        this.injectCSS();
        this.makeToggleCategoryGlobal();
        this.renderMoveCategoriesSection();
    }

    // Define categories and their corresponding moves
    initializeMoveCategories() {
        return {
            hazards: ['stealthrock', 'spikes', 'toxicspikes', 'stickyweb'],
            cleric: ['wish', 'healingwish', 'healbell', 'aromatherapy'],
            momentum: ['uturn', 'voltswitch', 'teleport'],
            priority: ['aquajet', 'bulletpunch', 'extremespeed', 'fakeout'],
            disruption: ['taunt', 'knockoff', 'encore', 'trick', 'switcheroo'],
            speedControl: ['bulldoze', 'electroweb', 'icywind', 'quash', 'tailwind', 'trickroom'],
        };
    }

    addPokemon(pokemon, teamType = 'user') {
        // Fetch the learnset of the Pokémon
        const learnset = this.getPokemonLearnset(pokemon);

        if (learnset) {
            Object.keys(learnset).forEach(move => {
                let existingMove = this.moves.find(existingMove => existingMove.name === move);

                if (existingMove) {
                    // Check if the Pokémon is already in the move
                    const isPokemonAlreadyAdded = existingMove.pokemon.some(p => p.pokemon.name === pokemon.name);

                    if (!isPokemonAlreadyAdded) {
                        // Add the Pokémon if it isn't already in the move list
                        existingMove.pokemon.push({ pokemon, teamType });
                    }
                } else {
                    // Add the move if it doesn't exist in the moveList
                    this.moves.push({
                        name: move,
                        pokemon: [{ pokemon, teamType }],
                        categories: this.getMoveCategories(move)
                    });
                }
            });
        } else {
            console.warn(`Learnset not found for ${pokemon.name}`);
        }

        // Re-render the move categories after updating the list, without toggling the visibility
        this.renderMoveCategories();
    }

    removePokemon(pokemon) {
        // Remove the Pokémon from all moves in the list
        this.moves.forEach(move => {
            move.pokemon = move.pokemon.filter(p => p.pokemon.name.toLowerCase() !== pokemon.name.toLowerCase());
        });

        // Remove any moves that no longer have any Pokémon associated with them
        this.moves = this.moves.filter(move => move.pokemon.length > 0);

        // Re-render the move categories after removing the Pokémon, without toggling the visibility
        this.renderMoveCategories();
    }

    // Get the categories for a specific move
    getMoveCategories(move) {
        const moveId = Dex.moves.get(move).id;
        const categories = [];

        Object.keys(this.moveCategories).forEach(category => {
            if (this.moveCategories[category].includes(moveId)) {
                categories.push(category);
            }
        });

        return categories;
    }

    // Render all categories and moves for both teams
    renderMoveCategories() {
        const moveCategoriesContainer = this.room.$el.find('#moveCategories');
        const isContainerVisible = moveCategoriesContainer.is(':visible');  // Preserve visibility state

        moveCategoriesContainer.empty();  // Clear previous content

        // Render moves for both user and enemy teams in the same section
        this.renderCombinedMoves(moveCategoriesContainer);

        if (isContainerVisible) {
            moveCategoriesContainer.show();  // Restore visibility if it was open before
        } else {
            moveCategoriesContainer.hide();  // Keep it hidden if it was hidden before
        }
    }

    renderCombinedMoves(container) {
        Object.keys(this.moveCategories).forEach(category => {
            const movesInCategory = this.moves
                .filter(move => move.categories.includes(category))
                .filter(move => move.pokemon.length > 0);

            if (movesInCategory.length > 0) {
                let categoryHtml = `
                    <div class="move-category">
                        <div class="category-header" onclick="toggleCategory('${category}')">
                            <h3>${this.formatCategoryName(category)}</h3>
                        </div>
                        <ul id="${category}-list" class="move-list" style="display: none;">`;

                movesInCategory.forEach(move => {
                    const moveName = Dex.moves.get(move.name).name;

                    let pokemonSprites = '';
                    move.pokemon.forEach(({ pokemon }) => {
                        const spriteStyle = this.getPokemonIconStyle(pokemon);
                        // Removed borderColor reference here
                        pokemonSprites += `<div class="pokemon-sprite" style="${spriteStyle}"></div>`;
                    });

                    categoryHtml += `
                        <li>
                            <span>${moveName}</span>
                            <div class="pokemon-sprites">${pokemonSprites}</div>
                        </li>`;
                });

                categoryHtml += `</ul></div>`;
                container.append(categoryHtml);
            }
        });
    }

    getPokemonIconStyle(pokemon) {
        const iconStyle = Dex.getPokemonIcon(pokemon);  
        return `background: ${iconStyle.substr(11)};`;
    }

    getPokemonLearnset(pokemon) {
        let pokemonName = String(pokemon.name).toLowerCase().replace(/\s/g, '').replace('-', '');
        let learnset = BattleTeambuilderTable.learnsets[pokemonName];

        if (!learnset) {
            const baseSpecies = Dex.species.get(pokemonName).baseSpecies;
            if (baseSpecies) {
                const baseSpeciesName = baseSpecies.toLowerCase().replace(/\s/g, '').replace('-', '');
                learnset = BattleTeambuilderTable.learnsets[baseSpeciesName];
            }
        }

        return learnset || null;
    }

    formatCategoryName(category) {
        return category.charAt(0).toUpperCase() + category.slice(1);
    }

    injectCSS() {
        const css = `
            .move-category {
                margin-bottom: 15px;
                background-color: #f4f4f4;
                border: 1px solid #ccc;
                padding: 10px;
                border-radius: 5px;
            }

            .category-header {
                font-size: 12px;
                font-weight: bold;
                cursor: pointer;
                background-color: #e0e0e0;
                padding: 5px;
                border-radius: 5px;
            }

            .move-list {
                list-style-type: none;
                padding-left: 0;
                margin-top: 10px;
                font-size: 12px;
            }

            .move-list li {
                padding: 5px 0;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }

            .move-list li span {
                color: #333;
                font-weight: bold;
            }

            .pokemon-sprites {
                display: flex;
                gap: 5px;
            }

            .pokemon-sprite {
                width: 40px;
                height: 30px;
                margin-left: 5px;
                vertical-align: middle;
                border-radius: 50%; /* Make the border appear as a ring */
            }

            .move-category h3 {
                color: #333;
            }
        `;
        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = css;
        document.head.appendChild(styleSheet);
    }

    makeToggleCategoryGlobal() {
        window.toggleCategory = function (category) {
            const list = document.getElementById(`${category}-list`);
            if (list) {
                list.style.display = (list.style.display === 'none') ? 'block' : 'none';
            } else {
                console.error(`Category list for ${category} not found.`);
            }
        };
    }

    renderMoveCategoriesSection() {
        if (!this.room.$el.find('#toggleMoveCategories').length) {
            const html = `
                <div style="margin-top: 20px;">
                    <button id="toggleMoveCategories" class="button">Show Move Categories</button>
                    <div id="moveCategories" class="move-category-wrapper" style="display: none;">
                    </div>
                </div>
            `;
            this.room.$el.append(html);
        }
    }
}
