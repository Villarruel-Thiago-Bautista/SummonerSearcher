// live_details.js

const API_KEY = window.API_KEY;
let DDRAGON_VERSION = "14.10.1";

async function obtenerVersionDDragon() {
    try {
        const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
        const versions = await res.json();
        DDRAGON_VERSION = versions[0];
    } catch (e) {
        console.warn("No se pudo cargar versión de DDragon", e.message);
    }
}

obtenerVersionDDragon();

function parseQuery() {
    const params = new URLSearchParams(window.location.search);
    return {
        region: params.get('region'),
        puuid: params.get('puuid')
    };
}

function mostrarMensaje(msg) {
    const content = document.getElementById('content');
    content.innerHTML = `<div class="error">${msg}</div>`;
}

function formatMinutes(ms) {
    return Math.floor(ms / 60000);
}

function mapGameMode(mode) {
    const modos = { 'CLASSIC': 'Clásica', 'ARAM': 'ARAM', 'CHERRY': 'Arena', 'URF': 'URF' };
    return modos[mode] || mode;
}

function formatNumber(num) {
    return num?.toLocaleString?.() ?? num;
}

function obtenerNombreCampeonPorId(id) {
    const champs = { 266: "Aatrox", 103: "Ahri", 84: "Akali", 12: "Alistar", 32: "Amumu", 34: "Anivia", 1: "Annie", 523: "Aphelios", 22: "Ashe", 136: "AurelionSol", 268: "Azir", 432: "Bard", 201: "Braum", 51: "Caitlyn", 164: "Camille", 69: "Cassiopeia", 31: "ChoGath", 42: "Corki", 122: "Darius", 131: "Diana", 119: "Draven", 36: "DrMundo", 245: "Ekko", 60: "Elise", 28: "Evelynn", 81: "Ezreal", 9: "Fiddlesticks", 114: "Fiora", 105: "Fizz", 3: "Galio", 41: "Gangplank", 86: "Garen", 150: "Gnar", 79: "Gragas", 104: "Graves", 120: "Hecarim", 74: "Heimerdinger", 420: "Illaoi", 39: "Irelia", 427: "Ivern", 40: "Janna", 59: "JarvanIV", 24: "Jax", 126: "Jayce", 202: "Jhin", 222: "Jinx", 145: "KaiSa", 429: "Kalista", 43: "Karma", 30: "Karthus", 38: "Kassadin", 55: "Katarina", 10: "Kayle", 141: "Kayn", 85: "Kennen", 121: "Khazix", 203: "Kindred", 240: "Kled", 96: "KogMaw", 7: "LeBlanc", 64: "LeeSin", 89: "Leona", 127: "Lissandra", 236: "Lucian", 117: "Lulu", 99: "Lux", 54: "Malphite", 90: "Malzahar", 57: "Maokai", 11: "MasterYi", 21: "MissFortune", 62: "Wukong", 82: "Mordekaiser", 25: "Morgana", 267: "Nami", 75: "Nasus", 58: "Renekton", 107: "Rengar", 92: "Riven", 68: "Rumble", 13: "Ryze", 360: "Samira", 113: "Sejuani", 235: "Senna", 147: "Seraphine", 875: "Sett", 35: "Shaco", 98: "Shen", 102: "Shyvana", 27: "Singed", 14: "Sion", 15: "Sivir", 72: "Skarner", 37: "Sona", 16: "Soraka", 50: "Swain", 517: "Sylas", 134: "Syndra", 223: "TahmKench", 163: "Taliyah", 91: "Talon", 44: "Taric", 17: "Teemo", 412: "Thresh", 18: "Tristana", 48: "Trundle", 23: "Tryndamere", 4: "TwistedFate", 29: "Twitch", 77: "Udyr", 6: "Urgot", 110: "Varus", 67: "Vayne", 45: "Veigar", 161: "VelKoz", 254: "Vi", 234: "Viego", 112: "Viktor", 8: "Vladimir", 106: "Volibear", 19: "Warwick", 498: "Xayah", 101: "Xerath", 5: "XinZhao", 157: "Yasuo", 777: "Yone", 83: "Yorick", 350: "Yuumi", 154: "Zac", 238: "Zed", 221: "Zeri", 115: "Ziggs", 26: "Zilean", 142: "Zoe", 143: "Zyra", 887: "Gwen", 166: "Akshan", 711: "Vex", 888: "Renata", 200: "Belveth", 895: "Nilah", 897: "KSante", 902: "Milio", 950: "Naafiri", 233: "Briar", 910: "Hwei", 901: "Smolder" };
    return champs[id] || "Aatrox";
}

function renderPlayerCard(participant, mastery) {
    const champName = obtenerNombreCampeonPorId(participant.championId);
    const masteryLevel = mastery?.championLevel ?? 0;
    const masteryPts = mastery?.championPoints ?? 0;
    const chest = mastery?.chestGranted ? '✅ Cofre disponible' : '❌ Cofre';

    return `
        <div class="live-player-card">
            <div class="live-player-left">
                <img class="live-p-icon" src="https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${champName}.png" alt="${champName}">
                <div>
                    <div class="live-player-name">${participant.summonerName || participant.riotIdGameName || 'Invocador desconocido'}</div>
                    <div class="live-player-meta">${participant.teamId === 100 ? 'Equipo Azul' : 'Equipo Rojo'} • ${participant.teamPosition || 'Sin rol'}</div>
                </div>
            </div>
            <div class="live-player-stats">
                <div class="live-player-stat">🏆 Nivel de maestría: <strong>${masteryLevel}</strong></div>
                <div class="live-player-stat">✨ Pts maestría: <strong>${formatNumber(masteryPts)}</strong></div>
                <div class="live-player-stat">${chest}</div>
            </div>
        </div>
    `;
}

async function initLiveDetails() {
    try {
        const { region, puuid } = parseQuery();
        const content = document.getElementById('content');

        if (!region || !puuid) {
            mostrarMensaje('Faltan parámetros en la URL. Asegúrate de abrir esta página desde el botón "EN PARTIDA ACTIVA".');
            return;
        }

        content.innerHTML = '<div class="loading-box"><p class="loading">Cargando datos de la partida en vivo...</p></div>';

        const liveData = await chequearPartidaEnVivo(puuid, region);
        if (!liveData) {
            mostrarMensaje('No se encontró una partida en vivo para este invocador.');
            return;
        }

        const gameMode = mapGameMode(liveData.gameMode);
        const elapsed = formatMinutes(Date.now() - liveData.gameStartTime);

        const masteryPromises = liveData.participants.map(p =>
            fetch(`https://${region}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-summoner/${p.summonerId}/by-champion/${p.championId}`, {
                headers: { "X-Riot-Token": window.API_KEY }
            })
                .then(r => {
                    if (!r.ok) {
                        console.warn(`Maestría falló para ${p.summonerName || p.riotIdGameName}: ${r.status} ${r.statusText}`);
                        return null;
                    }
                    return r.json();
                })
                .catch((e) => {
                    console.warn(`Error al consultar maestría de ${p.summonerName || p.riotIdGameName}:`, e);
                    return null;
                })
        );

        const masteryResults = await Promise.all(masteryPromises);

        content.innerHTML = `
            <div class="live-details-card">
                <div class="live-details-header">
                    <div>
                        <h2>Partida en vivo</h2>
                        <p>${gameMode} • ${elapsed} min</p>
                    </div>
                    <a class="search-btn" href="index.html">← Volver</a>
                </div>
                <div class="live-players-grid">
                    ${liveData.participants.map((p, idx) => renderPlayerCard(p, masteryResults[idx])).join('')}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error en live_details:', error);
        mostrarMensaje(`Error cargando detalles de la partida: ${error.message || error}`);
    }
}

window.addEventListener('DOMContentLoaded', initLiveDetails);
