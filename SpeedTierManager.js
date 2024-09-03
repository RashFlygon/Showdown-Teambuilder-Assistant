export default class SpeedTierManager {
    constructor(room) {
        this.room = room;
        this.userSpeedList = [];
        this.enemySpeedList = [];
        this.injectCSS(); // Inject the CSS directly from this class
    }

    addPokemon(pokemon, teamType = 'user') {
        const speedList = teamType === 'enemy' ? this.enemySpeedList : this.userSpeedList;

        speedList.push({ name: pokemon.name, speed: pokemon.baseStats.spe, sprite: this.getSprite(pokemon) });
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

        this.userSpeedList.forEach(pokemon => {
            userSpeedListEl.append(`
                <div class="speed-entry">
                    <img src="${pokemon.sprite}" alt="${pokemon.name}" class="speed-sprite">
                    <span class="speed-value">${pokemon.speed}</span>
                </div>
            `);
        });

        this.enemySpeedList.forEach(pokemon => {
            enemySpeedListEl.append(`
                <div class="speed-entry">
                    <span class="speed-value">${pokemon.speed}</span>
                    <img src="${pokemon.sprite}" alt="${pokemon.name}" class="speed-sprite">
                </div>
            `);
        });
    }

    getSprite(pokemon) {
        // Return the URL for the Pokémon's sprite
        const spriteDir = `https://play.pokemonshowdown.com/sprites/dex`;
        return `${spriteDir}/${toID(pokemon.id)}.png`;
    }

    injectCSS() {
        const css = `
            .speed-entry {
                display: flex;
                align-items: center;
                margin-bottom: 5px;
            }

            .speed-sprite {
                width: 24px;
                height: auto;
                margin-right: 5px;
            }

            #userSpeedList {
                background-color: #66B2FF; /* Blue background for the user team */
                padding: 10px;
                margin-right: 10px;
                border-radius: 5px;
            }

            #enemySpeedList {
                background-color: #CC3333; /* Red background for the enemy team */
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
