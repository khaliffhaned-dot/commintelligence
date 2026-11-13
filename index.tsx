/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// --- Auth-aware API client ---
// Every request carries X-Requested-With (the server rejects state-changing calls without it, as CSRF protection).
// A 401 anywhere re-opens the sign-in screen.
const authState: { user: any; org: any; role: string | null; onAuthRequired: (() => void) | null } = { user: null, org: null, role: null, onAuthRequired: null };

async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetch(url, { ...init, headers: { 'X-Requested-With': 'fetch', ...((init.headers as any) || {}) }, credentials: 'same-origin' });
    if (res.status === 401 && !url.startsWith('/api/auth/')) authState.onAuthRequired?.();
    return res;
}

/**
 * Calls the Cloudflare Pages Function at /api/ai, which holds HUNYUAN_API_KEY
 * server-side, forwards the request to Hunyuan and returns the parsed JSON object.
 */
async function generateJson(prompt: string, imageParts?: { mimeType: string, data: string }[]): Promise<any> {
    let response: Response;
    try {
        response = await apiFetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, imageParts }),
        });
    } catch (e: any) {
        throw new Error(`Could not reach the AI backend: ${e.message}`);
    }

    let body: any = null;
    try {
        body = await response.json();
    } catch {
        // Non-JSON response (e.g. SPA fallback HTML when the function isn't deployed).
    }
    if (!body) {
        throw new Error(`The AI backend (/api/ai) returned an unexpected response (HTTP ${response.status}). Check that the Pages Function is deployed.`);
    }
    if (body.error) {
        throw new Error(body.error);
    }
    return body.result;
}

declare var L: any;
declare var ApexCharts: any;
declare var html2canvas: any;
declare var jspdf: any;

interface Client {
    id: string;
    name: string;
    industry: string;
    logoUrl?: string;
}

// --- Application State ---
const appState = {
    clients: [] as Client[], // Clients will be loaded from persistent storage.
    currentClientId: null as string | null,
    currentClient: null as Client | null,
    latestVerificationResult: null as any | null,
    charts: {} as { [key: string]: any },
    mapInstance: null as any,
    uploadedImageData: null as { mimeType: string, data: string, url: string } | null,
    isInitialized: false,
    cache: {} as { [key: string]: any }, // Cache for API responses
    signalFeedIntervalId: null as any, // To manage the real-time feed simulation
    modalLogoDataUrl: null as string | null, // Temp storage for logo uploads
    signalFeedFocus: 'all' as string, // Topic focus for the real-time feed: 'all', 'BN', 'PH', 'PN'
    nusaPulseMode: 'brand' as 'brand' | 'political', // Regional Map mode: brand intelligence vs. political sentiment
    nusaPulsePartyFocus: 'BN' as string, // Coalition focus when nusaPulseMode is 'political'
};

const COALITION_NAMES: { [key: string]: string } = {
    BN: 'Barisan Nasional (BN)',
    PH: 'Pakatan Harapan (PH)',
    PN: 'Perikatan Nasional (PN)',
};


/**
 * Generates initials from a client name.
 * e.g., "Apex Innovations" -> "AI", "Google" -> "G"
 * @param name The full name of the client.
 * @returns A string containing the initials.
 */
function getInitials(name: string): string {
    if (!name) return '';
    const words = name.trim().split(/\s+/).filter(Boolean); // Filter out empty strings from multiple spaces
    if (words.length === 0) return '';
    if (words.length === 1) {
        return words[0].charAt(0).toUpperCase();
    }
    // For names with multiple words, take the first letter of the first and last words.
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

/**
 * Dynamically updates the SVG lines in the propagation map to connect the nodes correctly.
 * This function is called on view render and window resize to ensure responsiveness.
 */
function updatePropagationLines() {
    const container = document.querySelector('.propagation-map-container');
    // If the container is not in the DOM, do nothing. This handles window resize events for other views.
    if (!container) return;

    const nodes = {
        source: document.getElementById('node-source'),
        amplifier: document.getElementById('node-amplifier'),
        bot: document.getElementById('node-bot'),
        media: document.getElementById('node-media'),
        public: document.getElementById('node-public')
    };

    const lines = {
        'source-amplifier': document.getElementById('line-source-amplifier'),
        'amplifier-bot': document.getElementById('line-amplifier-bot'),
        'amplifier-media': document.getElementById('line-amplifier-media'),
        'bot-public': document.getElementById('line-bot-public')
    };

    const getCenter = (el: HTMLElement | null) => {
        if (!el) return { x: 0, y: 0 };
        // Get position relative to the container, which is the offsetParent
        const x = el.offsetLeft + el.offsetWidth / 2;
        const y = el.offsetTop + el.offsetHeight / 2;
        return { x, y };
    };

    const sourceCenter = getCenter(nodes.source);
    const amplifierCenter = getCenter(nodes.amplifier);
    const botCenter = getCenter(nodes.bot);
    const mediaCenter = getCenter(nodes.media);
    const publicCenter = getCenter(nodes.public);

    const connections = [
        { line: lines['source-amplifier'], from: sourceCenter, to: amplifierCenter },
        { line: lines['amplifier-bot'], from: amplifierCenter, to: botCenter },
        { line: lines['amplifier-media'], from: amplifierCenter, to: mediaCenter },
        { line: lines['bot-public'], from: botCenter, to: publicCenter }
    ];

    connections.forEach(({ line, from, to }) => {
        if (line) {
            line.setAttribute('x1', String(from.x));
            line.setAttribute('y1', String(from.y));
            line.setAttribute('x2', String(to.x));
            line.setAttribute('y2', String(to.y));
        }
    });
}

/**
 * Dynamically updates SVG lines for the Stakeholder Map.
 */
function updateStakeholderLines() {
    const container = document.querySelector('.stakeholder-map-container');
    if (!container) return;

    const nodes = {
        center: document.getElementById('node-center-policy'),
        gov: document.getElementById('node-stakeholder-gov'),
        opp: document.getElementById('node-stakeholder-opp'),
        ngo: document.getElementById('node-stakeholder-ngo'),
        industry: document.getElementById('node-stakeholder-industry'),
        media: document.getElementById('node-stakeholder-media')
    };

    const lines = {
        'center-gov': document.getElementById('line-center-gov'),
        'center-opp': document.getElementById('line-center-opp'),
        'center-ngo': document.getElementById('line-center-ngo'),
        'center-industry': document.getElementById('line-center-industry'),
        'center-media': document.getElementById('line-center-media')
    };
    
    const getCenter = (el: HTMLElement | null) => {
        if (!el) return { x: 0, y: 0 };
        const x = el.offsetLeft + el.offsetWidth / 2;
        const y = el.offsetTop + el.offsetHeight / 2;
        return { x, y };
    };

    const center = getCenter(nodes.center);
    
    Object.entries(nodes).forEach(([key, nodeEl]) => {
        if (key !== 'center') {
            const lineEl = lines[`center-${key.split('-')[2]}` as keyof typeof lines];
            if (lineEl) {
                const nodeCenter = getCenter(nodeEl);
                lineEl.setAttribute('x1', String(center.x));
                lineEl.setAttribute('y1', String(center.y));
                lineEl.setAttribute('x2', String(nodeCenter.x));
                lineEl.setAttribute('y2', String(nodeCenter.y));
            }
        }
    });
}


document.addEventListener('DOMContentLoaded', () => {
    // --- Global Error Handling ---
    // This ensures that any unexpected error in the application
    // is caught and a user-friendly message is displayed.
    function renderErrorBoundary(error: Error) {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="error-boundary-fallback">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <h3>Oops! Something went wrong.</h3>
                    <p>We've encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.</p>
                    <p class="error-message"><code>${error.message}</code></p>
                </div>
            `;
        }
        console.error("Caught unhandled error:", error);
    }

    window.onerror = (message, source, lineno, colno, error) => {
        if (error) renderErrorBoundary(error);
        return true; // Prevents the default browser error handler
    };
    window.onunhandledrejection = (event) => {
        if (event.reason instanceof Error) renderErrorBoundary(event.reason);
    };

    try {
        const landingPage = document.getElementById('landing-page');
        const appContainer = document.getElementById('app-container');

        // --- View Rendering Functions ---
        /**
         * Renders the NusaPulse (Market Intelligence) dashboard.
         */
        /** Renders the toolbar for switching the Regional Map between Brand and Political modes. */
        function renderNusaPulseToolbarHtml(): string {
            const mode = appState.nusaPulseMode;
            const party = appState.nusaPulsePartyFocus;
            return `
                <div class="nusapulse-toolbar">
                    <div class="toggle-group">
                        <button class="toggle-btn ${mode === 'brand' ? 'active' : ''}" data-mode="brand" type="button">Brand</button>
                        <button class="toggle-btn ${mode === 'political' ? 'active' : ''}" data-mode="political" type="button">Political Parties</button>
                    </div>
                    ${mode === 'political' ? `
                    <select id="nusapulse-party-select" class="form-select">
                        <option value="BN" ${party === 'BN' ? 'selected' : ''}>Barisan Nasional (BN)</option>
                        <option value="PH" ${party === 'PH' ? 'selected' : ''}>Pakatan Harapan (PH)</option>
                        <option value="PN" ${party === 'PN' ? 'selected' : ''}>Perikatan Nasional (PN)</option>
                    </select>` : ''}
                </div>
            `;
        }

        function attachNusaPulseToolbarListeners() {
            document.querySelectorAll('.nusapulse-toolbar .toggle-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const newMode = (btn as HTMLElement).dataset.mode as 'brand' | 'political';
                    if (newMode !== appState.nusaPulseMode) {
                        appState.nusaPulseMode = newMode;
                        renderNusaPulseMapView();
                    }
                });
            });
            document.getElementById('nusapulse-party-select')?.addEventListener('change', (e) => {
                appState.nusaPulsePartyFocus = (e.target as HTMLSelectElement).value;
                renderNusaPulseMapView();
            });
        }

        async function renderNusaPulseMapView() {
            const container = document.getElementById('nusapulse-map-view');
            if (!container) return;
            const mode = appState.nusaPulseMode;
            const party = appState.nusaPulsePartyFocus;

            if (mode === 'brand' && !appState.currentClient) {
                container.innerHTML = `
                    <div class="view-header">
                        <div><h2>NusaPulse: Regional Map</h2></div>
                        ${renderNusaPulseToolbarHtml()}
                    </div>
                    <div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    <h3>No Client Selected</h3>
                    <p>Please select a client from the switcher above, add a new client, or switch to "Political Parties" mode above.</p>
                    <button id="mi-go-to-clients-btn" class="btn btn--primary">Go to Client Management</button>
                </div>`;
                document.getElementById('mi-go-to-clients-btn')?.addEventListener('click', () => {
                    switchView('clients-view');
                });
                attachNusaPulseToolbarListeners();
                return;
            }

            const cacheKey = mode === 'brand' ? `${appState.currentClientId}-nusapulseMap` : `political-${party}-nusapulseMap`;
            if (appState.cache[cacheKey]) {
                renderNusaPulseMapContent(appState.cache[cacheKey]);
                return;
            }

            const loadingLabel = mode === 'brand' ? appState.currentClient!.name : COALITION_NAMES[party];
            container.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>Generating NusaPulse Report for ${loadingLabel}...</p></div>`;

            try {
                const data = mode === 'brand'
                    ? await fetchMarketIntelligenceData(appState.currentClient!)
                    : await fetchPartyRegionalData(party);
                appState.cache[cacheKey] = data;
                renderNusaPulseMapContent(data);
            } catch(error) {
                console.error("Failed to fetch market intelligence data", error);
                container.innerHTML = `
                    <div class="view-header">
                        <div><h2>NusaPulse: Regional Map</h2></div>
                        ${renderNusaPulseToolbarHtml()}
                    </div>
                    <div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    <h3>Analysis Failed</h3>
                    <p class="error-message">Could not generate the NusaPulse report. The backend service may be unavailable.</p>
                </div>`;
                attachNusaPulseToolbarListeners();
            }
        }

        function renderNusaPulseMapContent(data: any) {
            const container = document.getElementById('nusapulse-map-view');
            if (!container) return;
            const mode = appState.nusaPulseMode;
            const subtitle = mode === 'brand'
                ? `Hyperlocal intelligence for ${appState.currentClient?.name} across Malaysia.`
                : `Regional public sentiment for ${COALITION_NAMES[appState.nusaPulsePartyFocus]} across Malaysia.`;
            container.innerHTML = `
                 <div class="view-header">
                    <div>
                        <h2>NusaPulse: Regional Map</h2>
                        <p class="text-secondary">${subtitle}</p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        ${renderNusaPulseToolbarHtml()}
                        <button id="export-mi-pdf-button" class="btn btn--secondary">Export as PDF</button>
                    </div>
                </div>
                <div class="nusapulse-grid" id="mi-dashboard-export-content">
                    <div id="mi-map-card" class="card nusapulse-map-card">
                        <div class="card__header">
                            <h3>Regional Sentiment Map</h3>
                            <p class="text-secondary">Real-time sentiment and media buzz across all Malaysian states.</p>
                        </div>
                        <div id="mi-map" class="map-container"></div>
                    </div>
                    <div id="mi-sentiment-chart-card" class="card">
                        <div class="card__header">
                            <h3>Sentiment Over Time</h3>
                             <p class="text-secondary">Last 6 months trend</p>
                        </div>
                        <div id="mi-sentiment-chart" class="card__body"></div>
                    </div>
                    <div id="mi-topics-chart-card" class="card">
                         <div class="card__header">
                            <h3>Key Topics</h3>
                             <p class="text-secondary">Top 5 trending topics</p>
                        </div>
                        <div id="mi-topics-chart" class="card__body"></div>
                    </div>
                    <div id="mi-buzz-chart-card" class="card">
                         <div class="card__header">
                            <h3>Media Buzz Tracking</h3>
                            <p class="text-secondary">Conversation volume by state</p>
                        </div>
                        <div id="mi-buzz-chart" class="card__body"></div>
                    </div>
                </div>
            `;
            document.getElementById('export-mi-pdf-button')?.addEventListener('click', () => handleGenericPdfExport(
                'mi-dashboard-export-content',
                'export-mi-pdf-button',
                'NusaPulse Report'
            ));
            attachNusaPulseToolbarListeners();
            initializeMapAndCharts(data, 'map');
        }

        /**
         * Fetches AI-generated, indicative regional public sentiment data for a political coalition.
         * Reuses the same shape as fetchMarketIntelligenceData so it can drive the same map/charts.
         */
        async function fetchPartyRegionalData(partyCode: string) {
            const partyName = COALITION_NAMES[partyCode] || partyCode;
            const prompt = `
                You are a Malaysian political intelligence analyst. Generate an indicative, AI-estimated regional public
                sentiment report for the political coalition "${partyName}" across Malaysia.
                The report must be a valid JSON object with the following keys: 'regionalSentiment', 'sentimentOverTime', 'keyTopics'.

                1.  'regionalSentiment': An array of objects, one for each major Malaysian state (e.g., Selangor, Kuala Lumpur, Johor, Penang, Sarawak, Sabah, etc.). Each object must have:
                    - 'region': The name of the state (string).
                    - 'lat', 'lng': Geographic coordinates (number).
                    - 'positive', 'neutral', 'negative': Sentiment percentages toward this coalition in that state (integer, summing to 100).
                    - 'buzz': A score from 1 to 100 representing conversation volume about this coalition (integer).
                2.  'sentimentOverTime': An object with 'categories' (an array of the last 6 months, e.g., ["Jan", "Feb", ...]) and 'series' (an array of 3 objects for 'Positive', 'Neutral', 'Negative', each with a 'name' and 'data' array of 6 integer percentages).
                3.  'keyTopics': An object with 'labels' (an array of 5 trending topic strings associated with this coalition) and 'series' (an array of 5 corresponding integer values representing their prevalence).
            `;
            return generateJson(prompt);
        }

        async function fetchMarketIntelligenceData(client: Client) {
             const prompt = `
                You are a market intelligence analyst for Malaysia.
                Generate a detailed market intelligence report for the client "${client.name}" in the "${client.industry}" sector.
                The report must be a valid JSON object.
                The JSON object must contain the following keys: 'regionalSentiment', 'sentimentOverTime', 'keyTopics', 'shareOfVoice', 'sentimentComparison', and 'competitorInsights'.

                1.  'regionalSentiment': An array of objects, one for each major Malaysian state (e.g., Selangor, Kuala Lumpur, Johor, Penang, Sarawak, Sabah, etc.). Each object must have:
                    - 'region': The name of the state (string).
                    - 'lat', 'lng': Geographic coordinates (number).
                    - 'positive', 'neutral', 'negative': Sentiment percentages (integer, summing to 100).
                    - 'buzz': A score from 1 to 100 representing conversation volume (integer).
                2.  'sentimentOverTime': An object with 'categories' (an array of the last 6 months, e.g., ["Jan", "Feb", ...]) and 'series' (an array of 3 objects for 'Positive', 'Neutral', 'Negative', each with a 'name' and 'data' array of 6 integer percentages).
                3.  'keyTopics': An object with 'labels' (an array of 5 trending topic strings) and 'series' (an array of 5 corresponding integer values representing their prevalence).
                4.  'shareOfVoice': An object with 'labels' (an array of strings: the client's name and 3 plausible competitor names) and 'series' (an array of 4 corresponding integer percentages that sum to 100).
                5.  'sentimentComparison': An object with 'labels' (same as shareOfVoice labels) and 'series' (an array of 3 objects for 'Positive', 'Neutral', 'Negative', each with 'name' and 'data' array of 4 sentiment scores from 0-100).
                6.  'competitorInsights': A concise paragraph (string) summarizing a key insight about a competitor's recent activities.
            `;
            try {
                return await generateJson(prompt);
            } catch (e) {
                console.error("Failed to parse market intelligence JSON:", e);
                throw e; // Re-throw to be caught by the caller
            }
        }

        /**
         * Initializes the Leaflet map and ApexCharts with API data.
         */
        function initializeMapAndCharts(data: any, type: 'map' | 'insights' = 'map') {
            const theme = document.body.classList.contains('dark') ? 'dark' : 'light';
            
            if (type === 'map') {
                // --- Map Initialization ---
                const mapElement = document.getElementById('mi-map');
                if (mapElement) {
                     if (appState.mapInstance) {
                        appState.mapInstance.remove();
                        appState.mapInstance = null;
                    }
                    appState.mapInstance = L.map('mi-map').setView([4.2105, 101.9758], 6);

                    const tileUrl = theme === 'dark'
                        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

                    L.tileLayer(tileUrl, {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    }).addTo(appState.mapInstance);

                    data.regionalSentiment.forEach((item: any) => {
                        // FIX: Add a check for valid coordinates to prevent Leaflet errors
                        // if the AI returns incomplete data for a region.
                        if (typeof item.lat !== 'number' || typeof item.lng !== 'number') {
                            console.warn(`Skipping map marker for region with invalid coordinates: ${item.region}`);
                            return; // Skip this item
                        }

                        const total = item.positive + item.neutral + item.negative;
                        const overallSentiment = (item.positive / total) - (item.negative / total);
                        let color = 'var(--warning)';
                        if (overallSentiment > 0.2) color = 'var(--success)';
                        if (overallSentiment < -0.2) color = 'var(--danger)';

                        const circle = L.circle([item.lat, item.lng], {
                            color: color,
                            fillColor: color,
                            fillOpacity: 0.6,
                            radius: 25000 + (item.buzz * 500) // Radius based on discussion volume
                        }).addTo(appState.mapInstance);

                        const popupContent = `
                            <div class="map-popup-header">${item.region}</div>
                            <div class="map-popup-body">
                                <p class="positive"><strong>Positive:</strong> ${item.positive}%</p>
                                <p class="neutral"><strong>Neutral:</strong> ${item.neutral}%</p>
                                <p class="negative"><strong>Negative:</strong> ${item.negative}%</p>
                            </div>`;
                        circle.bindPopup(popupContent);
                    });
                }

                // --- Charts Initialization ---
                if (appState.charts['sentiment']) appState.charts['sentiment'].destroy();
                var sentimentOptions = {
                    series: data.sentimentOverTime.series,
                    chart: { type: 'bar', height: 350, stacked: true, toolbar: { show: false } },
                    plotOptions: { bar: { horizontal: false, columnWidth: '55%' }, },
                    xaxis: { categories: data.sentimentOverTime.categories, labels: { style: { colors: 'var(--text-secondary)' } } },
                    yaxis: { labels: { formatter: (val: number) => `${val}%`, style: { colors: 'var(--text-secondary)' } } },
                    dataLabels: { enabled: false },
                    fill: { opacity: 1 }, colors: ['var(--success)', 'var(--warning)', 'var(--danger)'],
                    legend: { position: 'top', horizontalAlign: 'right', labels: { colors: 'var(--text-secondary)' } },
                    grid: { borderColor: 'var(--border-color)' },
                    tooltip: { theme: theme }
                };
                appState.charts['sentiment'] = new ApexCharts(document.querySelector("#mi-sentiment-chart"), sentimentOptions);
                appState.charts['sentiment'].render();

                if (appState.charts['topics']) appState.charts['topics'].destroy();
                var topicsOptions = {
                    series: data.keyTopics.series,
                    chart: { type: 'donut', height: 350 },
                    labels: data.keyTopics.labels,
                    colors: ['var(--chart-color-1)', 'var(--chart-color-2)', 'var(--chart-color-3)', 'var(--chart-color-4)', 'var(--chart-color-5)'],
                    legend: { position: 'bottom', labels: { colors: 'var(--text-secondary)' } },
                    responsive: [{ breakpoint: 480, options: { chart: { width: 200 }, legend: { position: 'bottom' } } }],
                    tooltip: { theme: theme, fillSeriesColor: false }
                };
                appState.charts['topics'] = new ApexCharts(document.querySelector("#mi-topics-chart"), topicsOptions);
                appState.charts['topics'].render();
                
                if (appState.charts['buzz']) appState.charts['buzz'].destroy();
                var buzzOptions = {
                    series: [{ name: 'Buzz Score', data: data.regionalSentiment.map((r: any) => r.buzz) }],
                    chart: { type: 'bar', height: 350, toolbar: { show: false } },
                    plotOptions: { bar: { borderRadius: 4, horizontal: true, } },
                    dataLabels: { enabled: false },
                    xaxis: { categories: data.regionalSentiment.map((r: any) => r.region), labels: { style: { colors: 'var(--text-secondary)' } } },
                    yaxis: { labels: { style: { colors: 'var(--text-secondary)' } } },
                    colors: ['var(--info)'],
                    grid: { borderColor: 'var(--border-color)' },
                    tooltip: { theme: theme }
                };
                appState.charts['buzz'] = new ApexCharts(document.querySelector("#mi-buzz-chart"), buzzOptions);
                appState.charts['buzz'].render();
            } else if (type === 'insights') {
                if (appState.charts['sov']) appState.charts['sov'].destroy();
                var sovOptions = {
                  series: data.shareOfVoice.series,
                  chart: { type: 'pie', height: 350 },
                  labels: data.shareOfVoice.labels,
                  colors: ['var(--primary)', 'var(--chart-color-1)', 'var(--chart-color-2)', 'var(--chart-color-3)'],
                  legend: { position: 'bottom', labels: { colors: 'var(--text-secondary)' } },
                  tooltip: { theme: theme, fillSeriesColor: false },
                  responsive: [{ breakpoint: 480, options: { chart: { width: 200 } } }]
                };
                appState.charts['sov'] = new ApexCharts(document.querySelector("#sov-chart"), sovOptions);
                appState.charts['sov'].render();

                if (appState.charts['sentimentComp']) appState.charts['sentimentComp'].destroy();
                var sentimentCompOptions = {
                    series: data.sentimentComparison.series,
                    chart: { type: 'bar', height: 350, toolbar: { show: false } },
                    plotOptions: { bar: { horizontal: false, columnWidth: '60%', endingShape: 'rounded' }, },
                    dataLabels: { enabled: false },
                    stroke: { show: true, width: 2, colors: ['transparent'] },
                    xaxis: { categories: data.sentimentComparison.labels, labels: { style: { colors: 'var(--text-secondary)' } } },
                    yaxis: { title: { text: 'Sentiment Score', style: { color: 'var(--text-secondary)' } }, labels: { style: { colors: 'var(--text-secondary)' } } },
                    fill: { opacity: 1 },
                    colors: ['var(--success)', 'var(--warning)', 'var(--danger)'],
                    grid: { borderColor: 'var(--border-color)' },
                    tooltip: { y: { formatter: (val: any) => val }, theme: theme },
                    legend: { position: 'top', horizontalAlign: 'right', labels: { colors: 'var(--text-secondary)' } }
                };
                appState.charts['sentimentComp'] = new ApexCharts(document.querySelector("#sentiment-comparison-chart"), sentimentCompOptions);
                appState.charts['sentimentComp'].render();
            }
        }

        /**
         * Renders the Veritas (Content Verification) view.
         */
        function renderVeritasIntegrityView() {
            const container = document.getElementById('veritas-integrity-view');
            if (!container) return;

            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h2>Veritas: Narrative Integrity Shield</h2>
                        <p class="text-secondary">Detect multi-modal disinformation and 'fitnah' before it spreads.</p>
                    </div>
                    <button id="export-vetting-pdf-button" class="btn btn--secondary" style="display: none;">Export as PDF</button>
                </div>
                <div class="veritas-grid">
                    <div class="input-panel">
                         <div class="card">
                            <div class="card__header">
                                <h3>Live Integrity Analysis</h3>
                                <p class="text-secondary">Submit content for real-time AI risk assessment.</p>
                            </div>
                            <div class="card__body">
                                <textarea id="content-verification-input" class="form-textarea" placeholder="Enter content here..."></textarea>
                                <button id="verify-content-button" class="btn btn--primary">Analyze Content</button>
                            </div>
                        </div>
                    </div>
                    <div class="output-panel">
                        <div id="vetting-results-container">
                            <div class="empty-state">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 12 2 2 4-4"></path><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                                <h4>Ready to Analyze</h4>
                                <p>Your content verification results will appear here.</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('verify-content-button')?.addEventListener('click', handleVerifyContent);
            document.getElementById('export-vetting-pdf-button')?.addEventListener('click', () => handleGenericPdfExport(
                'vetting-results-container',
                'export-vetting-pdf-button',
                'Narrative Integrity Report'
            ));
        }
        
        /**
         * Renders the Image Analysis view.
         */
        function renderSignalImageAnalysisView() {
            const container = document.getElementById('signal-image-analysis-view');
            if (!container) return;
            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h2>Signal: Image Analysis</h2>
                        <p class="text-secondary">Analyze brand presence and sentiment in visual media.</p>
                    </div>
                    <button id="export-vi-pdf-button" class="btn btn--secondary" style="display: none;">Export as PDF</button>
                </div>
                <div class="veritas-grid">
                    <div class="input-panel">
                         <div class="card" id="vi-input-panel">
                            <div class="card__header">
                                <h3>Image Upload & Analysis</h3>
                                <p class="text-secondary">Upload an image to identify objects and assess context.</p>
                            </div>
                            <div class="card__body">
                                <div id="image-upload-dropzone" class="image-dropzone">
                                    <input type="file" id="image-upload-input" accept="image/*" class="image-dropzone-input" style="display: none;">
                                    <div class="image-dropzone-prompt">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                        <p><strong>Drag & drop an image here</strong></p>
                                        <p class="text-secondary">or click to browse</p>
                                    </div>
                                </div>
                                <div id="image-preview-container" class="image-preview hidden">
                                    <img id="image-preview-element" src="#" alt="Image preview" />
                                    <button id="image-remove-button" class="btn btn--icon image-preview__remove-btn" aria-label="Remove image">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>
                                <textarea id="image-analysis-prompt-input" class="form-textarea" placeholder="Optional: Add a specific prompt, e.g., 'Describe the emotions in this image' or 'Identify potential brand risks'"></textarea>
                                <button id="analyze-image-button" class="btn btn--primary" disabled>Analyze Image</button>
                            </div>
                        </div>
                    </div>
                    <div class="output-panel">
                        <div id="image-analysis-results-container">
                            <div class="empty-state">
                                 <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                <h4>Awaiting Image</h4>
                                <p>Upload an image to begin analysis. Results will be displayed here.</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // --- Image Upload Listeners ---
            const dropzone = document.getElementById('image-upload-dropzone');
            const fileInput = document.getElementById('image-upload-input') as HTMLInputElement;
            const previewContainer = document.getElementById('image-preview-container');
            const previewElement = document.getElementById('image-preview-element') as HTMLImageElement;
            const removeButton = document.getElementById('image-remove-button');
            const analyzeButton = document.getElementById('analyze-image-button') as HTMLButtonElement;

            const handleFile = (file: File) => {
                if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const base64String = (e.target?.result as string).split(',')[1];
                        const imageUrl = e.target?.result as string;
                        appState.uploadedImageData = {
                            mimeType: file.type,
                            data: base64String,
                            url: imageUrl,
                        };

                        if (dropzone && previewContainer && previewElement) {
                            previewElement.src = imageUrl;
                            dropzone.classList.add('hidden');
                            previewContainer.classList.remove('hidden');
                            analyzeButton.disabled = false;
                        }
                    };
                    reader.readAsDataURL(file);
                }
            };

            dropzone?.addEventListener('click', () => fileInput.click());
            dropzone?.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.classList.add('dragover');
            });
            dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
            dropzone?.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
                if (e.dataTransfer?.files.length) {
                    handleFile(e.dataTransfer.files[0]);
                }
            });
            fileInput.addEventListener('change', () => {
                if (fileInput.files?.length) {
                    handleFile(fileInput.files[0]);
                }
            });
            removeButton?.addEventListener('click', () => {
                if (dropzone && previewContainer) {
                    appState.uploadedImageData = null;
                    fileInput.value = ''; // Reset file input
                    previewContainer.classList.add('hidden');
                    dropzone.classList.remove('hidden');
                    analyzeButton.disabled = true;
                }
            });

            analyzeButton?.addEventListener('click', handleImageAnalysis);
            document.getElementById('export-vi-pdf-button')?.addEventListener('click', () => handleGenericPdfExport(
                'image-analysis-results-container',
                'export-vi-pdf-button',
                'Visual Intelligence Report'
            ));
        }
        
        /**
         * Renders the Veritas Propagation Map view.
         */
        function renderVeritasPropagationView() {
            const container = document.getElementById('veritas-propagation-view');
            if (!container) return;

            // Check for cached data first
            const cacheKey = `${appState.currentClientId}-veritasPropagation`;
            const cachedData = appState.cache[cacheKey];

            if (!cachedData && !appState.latestVerificationResult) {
                container.innerHTML = `<div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M12 10v0"></path><path d="m14.5 9.5-5 5"></path><path d="m9.5 9.5 5 5"></path></svg>
                    <h3>No Data to Map</h3>
                    <p>Please analyze some content in the 'Narrative Integrity' view first. The propagation map will be generated based on the latest analysis.</p>
                    <button id="vp-go-to-integrity-btn" class="btn btn--primary">Go to Integrity Analysis</button>
                </div>`;
                document.getElementById('vp-go-to-integrity-btn')?.addEventListener('click', () => {
                    switchView('veritas-integrity-view');
                });
                return;
            }
            
            const data = cachedData || appState.latestVerificationResult.propagation;

            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h2>Veritas: Narrative Propagation Map</h2>
                        <p class="text-secondary">Visualize the predicted spread of the analyzed narrative.</p>
                    </div>
                     <button id="export-prop-pdf-button" class="btn btn--secondary">Export as PDF</button>
                </div>
                <div class="propagation-grid" id="prop-dashboard-export-content">
                    <div class="card">
                         <div class="card__header">
                            <h3>Propagation Metrics</h3>
                            <p class="text-secondary">Key indicators of narrative spread.</p>
                        </div>
                        <div class="card__body">
                            <div class="propagation-metric">
                                <span class="propagation-metric__label">Virality Score</span>
                                <span class="propagation-metric__value">${data.viralityScore}/100</span>
                            </div>
                            <div class="propagation-metric">
                                <span class="propagation-metric__label">Reach Estimate</span>
                                <span class="propagation-metric__value">${data.reachEstimate.toLocaleString()}</span>
                            </div>
                            <div class="propagation-metric">
                                <span class="propagation-metric__label">Key Amplifier</span>
                                <span class="propagation-metric__value">${data.keyAmplifier}</span>
                            </div>
                            <div class="propagation-metric">
                                <span class="propagation-metric__label">Predicted Timescale</span>
                                <span class="propagation-metric__value">${data.timescale}</span>
                            </div>
                        </div>
                    </div>
                    <div class="propagation-map-container">
                        <svg class="propagation-svg">
                            <defs>
                                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="8.5" refY="3.5" orient="auto">
                                    <polygon points="0 0, 10 3.5, 0 7" />
                                </marker>
                            </defs>
                            <line id="line-source-amplifier" stroke-width="2" marker-end="url(#arrowhead)"></line>
                            <line id="line-amplifier-bot" stroke-width="2" marker-end="url(#arrowhead)"></line>
                            <line id="line-amplifier-media" stroke-width="2" marker-end="url(#arrowhead)"></line>
                            <line id="line-bot-public" stroke-width="2" marker-end="url(#arrowhead)"></line>
                        </svg>

                        <div id="node-source" class="propagation-node propagation-node--source" style="top: 45%; left: 2rem;">
                            <div class="propagation-node__icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg></div>
                            <div class="propagation-node__text"><div class="propagation-node__title">Original Source</div><div class="propagation-node__subtitle">Disinfo Actor</div></div>
                        </div>
                        <div id="node-amplifier" class="propagation-node propagation-node--amplifier" style="top: 20%; left: 35%;">
                             <div class="propagation-node__icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.9 16.1C1 12.2 1 5.8 4.9 1.9"/><path d="M7.8 13.2a6.5 6.5 0 0 0 0-9.2"/><path d="M10.6 10.4c.9-.9.9-2.5 0-3.4s-2.5-.9-3.4 0"/><path d="m16.2 4.8 4.9-4.9"/><path d="m19.1 8.7 2.1-2.1"/><path d="m13.4 1.9-2.1 2.1"/></svg></div>
                            <div class="propagation-node__text"><div class="propagation-node__title">Amplifier</div><div class="propagation-node__subtitle">Influencer/Group</div></div>
                        </div>
                        <div id="node-bot" class="propagation-node propagation-node--botnet" style="top: 45%; left: 50%;">
                             <div class="propagation-node__icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg></div>
                            <div class="propagation-node__text"><div class="propagation-node__title">Bot Network</div><div class="propagation-node__subtitle">Automated Spread</div></div>
                        </div>
                        <div id="node-media" class="propagation-node propagation-node--media" style="top: 70%; left: 35%;">
                             <div class="propagation-node__icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg></div>
                            <div class="propagation-node__text"><div class="propagation-node__title">Media Outlets</div><div class="propagation-node__subtitle">News/Blogs</div></div>
                        </div>
                        <div id="node-public" class="propagation-node propagation-node--public" style="top: 45%; right: 2rem;">
                             <div class="propagation-node__icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
                            <div class="propagation-node__text"><div class="propagation-node__title">General Public</div><div class="propagation-node__subtitle">Social Media Users</div></div>
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('export-prop-pdf-button')?.addEventListener('click', () => handleGenericPdfExport(
                'prop-dashboard-export-content',
                'export-prop-pdf-button',
                'Narrative Propagation Report'
            ));
            
            requestAnimationFrame(() => {
                updatePropagationLines();
            });
        }
        
        /**
         * Renders the Client Management view.
         */
        function renderClientsView() {
            const container = document.getElementById('clients-view');
            if (!container) return;

            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h2>Client Management</h2>
                        <p class="text-secondary">Manage your portfolio of clients.</p>
                    </div>
                    <div class="view-header__search">
                        <svg class="view-header__search-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <input type="search" id="client-search-input" class="form-input" placeholder="Search by name or industry...">
                    </div>
                </div>
                <div class="clients-grid" id="clients-grid-container">
                    <!-- Client cards will be rendered here -->
                </div>
            `;
            
            const searchInput = document.getElementById('client-search-input') as HTMLInputElement;
            const gridContainer = document.getElementById('clients-grid-container');

            const updateClientList = (filter: string) => {
                if (!gridContainer) return;

                const searchTerm = filter.trim().toLowerCase();
                const filteredClients = appState.clients.filter(client =>
                    client.name.toLowerCase().includes(searchTerm) ||
                    client.industry.toLowerCase().includes(searchTerm)
                );
                
                if (filteredClients.length > 0) {
                    const clientsHtml = filteredClients.map(client => {
                        const logoContent = client.logoUrl 
                            ? `<img src="${client.logoUrl}" alt="${client.name} logo">`
                            : getInitials(client.name);

                        return `
                        <div class="card client-card">
                            <div class="client-card__header">
                                <div class="client-card__logo">${logoContent}</div>
                                <div>
                                    <div class="client-card__name">${client.name}</div>
                                    <div class="client-card__industry">${client.industry}</div>
                                </div>
                            </div>
                            <div class="client-card__actions">
                                <button class="btn btn--icon client-card__edit-btn" data-client-id="${client.id}" aria-label="Edit client">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                                </button>
                                <button class="btn btn--icon client-card__delete-btn" data-client-id="${client.id}" aria-label="Delete client">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                </button>
                            </div>
                        </div>
                    `}).join('');
                     gridContainer.innerHTML = clientsHtml + `
                        <div class="card client-card--add" id="add-client-button">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            <span>Add New Client</span>
                        </div>
                    `;
                } else if (searchTerm) {
                    gridContainer.innerHTML = `<div class="no-clients-found">
                        <h4>No Results Found</h4>
                        <p>Your search for "${filter}" did not match any clients.</p>
                    </div>`;
                } else { // No search term, and no clients exist
                     gridContainer.innerHTML = `
                        <div class="card client-card--add" id="add-client-button">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            <span>Add New Client</span>
                        </div>
                    `;
                }
                
                // Re-attach all event listeners
                document.getElementById('add-client-button')?.addEventListener('click', () => {
                     document.getElementById('add-client-modal-overlay')?.classList.add('visible');
                });
                
                document.querySelectorAll('.client-card__delete-btn').forEach(button => {
                    button.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const clientId = (e.currentTarget as HTMLElement).dataset.clientId;
                        if (clientId) {
                            showConfirmationModal('Are you sure you want to delete this client?', () => {
                                handleDeleteClient(clientId);
                            });
                        }
                    });
                });

                document.querySelectorAll('.client-card__edit-btn').forEach(button => {
                    button.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const clientId = (e.currentTarget as HTMLElement).dataset.clientId;
                        const clientToEdit = appState.clients.find(c => c.id === clientId);
                        if (clientToEdit) {
                            showEditClientModal(clientToEdit);
                        }
                    });
                });
            };

            updateClientList(''); // Initial render

            searchInput?.addEventListener('input', (e) => {
                updateClientList((e.target as HTMLInputElement).value);
            });
        }

        // --- NEW MODULE RENDER FUNCTIONS ---
        // --- LIVE INTEL FEED (real articles from /api/feed, pulled via /api/pull) ---
        const escapeHtml = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

        const INTEL_SECTORS = ['Banking & Finance', 'Energy & Utilities', 'Plantation & Agriculture', 'Technology & Digital',
            'Telecom & Media', 'Property & Construction', 'Manufacturing & Trade', 'Healthcare', 'Education',
            'Transport & Logistics', 'Retail & Consumer', 'Tourism & Hospitality', 'Environment & Climate',
            'Politics & Government', 'Other'];
        const INTEL_PARTIES: { [key: string]: string } = { BN: 'BN', PH: 'PH', PN: 'PN', GPS: 'GPS (Sarawak)', GRS: 'GRS (Sabah)', Other: 'Other political' };
        const AUTO_PULL_STALE_SECONDS = 600; // pull on open if data is older than 10 minutes
        const FEED_POLL_MS = 60000;          // re-check every minute while the page is open (only when Auto-refresh is on)

        // Manual by default: nothing pulls in the background unless the user switches Auto-refresh on.
        // The choice is remembered in this browser.
        function autoPullOn(): boolean { try { return localStorage.getItem('autoPull') === '1'; } catch { return false; } }
        function setAutoPull(on: boolean) { try { localStorage.setItem('autoPull', on ? '1' : '0'); } catch { /* storage unavailable: stays manual */ } }
        function autoToggleHtml(): string {
            return `<label class="auto-toggle" title="Off: news updates only when you click Pull latest. On: the page pulls by itself when data is stale."><input type="checkbox" id="auto-pull-toggle" ${autoPullOn() ? 'checked' : ''}> Auto-refresh</label>`;
        }

        function timeAgo(unixSeconds: number): string {
            const diff = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
            if (diff < 60) return 'just now';
            if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
            if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
            return `${Math.floor(diff / 86400)} d ago`;
        }

        const feedFilters = { sector: '', party: '', sentiment: '', audience: '' };
        let feedChannel: 'news' | 'social' = 'news';

        /** Asks the backend to fetch + tag new articles. Returns the API response (or null on failure). */
        async function pullLatestNews(): Promise<any> {
            try {
                const res = await apiFetch('/api/pull', { method: 'POST' });
                return await res.json();
            } catch (e) {
                console.error('Pull failed', e);
                return null;
            }
        }

        /** Asks the backend to collect YouTube comments / Reddit posts (whichever are configured). */
        async function pullSocialNow(): Promise<any> {
            try {
                return await (await apiFetch('/api/pull-social', { method: 'POST' })).json();
            } catch (e) {
                console.error('Social pull failed', e);
                return null;
            }
        }

        const SOCIAL_LABELS: { [key: string]: string } = { youtube: 'YouTube', reddit: 'Reddit' };

        async function loadSocialFeed() {
            const list = document.getElementById('intel-feed-list');
            const status = document.getElementById('intel-feed-status');
            if (!list || !status) return null;
            const qs = new URLSearchParams({ limit: '60' });
            (Object.keys(feedFilters) as (keyof typeof feedFilters)[]).forEach(k => { if (feedFilters[k]) qs.set(k, feedFilters[k]); });
            try {
                const res = await apiFetch(`/api/social?${qs}`);
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                const cfg = data.configured || {};
                if (!cfg.youtube && !cfg.reddit) {
                    list.innerHTML = `<div class="card"><div class="card__body">
                        <h3>Social sources are not switched on yet</h3>
                        <p>This view collects public YouTube comments and Reddit posts through their official APIs. An administrator needs to add the API credentials to the project first.</p>
                        <p class="text-secondary">Until then the platform covers online news only.</p></div></div>`;
                    status.textContent = 'Social: not configured';
                    return data;
                }
                if (!data.items.length) {
                    list.innerHTML = `<div class="empty-state"><p>No social posts${data.total ? ' match these filters' : ' yet'}. ${data.total ? '' : 'Click <strong>Pull latest</strong> to collect them.'}</p></div>`;
                } else {
                    list.innerHTML = data.items.map((it: any) => `
                        <div class="card signal-mention-card">
                            <div class="mention-card__header"><div>
                                <div class="mention-card__source"><span class="trend-badge trend-badge--stable">${escapeHtml(SOCIAL_LABELS[it.channel] || it.channel)}</span> ${escapeHtml(it.label || '')}</div>
                                <div class="mention-card__timestamp">${timeAgo(it.publishedAt)}${it.score ? ` · ${it.score} ${it.channel === 'youtube' ? 'likes' : 'upvotes'}` : ''}</div>
                            </div></div>
                            <p class="mention-card__content"><a href="${escapeHtml(it.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(it.text)}</a></p>
                            <div class="mention-card__footer">
                                ${it.sentiment ? `<div class="sentiment-tag sentiment-tag--${escapeHtml(it.sentiment.toLowerCase())}">${escapeHtml(it.sentiment)}</div>` : '<div class="sentiment-tag">Untagged</div>'}
                                <div class="mention-card__author">${escapeHtml([it.sector, it.party && it.party !== 'None' ? it.party : '', it.audience].filter(Boolean).join(' · '))}</div>
                            </div>
                        </div>`).join('');
                }
                status.textContent = `${data.total} social posts stored (kept ${data.retentionDays} days)${data.lastPull ? ` · last pulled ${timeAgo(data.lastPull)}` : ''}`;
                return data;
            } catch (e: any) {
                list.innerHTML = `<div class="empty-state"><p class="error-message">Could not load social posts: ${escapeHtml(e.message)}</p></div>`;
                return null;
            }
        }

        async function loadFeed() {
            if (feedChannel === 'social') return loadSocialFeed();
            const list = document.getElementById('intel-feed-list');
            const status = document.getElementById('intel-feed-status');
            if (!list || !status) return null;
            const qs = new URLSearchParams({ limit: '60' });
            (Object.keys(feedFilters) as (keyof typeof feedFilters)[]).forEach(k => { if (feedFilters[k]) qs.set(k, feedFilters[k]); });
            try {
                const res = await apiFetch(`/api/feed?${qs}`);
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                if (!data.items.length) {
                    list.innerHTML = `<div class="empty-state"><p>No articles${data.total ? ' match these filters' : ' yet'}. ${data.total ? '' : 'Click <strong>Pull latest</strong> to fetch Malaysian news.'}</p></div>`;
                } else {
                    list.innerHTML = data.items.map((it: any) => `
                        <div class="card signal-mention-card">
                            <div class="mention-card__header">
                                <div>
                                    <div class="mention-card__source">${escapeHtml(it.source)}</div>
                                    <div class="mention-card__timestamp">${timeAgo(it.publishedAt)}</div>
                                </div>
                            </div>
                            <p class="mention-card__content"><a href="${escapeHtml(it.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(it.title)}</a></p>
                            <div class="mention-card__footer">
                                ${it.sentiment ? `<div class="sentiment-tag sentiment-tag--${escapeHtml(it.sentiment.toLowerCase())}">${escapeHtml(it.sentiment)}</div>` : '<div class="sentiment-tag">Untagged</div>'}
                                <div class="mention-card__author">${escapeHtml([it.sector, it.party && it.party !== 'None' ? it.party : '', it.audience].filter(Boolean).join(' · '))}</div>
                            </div>
                        </div>`).join('');
                }
                status.textContent = data.lastPull
                    ? `${data.total} articles stored · last pulled ${timeAgo(data.lastPull)}`
                    : 'No pulls yet';
                return data;
            } catch (e: any) {
                list.innerHTML = `<div class="empty-state"><p class="error-message">Could not load the feed: ${escapeHtml(e.message)}</p></div>`;
                return null;
            }
        }

        async function pullAndReload(button?: HTMLButtonElement | null) {
            if (button) { button.disabled = true; button.textContent = 'Pulling…'; }
            const r = feedChannel === 'social' ? await pullSocialNow() : await pullLatestNews();
            const status = document.getElementById('intel-feed-status');
            if (status) {
                if (!r || r.error) status.textContent = `Pull failed: ${r?.error || 'network error'}`;
                else if (r.skipped) status.textContent = `Pulled recently — next pull available in ${r.nextPullInSeconds}s`;
            }
            const data = await loadFeed();
            if (status && r && r.ok && feedChannel === 'news') {
                status.textContent = `${r.newItems} new article${r.newItems === 1 ? '' : 's'} · ${data?.total ?? ''} stored`
                    + (r.failedFeeds ? ` · ${r.failedFeeds} source${r.failedFeeds === 1 ? '' : 's'} unavailable` : '');
            }
            if (button) { button.disabled = false; button.textContent = 'Pull latest'; }
        }

        function renderSignalFeedView() {
            const container = document.getElementById('signal-feed-view');
            if (!container) return;
            const opt = (items: string[], label: string) => `<option value="">${label}</option>` + items.map(i => `<option value="${escapeHtml(i)}">${escapeHtml(i)}</option>`).join('');
            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h2>Signal: Live Malaysia Feed</h2>
                        <p class="text-secondary">Real news across Malaysian sectors and party politics, AI-tagged for sector, coalition and sentiment.</p>
                        <p class="text-secondary" id="intel-feed-status">Loading…</p>
                    </div>
                    <div class="header-actions">
                        ${autoToggleHtml()}
                        <button id="intel-pull-button" class="btn btn--primary">Pull latest</button>
                    </div>
                </div>
                <div class="toggle-group" style="margin-bottom:1rem;" id="feed-channel-toggle">
                    <button class="toggle-btn active" data-channel="news" type="button">News</button>
                    <button class="toggle-btn" data-channel="social" type="button">Social (YouTube &amp; Reddit)</button>
                </div>
                <div class="form-group" style="display:flex; gap:0.75rem; flex-wrap:wrap; margin-bottom:1rem;">
                    <select id="feed-filter-sector" class="form-select" style="max-width:260px;">${opt(INTEL_SECTORS, 'All sectors')}</select>
                    <select id="feed-filter-party" class="form-select" style="max-width:220px;">
                        <option value="">All parties</option>
                        ${Object.keys(INTEL_PARTIES).map(k => `<option value="${k}">${INTEL_PARTIES[k]}</option>`).join('')}
                    </select>
                    <select id="feed-filter-sentiment" class="form-select" style="max-width:200px;">${opt(['Positive', 'Neutral', 'Negative'], 'Any sentiment')}</select>
                    <select id="feed-filter-audience" class="form-select" style="max-width:240px;">${opt(INTEL_AUDIENCES, 'All stakeholder audiences')}</select>
                </div>
                <div class="signal-feed-column" id="intel-feed-list"></div>
            `;

            (['sector', 'party', 'sentiment', 'audience'] as const).forEach(k => {
                const el = document.getElementById(`feed-filter-${k}`) as HTMLSelectElement;
                el.value = feedFilters[k];
                el.addEventListener('change', () => { feedFilters[k] = el.value; loadFeed(); });
            });
            const pullBtn = document.getElementById('intel-pull-button') as HTMLButtonElement;
            pullBtn.addEventListener('click', () => pullAndReload(pullBtn));
            document.querySelectorAll('#feed-channel-toggle .toggle-btn').forEach(b => {
                b.classList.toggle('active', (b as HTMLElement).dataset.channel === feedChannel);
                b.addEventListener('click', () => {
                    feedChannel = (b as HTMLElement).dataset.channel === 'social' ? 'social' : 'news';
                    document.querySelectorAll('#feed-channel-toggle .toggle-btn').forEach(x => x.classList.toggle('active', x === b));
                    loadFeed();
                });
            });

            // Always show what is stored. Pulling is manual unless Auto-refresh is switched on.
            const startFeedAuto = () => {
                if (appState.signalFeedIntervalId) clearInterval(appState.signalFeedIntervalId);
                appState.signalFeedIntervalId = setInterval(async () => {
                    const view = document.getElementById('signal-feed-view');
                    if (!view || view.classList.contains('view-hidden') || document.hidden) return;
                    const data = await loadFeed();
                    if (data && data.lastPull && (Date.now() / 1000 - data.lastPull) > AUTO_PULL_STALE_SECONDS) pullAndReload(pullBtn);
                }, FEED_POLL_MS);
            };
            const stopFeedAuto = () => {
                if (appState.signalFeedIntervalId) clearInterval(appState.signalFeedIntervalId);
                appState.signalFeedIntervalId = null;
            };
            loadFeed().then(data => {
                if (!autoPullOn()) return;
                const stale = !data || !data.lastPull || (Date.now() / 1000 - data.lastPull) > AUTO_PULL_STALE_SECONDS;
                if (stale) pullAndReload(pullBtn);
            });
            stopFeedAuto();
            if (autoPullOn()) startFeedAuto();
            document.getElementById('auto-pull-toggle')?.addEventListener('change', (e) => {
                const on = (e.target as HTMLInputElement).checked;
                setAutoPull(on);
                if (on) { startFeedAuto(); loadFeed().then(d => { if (d && (!d.lastPull || (Date.now() / 1000 - d.lastPull) > AUTO_PULL_STALE_SECONDS)) pullAndReload(pullBtn); }); }
                else stopFeedAuto();
            });
        }



        async function renderNexusForecasterView() {
            const container = document.getElementById('nexus-forecaster-view');
            if (!container) return;
            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h2>Nexus: Policy & Stakeholder Forecaster</h2>
                        <p class="text-secondary">Monitor legislative affairs and predict policy impact with AI/ML.</p>
                    </div>
                </div>
                <div class="nexus-grid">
                    <div class="card">
                        <div class="card__header"><div class="card__header-main"><h3>Tracked Policies</h3><p class="text-secondary">Live updates from Parliament</p></div></div>
                        <div id="nexus-policy-list" class="card__body" style="padding: 0;"></div>
                    </div>
                    <div class="card" id="nexus-impact-panel-container">
                        <div class="card__body" id="nexus-impact-panel">
                             <div class="empty-state">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                                <h4>No Policy Selected</h4>
                                <p>Select a policy from the list to view the AI-generated impact analysis and stakeholder map.</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            const policyListContainer = document.getElementById('nexus-policy-list');
            if (!policyListContainer) return;
            
            // This would come from a live government API feed in a real product.
            const policies = fetchPolicies();
            
            policyListContainer.innerHTML = policies.map((p:any) => `
                <div class="policy-item" data-policy-id="${p.id}">
                    <div class="policy-item__info">
                        <h4>${p.name}</h4>
                        <p>Status: ${p.status} | Last Update: ${p.lastUpdate}</p>
                    </div>
                    <div class="policy-status policy-status--${p.status.toLowerCase()}">${p.status}</div>
                </div>
            `).join('');

            document.querySelectorAll('.policy-item').forEach(item => {
                item.addEventListener('click', () => {
                    const policyId = (item as HTMLElement).dataset.policyId;
                    renderNexusImpactAnalysis(policies.find((p: any) => p.id === policyId));
                     document.querySelectorAll('.policy-item').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                });
            });
        }
        
        function fetchPolicies() {
            // In a production app, this would fetch from a live data source (e.g., a government API or a web scraper).
            // For now, it returns a static but representative list.
            return [
                { id: 'policy-01', name: 'National Cybersecurity Bill 2024', status: 'Debating', lastUpdate: '2024-07-15', details: 'A bill to strengthen national cybersecurity frameworks and enforcement.' },
                { id: 'policy-02', name: 'Renewable Energy Transition Roadmap', status: 'Passed', lastUpdate: '2024-06-28', details: 'A national plan to increase the share of renewable energy in the power grid to 40% by 2035.' },
                { id: 'policy-03', name: 'Digital Economy Blueprint Phase 2', status: 'Proposed', lastUpdate: '2024-07-22', details: 'A proposal to accelerate digital adoption in SMEs and rural areas.' },
            ];
        }

        async function renderNexusImpactAnalysis(policy: any) {
            const container = document.getElementById('nexus-impact-panel');
            if (!container) return;

            const cacheKey = `nexus-impact-${policy.id}`;
            if (appState.cache[cacheKey]) {
                container.innerHTML = appState.cache[cacheKey];
                return;
            }

            container.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>Generating AI impact analysis for ${policy.name}...</p></div>`;
            try {
                const prompt = `
                    Analyze the potential impact of the following Malaysian policy:
                    Name: "${policy.name}"
                    Details: "${policy.details}"
                    Provide your analysis as a single valid JSON object with three keys:
                    1. "impactScore": An integer from 1 to 10 representing the overall societal and economic impact.
                    2. "summary": A concise paragraph summarizing the key implications of this policy.
                    3. "stakeholders": A short paragraph listing the primary groups that will be most affected by this policy.
                `;

                const analysis = await generateJson(prompt);
                
                const impactColorClass = analysis.impactScore > 7
                    ? 'impact-score__value--high'
                    : analysis.impactScore > 4 ? 'impact-score__value--medium' : 'impact-score__value--low';
                
                const contentHtml = `
                    <div class="card__header">
                        <h3>Impact Analysis: ${policy.name}</h3>
                    </div>
                    <div class="card__body">
                        <div class="impact-score">
                            <div class="impact-score__value ${impactColorClass}">${analysis.impactScore}/10</div>
                            <p class="text-secondary">Predicted Impact Score</p>
                        </div>
                        <div class="impact-summary">
                            <h4>Key Summary</h4>
                            <p>${analysis.summary}</p>
                        </div>
                        <div class="impact-summary">
                            <h4>Affected Stakeholders</h4>
                            <p>${analysis.stakeholders}</p>
                        </div>
                    </div>
                `;
                container.innerHTML = contentHtml;
                appState.cache[cacheKey] = contentHtml;
            } catch (e) {
                 container.innerHTML = `<div class="empty-state"><p class="error-message">Could not generate analysis.</p></div>`;
            }
        }

        function renderAegisReputationView() {
            const container = document.getElementById('aegis-reputation-view');
            if (!container) return;

            if (!appState.currentClient) {
                 container.innerHTML = `<div class="empty-state">
                    <h3>No Client Selected</h3>
                    <p>Please select a client to view the Aegis dashboard.</p>
                </div>`;
                return;
            }
            
            // In a real app, this would be a complex, AI-driven score.
            // For the demo, we'll keep the visual generation but the logic is now AI-first.
            const score = 82; 
            const circumference = 2 * Math.PI * 90;
            const offset = circumference - (score / 100) * circumference;

            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h2>Aegis: Reputation Command & Crisis AI</h2>
                        <p class="text-secondary">Predictive reputation scoring and AI-powered crisis simulation.</p>
                    </div>
                </div>
                <div class="aegis-grid">
                    <div class="card">
                        <div class="card__header"><h3>Brand Maruah Score</h3></div>
                        <div class="card__body">
                             <div class="maruah-score-dial">
                                 <svg viewBox="0 0 200 100">
                                    <path d="M 10 100 A 90 90 0 0 1 190 100" stroke="var(--surface-light)" stroke-width="20" fill="none" />
                                    <path d="M 10 100 A 90 90 0 0 1 190 100" stroke="var(--success)" stroke-width="20" fill="none" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round" />
                                </svg>
                                <div class="maruah-score-text">
                                    <div class="maruah-score-value">${score}</div>
                                    <div class="maruah-score-label">Excellent</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card__header"><h3>Reputation Factors</h3></div>
                        <div class="card__body">
                            <div class="propagation-metric"><span class="propagation-metric__label">Media Sentiment</span><span class="propagation-metric__value">Positive</span></div>
                            <div class="propagation-metric"><span class="propagation-metric__label">Social Media Tone</span><span class="propagation-metric__value">Positive</span></div>
                            <div class="propagation-metric"><span class="propagation-metric__label">Stakeholder Trust</span><span class="propagation-metric__value">High</span></div>
                        </div>
                    </div>
                    <div class="card">
                         <div class="card__header"><h3>Crisis Simulation</h3></div>
                         <div class="card__body">
                            <div class="crisis-sim-actions">
                                <select id="crisis-scenario-select" class="form-select">
                                    <option>Select a scenario...</option>
                                    <option value="Product recall">Product Recall</option>
                                    <option value="Negative media coverage">Negative Media Coverage</option>
                                    <option value="Data breach">Data Breach</option>
                                </select>
                                <button id="run-sim-button" class="btn btn--primary">Run Sim</button>
                            </div>
                            <div id="crisis-sim-output-container" class="crisis-sim-output">
                                <h5>AI Recommended First Response:</h5>
                                <p>Select a scenario to generate a response plan.</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            document.getElementById('run-sim-button')?.addEventListener('click', handleCrisisSim);
        }
        
        async function handleCrisisSim() {
            const scenario = (document.getElementById('crisis-scenario-select') as HTMLSelectElement).value;
            const outputContainer = document.getElementById('crisis-sim-output-container');
            if (!scenario || !outputContainer || !appState.currentClient) return;

            outputContainer.innerHTML = `<div class="spinner"></div><p>Generating response for ${appState.currentClient.name}...</p>`;
            try {
                const prompt = `
                    You are a crisis communications expert in Malaysia.
                    For the client "${appState.currentClient.name}", generate a concise, actionable first response plan for the following crisis scenario: "${scenario}".
                    The response should be a single, detailed paragraph.
                    Return a single valid JSON object with one key: "responsePlan".
                `;
                const result = await generateJson(prompt);

                outputContainer.innerHTML = `
                    <h5>AI Recommended First Response for "${scenario}":</h5>
                    <p>${result.responsePlan}</p>
                `;
            } catch (e) {
                outputContainer.innerHTML = `<p class="error-message">Could not generate simulation response.</p>`;
            }
        }


        function renderAmplifyCommsView() {
            const container = document.getElementById('amplify-comms-view');
            if (!container) return;
            container.innerHTML = `
                 <div class="view-header">
                    <div>
                        <h2>Amplify: Strategic Influence & Comms Suite</h2>
                        <p class="text-secondary">AI-driven audience segmentation and content generation.</p>
                    </div>
                </div>
                <div class="amplify-grid">
                    <div class="card">
                         <div class="card__header"><h3>Audience Segmentation</h3></div>
                         <div class="card__body">
                            <div class="audience-segments">
                                <button class="segment-tab active" data-segment="urban_millennials">Urban Millennials</button>
                                <button class="segment-tab" data-segment="suburban_families">Suburban Families</button>
                                <button class="segment-tab" data-segment="digital_natives">Digital Natives</button>
                            </div>
                            <div id="segment-details-container" class="segment-details"></div>
                        </div>
                    </div>
                     <div class="card">
                         <div class="card__header"><h3>Key Opinion Leaders (KOLs)</h3></div>
                         <div class="card__body kol-list">
                            <div class="kol-item"><img src="https://i.pravatar.cc/40?u=kol1" class="kol-avatar" alt="KOL Avatar"><div class="kol-info"><h5>Aina Abdul</h5><p>Tech & Lifestyle Influencer</p></div></div>
                            <div class="kol-item"><img src="https://i.pravatar.cc/40?u=kol2" class="kol-avatar" alt="KOL Avatar"><div class="kol-info"><h5>Ben Ibrahim</h5><p>Financial News Journalist</p></div></div>
                            <div class="kol-item"><img src="https://i.pravatar.cc/40?u=kol3" class="kol-avatar" alt="KOL Avatar"><div class="kol-info"><h5>Dr. Malek Hassan</h5><p>Policy Analyst</p></div></div>
                        </div>
                    </div>
                     <div class="card">
                         <div class="card__header"><h3>AI Content Engine</h3></div>
                         <div class="card__body">
                            <div class="form-group">
                                <label for="content-angle-select">Select Content Angle</label>
                                <select id="content-angle-select" class="form-select">
                                    <option value="innovation">Highlight Innovation</option>
                                    <option value="community">Focus on Community</option>
                                    <option value="sustainability">Emphasize Sustainability</option>
                                </select>
                            </div>
                            <button id="generate-content-button" class="btn btn--primary">Generate Content Ideas</button>
                            <div id="content-ideas-container" class="content-engine-grid" style="margin-top: 1.5rem; opacity: 0;">
                                <!-- content generated here -->
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.querySelectorAll('.segment-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    document.querySelectorAll('.segment-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    const segmentId = (tab as HTMLElement).dataset.segment;
                    updateSegmentDetails(segmentId!);
                });
            });

            document.getElementById('generate-content-button')?.addEventListener('click', handleGenerateContent);
            updateSegmentDetails('urban_millennials'); // Initial load
        }
        
        function updateSegmentDetails(segmentId: string) {
            const container = document.getElementById('segment-details-container');
            if (!container) return;
            // This data is static as it represents stable audience personas.
            const details = {
                urban_millennials: {
                    title: "Urban Millennials",
                    description: "Ages 25-40, living in major cities like KL and Penang. Highly connected, value authenticity and social responsibility. Primarily reached through Instagram, TikTok, and digital news portals."
                },
                suburban_families: {
                    title: "Suburban Families",
                    description: "Ages 35-55, with children, living in suburban areas. Value-conscious, prioritize safety and reliability. Reached through Facebook, community forums, and trusted news sources."
                },
                digital_natives: {
                    title: "Digital Natives",
                    description: "Ages 18-24, students or early in their careers. Trend-focused, highly visual, and prefer short-form content. Primarily on TikTok, X (Twitter), and YouTube."
                }
            };
            const detail = details[segmentId as keyof typeof details];
            container.innerHTML = `<h4>About: ${detail.title}</h4><p>${detail.description}</p>`;
        }
        
        async function handleGenerateContent() {
            const angle = (document.getElementById('content-angle-select') as HTMLSelectElement).value;
            const container = document.getElementById('content-ideas-container');
            if (!angle || !container || !appState.currentClient) return;

            container.style.opacity = '1';
            container.innerHTML = `<div class="spinner"></div>`;

            try {
                const prompt = `
                    You are a public relations content strategist. For the client "${appState.currentClient.name}", generate content ideas based on the angle: "${angle}".
                    Provide two distinct ideas.
                    Return a single valid JSON object with two keys:
                    1. "pressRelease": A creative headline and one-sentence summary for a press release.
                    2. "socialMediaPost": A short, engaging social media post text suitable for LinkedIn or Facebook.
                `;
                const ideas = await generateJson(prompt);

                container.innerHTML = `
                    <div>
                        <h5>Press Release Angle</h5>
                        <p>"${ideas.pressRelease}"</p>
                    </div>
                    <div>
                        <h5>Social Media Post</h5>
                        <p>"${ideas.socialMediaPost}"</p>
                    </div>
                `;
            } catch (e) {
                container.innerHTML = `<p class="error-message">Could not generate content ideas.</p>`;
            }
        }


        // --- Helper & Utility Functions ---

        /**
         * Generic PDF export handler using html2canvas and jspdf.
         * @param elementId The ID of the element to export.
         * @param buttonId The ID of the button that triggered the export.
         * @param reportName The name for the exported PDF file.
         */
        async function handleGenericPdfExport(elementId: string, buttonId: string, reportName: string) {
            const element = document.getElementById(elementId);
            const button = document.getElementById(buttonId) as HTMLButtonElement | null;
            if (!element || !button) return;

            const originalButtonText = button.innerHTML;
            button.innerHTML = '<div class="spinner"></div> Exporting...';
            button.disabled = true;

            try {
                const canvas = await html2canvas(element, {
                    scale: 2, // Higher scale for better quality
                    useCORS: true,
                    backgroundColor: document.body.classList.contains('dark') ? '#111827' : '#F9FAFB'
                });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jspdf.jsPDF({
                    orientation: 'p',
                    unit: 'px',
                    format: [canvas.width, canvas.height]
                });
                pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
                
                const clientName = appState.currentClient?.name.replace(/\s/g, '_') || 'Report';
                const date = new Date().toISOString().split('T')[0];
                pdf.save(`${reportName.replace(/\s/g, '_')}_${clientName}_${date}.pdf`);

            } catch (error) {
                console.error("PDF export failed", error);
                showToast("Failed to export PDF.", "error");
            } finally {
                button.innerHTML = originalButtonText;
                button.disabled = false;
            }
        }
        
        /**
         * Handles the content verification process.
         */
        async function handleVerifyContent() {
            const inputElement = document.getElementById('content-verification-input') as HTMLTextAreaElement;
            const button = document.getElementById('verify-content-button') as HTMLButtonElement;
            const resultsContainer = document.getElementById('vetting-results-container');
            const exportButton = document.getElementById('export-vetting-pdf-button');

            if (!inputElement || !button || !resultsContainer) return;
            const content = inputElement.value.trim();
            if (!content) return;

            const originalButtonText = button.innerText;
            button.disabled = true;
            button.innerHTML = '<div class="spinner"></div> Analyzing...';
            resultsContainer.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>AI is analyzing the content for potential risks...</p></div>`;
            if (exportButton) exportButton.style.display = 'none';

            try {
                const clientName = appState.currentClient?.name || 'a Malaysian company';
                const prompt = `
                    As a disinformation analyst for Malaysia, analyze the following content for potential risks, assuming it's related to ${clientName}.
                    Content: "${content}"

                    Provide a detailed analysis as a single valid JSON object with the following structure:
                    1.  "riskScore": An integer from 0 to 100 indicating the overall risk level.
                    2.  "scoreJustification": A brief sentence explaining the score.
                    3.  "overallAssessment": A paragraph summarizing the content's potential for 'fitnah' or disinformation.
                    4.  "recommendedAction": A short, actionable recommendation (e.g., "Monitor closely," "Prepare holding statement," "Immediate rebuttal required").
                    5.  "complianceChecks": An array of objects, each representing a check. Include checks for:
                        - "Racial Sensitivity"
                        - "Religious Sensitivity"
                        - "Political Neutrality"
                        Each object must have "checkName", "severity" ("Low", "Medium", "High", or "None"), and "details" (a brief explanation).
                    6.  "propagation": An object with narrative propagation predictions:
                        - "viralityScore": An integer from 0 to 100.
                        - "reachEstimate": An estimated number of people it could reach (integer).
                        - "keyAmplifier": The most likely type of account to spread this (e.g., "Political blogs", "Anonymous social media accounts").
                        - "timescale": The predicted time to reach peak virality (e.g., "6-12 hours", "2-3 days").
                `;

                const result = await generateJson(prompt);
                appState.latestVerificationResult = result;
                
                // Cache the propagation data for the other view
                const propagationCacheKey = `${appState.currentClientId}-veritasPropagation`;
                appState.cache[propagationCacheKey] = result.propagation;

                renderVettingResults(result);
                if (exportButton) exportButton.style.display = 'inline-flex';

            } catch (error) {
                console.error("Content verification failed", error);
                resultsContainer.innerHTML = `<div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    <h3>Analysis Failed</h3>
                    <p class="error-message">Could not process the content. Please try again later.</p>
                </div>`;
            } finally {
                button.disabled = false;
                button.innerText = originalButtonText;
            }
        }
        
        /**
         * Renders the results of the content verification.
         * @param data The analysis data from the API.
         */
        function renderVettingResults(data: any) {
            const container = document.getElementById('vetting-results-container');
            if (!container) return;

            const circumference = 2 * Math.PI * 45;
            const offset = circumference - (data.riskScore / 100) * circumference;
            const scoreColor = data.riskScore > 70 ? 'var(--danger)' : data.riskScore > 40 ? 'var(--warning)' : 'var(--info)';

            const complianceHtml = data.complianceChecks.map((check: any) => `
                <div class="compliance-card compliance-card--${check.severity.toLowerCase()}">
                    <div class="compliance-card__header">
                        <span class="compliance-card__title">${check.checkName}</span>
                        <span class="compliance-card__severity">${check.severity}</span>
                    </div>
                    <p>${check.details}</p>
                </div>
            `).join('');

            container.innerHTML = `
                <div class="ai-report-header">
                    <h3>Narrative Integrity Report</h3>
                    <p class="text-secondary">${data.overallAssessment}</p>
                </div>
                <div class="veritas-results-grid">
                    <div class="card">
                        <div class="card__header">
                            <h4>Overall Risk Score</h4>
                        </div>
                        <div class="card__body">
                            <div class="score-dial-container">
                                <svg viewBox="0 0 100 100">
                                    <circle class="score-dial-track" cx="50" cy="50" r="45"></circle>
                                    <circle class="score-dial-value" cx="50" cy="50" r="45"
                                        stroke="${scoreColor}"
                                        stroke-dasharray="${circumference}"
                                        stroke-dashoffset="${offset}"
                                    ></circle>
                                </svg>
                                <div class="score-text" style="color: ${scoreColor};">${data.riskScore}</div>
                            </div>
                            <p class="score-justification">${data.scoreJustification}</p>
                        </div>
                    </div>
                     <div class="card">
                        <div class="card__header">
                            <h4>Recommended Action</h4>
                        </div>
                         <div class="card__body">
                            <div class="insight-card-container">
                                <div class="insight-card">
                                    <p><strong>${data.recommendedAction}</strong></p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card__header">
                            <h4>Compliance & Sensitivity Checks</h4>
                        </div>
                         <div class="card__body">
                            ${complianceHtml}
                        </div>
                    </div>
                </div>
            `;
        }
        
        /**
         * Handles the image analysis process.
         */
        async function handleImageAnalysis() {
            const promptInput = document.getElementById('image-analysis-prompt-input') as HTMLTextAreaElement;
            const button = document.getElementById('analyze-image-button') as HTMLButtonElement;
            const resultsContainer = document.getElementById('image-analysis-results-container');
            const exportButton = document.getElementById('export-vi-pdf-button');

            if (!appState.uploadedImageData || !button || !resultsContainer) return;

            const originalButtonText = button.innerText;
            button.disabled = true;
            button.innerHTML = '<div class="spinner"></div> Analyzing...';
            resultsContainer.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>AI is analyzing the image...</p></div>`;
            if (exportButton) exportButton.style.display = 'none';

            try {
                const userPrompt = promptInput.value.trim() || "Analyze this image in detail. Describe what you see, identify key objects and concepts, and assess its brand safety.";
                const prompt = `
                    Analyze the image based on this prompt: "${userPrompt}".
                    Return a single valid JSON object with the following keys:
                    1. "description": A detailed description of the image (string).
                    2. "identifiedObjects": An array of strings naming the key objects/concepts identified.
                    3. "brandSafety": One of "Safe", "Neutral", or "High-Risk".
                `;

                const result = await generateJson(prompt, [
                    { mimeType: appState.uploadedImageData.mimeType, data: appState.uploadedImageData.data }
                ]);
                
                // Combine original image with the result for display
                const finalResult = {
                    ...result,
                    imageUrl: appState.uploadedImageData.url
                };

                renderImageAnalysisResults(finalResult);
                if (exportButton) exportButton.style.display = 'inline-flex';

            } catch (error) {
                console.error("Image analysis failed", error);
                resultsContainer.innerHTML = `<div class="empty-state">
                    <h3>Analysis Failed</h3>
                    <p class="error-message">Could not analyze the image. The file might be unsupported or the service is unavailable.</p>
                </div>`;
            } finally {
                button.disabled = false;
                button.innerText = originalButtonText;
            }
        }
        
        /**
         * Renders the results of the image analysis.
         */
        function renderImageAnalysisResults(data: any) {
            const container = document.getElementById('image-analysis-results-container');
            if (!container) return;

            const tagsHtml = data.identifiedObjects.map((tag: string) => `
                <span class="sentiment-tag sentiment-tag--neutral" style="background-color: var(--info-bg); color: var(--info);">${tag}</span>
            `).join(' ');

            container.innerHTML = `
                <div class="ai-report-header">
                    <h3>Visual Intelligence Report</h3>
                </div>
                <div class="card" style="margin-bottom: 1.5rem;">
                    <img src="${data.imageUrl}" alt="Analyzed image" style="width: 100%; height: auto; border-bottom: 1px solid var(--border-color);" />
                    <div class="card__body">
                        <div class="ai-report-section">
                            <h4>AI Summary</h4>
                            <p>${data.description}</p>
                        </div>
                    </div>
                </div>
                 <div class="card">
                    <div class="card__header">
                        <h4>Analysis Details</h4>
                    </div>
                     <div class="card__body">
                        <div class="ai-report-section">
                            <h4>Identified Objects & Concepts</h4>
                            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                ${tagsHtml}
                            </div>
                        </div>
                        <div class="ai-report-section">
                            <h4>Brand Safety Assessment</h4>
                             <div class="compliance-card compliance-card--${data.brandSafety.toLowerCase().replace(' ', '-')}">
                                <div class="compliance-card__header">
                                    <span class="compliance-card__title">Risk Level</span>
                                    <span class="compliance-card__severity">${data.brandSafety}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * Displays a toast notification.
         * @param message The message to display.
         * @param type The type of toast ('success' or 'error').
         */
        function showToast(message: string, type: 'success' | 'error' = 'success') {
            const container = document.getElementById('toast-container');
            if (!container) return;
            const toast = document.createElement('div');
            toast.className = `toast toast--${type}`;
            toast.textContent = message;
            container.appendChild(toast);
            setTimeout(() => {
                toast.remove();
            }, 4000);
        }

        function showConfirmationModal(message: string, onConfirm: () => void) {
            const overlay = document.getElementById('confirmation-modal-overlay');
            const messageEl = document.getElementById('confirmation-modal-message');
            const confirmBtn = document.getElementById('confirmation-confirm-button');
            const cancelBtn = document.getElementById('confirmation-cancel-button');

            if (!overlay || !messageEl || !confirmBtn || !cancelBtn) return;
            
            messageEl.textContent = message;
            
            const confirmHandler = () => {
                onConfirm();
                closeHandler();
            };
            
            const closeHandler = () => {
                overlay.classList.remove('visible');
                confirmBtn.removeEventListener('click', confirmHandler);
                cancelBtn.removeEventListener('click', closeHandler);
            };

            confirmBtn.addEventListener('click', confirmHandler);
            cancelBtn.addEventListener('click', closeHandler);
            
            overlay.classList.add('visible');
        }
        
        /**
         * Sets up the logo uploader functionality for a given modal.
         * @param prefix 'add-client' or 'edit-client'
         */
        function setupLogoUploader(prefix: string) {
            const input = document.getElementById(`${prefix}-logo-input`) as HTMLInputElement;
            const dropzone = document.getElementById(`${prefix}-logo-dropzone`);
            const preview = document.getElementById(`${prefix}-logo-preview`);
            const previewImg = document.getElementById(`${prefix}-logo-preview-img`) as HTMLImageElement;
            const removeBtn = document.getElementById(`${prefix}-logo-remove-btn`);

            if (!input || !dropzone || !preview || !previewImg || !removeBtn) return;

            const handleFile = (file: File) => {
                if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const dataUrl = e.target?.result as string;
                        appState.modalLogoDataUrl = dataUrl;
                        previewImg.src = dataUrl;
                        dropzone.classList.add('hidden');
                        preview.classList.remove('hidden');
                    };
                    reader.readAsDataURL(file);
                }
            };
            
            const resetUploader = () => {
                input.value = '';
                appState.modalLogoDataUrl = null;
                previewImg.src = '';
                preview.classList.add('hidden');
                dropzone.classList.remove('hidden');
            };

            dropzone.addEventListener('click', () => input.click());
            input.addEventListener('change', () => input.files?.length && handleFile(input.files[0]));
            removeBtn.addEventListener('click', resetUploader);
            
            return resetUploader; // Return a function to reset the state when the modal closes
        }

        function showEditClientModal(client: Client) {
            const overlay = document.getElementById('edit-client-modal-overlay');
            const nameInput = document.getElementById('edit-client-name-input') as HTMLInputElement;
            const industryInput = document.getElementById('edit-client-industry-input') as HTMLInputElement;
            const saveBtn = document.getElementById('edit-client-save-button');
            const cancelBtn = document.getElementById('edit-client-cancel-button');
            const closeBtn = document.getElementById('edit-client-modal-close');
            
            const dropzone = document.getElementById('edit-client-logo-dropzone');
            const preview = document.getElementById('edit-client-logo-preview');
            const previewImg = document.getElementById('edit-client-logo-preview-img') as HTMLImageElement;
            
            if (!overlay || !nameInput || !industryInput || !saveBtn || !cancelBtn || !closeBtn || !dropzone || !preview || !previewImg) return;
            
            // Reset fields
            nameInput.value = client.name;
            industryInput.value = client.industry;
            appState.modalLogoDataUrl = client.logoUrl || null;
            
            if (client.logoUrl) {
                previewImg.src = client.logoUrl;
                preview.classList.remove('hidden');
                dropzone.classList.add('hidden');
            } else {
                preview.classList.add('hidden');
                dropzone.classList.remove('hidden');
            }
            
            const saveHandler = () => {
                const newName = nameInput.value.trim();
                const newIndustry = industryInput.value.trim();
                if (newName && newIndustry) {
                    handleEditClient(client.id, newName, newIndustry, appState.modalLogoDataUrl);
                    closeHandler();
                }
            };
            
            const closeHandler = () => {
                overlay.classList.remove('visible');
                saveBtn.removeEventListener('click', saveHandler);
                cancelBtn.removeEventListener('click', closeHandler);
                closeBtn.removeEventListener('click', closeHandler);
                appState.modalLogoDataUrl = null; // Clear temp state
            };
            
            saveBtn.addEventListener('click', saveHandler);
            cancelBtn.addEventListener('click', closeHandler);
            closeBtn.addEventListener('click', closeHandler);
            
            overlay.classList.add('visible');
        }

        // --- Client Data Handlers (Using localStorage as a persistent backend simulation) ---
        const CLIENTS_STORAGE_KEY = 'prvail_clients';

        async function fetchClients() {
            try {
                const clientsJson = localStorage.getItem(CLIENTS_STORAGE_KEY);
                let clients: Client[] = clientsJson ? JSON.parse(clientsJson) : [];

                if (clients.length === 0) {
                    // If no clients exist, add the default one and save it.
                    clients = [{
                        id: 'prsm-01',
                        name: 'Public Relations Practitioners Society of Malaysia',
                        industry: 'Professional Association'
                    }];
                    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
                }

                appState.clients = clients;

                if (appState.clients.length > 0 && !appState.currentClientId) {
                    appState.currentClientId = appState.clients[0].id;
                }
                updateCurrentClient();
            } catch (error) {
                console.error("Error loading clients from localStorage:", error);
                showToast("Could not load client data.", "error");
                // Fallback to empty state
                appState.clients = [];
            }
        }

        async function handleAddClient(name: string, industry: string, logoUrl: string | null) {
            try {
                const newClient: Client = {
                    id: `client-${Date.now()}`,
                    name,
                    industry,
                    logoUrl: logoUrl || undefined,
                };
                
                const updatedClients = [...appState.clients, newClient];
                localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(updatedClients));
                appState.clients = updatedClients;

                if (!appState.currentClientId) {
                    appState.currentClientId = newClient.id;
                    updateCurrentClient();
                }

                showToast("Client added successfully.", "success");
                renderClientsView();
                updateClientSwitcher();
            } catch (error) {
                 showToast("Failed to add client.", "error");
            }
        }

        async function handleEditClient(id: string, name: string, industry: string, logoUrl: string | null) {
             try {
                const updatedClients = appState.clients.map(c => 
                    c.id === id ? { ...c, name, industry, logoUrl: logoUrl || undefined } : c
                );
                localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(updatedClients));
                appState.clients = updatedClients;
                
                updateCurrentClient(); // This will re-sync currentClient if it was the one edited
                showToast("Client updated successfully.", "success");
                renderClientsView();
                updateClientSwitcher();
            } catch (error) {
                 showToast("Failed to update client.", "error");
            }
        }

        async function handleDeleteClient(id: string) {
            try {
                const wasCurrentClient = appState.currentClientId === id;
                const updatedClients = appState.clients.filter(c => c.id !== id);
                localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(updatedClients));
                appState.clients = updatedClients;
                
                if (wasCurrentClient) {
                    appState.currentClientId = appState.clients.length > 0 ? appState.clients[0].id : null;
                    updateCurrentClient();
                    // Refresh current view with new client data (or empty state)
                    switchView(getActiveView());
                }
                
                showToast("Client deleted successfully.", "success");
                renderClientsView();
                updateClientSwitcher();
            } catch (error) {
                showToast("Failed to delete client.", "error");
            }
        }
        
        function updateCurrentClient() {
            appState.currentClient = appState.clients.find(c => c.id === appState.currentClientId) || null;
        }

        // --- NEW MODULES ---

        /** Renders Signal: Video Intelligence View */
        function renderSignalVideoView() {
            const container = document.getElementById('signal-video-view');
            if (!container) return;
            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h2>Signal: Video Intelligence</h2>
                        <p class="text-secondary">Extract insights, transcripts, and summaries from video content.</p>
                    </div>
                    <button id="export-video-analysis-pdf-button" class="btn btn--secondary" style="display: none;">Export as PDF</button>
                </div>
                <div class="video-analysis-grid" id="video-analysis-export-content">
                    <div class="card">
                        <div class="card__header"><h3>Video Analysis Input</h3></div>
                        <div class="card__body">
                             <div class="form-group">
                                <label for="video-url-input">Video URL</label>
                                <input type="url" id="video-url-input" class="form-input" placeholder="e.g., https://www.youtube.com/watch?v=...">
                            </div>
                            <button id="analyze-video-button" class="btn btn--primary">Analyze Video</button>
                        </div>
                    </div>
                    <div id="video-analysis-output">
                        <div class="empty-state">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
                            <h4>Ready for Analysis</h4>
                            <p>Enter a video URL to generate a summary and transcript.</p>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('analyze-video-button')?.addEventListener('click', handleVideoAnalysis);
            document.getElementById('export-video-analysis-pdf-button')?.addEventListener('click', () => handleGenericPdfExport(
                'video-analysis-export-content',
                'export-video-analysis-pdf-button',
                'Video Intelligence Report'
            ));
        }

        async function handleVideoAnalysis() {
            const urlInput = document.getElementById('video-url-input') as HTMLInputElement;
            const outputContainer = document.getElementById('video-analysis-output');
            const button = document.getElementById('analyze-video-button') as HTMLButtonElement;
            const exportBtn = document.getElementById('export-video-analysis-pdf-button');
            if (!urlInput?.value || !outputContainer || !button) return;

            button.disabled = true;
            button.innerHTML = '<div class="spinner"></div> Analyzing...';
            if (exportBtn) exportBtn.style.display = 'none';
            outputContainer.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>AI is analyzing the video. This may take a moment...</p></div>`;
            
            try {
                // NOTE: The model cannot directly access URLs. This prompt asks it to *simulate* an analysis.
                // A production backend would use tools to download and transcribe the video before passing content to the model.
                const prompt = `
                    You are a video analysis AI. A user has provided this URL: "${urlInput.value}".
                    Act as if you have watched and analyzed the video. Generate a plausible analysis.
                    Return a single valid JSON object with three keys:
                    1. "summary": A concise paragraph summarizing the video's content.
                    2. "topics": An array of 3-5 key topics discussed in the video (array of strings).
                    3. "transcript": A short, plausible excerpt of the video's transcript (a single string with line breaks).
                `;
                const result = await generateJson(prompt);
                
                outputContainer.innerHTML = `
                    <div class="card">
                        <div class="card__header"><h3>AI Summary & Key Topics</h3></div>
                        <div class="card__body">
                            <p>${result.summary}</p>
                            <hr>
                            <h4>Key Topics:</h4>
                            <p>${result.topics.join(', ')}</p>
                        </div>
                    </div>
                     <div class="card">
                        <div class="card__header"><h3>Transcript</h3></div>
                        <div class="card__body">
                            <div class="video-transcript">${result.transcript.replace(/\n/g, '<br>')}</div>
                        </div>
                    </div>
                `;
                if(exportBtn) exportBtn.style.display = 'inline-flex';
            } catch (e) {
                 outputContainer.innerHTML = `<div class="empty-state"><p class="error-message">Could not analyze the video.</p></div>`;
            } finally {
                button.disabled = false;
                button.innerHTML = 'Analyze Video';
            }
        }

        /** Renders Signal: Video Generation View */
        function renderSignalVideoGenerationView() {
            const container = document.getElementById('signal-video-generation-view');
            if (!container) return;
            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h2>Signal: AI Video Generation</h2>
                        <p class="text-secondary">Create short video clips from text prompts and images.</p>
                    </div>
                </div>
                <div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
                    <h3>Not Available on This Provider</h3>
                    <p>Video generation previously used Google's Veo model, which has no equivalent on Hunyuan's OpenAI-compatible chat API. Tencent's native video generation service uses a different authentication scheme (Tencent Cloud SecretId/SecretKey request signing) that must never run in the browser, so this feature needs a small backend proxy before it can be re-enabled.</p>
                </div>
            `;
        }

        /** Renders Veritas: Deepfake Detection View */
        function renderVeritasDeepfakeView() {
            const container = document.getElementById('veritas-deepfake-view');
            if (!container) return;
            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h2>Veritas: Deepfake Detection</h2>
                        <p class="text-secondary">Assess the authenticity of images with AI-powered analysis.</p>
                    </div>
                     <button id="export-deepfake-pdf-button" class="btn btn--secondary" style="display: none;">Export as PDF</button>
                </div>
                <div class="veritas-grid" id="deepfake-export-content">
                    <div class="input-panel">
                         <div class="card">
                            <div class="card__header"><h3>Image Authenticity Check</h3></div>
                            <div class="card__body">
                                <div id="deepfake-upload-dropzone" class="image-dropzone">
                                    <input type="file" id="deepfake-upload-input" accept="image/*" style="display: none;">
                                    <div class="image-dropzone-prompt"><p>Drop image here or click to upload</p></div>
                                </div>
                                <div id="deepfake-preview-container" class="image-preview hidden">
                                    <img id="deepfake-preview-element" src="#" alt="Image preview" />
                                </div>
                                <button id="analyze-deepfake-button" class="btn btn--primary" disabled>Check Authenticity</button>
                            </div>
                        </div>
                    </div>
                    <div class="output-panel">
                        <div id="deepfake-results-container">
                            <div class="empty-state">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 1 1 4 0 2 2 0 0 1-4 0Z"/></svg>
                                <h4>Awaiting Image</h4>
                                <p>Upload an image to assess its authenticity.</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Re-use image upload logic, but scoped to this view
            const dropzone = document.getElementById('deepfake-upload-dropzone');
            const fileInput = document.getElementById('deepfake-upload-input') as HTMLInputElement;
            const previewContainer = document.getElementById('deepfake-preview-container');
            const previewElement = document.getElementById('deepfake-preview-element') as HTMLImageElement;
            const analyzeButton = document.getElementById('analyze-deepfake-button') as HTMLButtonElement;

            const handleFile = (file: File) => {
                 if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const base64String = (e.target?.result as string).split(',')[1];
                        const imageUrl = e.target?.result as string;
                        // Store it temporarily for this view
                        analyzeButton.dataset.imageData = JSON.stringify({ mimeType: file.type, data: base64String });
                        
                        previewElement.src = imageUrl;
                        dropzone?.classList.add('hidden');
                        previewContainer?.classList.remove('hidden');
                        analyzeButton.disabled = false;
                    };
                    reader.readAsDataURL(file);
                }
            };
            dropzone?.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', () => fileInput.files?.length && handleFile(fileInput.files[0]));

            analyzeButton?.addEventListener('click', handleDeepfakeDetection);
            document.getElementById('export-deepfake-pdf-button')?.addEventListener('click', () => handleGenericPdfExport(
                'deepfake-export-content',
                'export-deepfake-pdf-button',
                'Deepfake Detection Report'
            ));
        }

        async function handleDeepfakeDetection() {
            const button = document.getElementById('analyze-deepfake-button') as HTMLButtonElement;
            const resultsContainer = document.getElementById('deepfake-results-container');
            const exportBtn = document.getElementById('export-deepfake-pdf-button');
            const imageData = button.dataset.imageData;

            if (!imageData || !resultsContainer) return;
            
            button.disabled = true;
            button.innerHTML = '<div class="spinner"></div> Analyzing...';
            if (exportBtn) exportBtn.style.display = 'none';
            resultsContainer.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>AI is checking for manipulation...</p></div>`;

            try {
                const prompt = `
                    Analyze this image for signs of AI generation, manipulation, or deepfake characteristics.
                    Look for visual artifacts, inconsistencies in lighting, and other subtle clues.
                    Return a single valid JSON object with two keys:
                    1. "authenticityScore": An integer from 0 (likely manipulated) to 100 (likely authentic).
                    2. "assessment": A brief paragraph explaining your reasoning for the score.
                `;
                const imagePart = JSON.parse(imageData);

                const result = await generateJson(prompt, [imagePart]);
                
                const circumference = 2 * Math.PI * 45;
                const offset = circumference - (result.authenticityScore / 100) * circumference;
                const scoreColor = result.authenticityScore > 70 ? 'var(--success)' : result.authenticityScore > 40 ? 'var(--warning)' : 'var(--danger)';
                const scoreLabel = result.authenticityScore > 70 ? 'Likely Authentic' : result.authenticityScore > 40 ? 'Potentially Manipulated' : 'Likely Manipulated';

                resultsContainer.innerHTML = `
                    <div class="card">
                         <div class="card__header"><h4>Authenticity Score</h4></div>
                         <div class="card__body">
                            <div class="score-dial-container">
                                <svg viewBox="0 0 100 100">
                                    <circle class="score-dial-track" cx="50" cy="50" r="45"></circle>
                                    <circle class="score-dial-value" cx="50" cy="50" r="45"
                                        stroke="${scoreColor}" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"></circle>
                                </svg>
                                <div class="score-text" style="color: ${scoreColor};">${result.authenticityScore}%</div>
                            </div>
                            <p class="score-justification">${scoreLabel}</p>
                        </div>
                    </div>
                     <div class="card">
                        <div class="card__header"><h4>AI Assessment</h4></div>
                        <div class="card__body"><p>${result.assessment}</p></div>
                    </div>
                `;
                 if (exportBtn) exportBtn.style.display = 'inline-flex';
            } catch(e) {
                resultsContainer.innerHTML = `<div class="empty-state"><p class="error-message">Analysis failed.</p></div>`;
            } finally {
                button.disabled = false;
                button.innerHTML = 'Check Authenticity';
            }
        }
        
        /** Renders NusaPulse: Industry Insights View */
        async function renderNusaPulseInsightsView() {
            const container = document.getElementById('nusapulse-insights-view');
            if (!container) return;

             if (!appState.currentClient) {
                container.innerHTML = `<div class="empty-state"><h3>No Client Selected</h3><p>Please select a client to get started.</p></div>`;
                return;
            }

            const cacheKey = `${appState.currentClientId}-nusapulseMap`; // Re-use same data object
            if (appState.cache[cacheKey]) {
                renderNusaPulseInsightsContent(appState.cache[cacheKey]);
                return;
            }

            container.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>Generating Industry Insights for ${appState.currentClient.name}...</p></div>`;
            
            try {
                const data = await fetchMarketIntelligenceData(appState.currentClient);
                appState.cache[cacheKey] = data;
                renderNusaPulseInsightsContent(data);
            } catch(error) {
                container.innerHTML = `<div class="empty-state"><p class="error-message">Could not generate insights.</p></div>`;
            }
        }

        function renderNusaPulseInsightsContent(data: any) {
             const container = document.getElementById('nusapulse-insights-view');
            if (!container || !appState.currentClient) return;
            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h2>NusaPulse: Industry Insights</h2>
                        <p class="text-secondary">Competitive intelligence for ${appState.currentClient.name}.</p>
                    </div>
                    <button id="export-insights-pdf-button" class="btn btn--secondary">Export as PDF</button>
                </div>
                <div class="insights-grid" id="insights-export-content">
                    <div class="card">
                        <div class="card__header"><h3>Share of Voice</h3></div>
                        <div id="sov-chart" class="card__body"></div>
                    </div>
                    <div class="card">
                        <div class="card__header"><h3>Sentiment Comparison</h3></div>
                        <div id="sentiment-comparison-chart" class="card__body"></div>
                    </div>
                    <div class="card" style="grid-column: 1 / -1;">
                        <div class="card__header"><h3>Key Competitor Insights</h3></div>
                        <div class="card__body"><p>${data.competitorInsights}</p></div>
                    </div>
                </div>
            `;
            document.getElementById('export-insights-pdf-button')?.addEventListener('click', () => handleGenericPdfExport(
                'insights-export-content',
                'export-insights-pdf-button',
                'Industry Insights Report'
            ));
            initializeMapAndCharts(data, 'insights');
        }

        /** Renders Nexus: Stakeholder Mapping View */
        function renderNexusStakeholderView() {
            const container = document.getElementById('nexus-stakeholder-view');
            if (!container) return;
            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h2>Nexus: Stakeholder Mapping</h2>
                        <p class="text-secondary">Visualize the key players and their influence on specific topics.</p>
                    </div>
                     <button id="export-stakeholder-pdf-button" class="btn btn--secondary" style="display: none;">Export as PDF</button>
                </div>
                 <div class="stakeholder-grid" id="stakeholder-export-content">
                    <div class="card">
                         <div class="card__header"><h3>Generate Map</h3></div>
                         <div class="card__body">
                            <div class="form-group">
                                <label for="stakeholder-topic-input">Policy or Topic</label>
                                <input type="text" id="stakeholder-topic-input" class="form-input" placeholder="e.g., National AI Framework">
                            </div>
                            <button id="generate-stakeholder-map-button" class="btn btn--primary">Generate Map</button>
                        </div>
                    </div>
                    <div id="stakeholder-map-output">
                         <div class="empty-state">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><path d="M6.5 8.5c0 4 6 6 6 6s6-2 6-6"/><path d="M12 11.5V17"/><path d="M12 17h-2.5"/><path d="M12 17h2.5"/></svg>
                            <h4>Enter a Topic</h4>
                            <p>Provide a policy or issue to generate a stakeholder influence map.</p>
                        </div>
                    </div>
                </div>
            `;
             document.getElementById('generate-stakeholder-map-button')?.addEventListener('click', handleStakeholderMapGeneration);
             document.getElementById('export-stakeholder-pdf-button')?.addEventListener('click', () => handleGenericPdfExport(
                'stakeholder-map-output',
                'export-stakeholder-pdf-button',
                'Stakeholder Map Report'
            ));
        }
        
        async function handleStakeholderMapGeneration() {
            const topicInput = document.getElementById('stakeholder-topic-input') as HTMLInputElement;
            const outputContainer = document.getElementById('stakeholder-map-output');
            const button = document.getElementById('generate-stakeholder-map-button') as HTMLButtonElement;
            const exportBtn = document.getElementById('export-stakeholder-pdf-button');
            if (!topicInput?.value || !outputContainer || !button) return;
            
            button.disabled = true;
            button.innerHTML = '<div class="spinner"></div> Generating...';
            if (exportBtn) exportBtn.style.display = 'none';
            outputContainer.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>AI is mapping the influence landscape...</p></div>`;

            try {
                const prompt = `
                    For the policy topic "${topicInput.value}" in Malaysia, identify the stance of five key stakeholder groups: Government, Opposition, NGOs, Industry, and Media.
                    Return a single valid JSON object with two keys:
                    1. "stakes": An object where keys are "government", "opposition", "ngos", "industry", "media" and values are their stance ("For", "Against", "Neutral").
                    2. "insights": A brief paragraph summarizing the overall stakeholder landscape and potential points of contention or alliance.
                `;
                const result = await generateJson(prompt);
                
                outputContainer.innerHTML = `
                     <div class="stakeholder-map-container">
                        <svg class="stakeholder-svg">
                           <line id="line-center-gov"></line><line id="line-center-opp"></line><line id="line-center-ngo"></line><line id="line-center-industry"></line><line id="line-center-media"></line>
                        </svg>
                        <div id="node-center-policy" class="stakeholder-node" style="top: 45%; left: 45%;"><b>${topicInput.value}</b></div>
                        <div id="node-stakeholder-gov" class="stakeholder-node stakeholder-node--${result.stakes.government.toLowerCase()}" style="top: 10%; left: 40%;"><div>Government</div><small>${result.stakes.government}</small></div>
                        <div id="node-stakeholder-opp" class="stakeholder-node stakeholder-node--${result.stakes.opposition.toLowerCase()}" style="top: 45%; left: 5%;"><div>Opposition</div><small>${result.stakes.opposition}</small></div>
                        <div id="node-stakeholder-ngo" class="stakeholder-node stakeholder-node--${result.stakes.ngos.toLowerCase()}" style="top: 80%; left: 20%;"><div>NGOs</div><small>${result.stakes.ngos}</small></div>
                        <div id="node-stakeholder-industry" class="stakeholder-node stakeholder-node--${result.stakes.industry.toLowerCase()}" style="top: 45%; right: 5%;"><div>Industry</div><small>${result.stakes.industry}</small></div>
                        <div id="node-stakeholder-media" class="stakeholder-node stakeholder-node--${result.stakes.media.toLowerCase()}" style="top: 80%; right: 20%;"><div>Media</div><small>${result.stakes.media}</small></div>
                    </div>
                    <div class="card" style="margin-top: 1.5rem">
                        <div class="card__header"><h3>Key Insights</h3></div>
                        <div class="card__body"><p>${result.insights}</p></div>
                    </div>
                `;
                 if (exportBtn) exportBtn.style.display = 'inline-flex';
                 requestAnimationFrame(updateStakeholderLines);
            } catch(e) {
                 outputContainer.innerHTML = `<div class="empty-state"><p class="error-message">Could not generate map.</p></div>`;
            } finally {
                button.disabled = false;
                button.innerHTML = 'Generate Map';
            }
        }

        /** Renders Aegis: Scenario Planner View */
        function renderAegisScenarioView() {
            const container = document.getElementById('aegis-scenario-view');
            if (!container) return;
             container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h2>Aegis: Scenario Planner</h2>
                        <p class="text-secondary">Generate detailed, multi-stage crisis response plans.</p>
                    </div>
                    <button id="export-scenario-pdf-button" class="btn btn--secondary" style="display: none;">Export as PDF</button>
                </div>
                 <div class="scenario-grid">
                     <div class="card">
                         <div class="card__header"><h3>Define Crisis Scenario</h3></div>
                         <div class="card__body">
                            <div class="form-group">
                                <label for="scenario-title-input">Scenario Title</label>
                                <input type="text" id="scenario-title-input" class="form-input" placeholder="e.g., Product Contamination Allegation">
                            </div>
                            <div class="form-group">
                                <label for="scenario-details-input">Scenario Details</label>
                                <textarea id="scenario-details-input" class="form-textarea" placeholder="Describe the crisis in detail..."></textarea>
                            </div>
                            <button id="generate-plan-button" class="btn btn--primary">Generate Response Plan</button>
                        </div>
                    </div>
                    <div id="scenario-plan-output">
                        <div class="empty-state">
                             <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                            <h4>Define a Scenario</h4>
                            <p>Fill out the details of a potential crisis to generate a strategic response plan.</p>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('generate-plan-button')?.addEventListener('click', handleScenarioPlanGeneration);
            document.getElementById('export-scenario-pdf-button')?.addEventListener('click', () => handleGenericPdfExport(
                'scenario-plan-output',
                'export-scenario-pdf-button',
                'Scenario Plan Report'
            ));
        }
        
        async function handleScenarioPlanGeneration() {
            const title = (document.getElementById('scenario-title-input') as HTMLInputElement).value;
            const details = (document.getElementById('scenario-details-input') as HTMLTextAreaElement).value;
            const outputContainer = document.getElementById('scenario-plan-output');
            const button = document.getElementById('generate-plan-button') as HTMLButtonElement;
            const exportBtn = document.getElementById('export-scenario-pdf-button');
            if (!title || !details || !outputContainer || !button) return;

            button.disabled = true;
            button.innerHTML = '<div class="spinner"></div> Generating...';
            if (exportBtn) exportBtn.style.display = 'none';
            outputContainer.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>AI is formulating a strategic response...</p></div>`;

            try {
                const prompt = `
                    You are a crisis communications expert. Create a strategic response plan for the following scenario:
                    Title: "${title}"
                    Details: "${details}"

                    Structure the plan into three phases.
                    Return a single valid JSON object with three keys:
                    1. "immediate": An array of 3-4 strings detailing actions for the first 24 hours.
                    2. "shortTerm": An array of 3-4 strings for actions during the first week.
                    3. "longTerm": An array of 3-4 strings for recovery and reputation rebuilding actions.
                `;
                const result = await generateJson(prompt);
                
                outputContainer.innerHTML = `
                    <div class="card" id="scenario-plan-export-content">
                        <div class="card__header"><h3>Response Plan: ${title}</h3></div>
                        <div class="card__body">
                            <div class="plan-stage-card">
                                <h4>Immediate Actions (First 24 Hours)</h4>
                                <ul>${result.immediate.map((s: string) => `<li>${s}</li>`).join('')}</ul>
                            </div>
                            <div class="plan-stage-card">
                                <h4>Short-Term Strategy (Week 1)</h4>
                                <ul>${result.shortTerm.map((s: string) => `<li>${s}</li>`).join('')}</ul>
                            </div>
                            <div class="plan-stage-card">
                                <h4>Long-Term Recovery</h4>
                                <ul>${result.longTerm.map((s: string) => `<li>${s}</li>`).join('')}</ul>
                            </div>
                        </div>
                    </div>
                `;
                if (exportBtn) exportBtn.style.display = 'inline-flex';
            } catch(e) {
                 outputContainer.innerHTML = `<div class="empty-state"><p class="error-message">Could not generate plan.</p></div>`;
            } finally {
                button.disabled = false;
                button.innerHTML = 'Generate Response Plan';
            }
        }

        /** Renders Amplify: Campaign Builder View */
        function renderAmplifyCampaignView() {
            const container = document.getElementById('amplify-campaign-view');
            if (!container) return;
            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h2>Amplify: Campaign Builder</h2>
                        <p class="text-secondary">AI-assisted campaign planning from goal to execution.</p>
                    </div>
                    <button id="export-campaign-pdf-button" class="btn btn--secondary" style="display: none;">Export as PDF</button>
                </div>
                <div class="campaign-grid">
                    <div class="card">
                         <div class="card__header"><h3>Campaign Goal</h3></div>
                         <div class="card__body">
                            <div class="form-group">
                                <label for="campaign-goal-input">What is the primary goal of this campaign?</label>
                                <textarea id="campaign-goal-input" class="form-textarea" placeholder="e.g., Launch our new 'Hijau' line of sustainable products to the Malaysian market."></textarea>
                            </div>
                            <button id="build-campaign-button" class="btn btn--primary">Build Campaign</button>
                        </div>
                    </div>
                    <div id="campaign-plan-output">
                        <div class="empty-state">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5C17.7 10.2 19 9.3 19 8c0-1.7-1.3-3-3-3S13 6.3 13 8c0 1.3 1.3 2.2 2.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 12c.2-1 .7-1.7 1.5-2.5C11.7 8.2 13 7.3 13 6c0-1.7-1.3-3-3-3S7 4.3 7 6c0 1.3 1.3 2.2 2.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 12v1.5c0 1.5.7 2.8 2 3.5"/><path d="M15 14v1.5c0 1.5-.7 2.8-2 3.5"/><path d="M12 22a2.5 2.5 0 0 1-2-4H8a6 6 0 0 1-6-6 6 6 0 0 1 6-6h8a6 6 0 0 1 6 6 6 6 0 0 1-6 6h-2a2.5 2.5 0 0 1-2 4Z"/></svg>
                            <h4>State Your Goal</h4>
                            <p>Describe your campaign objective, and the AI will generate a strategic plan.</p>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('build-campaign-button')?.addEventListener('click', handleCampaignBuild);
            document.getElementById('export-campaign-pdf-button')?.addEventListener('click', () => handleGenericPdfExport(
                'campaign-plan-output',
                'export-campaign-pdf-button',
                'Campaign Plan'
            ));
        }
        
        async function handleCampaignBuild() {
            const goal = (document.getElementById('campaign-goal-input') as HTMLTextAreaElement).value;
            const outputContainer = document.getElementById('campaign-plan-output');
            const button = document.getElementById('build-campaign-button') as HTMLButtonElement;
            const exportBtn = document.getElementById('export-campaign-pdf-button');
            if (!goal || !outputContainer || !button) return;

            button.disabled = true;
            button.innerHTML = '<div class="spinner"></div> Building...';
            if (exportBtn) exportBtn.style.display = 'none';
            outputContainer.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>AI is building your campaign framework...</p></div>`;
            
            try {
                const prompt = `
                    You are a campaign strategist. Based on the following goal, create a communications campaign plan.
                    Goal: "${goal}"
                    
                    Return a single valid JSON object with the following keys:
                    1. "campaignName": A creative, catchy name for the campaign.
                    2. "keyMessage": The single most important message the campaign should convey, in one sentence.
                    3. "timeline": An array of 3 objects, each representing a phase of the campaign (e.g., Teaser, Launch, Sustain). Each object must have "phase", "duration" (e.g., "Week 1-2"), and "description" (a brief summary of activities).
                `;
                const result = await generateJson(prompt);

                const timelineHtml = result.timeline.map((item: any) => `
                    <div class="timeline-item">
                        <h5>${item.phase} <span class="text-secondary">(${item.duration})</span></h5>
                        <p>${item.description}</p>
                    </div>
                `).join('');
                
                outputContainer.innerHTML = `
                    <div class="card" id="campaign-plan-export-content">
                        <div class="card__header"><h3>Campaign Plan: ${result.campaignName}</h3></div>
                        <div class="card__body">
                            <div class="ai-report-section"><h4>Key Message</h4><p>${result.keyMessage}</p></div>
                             <div class="ai-report-section">
                                <h4>Campaign Timeline</h4>
                                <div class="timeline">${timelineHtml}</div>
                             </div>
                        </div>
                    </div>
                `;
                 if (exportBtn) exportBtn.style.display = 'inline-flex';
            } catch(e) {
                outputContainer.innerHTML = `<div class="empty-state"><p class="error-message">Could not build campaign.</p></div>`;
            } finally {
                button.disabled = false;
                button.innerHTML = 'Build Campaign';
            }
        }
        
        /** Renders Due Diligence: Entity Vetting View */
        function renderDueDiligenceView() {
            const container = document.getElementById('duediligence-vetting-view');
            if (!container) return;
            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h2>Due Diligence: Entity Vetting</h2>
                        <p class="text-secondary">Assess political, cultural (3R), and reputational risk before engaging a partner, politician, or entity in Malaysia.</p>
                    </div>
                    <button id="export-dd-pdf-button" class="btn btn--secondary" style="display: none;">Export as PDF</button>
                </div>
                <div class="veritas-grid">
                    <div class="input-panel">
                        <div class="card">
                            <div class="card__header">
                                <h3>Entity Details</h3>
                                <p class="text-secondary">Provide the entity to vet and any known context.</p>
                            </div>
                            <div class="card__body">
                                <div class="form-group">
                                    <label for="dd-entity-name-input">Entity Name</label>
                                    <input type="text" id="dd-entity-name-input" class="form-input" placeholder="e.g., a politician, company, or organization">
                                </div>
                                <div class="form-group">
                                    <label for="dd-entity-type-select">Entity Type</label>
                                    <select id="dd-entity-type-select" class="form-select">
                                        <option value="Politician">Politician</option>
                                        <option value="Political Party">Political Party</option>
                                        <option value="Company">Company / Corporation</option>
                                        <option value="NGO">NGO / Civil Society Group</option>
                                        <option value="Government Agency">Government Agency</option>
                                        <option value="Individual">Individual (Non-political)</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="dd-context-input">Additional Context (optional)</label>
                                    <textarea id="dd-context-input" class="form-textarea" placeholder="e.g., proposed sponsorship deal, joint statement, board appointment..."></textarea>
                                </div>
                                <button id="run-due-diligence-button" class="btn btn--primary">Run Due Diligence</button>
                            </div>
                        </div>
                    </div>
                    <div class="output-panel">
                        <div id="due-diligence-results-container">
                            <div class="empty-state">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                <h4>Ready to Vet</h4>
                                <p>Enter an entity to generate a political, cultural, and reputational due diligence report.</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('run-due-diligence-button')?.addEventListener('click', handleRunDueDiligence);
            document.getElementById('export-dd-pdf-button')?.addEventListener('click', () => handleGenericPdfExport(
                'due-diligence-results-container',
                'export-dd-pdf-button',
                'Due Diligence Report'
            ));
        }

        /**
         * Handles the entity due diligence process.
         */
        async function handleRunDueDiligence() {
            const nameInput = document.getElementById('dd-entity-name-input') as HTMLInputElement;
            const typeSelect = document.getElementById('dd-entity-type-select') as HTMLSelectElement;
            const contextInput = document.getElementById('dd-context-input') as HTMLTextAreaElement;
            const button = document.getElementById('run-due-diligence-button') as HTMLButtonElement;
            const resultsContainer = document.getElementById('due-diligence-results-container');
            const exportButton = document.getElementById('export-dd-pdf-button');

            if (!nameInput || !typeSelect || !button || !resultsContainer) return;
            const entityName = nameInput.value.trim();
            if (!entityName) return;
            const entityType = typeSelect.value;
            const context = contextInput?.value.trim() || 'None provided';

            const originalButtonText = button.innerText;
            button.disabled = true;
            button.innerHTML = '<div class="spinner"></div> Vetting...';
            resultsContainer.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>AI is running political, cultural, and reputational due diligence...</p></div>`;
            if (exportButton) exportButton.style.display = 'none';

            try {
                const clientName = appState.currentClient?.name || 'our client';
                const prompt = `
                    As a Malaysian political and PR due diligence analyst, assess the following entity on behalf of ${clientName}, who is considering an engagement with it.

                    Entity Name: "${entityName}"
                    Entity Type: ${entityType}
                    Additional Context: ${context}

                    Provide a comprehensive due diligence assessment considering:
                    1. Political exposure and coalition dynamics (Pakatan Harapan / Barisan Nasional / Perikatan Nasional / other), and known relationships or affiliations.
                    2. 3R sensitivities (Race, Religion, Royalty), plus federal-state and Sabah/Sarawak autonomy considerations where relevant.
                    3. Reputational and integrity red flags (past controversies, conflicts of interest, regulatory issues).
                    4. Likely reactions from key stakeholder groups (e.g., government, opposition, media, civil society, business community).
                    5. A clear overall recommendation on whether to proceed with the engagement.

                    Return a single valid JSON object with this exact structure:
                    {
                        "overallRiskScore": integer 0-100,
                        "riskLevel": "Low" | "Medium" | "High" | "Critical",
                        "recommendation": short actionable recommendation (e.g., "Proceed", "Proceed with Caution", "Enhanced Due Diligence Required", "Decline Engagement"),
                        "executiveSummary": a paragraph summarizing the overall assessment,
                        "politicalExposure": {
                            "coalitionAffiliations": array of objects with "coalition" ("PH", "BN", "PN", or "None/Other") and "strength" ("Strong", "Moderate", "Weak"),
                            "influenceScore": integer 0-100,
                            "keyRelationships": array of objects with "name" and "relationship" (brief description)
                        },
                        "sensitivityChecks": array of objects, each with "area" (e.g. "Race", "Religion", "Royalty", "Sabah/Sarawak Autonomy", "Federal-State Relations"), "severity" ("Low", "Medium", or "High"), and "details",
                        "integrityFlags": array of objects, each with "flag" (short title), "severity" ("Low", "Medium", or "High"), and "details". Use an empty array if none found,
                        "stakeholderReactions": array of objects with "stakeholder" and "reaction" (their likely stance/reaction),
                        "mitigationStrategies": array of short actionable strings,
                        "confidenceLevel": integer 0-100
                    }
                `;

                const result = await generateJson(prompt);
                renderDueDiligenceResults(entityName, entityType, result);
                if (exportButton) exportButton.style.display = 'inline-flex';

            } catch (error) {
                console.error("Due diligence check failed", error);
                resultsContainer.innerHTML = `<div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    <h3>Due Diligence Failed</h3>
                    <p class="error-message">Could not process the request. Please try again later.</p>
                </div>`;
            } finally {
                button.disabled = false;
                button.innerText = originalButtonText;
            }
        }

        /**
         * Renders the results of the entity due diligence check.
         */
        function renderDueDiligenceResults(entityName: string, entityType: string, data: any) {
            const container = document.getElementById('due-diligence-results-container');
            if (!container) return;

            const circumference = 2 * Math.PI * 45;
            const offset = circumference - (data.overallRiskScore / 100) * circumference;
            const scoreColor = data.overallRiskScore > 70 ? 'var(--danger)' : data.overallRiskScore > 40 ? 'var(--warning)' : 'var(--info)';

            const riskLevelClass = (data.riskLevel || '').toLowerCase();
            const bannerClass = riskLevelClass === 'low' ? 'proceed' : riskLevelClass === 'medium' ? 'caution' : 'enhanced';

            const coalitionHtml = (data.politicalExposure?.coalitionAffiliations || []).map((c: any) => `
                <span class="coalition-badge">${c.coalition} <span class="coalition-badge__strength">${c.strength}</span></span>
            `).join('') || '<p class="text-secondary">No coalition affiliations identified.</p>';

            const relationshipsHtml = (data.politicalExposure?.keyRelationships || []).map((r: any) => `
                <div class="dd-relationship-item"><span>${r.name}</span><span class="text-secondary">${r.relationship}</span></div>
            `).join('') || '<p class="text-secondary">No key relationships identified.</p>';

            const sensitivityHtml = (data.sensitivityChecks || []).map((check: any) => `
                <div class="compliance-card compliance-card--${(check.severity || 'low').toLowerCase()}">
                    <div class="compliance-card__header">
                        <span class="compliance-card__title">${check.area}</span>
                        <span class="compliance-card__severity">${check.severity}</span>
                    </div>
                    <p>${check.details}</p>
                </div>
            `).join('');

            const integrityHtml = (data.integrityFlags || []).length ? (data.integrityFlags || []).map((flag: any) => `
                <div class="compliance-card compliance-card--${(flag.severity || 'low').toLowerCase()}">
                    <div class="compliance-card__header">
                        <span class="compliance-card__title">${flag.flag}</span>
                        <span class="compliance-card__severity">${flag.severity}</span>
                    </div>
                    <p>${flag.details}</p>
                </div>
            `).join('') : '<p class="text-secondary">No significant integrity flags identified.</p>';

            const stakeholderHtml = (data.stakeholderReactions || []).map((s: any) => `
                <div class="dd-stakeholder-item"><span>${s.stakeholder}</span><span class="text-secondary">${s.reaction}</span></div>
            `).join('');

            const mitigationHtml = (data.mitigationStrategies || []).map((s: string) => `<li>${s}</li>`).join('');

            container.innerHTML = `
                <div class="ai-report-header">
                    <h3>Due Diligence Report: ${entityName}</h3>
                    <p class="text-secondary">${entityType} &middot; Confidence: ${data.confidenceLevel}%</p>
                    <p class="text-secondary">${data.executiveSummary}</p>
                </div>
                <div class="dd-recommendation-banner dd-recommendation-banner--${bannerClass}">${data.recommendation}</div>
                <div class="veritas-results-grid">
                    <div class="card">
                        <div class="card__header"><h4>Overall Risk Score</h4></div>
                        <div class="card__body">
                            <div class="score-dial-container">
                                <svg viewBox="0 0 100 100">
                                    <circle class="score-dial-track" cx="50" cy="50" r="45"></circle>
                                    <circle class="score-dial-value" cx="50" cy="50" r="45"
                                        stroke="${scoreColor}"
                                        stroke-dasharray="${circumference}"
                                        stroke-dashoffset="${offset}"
                                    ></circle>
                                </svg>
                                <div class="score-text" style="color: ${scoreColor};">${data.overallRiskScore}</div>
                            </div>
                            <p class="score-justification">Risk Level: ${data.riskLevel}</p>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card__header"><h4>Political Exposure</h4></div>
                        <div class="card__body">
                            <div class="propagation-metric"><span class="propagation-metric__label">Influence Score</span><span class="propagation-metric__value">${data.politicalExposure?.influenceScore ?? 'N/A'}</span></div>
                            <div style="margin: 0.75rem 0;">${coalitionHtml}</div>
                            <h5 class="text-secondary" style="margin-bottom: 0.5rem;">Key Relationships</h5>
                            <div class="dd-relationship-list">${relationshipsHtml}</div>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card__header"><h4>3R & Cultural Sensitivity Checks</h4></div>
                        <div class="card__body">${sensitivityHtml}</div>
                    </div>
                    <div class="card">
                        <div class="card__header"><h4>Integrity & Reputational Flags</h4></div>
                        <div class="card__body">${integrityHtml}</div>
                    </div>
                    <div class="card">
                        <div class="card__header"><h4>Stakeholder Reactions</h4></div>
                        <div class="card__body"><div class="dd-stakeholder-list">${stakeholderHtml}</div></div>
                    </div>
                    <div class="card">
                        <div class="card__header"><h4>Recommended Mitigation Strategies</h4></div>
                        <div class="card__body"><ul class="dd-mitigation-list">${mitigationHtml}</ul></div>
                    </div>
                </div>
            `;
        }

        /** Renders NusaPulse: Party Sentiment Tracker, built from real stored coverage (/api/stats). */
        async function renderNusaPulsePartyTrackerView() {
            const container = document.getElementById('nusapulse-party-tracker-view');
            if (!container) return;
            container.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>Loading media sentiment…</p></div>`;
            try {
                const [statsRes, feedRes] = await Promise.all([apiFetch('/api/stats?days=7'), apiFetch('/api/feed?limit=200')]);
                const stats = await statsRes.json();
                const feed = await feedRes.json();
                if (stats.error) throw new Error(stats.error);
                renderPartyTrackerContent(stats, feed.items || []);
            } catch (e: any) {
                container.innerHTML = `<div class="empty-state"><h3>Could not load tracker</h3><p class="error-message">${escapeHtml(e.message)}</p></div>`;
            }
        }

        function renderPartyTrackerContent(stats: any, items: any[]) {
            const container = document.getElementById('nusapulse-party-tracker-view');
            if (!container) return;
            const codes = ['BN', 'PH', 'PN', 'GPS', 'GRS'];
            const tally = (code: string, s: string) => (stats.byParty as any[]).filter(r => r.party === code && r.sentiment === s).reduce((a, r) => a + r.n, 0);
            const rows = codes.map(code => {
                const pos = tally(code, 'Positive'), neu = tally(code, 'Neutral'), neg = tally(code, 'Negative');
                const total = pos + neu + neg;
                return { code, pos, neu, neg, total, net: total ? Math.round(((pos - neg) / total) * 100) : 0 };
            });
            const grand = rows.reduce((a, r) => a + r.total, 0);

            if (!grand) {
                container.innerHTML = `
                    <div class="view-header"><div><h2>NusaPulse: Party Sentiment Tracker</h2></div></div>
                    <div class="empty-state"><p>No tagged political coverage yet. Open <strong>Signal → Live Malaysia Feed</strong> and click <strong>Pull latest</strong> first.</p></div>`;
                return;
            }

            const headlines = (code: string) => items.filter(i => i.party === code).slice(0, 4).map(i =>
                `<li><a href="${escapeHtml(i.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(i.title)}</a> <span class="text-secondary">— ${escapeHtml(i.source)}</span></li>`).join('');

            const cards = rows.filter(r => r.total).map(r => `
                <div class="card">
                    <div class="card__header coalition-detail-card__header"><h3>${escapeHtml(INTEL_PARTIES[r.code] || r.code)}</h3>
                        <span class="trend-badge trend-badge--${r.net > 5 ? 'rising' : r.net < -5 ? 'declining' : 'stable'}">Net ${r.net > 0 ? '+' : ''}${r.net}</span></div>
                    <div class="card__body">
                        <div class="propagation-metric"><span class="propagation-metric__label">Articles (7 days)</span><span class="propagation-metric__value">${r.total}</span></div>
                        <div class="ai-report-section"><h4>Latest headlines</h4><ul>${headlines(r.code) || '<li>None yet</li>'}</ul></div>
                    </div>
                </div>`).join('');

            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h2>NusaPulse: Party Sentiment Tracker</h2>
                        <p class="text-secondary">Media sentiment from ${grand} tagged articles over the last ${stats.days} days. This reflects news coverage, not polling.</p>
                    </div>
                    <div style="display:flex; gap:0.75rem;">
                        <button id="refresh-party-tracker-button" class="btn btn--secondary">Refresh</button>
                        <button id="export-party-tracker-pdf-button" class="btn btn--secondary">Export as PDF</button>
                    </div>
                </div>
                <div class="insights-grid" id="party-tracker-export-content">
                    <div class="card"><div class="card__header"><h3>Coverage Volume by Party</h3></div><div id="party-volume-chart" class="card__body"></div></div>
                    <div class="card"><div class="card__header"><h3>Sentiment Mix by Party</h3></div><div id="party-sentiment-comp-chart" class="card__body"></div></div>
                    <div class="card" style="grid-column: 1 / -1;"><div class="card__header"><h3>Daily Net Sentiment</h3></div><div id="party-daily-chart" class="card__body"></div></div>
                    <div style="grid-column: 1 / -1;" class="coalition-detail-grid">${cards}</div>
                </div>`;

            document.getElementById('refresh-party-tracker-button')?.addEventListener('click', renderNusaPulsePartyTrackerView);
            document.getElementById('export-party-tracker-pdf-button')?.addEventListener('click', () => handleGenericPdfExport(
                'party-tracker-export-content', 'export-party-tracker-pdf-button', 'Party Sentiment Tracker Report'));

            const theme = document.body.classList.contains('dark') ? 'dark' : 'light';
            const axis = { labels: { style: { colors: 'var(--text-secondary)' } } };
            const make = (key: string, sel: string, opts: any) => {
                if (appState.charts[key]) appState.charts[key].destroy();
                appState.charts[key] = new ApexCharts(document.querySelector(sel), { ...opts, tooltip: { theme }, grid: { borderColor: 'var(--border-color)' } });
                appState.charts[key].render();
            };
            const labels = rows.map(r => r.code);
            make('partyVolume', '#party-volume-chart', {
                series: [{ name: 'Articles', data: rows.map(r => r.total) }],
                chart: { type: 'bar', height: 320, toolbar: { show: false } },
                plotOptions: { bar: { borderRadius: 4, columnWidth: '50%' } }, dataLabels: { enabled: false },
                xaxis: { categories: labels, ...axis }, yaxis: axis, colors: ['var(--primary)'],
            });
            make('partySentimentComp', '#party-sentiment-comp-chart', {
                series: [
                    { name: 'Positive', data: rows.map(r => r.pos) },
                    { name: 'Neutral', data: rows.map(r => r.neu) },
                    { name: 'Negative', data: rows.map(r => r.neg) },
                ],
                chart: { type: 'bar', height: 320, stacked: true, toolbar: { show: false } },
                plotOptions: { bar: { columnWidth: '55%' } }, dataLabels: { enabled: false },
                xaxis: { categories: labels, ...axis }, yaxis: axis, fill: { opacity: 1 },
                colors: ['var(--success)', 'var(--warning)', 'var(--danger)'],
                legend: { position: 'top', horizontalAlign: 'right', labels: { colors: 'var(--text-secondary)' } },
            });
            const days: string[] = [...new Set<string>((stats.partyDaily as any[]).map(r => r.day))].sort();
            const net = (code: string, day: string) => {
                const r = (stats.partyDaily as any[]).filter(x => x.party === code && x.day === day);
                const t = r.reduce((a, x) => a + x.n, 0);
                const p = r.filter(x => x.sentiment === 'Positive').reduce((a, x) => a + x.n, 0);
                const n = r.filter(x => x.sentiment === 'Negative').reduce((a, x) => a + x.n, 0);
                return t ? Math.round(((p - n) / t) * 100) : null;
            };
            make('partyDaily', '#party-daily-chart', {
                series: rows.filter(r => r.total).map(r => ({ name: r.code, data: days.map(d => net(r.code, d)) })),
                chart: { type: 'line', height: 320, toolbar: { show: false } },
                stroke: { curve: 'smooth', width: 3 }, markers: { size: 4 },
                xaxis: { categories: days, ...axis },
                yaxis: { min: -100, max: 100, labels: { formatter: (v: number) => `${v}`, style: { colors: 'var(--text-secondary)' } } },
                legend: { position: 'top', horizontalAlign: 'right', labels: { colors: 'var(--text-secondary)' } },
            });
        }



        // --- MEASURE: AMEC Barcelona Principles 4.0 ---
        const INTEL_AUDIENCES = ['Government & Regulators', 'Business & Industry', 'Investors & Markets', 'Consumers & Public',
            'Civil Society & NGOs', 'Workforce & Unions', 'General public interest'];
        const MEASURE_METRICS: { [key: string]: string } = {
            volume: 'Coverage volume (articles)',
            positive_share: 'Positive share of coverage (%)',
            negative_share: 'Negative share of coverage (%)',
            net_sentiment: 'Net sentiment (-100 to +100)',
            share_of_voice: 'Share of voice (%)',
        };
        const statusBadge = (s: string) => `<span class="trend-badge trend-badge--${s === 'Met' ? 'rising' : s === 'Behind' ? 'declining' : 'stable'}">${escapeHtml(s)}</span>`;
        const optionList = (items: string[], blank: string) => `<option value="">${blank}</option>` + items.map(i => `<option value="${escapeHtml(i)}">${escapeHtml(i)}</option>`).join('');
        let measureDays = 30;

        async function renderMeasureObjectivesView() {
            const container = document.getElementById('measure-objectives-view');
            if (!container) return;
            container.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>Loading measurement report…</p></div>`;
            let report: any;
            try {
                const res = await apiFetch(`/api/report?days=${measureDays}`);
                report = await res.json();
                if (report.error) throw new Error(report.error);
            } catch (e: any) {
                container.innerHTML = `<div class="empty-state"><p class="error-message">Could not load the report: ${escapeHtml(e.message)}</p></div>`;
                return;
            }

            const scopeText = (o: any) => [o.party, o.sector, o.audience].filter(Boolean).join(' · ') || 'All coverage';
            const rowsHtml = report.impact.objectives.map((o: any) => `
                <tr>
                    <td><strong>${escapeHtml(o.name)}</strong><div class="text-secondary">${escapeHtml(scopeText(o))} · last ${o.days} days</div></td>
                    <td>${escapeHtml(MEASURE_METRICS[o.metric] || o.metric)}</td>
                    <td>${o.comparator === 'atleast' ? '≥' : '≤'} ${o.target}</td>
                    <td>${o.value === null ? '—' : o.value} <span class="text-secondary">(n=${o.sampleSize})</span></td>
                    <td>${statusBadge(o.status)}</td>
                    <td><button class="btn btn--secondary" data-delete-objective="${escapeHtml(o.id)}">Delete</button></td>
                </tr>`).join('') || `<tr><td colspan="6" class="text-secondary">No objectives yet. Add one above: a clear, measurable objective is the starting point of the Barcelona Principles.</td></tr>`;

            const out = report.outputs, oc = report.outcomes, mix = oc.sentimentMix;
            const sourcesHtml = out.bySource.map((s: any) => `<li>${escapeHtml(s.source)} <span class="text-secondary">(${s.n})</span></li>`).join('');
            const audienceHtml = oc.byAudience.map((a: any) => `<tr><td>${escapeHtml(a.audience)}</td><td>${a.articles}</td><td>${a.netSentiment === null ? '—' : (a.netSentiment > 0 ? '+' : '') + a.netSentiment}</td></tr>`).join('')
                || `<tr><td colspan="3" class="text-secondary">No audience-tagged coverage yet. Pull the feed to tag more articles.</td></tr>`;

            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h2>Measure: Objectives &amp; Impact</h2>
                        <p class="text-secondary">Aligned to AMEC Barcelona Principles V4.0. Measured on real coverage over the last ${report.days} days, with no advertising value equivalents (AVEs).</p>
                    </div>
                    <div style="display:flex; gap:0.75rem;">
                        <select id="measure-days" class="form-select">
                            ${[7, 30, 90].map(d => `<option value="${d}" ${d === report.days ? 'selected' : ''}>Last ${d} days</option>`).join('')}
                        </select>
                        <button id="export-measure-pdf-button" class="btn btn--secondary">Export as PDF</button>
                    </div>
                </div>
                <div id="measure-export-content">
                    <div class="card" style="margin-bottom:1.5rem;">
                        <div class="card__header"><h3>1 · Set a measurable objective</h3></div>
                        <div class="card__body">
                            <div class="form-group"><label>Objective name</label><input id="obj-name" class="form-input" maxlength="120" placeholder="e.g. Keep PH net sentiment above 0 among investors" /></div>
                            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:0.75rem;">
                                <div class="form-group"><label>Metric</label><select id="obj-metric" class="form-select">${Object.keys(MEASURE_METRICS).map(k => `<option value="${k}">${MEASURE_METRICS[k]}</option>`).join('')}</select></div>
                                <div class="form-group"><label>Goal</label><select id="obj-comparator" class="form-select"><option value="atleast">At least</option><option value="atmost">At most</option></select></div>
                                <div class="form-group"><label>Target</label><input id="obj-target" type="number" class="form-input" value="50" /></div>
                                <div class="form-group"><label>Window (days)</label><input id="obj-days" type="number" min="1" max="90" class="form-input" value="30" /></div>
                                <div class="form-group"><label>Party (optional)</label><select id="obj-party" class="form-select">${optionList(Object.keys(INTEL_PARTIES), 'Any')}</select></div>
                                <div class="form-group"><label>Sector (optional)</label><select id="obj-sector" class="form-select">${optionList(INTEL_SECTORS, 'Any')}</select></div>
                                <div class="form-group"><label>Stakeholder audience (optional)</label><select id="obj-audience" class="form-select">${optionList(INTEL_AUDIENCES, 'Any')}</select></div>
                            </div>
                            <button id="obj-add" class="btn btn--primary" style="margin-top:0.75rem;">Add objective</button>
                            <span id="obj-msg" class="text-secondary" style="margin-left:0.75rem;"></span>
                        </div>
                    </div>

                    <div class="card" style="margin-bottom:1.5rem;">
                        <div class="card__header"><h3>Impact · objectives (${report.impact.met} of ${report.impact.total} met)</h3></div>
                        <div class="card__body" style="overflow-x:auto;">
                            <table class="measure-table"><thead><tr><th>Objective</th><th>Metric</th><th>Target</th><th>Measured</th><th>Status</th><th></th></tr></thead><tbody>${rowsHtml}</tbody></table>
                        </div>
                    </div>

                    <div class="insights-grid">
                        <div class="card">
                            <div class="card__header"><h3>Outputs</h3></div>
                            <div class="card__body">
                                <div class="propagation-metric"><span class="propagation-metric__label">Articles collected</span><span class="propagation-metric__value">${out.articles}</span></div>
                                <div class="propagation-metric"><span class="propagation-metric__label">Distinct sources</span><span class="propagation-metric__value">${out.sources}</span></div>
                                <p class="text-secondary" style="margin:0.5rem 0;">Channels: ${escapeHtml(out.channels.join(', '))}</p>
                                <div class="ai-report-section"><h4>Top sources</h4><ul>${sourcesHtml || '<li>None yet</li>'}</ul></div>
                            </div>
                        </div>
                        <div class="card">
                            <div class="card__header"><h3>Outcomes · sentiment of coverage</h3></div>
                            <div class="card__body">
                                <div class="propagation-metric"><span class="propagation-metric__label">Net sentiment</span><span class="propagation-metric__value">${oc.netSentiment === null ? '—' : (oc.netSentiment > 0 ? '+' : '') + oc.netSentiment}</span></div>
                                <div id="measure-sentiment-chart"></div>
                            </div>
                        </div>
                        <div class="card" style="grid-column:1 / -1;">
                            <div class="card__header"><h3>Outcomes · by stakeholder audience</h3></div>
                            <div class="card__body" style="overflow-x:auto;">
                                <table class="measure-table"><thead><tr><th>Audience</th><th>Articles</th><th>Net sentiment</th></tr></thead><tbody>${audienceHtml}</tbody></table>
                            </div>
                        </div>
                    </div>
                    <p class="text-secondary" style="margin-top:1rem;">Both quantitative counts and qualitative context (the linked headlines in the Live Feed) should be read together. Sentiment and audience labels are AI-assigned from headlines; see Methodology &amp; Ethics for limits.</p>
                </div>`;

            document.getElementById('measure-days')?.addEventListener('change', (e) => { measureDays = Number((e.target as HTMLSelectElement).value); renderMeasureObjectivesView(); });
            document.getElementById('export-measure-pdf-button')?.addEventListener('click', () => handleGenericPdfExport('measure-export-content', 'export-measure-pdf-button', 'Measurement Report (Barcelona Principles 4.0)'));
            document.querySelectorAll('[data-delete-objective]').forEach(btn => btn.addEventListener('click', async () => {
                await apiFetch(`/api/objectives?id=${encodeURIComponent((btn as HTMLElement).dataset.deleteObjective || '')}`, { method: 'DELETE' });
                renderMeasureObjectivesView();
            }));
            document.getElementById('obj-add')?.addEventListener('click', async () => {
                const v = (id: string) => (document.getElementById(id) as HTMLInputElement).value;
                const msg = document.getElementById('obj-msg')!;
                const res = await apiFetch('/api/objectives', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: v('obj-name'), metric: v('obj-metric'), comparator: v('obj-comparator'), target: v('obj-target'),
                        days: v('obj-days'), party: v('obj-party'), sector: v('obj-sector'), audience: v('obj-audience') }),
                });
                const data = await res.json();
                if (data.error) { msg.textContent = data.error; return; }
                renderMeasureObjectivesView();
            });

            if (appState.charts['measureSentiment']) appState.charts['measureSentiment'].destroy();
            const total = mix.Positive + mix.Neutral + mix.Negative;
            const chartEl = document.querySelector('#measure-sentiment-chart');
            if (chartEl && total) {
                appState.charts['measureSentiment'] = new ApexCharts(chartEl, {
                    series: [mix.Positive, mix.Neutral, mix.Negative], labels: ['Positive', 'Neutral', 'Negative'],
                    chart: { type: 'donut', height: 260 }, colors: ['var(--success)', 'var(--warning)', 'var(--danger)'],
                    legend: { position: 'bottom', labels: { colors: 'var(--text-secondary)' } },
                    tooltip: { theme: document.body.classList.contains('dark') ? 'dark' : 'light' },
                });
                appState.charts['measureSentiment'].render();
            } else if (chartEl) {
                chartEl.innerHTML = '<p class="text-secondary">No tagged coverage yet. Pull the feed first.</p>';
            }
        }

        async function renderMeasureMethodologyView() {
            const container = document.getElementById('measure-methodology-view');
            if (!container) return;
            let q: any = null;
            try { q = (await (await apiFetch('/api/report?days=90')).json()).dataQuality; } catch { /* shown as unavailable */ }
            const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
            const principles = [
                ['1', 'Set clear, measurable objectives', 'Measure → Objectives & Impact: objectives with a metric, target, scope and window, tracked against real coverage.', 'Supported'],
                ['2', 'Define and understand stakeholder audiences', 'Each article is tagged with the stakeholder audience it chiefly concerns, filterable in the Live Feed and reported in Outcomes.', 'Supported (AI-tagged)'],
                ['3', 'Measure all relevant channels', 'Online news (Free Malaysia Today, New Straits Times, Malaysiakini) plus YouTube comments and Reddit once an administrator enables them. Facebook, TikTok, X, WhatsApp and broadcast are not covered, so results are not the whole conversation.', 'Partial'],
                ['4', 'Use qualitative and quantitative analysis', 'Counts, shares and sentiment (quantitative) sit alongside linked source headlines (qualitative). The qualitative read still needs a human analyst.', 'Partial'],
                ['5', 'Do not use AVEs; judge by outcome and impact', 'The platform computes no advertising value equivalents. Impact is judged against your objectives, not a notional media price.', 'Supported'],
                ['6', 'Report outputs, outcomes and impact', 'Measure → Objectives & Impact reports all three, exportable as PDF.', 'Supported'],
                ['7', 'Ethics, governance and transparency', 'This page: sources, method, AI use and known limits are disclosed. Not yet in place: user accounts, access control and audit logs.', 'Partial'],
            ];
            const rows = principles.map(p => `<tr><td>${p[0]}</td><td><strong>${p[1]}</strong><div class="text-secondary">${p[2]}</div></td><td>${statusBadge(p[3] === 'Supported' ? 'Met' : p[3] === 'Partial' ? 'On track' : 'Behind').replace(/>[^<]*</, `>${escapeHtml(p[3])}<`)}</td></tr>`).join('');
            container.innerHTML = `
                <div class="view-header"><div>
                    <h2>Measure: Methodology &amp; Ethics</h2>
                    <p class="text-secondary">How this platform maps to the AMEC Barcelona Principles V4.0 (2025), and what its data can and cannot tell you.</p>
                </div></div>
                <div class="card" style="margin-bottom:1.5rem;"><div class="card__header"><h3>Barcelona Principles V4.0: coverage in this platform</h3></div>
                    <div class="card__body" style="overflow-x:auto;"><table class="measure-table"><thead><tr><th>#</th><th>Principle and how it is applied</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></div>
                <div class="insights-grid">
                    <div class="card"><div class="card__header"><h3>Data and method</h3></div><div class="card__body"><div class="ai-report-section"><ul>
                        <li><strong>Sources:</strong> RSS feeds from Free Malaysia Today, New Straits Times and Malaysiakini, each linked to the original article. Social: public YouTube comments and Reddit posts through their official APIs, when enabled. No author names are stored, and social posts are deleted after 14 days.</li>
                        <li><strong>GNews (optional):</strong> when enabled, Malaysian headlines in English, Chinese and Tamil (the service does not support Malay), delayed by up to 12 hours on its free plan. The free plan is for non-commercial use only.</li>
                        <li><strong>Pulling:</strong> on demand and while the Live Feed is open. There is no always-on collection yet, so gaps are possible.</li>
                        <li><strong>AI tagging:</strong> a Cloudflare Workers AI model (Llama 3.3 70B) assigns sector, party, sentiment and audience from the headline only, not the full text.</li>
                        <li><strong>De-duplication:</strong> articles are matched by URL; the same story from different outlets counts separately.</li>
                    </ul></div></div></div>
                    <div class="card"><div class="card__header"><h3>Data quality (last 90 days)</h3></div><div class="card__body">
                        ${q ? `<div class="propagation-metric"><span class="propagation-metric__label">Articles stored</span><span class="propagation-metric__value">${q.total}</span></div>
                        <div class="propagation-metric"><span class="propagation-metric__label">AI-tagged</span><span class="propagation-metric__value">${pct(q.tagged, q.total)}</span></div>
                        <div class="propagation-metric"><span class="propagation-metric__label">With audience label</span><span class="propagation-metric__value">${pct(q.withAudience, q.total)}</span></div>` : '<p class="text-secondary">Unavailable right now.</p>'}
                    </div></div>
                    <div class="card" style="grid-column:1 / -1;"><div class="card__header"><h3>Limits to keep in mind</h3></div><div class="card__body"><div class="ai-report-section"><ul>
                        <li>Tags are machine-generated from headlines and are sometimes wrong. Spot-check before using a number in a client report.</li>
                        <li>Coverage is news only, so this is not public opinion and not polling, and it says nothing about social media.</li>
                        <li>Sentiment describes the tone of an article, not the opinion of a stakeholder audience.</li>
                        <li>Small samples (low n) swing wildly; the sample size is shown beside every measured value.</li>
                        <li><strong>Why no AVE:</strong> the Barcelona Principles say invalid measures such as advertising value equivalents should not be used. AVEs convert coverage into a notional ad price and say nothing about outcome or impact.</li>
                    </ul></div></div></div>
                </div>
                <p class="text-secondary" style="margin-top:1rem;">Reference: AMEC Barcelona Principles V4.0, amecorg.com. Paraphrased; read the original for the full text.</p>`;
        }

        // --- DASHBOARD: one-screen Malaysia overview built from real stored coverage ---
        const DASH_NS = (pos: number, neg: number, total: number) => (total ? Math.round(((pos - neg) / total) * 100) : null);

        async function renderDashboardView() {
            const container = document.getElementById('dashboard-overview-view');
            if (!container) return;
            container.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>Loading dashboard…</p></div>`;
            let d: any;
            try {
                const res = await apiFetch('/api/overview');
                d = await res.json();
                if (d.error) throw new Error(d.error);
            } catch (e: any) {
                container.innerHTML = `<div class="empty-state"><p class="error-message">Could not load the dashboard: ${escapeHtml(e.message)}</p></div>`;
                return;
            }

            const mix = d.sentimentMix;
            const tagged = mix.Positive + mix.Neutral + mix.Negative;
            const net = DASH_NS(mix.Positive, mix.Negative, tagged);
            // Only compare with the previous day once we have collected for two full days; before that it is not a fair comparison.
            const hasPriorDay = !!d.collectingSince && d.collectingSince <= d.generatedAt - 2 * 86400;
            const delta = hasPriorDay && d.articlesPrev24h ? Math.round(((d.articles24h - d.articlesPrev24h) / d.articlesPrev24h) * 100) : null;

            // Party roll-up
            const partyRows = ['BN', 'PH', 'PN', 'GPS', 'GRS'].map(code => {
                const rows = d.parties.filter((r: any) => r.party === code);
                const g = (s: string) => rows.filter((r: any) => r.sentiment === s).reduce((a: number, r: any) => a + r.n, 0);
                const pos = g('Positive'), neu = g('Neutral'), neg = g('Negative');
                return { code, pos, neu, neg, total: pos + neu + neg };
            });
            const topParty = [...partyRows].sort((a, b) => b.total - a.total)[0];

            // Sector roll-up (top 8 by volume)
            const sectorMap: { [k: string]: { pos: number; neu: number; neg: number } } = {};
            d.sectors.forEach((r: any) => {
                const s = (sectorMap[r.sector] = sectorMap[r.sector] || { pos: 0, neu: 0, neg: 0 });
                if (r.sentiment === 'Positive') s.pos += r.n; else if (r.sentiment === 'Negative') s.neg += r.n; else s.neu += r.n;
            });
            const sectorRows = Object.keys(sectorMap).map(name => ({ name, ...sectorMap[name], total: sectorMap[name].pos + sectorMap[name].neu + sectorMap[name].neg }))
                .sort((a, b) => b.total - a.total).slice(0, 8);

            const kpi = (label: string, value: string, sub: string, tone = '') =>
                `<div class="card kpi"><div class="kpi__label">${label}</div><div class="kpi__value ${tone}">${value}</div><div class="kpi__sub">${sub}</div></div>`;
            const netTone = net === null ? '' : net > 5 ? 'kpi__value--good' : net < -5 ? 'kpi__value--bad' : '';
            const stale = !d.lastPull || (Date.now() / 1000 - d.lastPull) > 3600;

            const headlines = d.latest.map((i: any) => `
                <li class="dash-headline">
                    <a href="${escapeHtml(i.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(i.title)}</a>
                    <div class="text-secondary">${escapeHtml(i.source)} · ${timeAgo(i.publishedAt)}${i.sector ? ' · ' + escapeHtml(i.sector) : ''}${i.sentiment ? ` · <span class="sentiment-tag sentiment-tag--${escapeHtml(i.sentiment.toLowerCase())}">${escapeHtml(i.sentiment)}</span>` : ''}</div>
                </li>`).join('');

            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h2>Malaysia Intelligence Dashboard</h2>
                        <p class="text-secondary">${authState.org ? escapeHtml(authState.org.name) + ' · ' : ''}Real news coverage, last 7 days${d.lastPull ? ` · updated ${timeAgo(d.lastPull)}` : ''}${stale ? ` <span class="trend-badge trend-badge--stable">Data may be stale${autoPullOn() ? '' : ' · click Pull latest'}</span>` : ''}</p>
                    </div>
                    <div class="header-actions">
                        ${autoToggleHtml()}
                        <button id="dash-pull-button" class="btn btn--primary">Pull latest</button>
                    </div>
                </div>

                ${d.quality.total ? '' : `<div class="card" style="margin-bottom:1.5rem;"><div class="card__body"><strong>No coverage collected yet.</strong> Click <em>Pull latest</em> to fetch Malaysian news.</div></div>`}

                <div class="kpi-grid">
                    ${kpi('Articles · last 24h', String(d.articles24h), delta === null ? 'comparison available after 2 days of data' : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% vs previous 24h`)}
                    ${kpi('Net sentiment · 7 days', net === null ? '—' : (net > 0 ? '+' : '') + net, `${tagged} tagged articles`, netTone)}
                    ${kpi('Most covered party', topParty && topParty.total ? escapeHtml(topParty.code) : '—', topParty && topParty.total ? `${topParty.total} articles` : 'no political coverage yet')}
                    ${kpi('Objectives met', d.objectives.total ? `${d.objectives.met}/${d.objectives.total}` : '—', d.objectives.total ? (d.objectives.behind ? `${d.objectives.behind} behind target` : 'none behind target') : 'set one under Measure')}
                </div>

                <div class="dash-grid">
                    <div class="card dash-wide"><div class="card__header"><h3>Coverage &amp; net sentiment by day</h3></div><div class="card__body"><div id="dash-trend-chart"></div></div></div>
                    <div class="card"><div class="card__header"><h3>Sentiment mix</h3></div><div class="card__body"><div id="dash-mix-chart"></div></div></div>
                    <div class="card dash-wide"><div class="card__header"><h3>Sectors · most covered</h3></div><div class="card__body"><div id="dash-sector-chart"></div></div></div>
                    <div class="card"><div class="card__header"><h3>Party coverage</h3></div><div class="card__body"><div id="dash-party-chart"></div></div></div>
                    <div class="card dash-wide"><div class="card__header"><h3>Latest headlines</h3></div><div class="card__body"><ul class="dash-list">${headlines || '<li class="text-secondary">Nothing yet.</li>'}</ul></div></div>
                    <div class="card"><div class="card__header"><h3>Coverage &amp; trust</h3></div><div class="card__body">
                        <ul class="dash-list">
                            <li><strong>Channels:</strong> online news (6 feeds)</li>
                            <li><strong>Social:</strong> not covered. A test of open networks (Bluesky, Mastodon) found no usable Malaysian volume.</li>
                            <li><strong>AI-tagged:</strong> ${d.quality.total ? Math.round((d.quality.tagged / d.quality.total) * 100) : 0}% of articles</li>
                            <li><strong>Top sources:</strong> ${d.sources.map((s: any) => `${escapeHtml(s.source)} (${s.n})`).join(', ') || '—'}</li>
                        </ul>
                        <p class="text-secondary" style="margin-top:0.75rem;">Tags are AI-assigned from headlines. See Measure → Methodology &amp; Ethics.</p>
                    </div></div>
                </div>`;

            const pullBtn = document.getElementById('dash-pull-button') as HTMLButtonElement;
            pullBtn.addEventListener('click', async () => {
                pullBtn.disabled = true; pullBtn.textContent = 'Pulling…';
                await pullLatestNews();
                renderDashboardView();
            });

            const theme = document.body.classList.contains('dark') ? 'dark' : 'light';
            const axisStyle = { labels: { style: { colors: 'var(--text-secondary)' } } };
            const make = (key: string, sel: string, opts: any) => {
                if (appState.charts[key]) appState.charts[key].destroy();
                const el = document.querySelector(sel);
                if (!el) return;
                appState.charts[key] = new ApexCharts(el, { ...opts, tooltip: { theme }, grid: { borderColor: 'var(--border-color)' } });
                appState.charts[key].render();
            };
            const emptyNote = (sel: string, text: string) => { const el = document.querySelector(sel); if (el) el.innerHTML = `<p class="text-secondary">${text}</p>`; };

            // Trend: volume columns + net sentiment line
            if (d.trend.length) {
                make('dashTrend', '#dash-trend-chart', {
                    series: [
                        { name: 'Articles', type: 'column', data: d.trend.map((r: any) => r.n) },
                        { name: 'Net sentiment', type: 'line', data: d.trend.map((r: any) => DASH_NS(r.pos, r.neg, r.n)) },
                    ],
                    chart: { type: 'line', height: 300, toolbar: { show: false } },
                    stroke: { width: [0, 3], curve: 'smooth' }, markers: { size: [0, 4] }, dataLabels: { enabled: false },
                    xaxis: { categories: d.trend.map((r: any) => r.day), ...axisStyle },
                    yaxis: [{ title: { text: 'Articles' }, ...axisStyle }, { opposite: true, min: -100, max: 100, title: { text: 'Net sentiment' }, ...axisStyle }],
                    colors: ['var(--primary)', 'var(--warning)'],
                    legend: { position: 'top', horizontalAlign: 'right', labels: { colors: 'var(--text-secondary)' } },
                });
            } else emptyNote('#dash-trend-chart', 'No tagged coverage yet.');

            if (tagged) {
                make('dashMix', '#dash-mix-chart', {
                    series: [mix.Positive, mix.Neutral, mix.Negative], labels: ['Positive', 'Neutral', 'Negative'],
                    chart: { type: 'donut', height: 300 }, colors: ['var(--success)', 'var(--warning)', 'var(--danger)'],
                    legend: { position: 'bottom', labels: { colors: 'var(--text-secondary)' } },
                });
            } else emptyNote('#dash-mix-chart', 'No tagged coverage yet.');

            if (sectorRows.length) {
                make('dashSector', '#dash-sector-chart', {
                    series: [{ name: 'Positive', data: sectorRows.map(r => r.pos) }, { name: 'Neutral', data: sectorRows.map(r => r.neu) }, { name: 'Negative', data: sectorRows.map(r => r.neg) }],
                    chart: { type: 'bar', height: Math.max(260, sectorRows.length * 38), stacked: true, toolbar: { show: false } },
                    plotOptions: { bar: { horizontal: true, barHeight: '65%' } }, dataLabels: { enabled: false },
                    xaxis: { categories: sectorRows.map(r => r.name), ...axisStyle }, yaxis: { labels: { style: { colors: 'var(--text-secondary)' }, maxWidth: 180 } },
                    colors: ['var(--success)', 'var(--warning)', 'var(--danger)'], fill: { opacity: 1 },
                    legend: { position: 'top', horizontalAlign: 'right', labels: { colors: 'var(--text-secondary)' } },
                });
            } else emptyNote('#dash-sector-chart', 'No sector data yet.');

            if (partyRows.some(r => r.total)) {
                make('dashParty', '#dash-party-chart', {
                    series: [{ name: 'Positive', data: partyRows.map(r => r.pos) }, { name: 'Neutral', data: partyRows.map(r => r.neu) }, { name: 'Negative', data: partyRows.map(r => r.neg) }],
                    chart: { type: 'bar', height: 300, stacked: true, toolbar: { show: false } },
                    plotOptions: { bar: { columnWidth: '55%' } }, dataLabels: { enabled: false },
                    xaxis: { categories: partyRows.map(r => r.code), ...axisStyle }, yaxis: axisStyle,
                    colors: ['var(--success)', 'var(--warning)', 'var(--danger)'], fill: { opacity: 1 },
                    legend: { position: 'top', labels: { colors: 'var(--text-secondary)' } },
                });
            } else emptyNote('#dash-party-chart', 'No political coverage tagged yet.');

            // Auto-refresh (off by default): if switched on and data is stale, pull once per visit. Otherwise it stays manual.
            document.getElementById('auto-pull-toggle')?.addEventListener('change', (e) => {
                setAutoPull((e.target as HTMLInputElement).checked);
                if ((e.target as HTMLInputElement).checked && stale) { pullBtn.click(); }
            });
            if (autoPullOn() && stale && !(appState as any).dashAutoPulled) {
                (appState as any).dashAutoPulled = true;
                pullLatestNews().then(r => { if (r && r.ok && r.newItems) renderDashboardView(); });
            }
        }

        // --- ACCOUNTS: sign-in screen, session check, user menu ---
        function showAuthOverlay(onSuccess: () => void) {
            document.getElementById('auth-overlay')?.remove();
            let mode: 'login' | 'signup' = 'login';
            const overlay = document.createElement('div');
            overlay.id = 'auth-overlay';
            document.body.appendChild(overlay);

            const render = () => {
                const signup = mode === 'signup';
                overlay.innerHTML = `
                    <div class="auth-card card" role="dialog" aria-modal="true" aria-labelledby="auth-title">
                        <div class="card__body">
                            <h2 id="auth-title">${signup ? 'Create your account' : 'Sign in to PRVAIL'}</h2>
                            <p class="text-secondary">${signup ? 'Your organisation gets its own private workspace.' : 'Welcome back.'}</p>
                            <form id="auth-form" novalidate>
                                ${signup ? '<div class="form-group"><label for="auth-name">Your name</label><input id="auth-name" class="form-input" autocomplete="name" maxlength="80"></div><div class="form-group"><label for="auth-org">Organisation</label><input id="auth-org" class="form-input" autocomplete="organization" maxlength="80" required></div>' : ''}
                                <div class="form-group"><label for="auth-email">Email</label><input id="auth-email" type="email" class="form-input" autocomplete="email" required></div>
                                <div class="form-group"><label for="auth-password">Password</label><input id="auth-password" type="password" class="form-input" autocomplete="${signup ? 'new-password' : 'current-password'}" required>${signup ? '<small class="text-secondary">At least 10 characters.</small>' : ''}</div>
                                ${signup ? '<div class="form-group"><label for="auth-code">Invite code <span class="text-secondary">(if you were given one)</span></label><input id="auth-code" class="form-input" autocomplete="off"></div>' : ''}
                                <p id="auth-error" class="error-message" role="alert" style="min-height:1.2em;"></p>
                                <button id="auth-submit" class="btn btn--primary" type="submit" style="width:100%;">${signup ? 'Create account' : 'Sign in'}</button>
                            </form>
                            <p style="margin-top:1rem; text-align:center;"><a href="#" id="auth-toggle">${signup ? 'Already have an account? Sign in' : 'New here? Create an account'}</a></p>
                        </div>
                    </div>`;
                document.getElementById('auth-toggle')!.addEventListener('click', (e) => { e.preventDefault(); mode = signup ? 'login' : 'signup'; render(); });
                (document.getElementById(signup ? 'auth-name' : 'auth-email') as HTMLInputElement | null)?.focus();
                document.getElementById('auth-form')!.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const val = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value || '';
                    const err = document.getElementById('auth-error')!;
                    const btn = document.getElementById('auth-submit') as HTMLButtonElement;
                    err.textContent = '';
                    btn.disabled = true;
                    try {
                        const res = await apiFetch(signup ? '/api/auth/signup' : '/api/auth/login', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(signup
                                ? { name: val('auth-name'), orgName: val('auth-org'), email: val('auth-email'), password: val('auth-password'), code: val('auth-code') }
                                : { email: val('auth-email'), password: val('auth-password') }),
                        });
                        const data = await res.json();
                        if (!res.ok || data.error) { err.textContent = data.error || 'Something went wrong. Try again.'; btn.disabled = false; return; }
                        authState.user = data.user; authState.org = data.org; authState.role = data.role;
                        overlay.remove();
                        onSuccess();
                    } catch {
                        err.textContent = 'Could not reach the server. Check your connection and try again.';
                        btn.disabled = false;
                    }
                });
            };
            render();
        }

        /** Resolves once the visitor has a valid session, showing the sign-in screen if they do not. */
        async function ensureSignedIn(): Promise<void> {
            try {
                const me = await (await apiFetch('/api/auth/me')).json();
                if (me.authenticated) { authState.user = me.user; authState.org = me.org; authState.role = me.role; return; }
            } catch { /* fall through to the sign-in screen */ }
            await new Promise<void>(resolve => showAuthOverlay(resolve));
        }

        function renderUserMenu() {
            const el = document.getElementById('user-menu-container');
            if (!el || !authState.user) return;
            el.innerHTML = `<span class="user-menu__who" title="${escapeHtml(authState.user.email)}">${escapeHtml(authState.user.name || authState.user.email)} · ${escapeHtml(authState.org?.name || '')}</span><button id="logout-button" class="btn btn--secondary" type="button">Sign out</button>`;
            document.getElementById('logout-button')?.addEventListener('click', async () => {
                try { await apiFetch('/api/auth/logout', { method: 'POST' }); } finally { location.reload(); }
            });
        }

        // If a session expires mid-use, ask the user to sign in again and refresh what they were looking at.
        authState.onAuthRequired = () => {
            if (document.getElementById('auth-overlay')) return;
            showAuthOverlay(() => { renderUserMenu(); switchView(getActiveView()); });
        };

        // --- UI Rendering & App Initialization ---
        const viewRenderers: { [key: string]: () => void } = {
            'dashboard-overview-view': renderDashboardView,
            'nusapulse-map-view': renderNusaPulseMapView,
            'veritas-integrity-view': renderVeritasIntegrityView,
            'veritas-propagation-view': renderVeritasPropagationView,
            'signal-feed-view': renderSignalFeedView,
            'signal-image-analysis-view': renderSignalImageAnalysisView,
            'nexus-forecaster-view': renderNexusForecasterView,
            'aegis-reputation-view': renderAegisReputationView,
            'amplify-comms-view': renderAmplifyCommsView,
            'clients-view': renderClientsView,
            // --- NEW VIEWS ---
            'signal-video-view': renderSignalVideoView,
            'signal-video-generation-view': renderSignalVideoGenerationView,
            'veritas-deepfake-view': renderVeritasDeepfakeView,
            'nusapulse-insights-view': renderNusaPulseInsightsView,
            'nexus-stakeholder-view': renderNexusStakeholderView,
            'aegis-scenario-view': renderAegisScenarioView,
            'amplify-campaign-view': renderAmplifyCampaignView,
            'duediligence-vetting-view': renderDueDiligenceView,
            'nusapulse-party-tracker-view': renderNusaPulsePartyTrackerView,
            'measure-objectives-view': renderMeasureObjectivesView,
            'measure-methodology-view': renderMeasureMethodologyView,
        };

        function getActiveView(): string {
             const activeLink = document.querySelector('.sub-nav-item.active');
             return activeLink ? activeLink.getAttribute('data-view') || 'dashboard-overview-view' : 'dashboard-overview-view';
        }

        function switchView(viewId: string) {
            document.querySelectorAll('.view').forEach(v => v.classList.add('view-hidden'));
            const targetView = document.getElementById(viewId);
            if (targetView) {
                targetView.classList.remove('view-hidden');
                viewRenderers[viewId]?.();
                updateSidebar(viewId);
                updateHeaderTitle(viewId);
                // Invalidate map size if switching to map view to fix rendering issues
                if (viewId === 'nusapulse-map-view' && appState.currentClient && appState.mapInstance) {
                     setTimeout(() => appState.mapInstance.invalidateSize(), 10);
                }
                if (viewId === 'veritas-propagation-view') {
                    requestAnimationFrame(updatePropagationLines);
                }
                if (viewId === 'nexus-stakeholder-view') {
                    requestAnimationFrame(updateStakeholderLines);
                }
            }
        }

        function updateSidebar(activeView: string) {
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active-parent', 'open'));
            document.querySelectorAll('.sub-nav-list').forEach(list => list.classList.remove('open'));
            document.querySelectorAll('.sub-nav-item').forEach(item => item.classList.remove('active'));

            const activeItem = document.querySelector(`.sub-nav-item[data-view="${activeView}"]`);
            if (activeItem) {
                activeItem.classList.add('active');
                const parentList = activeItem.closest('.sub-nav-list');
                if (parentList) {
                    parentList.classList.add('open');
                    const parentNavItem = parentList.previousElementSibling;
                    parentNavItem?.classList.add('active-parent', 'open');
                }
            } else if (activeView === 'clients-view') {
                // No specific sidebar item is active for client management
            }
        }
        
        function updateHeaderTitle(viewId: string) {
            const titleEl = document.getElementById('view-title');
            const navItem = document.querySelector(`.sub-nav-item[data-view="${viewId}"]`);
            if (titleEl && navItem) {
                titleEl.textContent = navItem.textContent;
            } else if (titleEl && viewId === 'clients-view') {
                 titleEl.textContent = 'Client Management';
            }
        }

        function updateClientSwitcher() {
            const container = document.getElementById('client-switcher-container');
            if (!container) return;
            
            if (!appState.currentClient) {
                container.innerHTML = `<button id="go-to-clients-btn" class="btn btn--secondary">Add Client</button>`;
                document.getElementById('go-to-clients-btn')?.addEventListener('click', () => switchView('clients-view'));
                return;
            }

            const listItems = appState.clients.map(client => {
                const logoContent = client.logoUrl
                    ? `<img src="${client.logoUrl}" alt="${client.name} logo">`
                    : getInitials(client.name);
                return `
                <li class="client-switcher__item ${client.id === appState.currentClientId ? 'active' : ''}" data-client-id="${client.id}">
                    <div class="client-switcher__logo">${logoContent}</div>
                    <span>${client.name}</span>
                </li>
            `}).join('');
            
            const currentClientLogo = appState.currentClient.logoUrl
                ? `<img src="${appState.currentClient.logoUrl}" alt="${appState.currentClient.name} logo">`
                : getInitials(appState.currentClient.name);

            container.innerHTML = `
                <div class="client-switcher" id="client-switcher">
                    <div class="client-switcher__display" id="client-switcher-display">
                        <div class="client-switcher__logo">${currentClientLogo}</div>
                        <div class="client-switcher__info">
                            <div class="client-switcher__name">${appState.currentClient.name}</div>
                            <div class="client-switcher__label">Current Client</div>
                        </div>
                         <svg class="client-switcher__arrow" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                    <div class="client-switcher__dropdown" id="client-switcher-dropdown">
                        <div class="client-switcher__dropdown-header">Switch Client</div>
                        <ul class="client-switcher__list">
                           ${listItems}
                           <li class="client-switcher__item client-switcher__item--empty" id="manage-clients-link">Manage Clients</li>
                        </ul>
                    </div>
                </div>
            `;
            
            const switcher = document.getElementById('client-switcher');
            const display = document.getElementById('client-switcher-display');
            display?.addEventListener('click', () => switcher?.classList.toggle('open'));

            document.querySelectorAll('.client-switcher__item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const clientId = (e.currentTarget as HTMLElement).dataset.clientId;
                    if (clientId && clientId !== appState.currentClientId) {
                        appState.currentClientId = clientId;
                        updateCurrentClient();
                        updateClientSwitcher();
                        switchView(getActiveView()); // Refresh current view with new client data
                    }
                    switcher?.classList.remove('open');
                });
            });
            
            document.getElementById('manage-clients-link')?.addEventListener('click', () => {
                switchView('clients-view');
                switcher?.classList.remove('open');
            });
            
            // Close dropdown if clicked outside
            document.addEventListener('click', (e) => {
                if (!switcher?.contains(e.target as Node)) {
                    switcher?.classList.remove('open');
                }
            });
        }
        
        function renderAppStructure() {
            if (!appContainer) return;
            appContainer.innerHTML = `
                <aside class="sidebar" id="sidebar">
                    <div class="sidebar__header">
                        <div class="sidebar__title-container">
                            <div class="sidebar__logo-wrapper">
                                <span class="sidebar__title">PR<span class="sidebar__title-v">V</span>AIL</span>
                            </div>
                            <span class="sidebar__tagline">Comms Intelligence</span>
                        </div>
                    </div>
                    <nav class="sidebar__nav">
                        <div class="nav-pillar">
                            <div class="nav-item active-parent open" data-parent="dashboard">
                                <div class="nav-item__content">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
                                    <span class="nav-item__text">Dashboard</span>
                                </div>
                                <svg class="nav-item__arrow" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </div>
                            <ul class="sub-nav-list open">
                                <li><a class="sub-nav-item active" data-view="dashboard-overview-view">Overview</a></li>
                            </ul>
                        </div>
                        <div class="nav-pillar">
                            <div class="nav-item" data-parent="signal">
                                <div class="nav-item__content">
                                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12H2a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h2.5"/><path d="M15 13.1c.9-1.3 1.5-2.9 1.5-4.6 0-4.1-3.3-7.5-7.5-7.5S1.5 4.4 1.5 8.5c0 1.7.6 3.3 1.5 4.6L7 17v3.5a1.5 1.5 0 0 0 3 0V17l3.5-3.9Z"/><path d="M12.5 6.5A2.5 2.5 0 0 1 15 9"/><path d="M18.5 3.5A6.5 6.5 0 0 1 22 10"/></svg>
                                    <span class="nav-item__text">Signal</span>
                                </div>
                                <svg class="nav-item__arrow" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </div>
                            <ul class="sub-nav-list">
                                <li><a class="sub-nav-item" data-view="signal-feed-view">Real-Time Feed</a></li>
                                <li><a class="sub-nav-item" data-view="signal-image-analysis-view">Image Analysis</a></li>
                                <li><a class="sub-nav-item" data-view="signal-video-view">Video Intelligence</a></li>
                                <li><a class="sub-nav-item" data-view="signal-video-generation-view">Video Generation</a></li>
                            </ul>
                        </div>
                        <div class="nav-pillar">
                            <div class="nav-item" data-parent="veritas">
                                <div class="nav-item__content">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
                                    <span class="nav-item__text">Veritas</span>
                                </div>
                                <svg class="nav-item__arrow" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </div>
                             <ul class="sub-nav-list">
                                <li><a class="sub-nav-item" data-view="veritas-integrity-view">Narrative Integrity</a></li>
                                <li><a class="sub-nav-item" data-view="veritas-propagation-view">Propagation Map</a></li>
                                <li><a class="sub-nav-item" data-view="veritas-deepfake-view">Deepfake Detection</a></li>
                            </ul>
                        </div>
                        <div class="nav-pillar">
                             <a class="nav-item" data-parent="nusapulse">
                                <div class="nav-item__content">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                                    <span class="nav-item__text">NusaPulse</span>
                                </div>
                                 <svg class="nav-item__arrow" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </a>
                             <ul class="sub-nav-list">
                                <li><a class="sub-nav-item" data-view="nusapulse-map-view">Regional Map</a></li>
                                <li><a class="sub-nav-item" data-view="nusapulse-insights-view">Industry Insights</a></li>
                                <li><a class="sub-nav-item" data-view="nusapulse-party-tracker-view">Party Sentiment Tracker</a></li>
                            </ul>
                        </div>
                         <div class="nav-pillar">
                            <div class="nav-item" data-parent="nexus">
                                <div class="nav-item__content">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>
                                    <span class="nav-item__text">Nexus</span>
                                </div>
                                <svg class="nav-item__arrow" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </div>
                             <ul class="sub-nav-list">
                                <li><a class="sub-nav-item" data-view="nexus-forecaster-view">Policy Forecaster</a></li>
                                <li><a class="sub-nav-item" data-view="nexus-stakeholder-view">Stakeholder Mapping</a></li>
                            </ul>
                        </div>
                         <div class="nav-pillar">
                            <div class="nav-item" data-parent="aegis">
                                <div class="nav-item__content">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c-.3 0-.6.1-.8.2-.5.3-.8.8-.9 1.3l-2.5 9.1c-.2.5-.1 1.1.1 1.6.3.5.7.9 1.2 1.1l.2.1h0c.2.1.4.1.6.1h6.2c.2 0 .4 0 .6-.1h0l.2-.1c.5-.2.9-.6 1.2-1.1.3-.5.3-1.1.1-1.6l-2.5-9.1c-.1-.5-.4-1-.9-1.3C12.6 2.1 12.3 2 12 2Z"/><path d="M6 16.5c-2-1.5-3-4-2-7"/><path d="M18 16.5c2-1.5 3-4 2-7"/><path d="M12 22v-3"/><path d="M8 22h8"/></svg>
                                    <span class="nav-item__text">Aegis</span>
                                </div>
                                <svg class="nav-item__arrow" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </div>
                             <ul class="sub-nav-list">
                                <li><a class="sub-nav-item" data-view="aegis-reputation-view">Reputation Command</a></li>
                                <li><a class="sub-nav-item" data-view="aegis-scenario-view">Scenario Planner</a></li>
                            </ul>
                        </div>
                        <div class="nav-pillar">
                            <div class="nav-item" data-parent="amplify">
                                <div class="nav-item__content">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
                                    <span class="nav-item__text">Amplify</span>
                                </div>
                                <svg class="nav-item__arrow" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </div>
                             <ul class="sub-nav-list">
                                <li><a class="sub-nav-item" data-view="amplify-comms-view">Comms Suite</a></li>
                                <li><a class="sub-nav-item" data-view="amplify-campaign-view">Campaign Builder</a></li>
                            </ul>
                        </div>
                        <div class="nav-pillar">
                            <div class="nav-item" data-parent="duediligence">
                                <div class="nav-item__content">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                    <span class="nav-item__text">Due Diligence</span>
                                </div>
                                <svg class="nav-item__arrow" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </div>
                             <ul class="sub-nav-list">
                                <li><a class="sub-nav-item" data-view="duediligence-vetting-view">Entity Vetting</a></li>
                            </ul>
                        </div>
                        <div class="nav-pillar">
                            <div class="nav-item" data-parent="measure">
                                <div class="nav-item__content">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>
                                    <span class="nav-item__text">Measure</span>
                                </div>
                                <svg class="nav-item__arrow" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </div>
                             <ul class="sub-nav-list">
                                <li><a class="sub-nav-item" data-view="measure-objectives-view">Objectives &amp; Impact</a></li>
                                <li><a class="sub-nav-item" data-view="measure-methodology-view">Methodology &amp; Ethics</a></li>
                            </ul>
                        </div>
                    </nav>
                </aside>
                <div class="main-wrapper">
                    <header class="header">
                        <h2 id="view-title">Dashboard</h2>
                        <div class="header__actions">
                            <div id="user-menu-container" class="user-menu"></div>
                            <div id="client-switcher-container">
                                <!-- Client switcher is rendered here -->
                            </div>
                            <button id="theme-toggle-button" class="btn btn--icon" aria-label="Toggle theme">
                                <svg id="theme-icon-sun" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                                <svg id="theme-icon-moon" class="hidden" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                            </button>
                            <div class="user-avatar">
                                <img src="https://i.pravatar.cc/80" alt="User avatar">
                            </div>
                        </div>
                    </header>
                    <main class="main-content" id="main-content">
                        <!-- Views are rendered here -->
                        <div id="dashboard-overview-view" class="view"></div>
                        <div id="nusapulse-map-view" class="view view-hidden"></div>
                        <div id="veritas-integrity-view" class="view view-hidden"></div>
                        <div id="veritas-propagation-view" class="view view-hidden"></div>
                        <div id="signal-feed-view" class="view view-hidden"></div>
                        <div id="signal-image-analysis-view" class="view view-hidden"></div>
                        <div id="nexus-forecaster-view" class="view view-hidden"></div>
                        <div id="aegis-reputation-view" class="view view-hidden"></div>
                        <div id="amplify-comms-view" class="view view-hidden"></div>
                        <div id="clients-view" class="view view-hidden"></div>
                         <!-- NEW VIEWS -->
                        <div id="signal-video-view" class="view view-hidden"></div>
                        <div id="signal-video-generation-view" class="view view-hidden"></div>
                        <div id="veritas-deepfake-view" class="view view-hidden"></div>
                        <div id="nusapulse-insights-view" class="view view-hidden"></div>
                        <div id="nexus-stakeholder-view" class="view view-hidden"></div>
                        <div id="aegis-scenario-view" class="view view-hidden"></div>
                        <div id="amplify-campaign-view" class="view view-hidden"></div>
                        <div id="duediligence-vetting-view" class="view view-hidden"></div>
                        <div id="measure-objectives-view" class="view view-hidden"></div>
                        <div id="measure-methodology-view" class="view view-hidden"></div>
                        <div id="nusapulse-party-tracker-view" class="view view-hidden"></div>
                    </main>
                </div>
            `;
        }

        async function initializeApp() {
            if (appState.isInitialized) return;
            const theme = localStorage.getItem('theme') || 'light';
            document.body.className = theme;
            const sunIcon = document.getElementById('theme-icon-sun');
            const moonIcon = document.getElementById('theme-icon-moon');
            if(sunIcon && moonIcon) {
                sunIcon.classList.toggle('hidden', theme === 'dark');
                moonIcon.classList.toggle('hidden', theme === 'light');
            }

            try {
                await fetchClients();
                updateClientSwitcher();
                switchView('dashboard-overview-view');
                appState.isInitialized = true;
            } catch (error) {
                console.error("Initialization failed:", error);
                 const mainContent = document.getElementById('main-content');
                if (mainContent) {
                    mainContent.innerHTML = `<div class="empty-state">
                        <h3>Initialization Failed</h3>
                        <p class="error-message">Could not connect to the backend services. Please check your connection and try again.</p>
                    </div>`;
                }
            }
        }

        function setupEventListeners() {
            // Sidebar Navigation
            document.querySelectorAll('.nav-item').forEach(item => {
                item.addEventListener('click', () => {
                    const parentId = item.getAttribute('data-parent');
                    const subList = item.nextElementSibling as HTMLElement | null;

                    const isOpen = item.classList.contains('open');

                    // Close all others
                    document.querySelectorAll('.nav-item.open').forEach(openItem => {
                        if (openItem !== item) {
                            openItem.classList.remove('open', 'active-parent');
                            const otherSubList = openItem.nextElementSibling as HTMLElement | null;
                            if (otherSubList) otherSubList.classList.remove('open');
                        }
                    });

                    // Toggle current
                    if (!isOpen) {
                        item.classList.add('open', 'active-parent');
                        if (subList) subList.classList.add('open');
                    } else {
                        item.classList.remove('open');
                        if (subList) subList.classList.remove('open');
                    }
                });
            });

            document.querySelectorAll('.sub-nav-item').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const viewId = (e.currentTarget as HTMLElement).dataset.view;
                    if (viewId) {
                        switchView(viewId);
                    }
                });
            });
            
            // Launch Button
            document.getElementById('launch-button')?.addEventListener('click', async () => {
                await ensureSignedIn();
                landingPage?.classList.add('hidden');
                appContainer?.classList.remove('hidden');
                renderAppStructure();
                renderUserMenu();
                setupEventListeners(); // Re-attach listeners to the newly rendered DOM
                initializeApp();
            });
            
            // Theme Toggle
            const themeToggleButton = document.getElementById('theme-toggle-button');
            if (themeToggleButton) {
                themeToggleButton.addEventListener('click', () => {
                    const isDark = document.body.classList.toggle('dark');
                    localStorage.setItem('theme', isDark ? 'dark' : 'light');
                    document.getElementById('theme-icon-sun')?.classList.toggle('hidden', isDark);
                    document.getElementById('theme-icon-moon')?.classList.toggle('hidden', !isDark);
                    
                    // Re-render the current view to update charts with the new theme
                    switchView(getActiveView());
                });
            }

            // --- Info Modal Listeners ---
            const infoModalOverlay = document.getElementById('info-modal-overlay');
            const infoModalClose = document.getElementById('info-modal-close');

            const showInfoModal = (title: string, content: string) => {
                const titleEl = document.getElementById('info-modal-title');
                const contentEl = document.getElementById('info-modal-content');
                if (titleEl && contentEl && infoModalOverlay) {
                    titleEl.textContent = title;
                    contentEl.innerHTML = content;
                    infoModalOverlay.classList.add('visible');
                }
            };
            
            const hideInfoModal = () => {
                infoModalOverlay?.classList.remove('visible');
            };
            
            infoModalClose?.addEventListener('click', hideInfoModal);
            infoModalOverlay?.addEventListener('click', (e) => {
                if (e.target === infoModalOverlay) hideInfoModal();
            });

            document.getElementById('terms-link')?.addEventListener('click', (e) => {
                e.preventDefault();
                showInfoModal('Terms of Service', '<p>Details about terms of service go here. This is a placeholder.</p>');
            });
             document.getElementById('privacy-link')?.addEventListener('click', (e) => {
                e.preventDefault();
                showInfoModal('Privacy Policy', '<p>Details about the privacy policy go here. This is a placeholder.</p>');
            });
             document.getElementById('disclaimer-link')?.addEventListener('click', (e) => {
                e.preventDefault();
                showInfoModal('Responsible AI Disclaimer', '<p>This platform uses generative AI. While we strive for accuracy, the information provided may sometimes be incorrect or incomplete. Please verify critical information independently.</p>');
            });
            
            // --- Add Client Modal ---
            const addClientModal = document.getElementById('add-client-modal-overlay');
            const resetAddLogoUploader = setupLogoUploader('add-client');
            const closeAddClientModal = () => {
                addClientModal?.classList.remove('visible');
                (document.getElementById('client-name-input') as HTMLInputElement).value = '';
                (document.getElementById('client-industry-input') as HTMLInputElement).value = '';
                resetAddLogoUploader();
            };
            document.getElementById('add-client-cancel-button')?.addEventListener('click', closeAddClientModal);
            document.getElementById('add-client-modal-close')?.addEventListener('click', closeAddClientModal);
            document.getElementById('add-client-save-button')?.addEventListener('click', () => {
                const name = (document.getElementById('client-name-input') as HTMLInputElement).value;
                const industry = (document.getElementById('client-industry-input') as HTMLInputElement).value;
                if (name.trim() && industry.trim()) {
                    handleAddClient(name, industry, appState.modalLogoDataUrl);
                    closeAddClientModal();
                } else {
                    showToast('Please fill in all fields.', 'error');
                }
            });

             // --- Edit Client Modal ---
            setupLogoUploader('edit-client');

            // Global listeners
            window.addEventListener('resize', () => {
                updatePropagationLines();
                updateStakeholderLines();
            });
        }
        
        // Initial setup for the landing page
        setupEventListeners();

    } catch (error) {
        if (error instanceof Error) {
            renderErrorBoundary(error);
        } else {
            renderErrorBoundary(new Error('An unknown error occurred.'));
        }
    }
});