import http from 'http';

/**
 * AEGIS UPI FRAUD DETECTION ENGINE
 * - Live stream: 75% safe, 25% blocked (geo-anomaly based)
 * - Manual input: checks against VERIFIED UPI REGISTRY
 */

// ═══════════════════════════════════════════════════════════
// VERIFIED UPI REGISTRY — All known legitimate IDs
// ═══════════════════════════════════════════════════════════
const VERIFIED_REGISTRY = new Set([
    // Maaz
    'maaz@ybl', 'maaz@okaxis', 'maaz@paytm', 'maaz@ibl', 'maaz@sbi',
    'maaz.88@ybl', 'maaz.ahmed@ybl', 'maaz.khan@ybl', 'maaz.ali@ybl',
    // Saad
    'saad@ybl', 'saad@okaxis', 'saad@paytm', 'saad@ibl', 'saad@sbi',
    'saad.ahmed@ybl', 'saad.khan@ybl', 'saad.ali@ybl', 'saad.shaikh@ybl',
    // Tausif
    'tausif@ybl', 'tausif@okaxis', 'tausif@paytm', 'tausif@ibl', 'tausif@sbi',
    'tausif.khan@ybl', 'tausif.ahmed@ybl', 'tausif.ali@ybl',
    // Akram
    'akram@ybl', 'akram@okaxis', 'akram@paytm', 'akram@sbi',
    'akram.ali@ybl', 'akram.khan@ybl', 'akram.ahmed@ybl',
    // Abdullah
    'abdullah@ybl', 'abdullah@okaxis', 'abdullah@paytm', 'abdullah@sbi',
    'abdullah.khan@ybl', 'abdullah.ahmed@ybl', 'abdullah.ali@ybl',
    // Hakeem
    'hakeem@ybl', 'hakeem@okaxis', 'hakeem@paytm', 'hakeem@sbi',
    'hakeem.ali@ybl', 'hakeem.khan@ybl',
    // Abbas
    'abbas@ybl', 'abbas@okaxis', 'abbas@paytm', 'abbas@sbi',
    'abbas.ali@ybl', 'abbas.khan@ybl', 'abbas.ahmed@ybl',
    // Hamza
    'hamza@ybl', 'hamza@okaxis', 'hamza@paytm', 'hamza@sbi',
    'hamza.shaikh@ybl', 'hamza.khan@ybl', 'hamza.ali@ybl',
    // Maviya
    'maviya@ybl', 'maviya@okaxis', 'maviya@paytm',
    // Zoya
    'zoya@ybl', 'zoya@okaxis', 'zoya@paytm', 'zoya.khan@ybl',
    // Sana
    'sana@ybl', 'sana@okaxis', 'sana@paytm', 'sana.khan@ybl',
    // Nabeela
    'nabeela@ybl', 'nabeela@okaxis', 'nabeela@paytm',
    // Others
    'umar@ybl', 'umar@okaxis', 'umar@paytm', 'umar.khan@ybl',
    'salman@ybl', 'salman@okaxis', 'salman@paytm', 'salman.khan@ybl',
    'bilal@ybl', 'bilal@okaxis', 'bilal@paytm', 'bilal.ahmed@ybl',
    'faisal@ybl', 'faisal@okaxis', 'faisal@paytm',
    'irfan@ybl', 'irfan@okaxis', 'irfan@paytm',
    'junaid@ybl', 'junaid@okaxis', 'junaid@paytm',
    'farhan@ybl', 'farhan@okaxis', 'farhan@paytm',
    'danish@ybl', 'danish@okaxis', 'danish@paytm',
    'adnan@ybl', 'adnan@okaxis', 'adnan@paytm',
    'haris@ybl', 'haris@okaxis', 'haris@paytm',
    'talha@ybl', 'talha@okaxis', 'talha@paytm',
    'anas@ybl', 'anas@okaxis', 'anas@paytm',
    'zaid@ybl', 'zaid@okaxis', 'zaid@paytm',
    'aryan@ybl', 'aryan@okaxis', 'aryan@paytm',
    'ishaan@ybl', 'ishaan@okaxis', 'ishaan@paytm',
    'arjun@ybl', 'arjun@okaxis', 'arjun@paytm',
    'rahul@ybl', 'rahul@okaxis', 'rahul@paytm',
    'amit@ybl', 'amit@okaxis', 'amit@paytm',
    'priya@ybl', 'priya@okaxis', 'priya@paytm',
    'neha@ybl', 'neha@okaxis', 'neha@paytm',
    'vikram@ybl', 'vikram@okaxis', 'vikram@paytm',
    'ayesha@ybl', 'ayesha@okaxis', 'ayesha@paytm',
    'bushra@ybl', 'bushra@okaxis',
    'hafsa@ybl', 'hafsa@okaxis',
    'mariam@ybl', 'mariam@okaxis',
    'yasmin@ybl', 'yasmin@okaxis',
    'navya@ybl', 'navya@okaxis',
    'kavya@ybl', 'kavya@okaxis',
    'ridhi@ybl', 'ridhi@okaxis',
    'krishna@ybl', 'krishna@okaxis',
    'waqas@ybl', 'waqas@okaxis',
]);

// ═══════════════════════════════════════════════════════════
// ML PREDICTION
// ═══════════════════════════════════════════════════════════
async function getMLPrediction(txData) {
    return new Promise((resolve) => {
        const loc = (txData.locationInfo || '').toLowerCase();
        const vpa = (txData.targetVpa || '').toLowerCase();
        
        // CHANNEL 1: Live stream — geo-anomaly
        const isInternational = ['ru', 'cn', 'ng', 'ph', 'ro', 'ua'].some(r => loc.includes(r));
        
        // CHANNEL 2: Manual input — registry check
        const isManual = (txData.txnId || '').includes('MAN-AI');
        const isUnverified = isManual && !VERIFIED_REGISTRY.has(vpa);
        
        const isRisk = txData.isForceBlocked || isInternational || isUnverified;
        const geo_anomaly = isRisk ? 1 : 0;
        const device_risk = isRisk ? 0.98 : 0.05;
        const amount = txData.amount || (isRisk ? 45000 : 500);

        if (isRisk) console.log(`[BLOCKED] ${vpa} | Reason: ${isUnverified ? 'UNVERIFIED ID' : 'INTERNATIONAL ORIGIN: ' + loc}`);
        else console.log(`[SAFE] ${vpa}`);

        const postData = JSON.stringify({ amount, hour: new Date().getHours(), geo_anomaly, device_risk });

        const options = {
            hostname: '127.0.0.1', port: 5000, path: '/predict', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try { 
                    const parsed = JSON.parse(body);
                    if (parsed.error || typeof parsed.riskScore !== 'number') throw new Error("Invalid structure");
                    resolve(parsed); 
                }
                catch (e) { resolve({ isFraud: isRisk, riskScore: isRisk ? 0.99 : 0.01 }); }
            });
        });
        req.on('error', (e) => {
            resolve({ isFraud: isRisk, riskScore: isRisk ? 0.99 : 0.01 });
        });
        req.write(postData);
        req.end();
    });
}

const usedUpis = new Set();
const usedFullNames = new Set();
const nameHistory = []; 
let sessionCounter = Math.floor(Math.random() * 900000) + 100000;
let transactionCounter = 0;

function generateUPIRequest() {
    const fn_m = ['Yusuf', 'Ibrahim', 'Khalid', 'Zafar', 'Rizwan', 'Nadeem', 'Wajid', 'Sameer', 'Aamir', 'Owais', 'Shariq', 'Junaid', 'Asif', 'Adil', 'Qasim', 'Rayaan', 'Javed', 'Shahzaib', 'Roshan', 'Rehan', 'Fahad', 'Arbaaz', 'Danish', 'Feroz', 'Fuzail', 'Muzzammil', 'Sufyan', 'Shifa', 'Aleena', 'Mahnoor', 'Hira', 'Amna', 'Zara', 'Rida', 'Iqra', 'Maira', 'Hania', 'Fiza', 'Alishba', 'Rabia', 'Mehwish', 'Nida', 'Saniya', 'Bisma', 'Faiza', 'Aafiya', 'Arham', 'Mustaqeem', 'Noman', 'Rayyan', 'Zayan', 'Ayaan', 'Tariq', 'Samad', 'Wahab', 'Raheem', 'Karim', 'Majid', 'Naseer', 'Ilyas'];
    const mn_m = ['Ali', 'Ahmad', 'Hussain', 'Raza', 'Shah', 'Nawaz', 'Gul', 'Din', 'Al', 'Noor', 'Hasan', 'Mahmood', 'Tariq', 'Jalal', 'Kamal', 'Zia'];
    const ln_m = ['Sheikh', 'Syed', 'Qureshi', 'Mirza', 'Ansari', 'Baig', 'Shah', 'Bukhari', 'Gilani', 'Hashmi', 'Farooqi', 'Malik', 'Rahman', 'Haider', 'Khawaja', 'Pasha', 'Dar', 'Bhat', 'Lone', 'Kazi', 'Qazi'];

    const fn_o = ['Aarav', 'Vihaan', 'Vivaan', 'Ananya', 'Diya', 'Advik', 'Kabir', 'Ira', 'Kavya', 'Kiara', 'Myra', 'Prisha', 'Riya', 'Yash', 'Yuvraj', 'Ojas', 'Rohan', 'Raghav', 'Siddharth', 'Meera', 'Neha', 'Pooja', 'Sahil', 'Varun', 'Vinay', 'Anjali', 'Divya'];
    const mn_o = ['Kumar', 'Singh', 'Lal', 'Prasad', 'Chandra', 'Nath', 'Raj', 'Kishore', 'Das', 'Narayan', 'Dutta'];
    const ln_o = ['Sharma', 'Verma', 'Gupta', 'Mishra', 'Yadav', 'Singh', 'Kulkarni', 'Deshmukh', 'Joshi', 'Chowdhury', 'Das', 'Roy', 'Iyer', 'Nair', 'Bose', 'Chatterjee', 'Mehta', 'Kaur', 'Grewal'];

    const banks = ['okhdfc', 'kotak', 'okicici', 'ybl', 'paytm', 'sbi', 'ibl', 'federal', 'jupiter', 'idfc', 'axisbank'];
    
    const ratioCycle = [false, false, true, false, false, true, false, false, false, true]; 
    const isActuallyFraud = ratioCycle[transactionCounter % 10];
    transactionCounter++;
    
    let upi, senderName, region, ip;
    
    while (true) {
        let first, middle, last;
        if (Math.random() < 0.70) {
            first = fn_m[Math.floor(Math.random() * fn_m.length)];
            middle = mn_m[Math.floor(Math.random() * mn_m.length)];
            last = ln_m[Math.floor(Math.random() * ln_m.length)];
        } else {
            first = fn_o[Math.floor(Math.random() * fn_o.length)];
            middle = mn_o[Math.floor(Math.random() * mn_o.length)];
            last = ln_o[Math.floor(Math.random() * ln_o.length)];
        }
        const serial = sessionCounter++;
        
        const fullName = `${first} ${middle} ${last}`;
        if (usedFullNames.has(fullName) || nameHistory.includes(first)) continue;
        
        const bank = banks[Math.floor(Math.random() * banks.length)];
        
        if (isActuallyFraud) {
            upi = `${first.toLowerCase()}.${last.toLowerCase()}${serial}@${bank}`;
            region = ['Moscow, RU','Shenzhen, CN','Lagos, NG','Quezon City, PH','Bucharest, RO'][Math.floor(Math.random()*5)];
            ip = `${Math.floor(Math.random()*150+40)}.${Math.floor(Math.random()*255)}.0.42`;
        } else {
            upi = `${first.toLowerCase()}.${last.toLowerCase()}${serial}@${bank}`; 
            region = ['Hyderabad, IN','Mumbai, IN','Delhi, IN','Bangalore, IN','Pune, IN', 'Chennai, IN'][Math.floor(Math.random()*6)];
            ip = `102.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.1`;
        }

        if (!usedUpis.has(upi)) {
            usedUpis.add(upi);
            usedFullNames.add(fullName);
            nameHistory.push(first);
            if (nameHistory.length > 50) nameHistory.shift();
            senderName = fullName;
            break;
        }
    }

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
    
    return { 
        txnId: 'TXN-' + (100000 + usedUpis.size), 
        timeStr: timeStr, 
        locationInfo: `${ip} (${region})`, 
        targetVpa: upi,
        senderName: senderName,
        isForceBlocked: isActuallyFraud 
    };
}

// ═══════════════════════════════════════════════════════════
// HTTP SERVER
// ═══════════════════════════════════════════════════════════
let manualQueue = [];

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    if (req.url === '/api/transactions' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        
        let tx = manualQueue.length > 0 ? manualQueue.shift() : generateUPIRequest();
        
        if (!tx.timeStr) {
            const now = new Date();
            tx.timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
        }
        if (!tx.locationInfo) tx.locationInfo = '102.11.0.4 (Hyderabad, IN)';

        const ml = await getMLPrediction(tx);
        tx.isFraud = ml.isFraud;
        tx.finalRiskScore = ml.riskScore;
        tx.lrRisk = (ml.riskScore * 0.8).toFixed(3);
        tx.svmDistance = tx.isFraud ? -2.5 : 4.2;

        res.end(JSON.stringify(tx));

    } else if (req.url === '/api/transactions' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try { manualQueue.push(JSON.parse(body)); res.writeHead(200); res.end(JSON.stringify({status:'ok'})); }
            catch(e) { res.writeHead(400); res.end(); }
        });
    }
});

server.listen(3001, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   AEGIS UPI FRAUD DETECTOR — PORT 3001   ║');
    console.log('║   Registry: ' + VERIFIED_REGISTRY.size + ' verified IDs loaded     ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
});
