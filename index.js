import express from 'express';
import makeWASocket, { useMultiFileAuthState, delay, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import { join } from 'path';

const app = express();
const port = process.env.PORT || 3000;

// --- INTERFACE HTML/CSS ---
const htmlPage = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>L'infini_industry | Session Generator</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .container { background: #1e293b; padding: 2rem; border-radius: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; max-width: 400px; width: 90%; border: 1px solid #334155; }
        h1 { color: #38bdf8; margin-bottom: 0.5rem; font-size: 1.5rem; }
        p { color: #94a3b8; font-size: 0.9rem; margin-bottom: 1.5rem; }
        input { width: 100%; padding: 12px; margin-bottom: 1rem; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: white; box-sizing: border-box; }
        button { background: #38bdf8; color: #0f172a; border: none; padding: 12px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; width: 100%; transition: 0.3s; }
        button:hover { background: #0ea5e9; transform: translateY(-2px); }
        .footer { margin-top: 2rem; font-size: 0.7rem; color: #475569; text-transform: uppercase; letter-spacing: 1px; }
        #result { margin-top: 1.5rem; padding: 10px; border-radius: 8px; display: none; background: #0f172a; border: 1px dashed #38bdf8; word-break: break-all; font-family: monospace; font-size: 0.8rem; }
    </style>
</head>
<body>
    <div class="container">
        <h1>L'infini_industry</h1>
        <p>Générez votre Session ID en toute sécurité via Pairing Code.</p>
        <input type="text" id="number" placeholder="Ex: 227xxxxxxxxx">
        <button onclick="getPairingCode()">Générer le Code</button>
        <div id="result"></div>
        <div class="footer">© 2026 L'infini_industry - Sécurité Garantie</div>
    </div>

    <script>
        async function getPairingCode() {
            const num = document.getElementById('number').value;
            const resDiv = document.getElementById('result');
            if(!num) return alert("Entrez votre numéro !");
            
            resDiv.style.display = "block";
            resDiv.innerHTML = "Génération du code...";
            
            try {
                const response = await fetch('/pair?num=' + num);
                const data = await response.json();
                if(data.code) {
                    resDiv.innerHTML = "Votre code : <b style='color:#38bdf8; font-size:1.2rem;'>" + data.code + "</b><br><br><small>Entrez ce code sur WhatsApp.</small>";
                } else {
                    resDiv.innerHTML = "Erreur. Réessayez.";
                }
            } catch (e) {
                resDiv.innerHTML = "Erreur de connexion au serveur.";
            }
        }
    </script>
</body>
</html>
`;

// --- LOGIQUE SERVEUR ---

app.get('/', (req, res) => {
    res.send(htmlPage);
});

app.get('/pair', async (req, res) => {
    let num = req.query.num;
    if (!num) return res.status(400).json({ error: "Numéro manquant" });

    // Dossier temporaire pour chaque requête
    const sessionPath = `./temp_${Date.now()}`;
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    try {
        const sock = makeWASocket({
            auth: state,
            version,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ["L'infini_industry", "Chrome", "1.0.0"]
        });

        if (!sock.authState.creds.registered) {
            await delay(2000);
            const code = await sock.requestPairingCode(num);
            res.json({ code: code });
        }

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                await delay(5000);
                const creds = JSON.parse(fs.readFileSync(join(sessionPath, 'creds.json'), 'utf-8'));
                const sessionId = "INFINI==" + Buffer.from(JSON.stringify(creds)).toString('base64');
                
                // Envoyer la session au numéro de l'utilisateur sur WhatsApp
                await sock.sendMessage(sock.user.id, { 
                    text: `*CONNEXION RÉUSSIE*\n\nVoici votre SESSION ID :\n\n${sessionId}\n\n_Gardez ce code secret._\n\n© L'infini_industry` 
                });

                // Nettoyage
                await delay(2000);
                fs.rmSync(sessionPath, { recursive: true, force: true });
            }
        });

    } catch (err) {
        res.status(500).json({ error: "Erreur serveur" });
    }
});

app.listen(port, () => console.log(`Serveur L'infini sur le port ${port}`));