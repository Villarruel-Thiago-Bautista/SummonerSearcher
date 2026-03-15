// live_manager.js

async function chequearPartidaEnVivo(puuid, region) {
    try {
        const res = await fetch(`https://${region}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}?api_key=${API_KEY}`);
        
        if (res.status === 404) return null; // No está en partida
        if (!res.ok) throw new Error("Error al consultar Spectator API");

        return await res.json();
    } catch (e) {
        console.warn("Spectator API:", e.message);
        return null;
    }
}

function renderizarTarjetaLive(liveData) {
    if (!liveData) return '';

    const tiempoTranscurrido = liveData.gameStartTime > 0 
        ? Math.floor((Date.now() - liveData.gameStartTime) / 60000) 
        : 0;

    const modos = { 'CLASSIC': 'Clásica', 'ARAM': 'ARAM', 'CHERRY': 'Arena', 'URF': 'URF' };
    const modoLindo = modos[liveData.gameMode] || liveData.gameMode;

    return `
        <div class="live-status-container">
            <div class="live-indicator">
                <span class="dot"></span>
                <strong>EN PARTIDA ACTIVA</strong>
            </div>
            <div style="display: flex; align-items: center;">
                <div class="live-details">
                    <span class="live-mode">${modoLindo}</span>
                    <span class="live-time">⏳ ${tiempoTranscurrido} min en juego</span>
                </div>
                <div class="live-players-mini">
                    ${liveData.participants.map(p => `
                        <img src="https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${obtenerNombreCampeonPorId(p.championId)}.png" 
                             title="${p.riotIdGameName}" class="live-p-icon">
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}