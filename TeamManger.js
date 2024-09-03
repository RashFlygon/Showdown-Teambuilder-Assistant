class TeamManager {
    constructor() {
        this.teams = this.loadTeamsFromStorage();
    }

    loadTeamsFromStorage() {
        const teams = new PSTeams();
        return teams.list;
    }

    getTeamByName(teamName) {
        return this.teams.find(team => team.name.toLowerCase() === teamName.toLowerCase());
    }
}
