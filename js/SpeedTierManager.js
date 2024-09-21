export default class SpeedTierManager {
    constructor(room) {
        this.room = room;
        this.userSpeedList = [];
        this.enemySpeedList = [];
        this.injectCSS(); // Inject the CSS directly from this class
    }

    addPokemon(pokemon, teamType = 'user') {
        const speedList = teamType === 'enemy' ? this.enemySpeedList : this.userSpeedList;

        // Add the Pokémon to the speed list and include the sprite style
        speedList.push({ name: pokemon.name, speed: pokemon.baseStats.spe, spriteStyle: this.getPokemonIconStyle(pokemon) });
        this.renderSpeedList();
    }

    removePokemon(pokemonName, teamType = 'user') {
        const speedList = teamType === 'enemy' ? this.enemySpeedList : this.userSpeedList;

        const index = speedList.findIndex(p => p.name.toLowerCase() === pokemonName.toLowerCase());
        if (index !== -1) {
            speedList.splice(index, 1);
            this.renderSpeedList();
        }
    }

    renderSpeedList() {
        const userSpeedListEl = this.room.$el.find('#userSpeedList');
        const enemySpeedListEl = this.room.$el.find('#enemySpeedList');

        userSpeedListEl.empty();
        enemySpeedListEl.empty();

        this.userSpeedList.sort((a, b) => b.speed - a.speed);
        this.enemySpeedList.sort((a, b) => b.speed - a.speed);

        // Render the user speed list
        this.userSpeedList.forEach(pokemon => {
            userSpeedListEl.append(`
                <div class="speed-entry">
                    <div class="speed-sprite" style="${pokemon.spriteStyle}"></div>
                    <span class="speed-value">${pokemon.speed}</span>
                </div>
            `);
        });

        // Render the enemy speed list
        this.enemySpeedList.forEach(pokemon => {
            enemySpeedListEl.append(`
                <div class="speed-entry">
                    <span class="speed-value">${pokemon.speed}</span>
                    <div class="speed-sprite" style="${pokemon.spriteStyle}"></div>
                </div>
            `);
        });
    }

    // Replace the getSprite method with getPokemonIconStyle
    getPokemonIconStyle(pokemon) {
        const iconStyle = Dex.getPokemonIcon(pokemon);  // Fetch the background position from Dex
        return `background: ${iconStyle.substr(11)}; width: 40px; height: 30px;`;  // Adjust the width and height if needed
    }

    injectCSS() {
        const css = `
            .speed-entry {
                display: flex;
                align-items: center;
                margin-bottom: 5px;
            }

            .speed-sprite {
                width: 40px;  /* Updated sprite width */
                height: 30px; /* Updated sprite height */
                margin-right: 5px;
                background-size: 800px 2400px;  /* Match the sprite sheet size */
            }

            #userSpeedList {
                background-color: #264653; /* Blue background for the user team */
                padding: 10px;
                margin-right: 10px;
                border-radius: 5px;
            }

            #enemySpeedList {
                background-color: #8B0000; /* Red background for the enemy team */
                padding: 10px;
                border-radius: 5px;
            }

            .speed-value {
                font-weight: bold;
                color: white;
            }

            .speed-list-header {
                text-align: center;
                font-weight: bold;
                color: white;
                margin-bottom: 10px;
                text-decoration: underline;
            }
        `;
        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = css;
        document.head.appendChild(styleSheet);
    }
}
