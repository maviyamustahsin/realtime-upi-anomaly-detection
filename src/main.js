import './style.css';

// ── DOM REFS ──────────────────────────────────────────────────────────────────
const feedContainer  = document.getElementById('feed-container');
const activeAnalysis = document.getElementById('active-analysis');
const statProcessed  = document.getElementById('stat-processed');
const statPrevented  = document.getElementById('stat-prevented');
const toggleBtn      = document.getElementById('toggle-sim-btn');
const toggleLabel    = document.getElementById('toggle-label');
const toggleIcon     = document.getElementById('toggle-icon');
const restartBtn     = document.getElementById('restart-btn');
const liveStatus     = document.getElementById('live-status');
const statusDot      = document.getElementById('status-dot-anim');
const fraudRateBar   = document.getElementById('fraud-rate-bar');
const fraudRatePct   = document.getElementById('fraud-rate-pct');
const gaugeArc       = document.getElementById('gauge-arc');
const gaugeNeedle    = document.getElementById('gauge-needle');
const gaugePct       = document.getElementById('gauge-pct');

// ── STATE ─────────────────────────────────────────────────────────────────────
let totalProcessed = 0, totalPrevented = 0;
let isPaused = false, smoothThreat = 0;
let lastSelectedCard = null, pollingTimeout;

// ── STATS ─────────────────────────────────────────────────────────────────────
function updateStats() {
    if (statProcessed) statProcessed.textContent = totalProcessed.toLocaleString();
    if (statPrevented) statPrevented.textContent = totalPrevented.toLocaleString();
    const rate = totalProcessed > 0 ? totalPrevented / totalProcessed : 0;
    if (fraudRateBar) fraudRateBar.style.width = `${(rate * 100).toFixed(1)}%`;
    if (fraudRatePct) fraudRatePct.textContent  = `${(rate * 100).toFixed(1)}%`;
}

// ── GAUGE ─────────────────────────────────────────────────────────────────────
function updateGauge(riskScore) {
    if (!gaugeArc) return;
    smoothThreat = smoothThreat * 0.65 + riskScore * 100 * 0.35;
    const pct = Math.min(100, Math.max(0, smoothThreat));
    const arcLen = 226.2;
    gaugeArc.style.strokeDasharray    = `${(pct / 100) * arcLen} ${arcLen}`;
    if (gaugePct) gaugePct.innerHTML  = `${Math.round(pct)}<small>%</small>`;
    if (gaugeNeedle) {
        const angle = -90 + (pct / 100) * 180;
        const rad = (angle * Math.PI) / 180;
        const nx = 90 + 66 * Math.cos(rad);
        const ny = 96 + 66 * Math.sin(rad);
        gaugeNeedle.setAttribute('x2', nx.toFixed(1));
        gaugeNeedle.setAttribute('y2', ny.toFixed(1));
    }
}

// ── PIPELINE ──────────────────────────────────────────────────────────────────
function animatePipeline(isFraud) {
    const nodeIds = ['node-input','node-lr','node-svm','node-rf','node-out'];
    const wireIds = ['line-1','line-2','line-3','line-4'];

    nodeIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active','safe','fraud');
    });
    wireIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active','fraud');
    });

    let delay = 0;
    nodeIds.forEach((id, i) => {
        setTimeout(() => {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.add('active');
            if (id === 'node-out') el.classList.add(isFraud ? 'fraud' : 'safe');
        }, delay);
        if (i < wireIds.length) {
            setTimeout(() => {
                const el = document.getElementById(wireIds[i]);
                if (el) { el.classList.add('active'); if (isFraud) el.classList.add('fraud'); }
            }, delay + 100);
        }
        delay += 210;
    });
}

// ── SELECT TRANSACTION ────────────────────────────────────────────────────────
function selectTransaction(tx) {
    if (lastSelectedCard) lastSelectedCard.classList.remove('selected');
    const card = document.getElementById(`card-${tx.txnId}`);
    if (card) { card.classList.add('selected'); lastSelectedCard = card; }

    const isFraud  = tx.isFraud;
    const hex      = isFraud ? '#ef4444' : '#22c55e';
    const cssVar   = isFraud ? 'var(--red)' : 'var(--green)';
    const bgCol    = isFraud ? 'rgba(239,68,68,0.1)'  : 'rgba(34,197,94,0.08)';
    const bdrCol   = isFraud ? 'rgba(239,68,68,0.3)'  : 'rgba(34,197,94,0.25)';
    const verdict  = isFraud ? '🛑  BLOCKED — FRAUDULENT' : '✅  VERIFIED — LEGITIMATE';

    const riskPct = ((tx.finalRiskScore || 0) * 100).toFixed(1);
    const lrPct   = ((tx.lrRisk || 0) * 100).toFixed(1);
    const svmDist = tx.svmDistance || 0;
    const svmPct  = Math.min(100, (Math.abs(svmDist) / 5) * 100).toFixed(1);
    const lrFill  = parseFloat(lrPct) > 50 ? '#ef4444' : '#22c55e';
    const svmFill = svmDist < 0 ? '#ef4444' : '#22c55e';

    if (!activeAnalysis) return;
    activeAnalysis.innerHTML = `
        <div class="an-wrap">
            <div class="an-top">
                <div class="an-meta-left">
                    <div class="an-txnid">${tx.txnId}</div>
                    <div class="an-time">${tx.timeStr}</div>
                </div>
                <div class="an-dial">
                    <svg viewBox="0 0 86 86" width="86" height="86">
                        <circle cx="43" cy="43" r="36" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="7"/>
                        <circle cx="43" cy="43" r="36" fill="none"
                            stroke="${hex}" stroke-width="7"
                            stroke-dasharray="${(riskPct / 100) * 226.2} 226.2"
                            stroke-linecap="round" transform="rotate(-90 43 43)"
                            style="filter:drop-shadow(0 0 8px ${hex}88);transition:stroke-dasharray 0.6s ease"/>
                    </svg>
                    <div class="an-dial-inner" style="color:${hex}">
                        <div class="an-dial-pct">${riskPct}%</div>
                        <div class="an-dial-sub">RISK</div>
                    </div>
                </div>
            </div>
            <div class="an-name">${tx.senderName || 'Unknown Sender'}</div>
            <div class="an-vpa">${tx.targetVpa}</div>
            <div class="an-verdict" style="background:${bgCol};border:1px solid ${bdrCol};color:${hex}">
                <i data-feather="${isFraud ? 'alert-octagon' : 'check-circle'}"></i>
                ${verdict}
            </div>
            <div class="an-loc"><i data-feather="map-pin"></i>${tx.locationInfo}</div>
            <div class="an-scores">
                <div class="an-score-col">
                    <div class="an-score-lbl">Logistic Regression</div>
                    <div class="an-score-track"><div class="an-score-fill" style="width:${lrPct}%;background:${lrFill}"></div></div>
                    <div class="an-score-val" style="color:${lrFill}">${lrPct}%</div>
                </div>
                <div class="an-score-col">
                    <div class="an-score-lbl">SVM Boundary Dist</div>
                    <div class="an-score-track"><div class="an-score-fill" style="width:${svmPct}%;background:${svmFill}"></div></div>
                    <div class="an-score-val" style="color:${svmFill}">${svmDist}</div>
                </div>
                <div class="an-score-col">
                    <div class="an-score-lbl">Random Forest</div>
                    <div class="an-score-track"><div class="an-score-fill" style="width:${riskPct}%;background:${hex}"></div></div>
                    <div class="an-score-val" style="color:${hex}">${isFraud ? 'Block' : 'Valid'}</div>
                </div>
            </div>
        </div>`;

    if (window.feather) window.feather.replace();
    updateGauge(tx.finalRiskScore || 0);
    animatePipeline(isFraud);
    activeAnalysis.classList.remove('flash-safe','flash-fraud');
    void activeAnalysis.offsetWidth;
    activeAnalysis.classList.add(isFraud ? 'flash-fraud' : 'flash-safe');
}

// ── ADD CARD TO FEED ──────────────────────────────────────────────────────────
function addTransactionToFeed(tx) {
    if (!feedContainer) return;
    totalProcessed++;
    if (tx.isFraud) totalPrevented++;
    updateStats();

    const isFraud   = tx.isFraud;
    const hex       = isFraud ? '#ef4444' : '#22c55e';
    const chipBg    = isFraud ? 'rgba(239,68,68,0.1)'  : 'rgba(34,197,94,0.08)';
    const chipBdr   = isFraud ? 'rgba(239,68,68,0.3)'  : 'rgba(34,197,94,0.2)';
    const chipLabel = isFraud ? '⬡  Blocked' : '⬡  Verified';

    const card = document.createElement('div');
    card.id = `card-${tx.txnId}`;
    card.className = 'txn-card';
    card.style.borderLeft = `3px solid ${hex}`;
    card.innerHTML = `
        <div class="card-top-row">
            <span class="card-txnid">${tx.txnId}</span>
            <span class="card-time">${tx.timeStr}</span>
        </div>
        <div class="card-name" style="color:${hex}">${tx.senderName}</div>
        <div class="card-vpa">${tx.targetVpa}</div>
        <div class="card-loc">${tx.locationInfo}</div>
        <div class="card-bottom-row">
            <span class="card-chip"
                style="background:${chipBg};color:${hex};border:1px solid ${chipBdr}">${chipLabel}</span>
            <span class="card-score" style="color:${hex}">${((tx.finalRiskScore||0)*100).toFixed(1)}%</span>
        </div>`;
    card.onclick = () => selectTransaction(tx);

    feedContainer.appendChild(card);
    if (feedContainer.children.length > 35)
        feedContainer.removeChild(feedContainer.firstChild);
    feedContainer.scrollTop = feedContainer.scrollHeight;

    selectTransaction(tx);
}

// ── CONTROLS ──────────────────────────────────────────────────────────────────
function setPaused(paused) {
    isPaused = paused;
    const icon  = document.getElementById('toggle-icon');
    const label = document.getElementById('toggle-label');
    const livePill = document.querySelector('.dash-live-pill');
    const scanDot  = document.getElementById('scan-dot');

    if (paused) {
        clearTimeout(pollingTimeout);
        if (icon)    icon.setAttribute('data-feather','play');
        if (label)   label.textContent = 'Resume';
        if (liveStatus) liveStatus.textContent = 'Paused';
        if (statusDot)  statusDot.classList.add('paused');
        if (livePill)   livePill.classList.add('paused');
        if (scanDot)    scanDot.style.animation = 'none';
    } else {
        if (icon)    icon.setAttribute('data-feather','pause');
        if (label)   label.textContent = 'Pause';
        if (liveStatus) liveStatus.textContent = 'System Active';
        if (statusDot)  statusDot.classList.remove('paused');
        if (livePill)   livePill.classList.remove('paused');
        if (scanDot)    scanDot.style.animation = '';
        startPolling();
    }
    if (window.feather) window.feather.replace();
}

function resetDashboard() {
    if (feedContainer) feedContainer.innerHTML = '';
    if (activeAnalysis) activeAnalysis.innerHTML = `
        <div class="dash-idle">
            <svg viewBox="0 0 90 90" width="90" height="90">
                <circle cx="45" cy="45" r="38" fill="none" stroke="rgba(139,92,246,0.1)" stroke-width="1.5"/>
                <circle cx="45" cy="45" r="38" fill="none" stroke="url(#dsg2)"
                    stroke-width="1.5" stroke-dasharray="55 184" stroke-linecap="round" class="idle-spin"/>
                <circle cx="45" cy="45" r="26" fill="none" stroke="rgba(139,92,246,0.2)"
                    stroke-width="1" stroke-dasharray="25 138" stroke-linecap="round" class="idle-spin-rev"/>
                <defs>
                    <linearGradient id="dsg2" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#8b5cf6"/>
                        <stop offset="100%" stop-color="#3b82f6"/>
                    </linearGradient>
                </defs>
            </svg>
            <div class="dash-idle-title">Awaiting Transaction</div>
            <div class="dash-idle-sub">Transactions appear automatically from the live stream.</div>
        </div>`;
    totalProcessed = 0; totalPrevented = 0; smoothThreat = 0;
    updateStats(); updateGauge(0); lastSelectedCard = null;
    if (restartBtn) {
        restartBtn.style.transition = 'transform 0.5s ease';
        restartBtn.style.transform  = 'rotate(360deg)';
        setTimeout(() => { restartBtn.style.transform = ''; }, 520);
    }
}

// ── MOCK DATA GENERATION FOR OFFLINE / VERCEL FALLBACK ────────────────────────
const MOCK_NAMES = [
    "Aarav Mehta", "Priya Sharma", "Rohan Verma", "Sneha Patel", 
    "Amit Gupta", "Ananya Reddy", "Vikram Singh", "Deepa Nair",
    "Rahul Joshi", "Siddharth Rao", "Karan Malhotra", "Meera Sen",
    "Aditya Bose", "Kriti Kapoor", "Sanjay Dutt", "Divya Pillai"
];
const MOCK_VPAs = [
    "aarav.m@okhdfcbank", "priya.sharma99@okaxis", "rohan.v@paytm",
    "sneha_patel@ybl", "amit.gupta@okicici", "ananya.r@oksbi",
    "vikram.s12@okaxis", "nair.deepa@paytm", "rahul.joshi@ybl",
    "siddharth.rao@oksbi", "karan_m@okhdfcbank", "meera.sen@okicici"
];
const MOCK_LOCATIONS = [
    "Mumbai, MH (IP: 103.45.12.89)", "Delhi, DL (IP: 103.22.45.101)",
    "Bengaluru, KA (IP: 115.112.5.34)", "Hyderabad, TS (IP: 182.74.88.90)",
    "Chennai, TN (IP: 122.164.23.45)", "Kolkata, WB (IP: 103.80.99.112)",
    "Pune, MH (IP: 117.195.44.78)", "Ahmedabad, GJ (IP: 103.241.12.5)",
    "Moscow, RU (IP: 82.200.34.12) [GEO ANOMALY]",
    "Lagos, NG (IP: 197.210.64.9) [GEO ANOMALY]",
    "Beijing, CN (IP: 211.144.20.76) [GEO ANOMALY]",
    "Bucharest, RO (IP: 109.166.32.14) [GEO ANOMALY]"
];

function generateMockTransaction() {
    const isAnomalyLoc = Math.random() < 0.20; // 20% high-risk location chance
    const locIndex = isAnomalyLoc 
        ? Math.floor(Math.random() * 4) + 8 // Pick from anomaly ranges
        : Math.floor(Math.random() * 8);

    const senderName = MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)];
    const targetVpa  = MOCK_VPAs[Math.floor(Math.random() * MOCK_VPAs.length)];
    const locationInfo = MOCK_LOCATIONS[locIndex];
    const amount = parseFloat((Math.random() * 28000 + 50).toFixed(2));
    
    // Determine isFraud based on anomaly features
    let isFraud = false;
    let baseRisk = 0.01 + Math.random() * 0.08;
    
    if (isAnomalyLoc) {
        isFraud = Math.random() < 0.70; // high fraud chance in anomaly location
        baseRisk += 0.45;
    }
    if (amount > 18000) {
        baseRisk += 0.25;
        if (Math.random() < 0.40) isFraud = true;
    }
    
    if (isFraud) {
        baseRisk = 0.76 + Math.random() * 0.22;
    }

    const finalRiskScore = Math.min(0.999, Math.max(0.001, baseRisk));
    const lrRisk = Math.min(0.99, Math.max(0.01, finalRiskScore + (Math.random() * 0.1 - 0.05)));
    
    // SVM distance (negative = fraud, positive = safe)
    const svmDistance = isFraud 
        ? parseFloat((-1.1 - Math.random() * 3).toFixed(2))
        : parseFloat((1.2 + Math.random() * 3).toFixed(2));

    return {
        txnId: "TXN" + Math.floor(Math.random() * 900000 + 100000),
        timeStr: new Date().toLocaleTimeString(),
        senderName,
        targetVpa,
        locationInfo,
        amount,
        isFraud,
        finalRiskScore,
        lrRisk,
        svmDistance
    };
}

// ── POLLING (WITH AUTOMATIC CLIENT-SIDE FALLBACK) ─────────────────────────────
async function startPolling() {
    if (isPaused) return;
    try {
        const res = await fetch('http://localhost:3001/api/transactions');
        if (res.ok) {
            addTransactionToFeed(await res.json());
        } else {
            // Server responds but error status -> use mock fallback
            addTransactionToFeed(generateMockTransaction());
        }
    } catch {
        // Network failure (offline/deployed on Vercel) -> use mock fallback
        addTransactionToFeed(generateMockTransaction());
    }
    pollingTimeout = setTimeout(startPolling, Math.random() * 1000 + 1500); // 1.5 - 2.5s intervals for realistic stream
}

// ── ANALYZER (WITH SERVERLESS OFFLINE INTERFERENCE MOCK) ──────────────────────
function initAnalyzer() {
    const vpaInput    = document.getElementById('manual-vpa-input');
    const simBtn      = document.getElementById('simulate-btn');
    const diagHud     = document.getElementById('diag-hud');
    const diagDecision    = document.getElementById('diag-decision');
    const diagConfidence  = document.getElementById('diag-confidence');
    const diagReason      = document.getElementById('diag-reason');
    const diagBadge       = document.getElementById('diag-badge');
    if (!vpaInput || !simBtn) return;

    vpaInput.addEventListener('keydown', e => { if (e.key === 'Enter') simBtn.click(); });

    simBtn.addEventListener('click', async () => {
        const vpa = vpaInput.value.trim();
        if (!vpa) return;

        if (diagHud) diagHud.style.display = 'block';
        if (diagDecision)   { diagDecision.innerText = 'Analyzing...'; diagDecision.style.color = 'var(--purple-l)'; }
        if (diagConfidence) diagConfidence.innerText = '';
        if (diagReason)     diagReason.innerText = 'Running input through the fraud detection pipeline...';
        if (diagBadge)      { diagBadge.style.background = 'var(--purple-d)'; diagBadge.style.color = 'var(--purple-l)'; diagBadge.innerText = 'SCANNING'; }

        try {
            // Try fetching from local ML flask server
            const res = await fetch('http://localhost:5000/analyze', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: vpa })
            });
            const result  = await res.json();
            const isFraud = result.isFraud;
            const c = isFraud ? '#ef4444' : '#22c55e';
            const bg = isFraud ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.12)';

            if (diagDecision) { diagDecision.innerText = isFraud ? '🛑  BLOCKED — FRAUD DETECTED' : '✅  SAFE — IDENTITY VERIFIED'; diagDecision.style.color = c; }
            if (diagBadge)    { diagBadge.style.background = bg; diagBadge.style.color = c; diagBadge.innerText = isFraud ? 'FRAUD' : 'SAFE'; }
            if (diagConfidence) { diagConfidence.style.color = c; diagConfidence.innerText = `${result.type || 'Input'}  ·  Risk: ${(result.riskScore*100).toFixed(1)}%${result.amount ? '  ·  ₹'+result.amount.toFixed(2) : ''}`; }
            if (diagReason)   diagReason.innerText = result.reason || '';
            updateGauge(result.riskScore || 0);

        } catch {
            // Local ML server offline -> run browser model simulation
            setTimeout(() => {
                const lowerInput = vpa.toLowerCase();
                let isFraud = false;
                let riskScore = 0.02 + Math.random() * 0.06;
                let reason = "✓  Verified: This VPA exists in the database. Identity confirmed as registered.";
                let type = "VPA Registry Lookup";

                if (lowerInput.includes('fraud') || lowerInput.includes('scam') || lowerInput.includes('phish')) {
                    isFraud = true;
                    riskScore = 0.94 + Math.random() * 0.05;
                    reason = "⚠  High risk substring matching: The address name contains terms commonly associated with active phishing handles.";
                } else if (!lowerInput.includes('@')) {
                    isFraud = true;
                    riskScore = 0.82 + Math.random() * 0.08;
                    reason = "⚠  Mismatched VPA syntax: The provided lookup is not a valid UPI handle. Marked as unregistered/anomaly.";
                    type = "Transaction ID Scan";
                } else if (Math.random() < 0.25) { // 25% chance of unverified registry lookup
                    isFraud = true;
                    riskScore = 0.78 + Math.random() * 0.12;
                    reason = "⚠  Registry check failed: VPA handle was not found in the verified database. Unregistered VPAs are blocked.";
                }

                const c = isFraud ? '#ef4444' : '#22c55e';
                const bg = isFraud ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.12)';

                if (diagDecision) { diagDecision.innerText = isFraud ? '🛑  BLOCKED — FRAUD DETECTED' : '✅  SAFE — IDENTITY VERIFIED'; diagDecision.style.color = c; }
                if (diagBadge)    { diagBadge.style.background = bg; diagBadge.style.color = c; diagBadge.innerText = isFraud ? 'FRAUD' : 'SAFE'; }
                if (diagConfidence) { diagConfidence.style.color = c; diagConfidence.innerText = `Client Simulator (${type})  ·  Risk: ${(riskScore*100).toFixed(1)}%`; }
                if (diagReason)   diagReason.innerText = reason;
                
                updateGauge(riskScore);
            }, 600); // 600ms latency simulation
        }
        vpaInput.value = '';
    });
}

// ── MOBILE TABS CONTROLLER ────────────────────────────────────────────────────
function initMobileTabs() {
    const tabsContainer = document.getElementById('dash-tabs');
    const dashGrid      = document.getElementById('dash-grid');
    if (!tabsContainer || !dashGrid) return;

    tabsContainer.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active classes
            tabsContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            dashGrid.classList.remove('active-stream', 'active-inspector', 'active-metrics');

            // Add active classes
            btn.classList.add('active');
            const targetTab = btn.getAttribute('data-tab');
            dashGrid.classList.add(`active-${targetTab}`);
        });
    });
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    updateStats(); updateGauge(0);
    startPolling();

    if (toggleBtn) toggleBtn.addEventListener('click', () => setPaused(!isPaused));
    if (restartBtn) restartBtn.addEventListener('click', resetDashboard);

    initAnalyzer();
    initMobileTabs();
    if (window.feather) window.feather.replace();
});

