const leagueCache = {};

async function fetchLeagueByPuuid(puuid, region) {
    if (!puuid) return [];
    if (leagueCache[puuid]) return leagueCache[puuid];

    try {
        const res = await fetch(`https://${region}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`, { headers: { "X-Riot-Token": API_KEY } });
        if (!res.ok) return [];
        const data = await res.json();
        leagueCache[puuid] = data;
        return data;
    } catch {
        return [];
    }
}

async function verDetallesPartida(matchId, element) {
    if (matchId === 'undefined') return;

    const existente = document.getElementById(`detalles-${matchId}`);
    if (existente) { existente.remove(); return; }

    const { REGION, MATCH_REGION } = obtenerRegiones();
    const detallesDiv = document.createElement('div');
    detallesDiv.id = `detalles-${matchId}`;
    detallesDiv.className = 'match-details-expanded';
    detallesDiv.innerHTML = '<div class="loading-mini">Analizando rendimiento de jugadores...</div>';
    element.after(detallesDiv);

    try {
        const res = await fetch(`https://${MATCH_REGION}.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${API_KEY}`);
        if (!res.ok) throw new Error("Error API");
        
        const data = await res.json();
        const participants = data.info.participants;

        // Fetch league info for each participant (cache to reduce requests)
        const leaguePromises = participants.map(p => fetchLeagueByPuuid(p.puuid, REGION));
        const leagueResults = await Promise.all(leaguePromises);
        const leagueByPuuid = participants.reduce((acc, p, idx) => {
            acc[p.puuid] = leagueResults[idx];
            return acc;
        }, {});

        const maxDamage = Math.max(...participants.map(p => p.totalDamageDealtToChampions));

        const equipo1 = participants.slice(0, 5);
        const equipo2 = participants.slice(5, 10);

        const killsEquipo1 = equipo1.reduce((acc, p) => acc + p.kills, 0);
        const killsEquipo2 = equipo2.reduce((acc, p) => acc + p.kills, 0);

        // Función interna para encontrar al rival en el equipo contrario
        const obtenerRival = (jugador, equipoContrario) => {
            return equipoContrario.find(r => r.teamPosition === jugador.teamPosition) || equipoContrario[0];
        };

        detallesDiv.innerHTML = `
            <div class="players-container">
                <div class="team-side blue-side">
                    <div class="team-header">
                        <h5>Equipo Azul ${equipo1[0].win ? '🏆 VICTORIA' : ''}</h5>
                    </div>
                    ${equipo1.map(p => renderFilaJugador(p, maxDamage, killsEquipo1, obtenerRival(p, equipo2), leagueByPuuid[p.puuid] || [])).join('')}
                </div>
                <div class="team-side red-side">
                    <div class="team-header">
                        <h5>Equipo Rojo ${equipo2[0].win ? '🏆 VICTORIA' : ''}</h5>
                    </div>
                    ${equipo2.map(p => renderFilaJugador(p, maxDamage, killsEquipo2, obtenerRival(p, equipo1), leagueByPuuid[p.puuid] || [])).join('')}
                </div>
            </div>
        `;
    } catch (e) {
        console.error(e);
        detallesDiv.innerHTML = `<div class="error-mini">Error: ${e.message}</div>`;
    }
}

function renderFilaJugador(p, maxDamage, totalTeamKills, rivalDirecto, leagueEntries) {
    const kdaNum = ((p.kills + p.assists) / Math.max(1, p.deaths)).toFixed(1);
    const dmgPercentage = (p.totalDamageDealtToChampions / maxDamage) * 100;
    const kp = totalTeamKills > 0 ? (((p.kills + p.assists) / totalTeamKills) * 100).toFixed(0) : 0;

    const soloEntry = (leagueEntries || []).find(e => e.queueType === 'RANKED_SOLO_5x5');

    const leagueHtml = `
        <div class="p-league">
            <div class="p-league-item ${soloEntry ? 'tier-' + soloEntry.tier.toLowerCase() : ''}">
                <span class="p-league-queue">Solo/Duo</span>
                <span class="p-league-tier">${soloEntry ? `${soloEntry.tier} ${soloEntry.rank}` : 'UNRANKED'}</span>
                ${soloEntry ? `<span class="p-league-lp">${soloEntry.leaguePoints} LP</span>` : ''}
            </div>
        </div>
    `;
    
    // Protección: Si no hay rivalDirecto, usamos al mismo jugador para que la resta sea 0 y no explote
    const rival = rivalDirecto || p;
    const difOro = p.goldEarned - rival.goldEarned;
    const difOroTexto = difOro >= 0 ? `+${(difOro/1000).toFixed(1)}k💰` : `${(difOro/1000).toFixed(1)}k💰`;
    const difClass = difOro >= 0 ? 'gold-up' : 'gold-down';

    // Corregimos la función de click para el nombre
    const clickBusqueda = `buscarOtro('${p.riotIdGameName}', '${p.riotIdTagline}')`;

    let tags = [];
    let tieneImpactoPositivo = false;

    // --- LÓGICA DE TAGS (Igual a la tuya) ---
    if ((p.totalDamageTaken > p.totalDamageDealtToChampions && p.deaths < 8)) {
        tags.push({ text: "PROTECTOR 🛡️", class: "t-vision", desc: "Absorbió daño y murio poco." });
        tieneImpactoPositivo = true;
    }

    // --- LÓGICA DE TAGS (Igual a la tuya) ---
    if (p.visionScore >= 40) {
        tags.push({ text: "VISIONARIO 👁️", class: "t-protect", desc: "Dominó visión." });
        tieneImpactoPositivo = true;
    }

    if (p.totalDamageDealtToChampions === maxDamage && maxDamage > 0) {
        tags.push({ text: "MÁX. DAÑO", class: "t-win", desc: "Máximo daño de la partida." });
        tieneImpactoPositivo = true;
    }
    if (kdaNum >= 4.0 && p.win) {
        tags.push({ text: "CARRY", class: "t-win", desc: "KDA excepcional." });
        tieneImpactoPositivo = true;
    }

    // 3. EFICIENTE
    const valEficiencia = (p.totalDamageDealtToChampions / Math.max(1, p.goldEarned)).toFixed(2);
    if (valEficiencia > 1.5) {
        tags.push({ text: "EFICIENTE", class: "t-win", desc: `Daño/Oro: ${valEficiencia}` });
        tieneImpactoPositivo = true;
    }

    // 4. OBJETIVOS 🐉
    const epicMonsterDamage = p.damageDealtToObjectives - p.damageDealtToTurrets;
    if (epicMonsterDamage > 15000) {
        tags.push({ text: "OBJETIVOS 🐉", class: "t-objectives", desc: "Gran daño a monstruos épicos." });
        tieneImpactoPositivo = true;
    }

    // 5. SPLITPUSHER
    if (p.damageDealtToTurrets > 6000) {
        tags.push({ text: "SPLITPUSHER", class: "t-split", desc: "Presión constante en torres." });
        tieneImpactoPositivo = true;
    }

    // 6. SIN IMPACTO (Solo si NO tuvo impacto positivo previo)
    if (!tieneImpactoPositivo) {
        const bajoDano = dmgPercentage < 10;
        const bajasTorres = p.damageDealtToTurrets < 2000;
        const bajoKP = kp < 20;

        // Si cumple cualquiera de las condiciones de "flojo"
        if (bajoDano || bajasTorres || bajoKP) {
            tags.push({ 
                text: "SIN IMPACTO", 
                class: "t-loss", 
                desc: `Bajo rendimiento en: ${bajoDano ? 'Daño ' : ''}${bajasTorres ? 'Torres ' : ''}${bajoKP ? 'Participación' : ''}` 
            });
        }
    }

    // 7. BOT / FEEDER (Esta se queda aparte porque puedes ser carry y morir 15 veces a la vez)
    if (p.deaths >= 8 && kdaNum <= 1.3) {
        tags.push({ text: "BOT / FEEDER", class: "t-loss", desc: "Demasiadas muertes." });
    }

    return `
        <div class="player-mini-row">
            <div class="p-champ-container">
                <img class="p-champ-img" src="https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${p.championName}.png">
                <span class="p-lvl-tag">${p.champLevel}</span>
            </div>

            <div class="p-main-info">
                <span class="p-name" onclick="${clickBusqueda}">${p.riotIdGameName}</span>
                ${leagueHtml}
                <div class="p-stats-row">
                    <span class="p-kda-mini">${p.kills}/${p.deaths}/${p.assists}</span>
                    <span class="p-kda-ratio">(${kdaNum})</span>
                    <span class="p-gold-diff ${difClass}">${difOroTexto}</span>
                </div>
                <div class="p-tags-container">
                    ${tags.map(t => `<span class="diff-tag ${t.class}" title="${t.desc}">${t.text}</span>`).join('')}
                </div>
            </div>

            <div class="p-dmg-analysis">
                <span class="p-dmg-val">⚔️ ${p.totalDamageDealtToChampions.toLocaleString()}</span>
                <div class="p-dmg-bar-bg">
                    <div class="p-dmg-bar-fill" style="width: ${dmgPercentage}%"></div>
                </div>
                <div class="p-extra-stats">
                    <span class="p-obj-val">🗼 ${(p.damageDealtToTurrets/1000).toFixed(1)}k</span>
                    <span class="p-obj-val monster">🐲 ${((p.damageDealtToObjectives - p.damageDealtToTurrets)/1000).toFixed(1)}k</span>
                </div>
            </div>

            <div class="p-items-mini">
                ${[p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].map(id => 
                    id > 0 ? `<img src="https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${id}.png">` : `<div class="i-dot"></div>`
                ).join('')}
            </div>
        </div>
    `;
}

// Función auxiliar para buscar desde la lista
function buscarOtro(name, tag) {
    document.getElementById("summonerName").value = `${name}#${tag}`;
    buscar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}