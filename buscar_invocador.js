// ========================================
// CONFIGURACIÓN
// ========================================
const MATCH_COUNT = 20;

let allMatches = [];
let currentStart = 0;
let puuidGlobal, regionGlobal, matchRegionGlobal, summonerGlobal, nameGlobal, tagGlobal, masteriesGlobal, liveDataGlobal;
let globalesGlobal = { kills:0, deaths:0, assists:0, damage:0, vision:0, wins:0, mvps:0 };
let champStatsGlobal = {};

function getQueueName(queueId) {
    const queues = {
        420: "Ranked Solo/Duo",
        440: "Ranked Flex",
        430: "Normal (Blind)",
        400: "Normal (Draft)",
        450: "ARAM",
        700: "Clash",
        830: "Intro Bots",
        840: "Beginner Bots",
        850: "Intermediate Bots",
        900: "URF",
        1020: "One for All",
        1300: "Nexus Blitz",
        1400: "Ultimate Spellbook",
        1700: "Arena",
        1900: "Pick URF",
        2000: "Tutorial",
        2010: "Replay",
        2020: "Tutorial 2"
    };
    return queues[queueId] || "Custom";
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(0).padStart(2, '0');
    return `${mins}:${secs}`;
}

function obtenerRegiones(){
    const regionSelect = document.getElementById("regionSelect");
    const region = regionSelect ? regionSelect.value : "la2";
    const americas = ['na1','br1','la1','la2'];
    const europe = ['euw1','eun1','tr1','ru'];
    const asia = ['kr','jp1'];
    let matchRegion = 'americas';
    if(europe.includes(region)) matchRegion = 'europe';
    else if(asia.includes(region)) matchRegion = 'asia';
    return {REGION:region, MATCH_REGION:matchRegion};
}

let DDRAGON_VERSION = "14.10.1";

async function obtenerVersionDDragon(){
    try{
        const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
        const versions = await res.json();
        DDRAGON_VERSION = versions[0];
    }catch(e){
        console.error("Error cargando DDragon", e);
    }
}
obtenerVersionDDragon();

document.getElementById("summonerName").addEventListener("keypress", e=>{
    if(e.key === "Enter") buscar();
});

// ========================================
// BUSCAR
// ========================================
async function buscar(){
    const input = document.getElementById("summonerName").value.trim();
    const resultado = document.getElementById("resultado");
    const {REGION, MATCH_REGION} = obtenerRegiones();

    if(!input.includes("#")){
        mostrarError("Usá Nombre#TAG (ej: example#LAS)");
        return;
    }

    const [gameName, tagLine] = input.split("#");
    resultado.innerHTML = '<div class="loading-box"><p class="loading">Sincronizando con los servidores de Riot...</p></div>';

    try{
        // ACCOUNT (Para obtener el PUUID)
        const accountRes = await fetch(`https://${MATCH_REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
        { headers:{"X-Riot-Token":window.API_KEY}});

        if(!accountRes.ok) throw new Error("Jugador no encontrado.");
        const accountData = await accountRes.json();
        const puuid = accountData.puuid;

        puuidGlobal = puuid;
        regionGlobal = REGION;
        matchRegionGlobal = MATCH_REGION;

        // SUMMONER (Para obtener el ID encriptado de la región)
        const summonerRes = await fetch(`https://${REGION}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
        { headers:{"X-Riot-Token":window.API_KEY}});
        const summoner = await summonerRes.json();

        // LLAMADAS EN PARALELO (Ranked, Historial y MAESTRÍAS recuperadas)
        const [rankedRes, masteryRes] = await Promise.all([
            fetch(`https://${REGION}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`, { headers:{"X-Riot-Token":window.API_KEY}}),
            fetch(`https://${REGION}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=3`, { headers:{"X-Riot-Token":window.API_KEY}})
        ]);

        const ranked = rankedRes.ok ? await rankedRes.json() : [];
        const masteries = masteryRes.ok ? await masteryRes.json() : [];

        let liveData = null; // Inicializamos siempre en null
        try {
            // Llamamos a la función del nuevo archivo live_manager.js
            liveData = await chequearPartidaEnVivo(puuid, REGION);
        } catch (e) {
            console.log("No está en partida o error en Spectator API");
        }

        summonerGlobal = summoner;
        nameGlobal = gameName;
        tagGlobal = tagLine;
        masteriesGlobal = masteries;
        liveDataGlobal = liveData;

        // Reset globals
        globalesGlobal = { kills:0, deaths:0, assists:0, damage:0, vision:0, wins:0, mvps:0 };
        champStatsGlobal = {};
        allMatches = [];
        currentStart = 0;

        await fetchMatches(0, 20);

        renderizar(summoner, allMatches, globalesGlobal, gameName, tagLine, champStatsGlobal, masteries, liveData, ranked);
        renderMatches();

    }catch(e){
        console.error(e);
        mostrarError(e.message);
    }
}

async function fetchMatches(start, count) {
    const matchIdsRes = await fetch(`https://${matchRegionGlobal}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuidGlobal}/ids?start=${start}&count=${count}`, { headers:{"X-Riot-Token":window.API_KEY}});
    if (!matchIdsRes.ok) {
        console.error("Error fetching match IDs");
        return;
    }
    const matchIds = await matchIdsRes.json();
    if (matchIds.length === 0) {
        // No more matches
        return;
    }
    const matchPromises = matchIds.map(id =>
        fetch(`https://${matchRegionGlobal}.api.riotgames.com/lol/match/v5/matches/${id}`,
        { headers:{"X-Riot-Token":window.API_KEY}})
        .then(res=>res.json())
    );
    const historial = await Promise.all(matchPromises);
    const newMatches = processMatches(historial, puuidGlobal);
    allMatches.push(...newMatches);
    currentStart += count;
    // Re-render
    renderizar(summonerGlobal, allMatches, globalesGlobal, nameGlobal, tagGlobal, champStatsGlobal, masteriesGlobal, liveDataGlobal, []);
    renderMatches();
}

function loadMoreMatches() {
    fetchMatches(currentStart, 20);
}

// ========================================
// PROCESAR PARTIDAS
// ========================================
function processMatches(historial, puuid) {
    let matches = [];

    historial.forEach(m=>{
        if(!m.info) return;
        const p = m.info.participants.find(x=>x.puuid===puuid);
        if(!p) return;

        const matchIdDeRiot = m.metadata ? m.metadata.matchId : null;
        const duration = m.info.gameDuration/60;
        const team = m.info.participants.filter(x=>x.teamId===p.teamId);
        const enemy = m.info.participants.filter(x=>x.teamId!==p.teamId);

        const teamKills = team.reduce((a,b)=>a+b.kills,0);
        const kp = teamKills>0 ? ((p.kills+p.assists)/teamKills)*100 : 0;
        const totalCS = p.totalMinionsKilled + p.neutralMinionsKilled;
        const csMin = (totalCS/duration).toFixed(1);
        const teamDamage = team.reduce((a,b)=>a+b.totalDamageDealtToChampions,0);
        const dmgShare = teamDamage>0 ? (p.totalDamageDealtToChampions/teamDamage)*100 : 0;
        const kda = (p.kills+p.assists)/Math.max(1,p.deaths);

        const impact = (kp*0.4 + dmgShare*0.3 + p.visionScore*0.15 + p.damageDealtToObjectives*0.0005);
        const carryScore = (kda*10 + kp*0.5 + dmgShare*0.8).toFixed(0);

        let multiKillText = "";
        if(p.pentaKills > 0) multiKillText = "PENTA";
        else if(p.quadraKills > 0) multiKillText = "QUADRA";
        else if(p.tripleKills > 0) multiKillText = "TRIPLE";
        else if(p.doubleKills > 0) multiKillText = "DOUBLE";

        let goldDiff = 0;
        if(p.teamPosition){
            const rival = enemy.find(e => e.teamPosition === p.teamPosition || e.individualPosition === p.individualPosition);
            if(rival) goldDiff = p.goldEarned - rival.goldEarned;
        }

        let diffTag=null; let diffClass="";
        if(goldDiff>1800){ diffTag="LANE DIFF"; diffClass="t-win" }
        if(goldDiff<-1800){ diffTag="GAPPED"; diffClass="t-loss" }

        const esMVP = kda === Math.max(...team.map(t=>(t.kills+t.assists)/Math.max(1,t.deaths))) && p.win;
        const smurfScore = (kda*5 + dmgShare + kp/2);
        const smurf = smurfScore > 80;

        const enemyAvgGold = enemy.reduce((a,b)=>a+b.goldEarned,0)/5;
        const teamAvgGold = team.reduce((a,b)=>a+b.goldEarned,0)/5;
        const teamGap = Math.abs(teamAvgGold - enemyAvgGold) > 3000;

        if(!champStatsGlobal[p.championName]) champStatsGlobal[p.championName]={games:0,wins:0};
        champStatsGlobal[p.championName].games++;
        if(p.win) champStatsGlobal[p.championName].wins++;

        globalesGlobal.kills += p.kills;
        globalesGlobal.deaths += p.deaths;
        globalesGlobal.assists += p.assists;
        globalesGlobal.damage += p.totalDamageDealtToChampions;
        globalesGlobal.vision += p.visionScore;
        if(p.win) globalesGlobal.wins++;
        if(esMVP) globalesGlobal.mvps++;

        matches.push({
            matchId: matchIdDeRiot,
            champ:p.championName, win:p.win, kills:p.kills, deaths:p.deaths, assists:p.assists,
            lvl:p.champLevel, dmg:p.totalDamageDealtToChampions, objDmg:p.damageDealtToObjectives,
            vision:p.visionScore, csMin, kp:Math.round(kp), dmgShare:dmgShare.toFixed(0), carryScore,
            goldDiff, smurf, teamGap, impact:impact.toFixed(0), diffTag, diffClass, esMVP, multiKillText,
            items:[p.item0,p.item1,p.item2,p.item3,p.item4,p.item5,p.item6],
            queueName: getQueueName(m.info.queueId),
            duration: formatDuration(m.info.gameDuration)
        });
    });

    return matches;
}

// ========================================
// RENDER
// ========================================
// ========================================
// RENDER
// ========================================
function renderizar(summoner, allMatchesParam, globales, name, tag, champStats, masteries, liveData, ranked) {
    ranked = Array.isArray(ranked) ? ranked : [];
    const total = allMatchesParam.length || 1;
    const avgKDA = ((globales.kills+globales.assists)/Math.max(1,globales.deaths)).toFixed(2);
    const avgDmg = (globales.damage/total).toLocaleString();
    const winRate = ((globales.wins/total)*100).toFixed(0);
    const avgVision = (globales.vision/total).toFixed(0);

    const ultimas5 = allMatchesParam.slice(0,5);
    const wins = ultimas5.filter(x=>x.win).length;
    let streak="Jugador inconsistente";
    if(wins>=4) streak="🔥 Hot Streak";
    else if(wins<=1) streak="💀 Cold Streak";

    const ultimas3 = allMatchesParam.slice(0,3);
    const derrotasSeguidas = ultimas3.filter(m=>!m.win).length;
    let tilt="🧠 Mentalidad estable";
    if(derrotasSeguidas>=3) tilt="🧠 Riesgo de Tilt Crítico";
    else if(derrotasSeguidas==2) tilt="🧠 Posible Tilt";

    const consistency = avgKDA>3 ? "🎯 Rendimiento Consistente" : "🎯 Rendimiento Variable";
    const smurfGames = allMatchesParam.filter(m=>m.smurf).length;
    let smurfMsg="🧩 Jugador Standard";
    if(smurfGames>=3) smurfMsg="🧩 Indicadores de Smurf";

   let champHtml = "";
   Object.entries(champStats).sort((a,b) => b[1].games - a[1].games).forEach(([champ, data]) => {
       const wr = ((data.wins / data.games) * 100).toFixed(0);
       const wrClass = wr >= 50 ? 'wr-high' : 'wr-low';
       
       champHtml += `
           <div class="champ-stat-item">
               <img class="c-mini-img" src="https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${champ}.png" title="${champ}">
               <div class="c-info">
                   <span class="c-wr ${wrClass}">${wr}% WR</span>
                   <span class="c-games">${data.games} jugadas</span>
               </div>
           </div>`;
   });

    document.getElementById("resultado").innerHTML = `
    <div class="card">
        
        ${liveData ? renderizarTarjetaLive(liveData) : ''}

        <div class="profile-header">
            <div class="icon-wrapper">
                <img src="https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${summoner.profileIconId}.png" class="p-img">
                <span class="p-level">${summoner.summonerLevel}</span>
            </div>
            <div class="profile-info">
                <h2>${name} <span class="tag">#${tag}</span></h2>
                <div class="ranks">
                    ${(() => {
                        const queues = [
                            { key: 'RANKED_SOLO_5x5', label: 'Solo/Duo' },
                            { key: 'RANKED_FLEX_SR', label: 'Flex' }
                        ];
                        const tierClasses = {
                            IRON: 'tier-iron',
                            BRONZE: 'tier-bronze',
                            SILVER: 'tier-silver',
                            GOLD: 'tier-gold',
                            PLATINUM: 'tier-platinum',
                            EMERALD: 'tier-emerald',
                            DIAMOND: 'tier-diamond',
                            MASTER: 'tier-master',
                            GRANDMASTER: 'tier-grandmaster',
                            CHALLENGER: 'tier-challenger',
                        };

                        return queues.map(q => {
                            const r = ranked.find(r => r.queueType === q.key);
                            if(!r) {
                                return `<div class="rank-item rank-unranked"><span class="rank-queue">${q.label}</span><span class="rank-tier">UNRANKED</span></div>`;
                            }
                            const tierClass = tierClasses[r.tier] || '';
                            return `<div class="rank-item">
                                <span class="rank-queue">${q.label}</span>
                                <span class="rank-badge ${tierClass}">${r.tier} ${r.rank}</span>
                                <span class="rank-lp">${r.leaguePoints} LP</span>
                            </div>`;
                        }).join('');
                    })()}
                </div>
            </div>
        </div>

        <div class="top-row-panels">
            <div class="glass-panel">
                <span class="panel-title">🤖 Analista IA</span>
                <div class="ia-content">
                    <span class="ia-pill">${tilt}</span>
                    <span class="ia-pill">${consistency}</span>
                    <span class="ia-pill">${smurfMsg}</span>
                </div>
            </div>

            <div class="glass-panel">
                <span class="panel-title">🏆 Top Maestrías</span>
                <div class="mastery-container">
                    ${masteries.map(m => `
                        <div class="mastery-item">
                            <img src="https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${obtenerNombreCampeonPorId(m.championId)}.png">
                            <span>${(m.championPoints/1000).toFixed(0)}k</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

        <div class="stats-grid">
            <div class="mini-stat stat-1">
                <span class="label">Winrate (${total}G)</span>
                <span class="value">${winRate}%</span>
            </div>
            <div class="mini-stat stat-2">
                <span class="label">KDA Prom</span>
                <span class="value">${avgKDA}</span>
            </div>
            <div class="mini-stat stat-3">
                <span class="label">Daño Prom</span>
                <span class="value">⚔️ ${avgDmg}</span>
            </div>
            <div class="mini-stat stat-4">
                <span class="label">Visión Prom</span>
                <span class="value">👁️ ${avgVision}</span>
            </div>
        </div>

        <div class="champ-stats-container">
            <strong>📊 Performance por Campeón</strong>
            <div class="champ-stats-list">
                ${champHtml}
            </div>
        </div>

        <div class="history-list">
        </div>
    </div>
    `;
}

function renderMatches() {
    const historyHtml = allMatches.map(m=>{
        const kdaColor = ((m.kills+m.assists)/Math.max(1,m.deaths)) > 6 ? 'kda-god' : ((m.kills+m.assists)/Math.max(1,m.deaths)) > 4 ? 'kda-high' : ((m.kills+m.assists)/Math.max(1,m.deaths)) < 1 ? 'kda-low' : '';
        return `
            <div class="match-row ${m.win ? 'match-win' : 'match-loss'}" onclick="verDetallesPartida('${m.matchId}', this)">
                <div class="m-left">
                    <div class="champ-img-box">
                        <img src="https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${m.champ}.png">
                        <span class="m-lvl">${m.lvl}</span>
                    </div>
                    <div class="m-meta">
                        <strong class="${m.win ? 't-win':'t-loss'}">${m.win ? 'VICTORIA':'DERROTA'}</strong>
                        <span class="m-queue">${m.queueName}</span>
                        <span class="m-duration">${m.duration}</span>
                        <span class="m-cs-val">${m.csMin} CS/min</span>
                        ${m.diffTag ? `<span class="diff-tag ${m.diffClass}">${m.diffTag}</span>`:''}
                    </div>
                </div>

                <div class="m-center">
                    <span class="m-kda ${kdaColor}">${m.kills} / ${m.deaths} / ${m.assists}</span>
                    <div class="m-badges">
                        ${m.multiKillText ? `<span class="badge badge-multi">${m.multiKillText}</span>`:''}
                        ${m.esMVP ? `<span class="badge badge-mvp">MVP</span>`:''}
                        ${m.smurf ? `<span class="badge badge-smurf">SMURF</span>`:''}
                    </div>
                    <span class="m-kp">🎯 ${m.kp}% Kill Part.</span>
                </div>

                <div class="m-advanced-stats">
                    <span class="adv-stat">⚔️ ${m.dmg.toLocaleString()} Dmg</span>
                    <span class="adv-stat">🗼 ${m.objDmg.toLocaleString()} Obj</span>
                    <span class="adv-stat">💰 ${m.goldDiff > 0 ? '+' : ''}${m.goldDiff}g</span>
                    <span class="adv-stat">📊 ${m.dmgShare}% Daño Total</span>
                </div>

                <div class="m-items">
                    ${m.items.map(id => id>0 ? `<img src="https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${id}.png" onerror="this.style.visibility='hidden'">` : `<div class="i-empty"></div>`).join('')}
                </div>
            </div>
            `}).join('') + '<button id="loadMoreBtn" onclick="loadMoreMatches()">↓</button>';
    document.querySelector('.history-list').innerHTML = historyHtml;
}

function mostrarError(m){
    document.getElementById("resultado").innerHTML=`<div class="error">${m}</div>`;
}

function obtenerNombreCampeonPorId(id) {
    const champs = { 266: "Aatrox", 103: "Ahri", 84: "Akali", 12: "Alistar", 32: "Amumu", 34: "Anivia", 1: "Annie", 523: "Aphelios", 22: "Ashe", 136: "AurelionSol", 268: "Azir", 432: "Bard", 201: "Braum", 51: "Caitlyn", 164: "Camille", 69: "Cassiopeia", 31: "ChoGath", 42: "Corki", 122: "Darius", 131: "Diana", 119: "Draven", 36: "DrMundo", 245: "Ekko", 60: "Elise", 28: "Evelynn", 81: "Ezreal", 9: "Fiddlesticks", 114: "Fiora", 105: "Fizz", 3: "Galio", 41: "Gangplank", 86: "Garen", 150: "Gnar", 79: "Gragas", 104: "Graves", 120: "Hecarim", 74: "Heimerdinger", 420: "Illaoi", 39: "Irelia", 427: "Ivern", 40: "Janna", 59: "JarvanIV", 24: "Jax", 126: "Jayce", 202: "Jhin", 222: "Jinx", 145: "KaiSa", 429: "Kalista", 43: "Karma", 30: "Karthus", 38: "Kassadin", 55: "Katarina", 10: "Kayle", 141: "Kayn", 85: "Kennen", 121: "Khazix", 203: "Kindred", 240: "Kled", 96: "KogMaw", 7: "LeBlanc", 64: "LeeSin", 89: "Leona", 127: "Lissandra", 236: "Lucian", 117: "Lulu", 99: "Lux", 54: "Malphite", 90: "Malzahar", 57: "Maokai", 11: "MasterYi", 21: "MissFortune", 62: "Wukong", 82: "Mordekaiser", 25: "Morgana", 267: "Nami", 75: "Nasus", 58: "Renekton", 107: "Rengar", 92: "Riven", 68: "Rumble", 13: "Ryze", 360: "Samira", 113: "Sejuani", 235: "Senna", 147: "Seraphine", 875: "Sett", 35: "Shaco", 98: "Shen", 102: "Shyvana", 27: "Singed", 14: "Sion", 15: "Sivir", 72: "Skarner", 37: "Sona", 16: "Soraka", 50: "Swain", 517: "Sylas", 134: "Syndra", 223: "TahmKench", 163: "Taliyah", 91: "Talon", 44: "Taric", 17: "Teemo", 412: "Thresh", 18: "Tristana", 48: "Trundle", 23: "Tryndamere", 4: "TwistedFate", 29: "Twitch", 77: "Udyr", 6: "Urgot", 110: "Varus", 67: "Vayne", 45: "Veigar", 161: "VelKoz", 254: "Vi", 234: "Viego", 112: "Viktor", 8: "Vladimir", 106: "Volibear", 19: "Warwick", 498: "Xayah", 101: "Xerath", 5: "XinZhao", 157: "Yasuo", 777: "Yone", 83: "Yorick", 350: "Yuumi", 154: "Zac", 238: "Zed", 221: "Zeri", 115: "Ziggs", 26: "Zilean", 142: "Zoe", 143: "Zyra", 887: "Gwen", 166: "Akshan", 711: "Vex", 888: "Renata", 200: "Belveth", 895: "Nilah", 897: "KSante", 902: "Milio", 950: "Naafiri", 233: "Briar", 910: "Hwei", 901: "Smolder" };
    return champs[id] || "Aatrox";
}