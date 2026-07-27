const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// メモリDB
const usersDb = {}; 
const players = {}; 
let coins = {};     

let economyMultiplier = 1.0; 
const MAP_SIZE = 200; // マップを拡張
const MAX_COINS = 30;
const COIN_BASE_VALUE = 10;

// エリア判定ロジック（サーバー側での不正防止用）
function getZone(x, z) {
    if (x >= -40 && x <= 40 && z >= -90 && z <= -50) return 'station';    // 金沢駅前
    if (x >= 20 && x <= 90 && z >= 20 && z <= 90) return 'kenrokuen';     // 兼六園
    if (x >= -90 && x <= -20 && z >= 20 && z <= 90) return 'samurai';     // 武家屋敷
    return 'none';
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// 兼六園エリア内にのみコインを生成する
function spawnCoin() {
    const id = crypto.randomUUID();
    // 兼六園エリア (X: 20〜90, Z: 20〜90) の中にランダム配置
    coins[id] = {
        id: id,
        x: 20 + Math.random() * 70, 
        y: 0.5, 
        z: 20 + Math.random() * 70
    };
    return coins[id];
}
for (let i = 0; i < MAX_COINS; i++) spawnCoin();

// 経済の変動ループ（30秒ごと）
setInterval(() => {
    economyMultiplier = (Math.random() * 2.0 + 0.5).toFixed(2);
    console.log(`[経済変動] 現在の市場倍率: x${economyMultiplier}`);
    io.emit('marketUpdate', economyMultiplier);
}, 30000);

// API: 新規登録
app.post('/api/register', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: '入力が不完全です' });
    if (usersDb[email]) return res.status(400).json({ success: false, message: '既に登録されています' });

    usersDb[email] = { passwordHash: hashPassword(password), money: 500 }; 
    res.json({ success: true, message: '登録完了。ログインしてください。' });
});

// API: ログイン
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const user = usersDb[email];
    if (!user || user.passwordHash !== hashPassword(password)) {
        return res.status(401).json({ success: false, message: '認証に失敗しました' });
    }
    res.json({ success: true, email: email, money: user.money });
});

io.use((socket, next) => {
    const email = socket.handshake.auth.email;
    if (!email || !usersDb[email]) return next(new Error('Auth failed'));
    socket.email = email;
    next();
});

io.on('connection', (socket) => {
    // ログイン時は金沢駅周辺にスポーン
    players[socket.id] = {
        id: socket.id,
        email: socket.email,
        x: (Math.random() - 0.5) * 20, 
        y: 1, 
        z: -60 + (Math.random() - 0.5) * 10,
        rotation: 0,
        color: Math.floor(Math.random() * 0xffffff)
    };

    socket.emit('initData', { 
        players: players, 
        coins: coins,
        multiplier: economyMultiplier 
    });
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // 1. 移動と向きの同期
    socket.on('playerMovement', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].z = data.z;
            players[socket.id].rotation = data.rotation;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // 2. コイン回収
    socket.on('collectCoin', (coinId) => {
        const p = players[socket.id];
        if (coins[coinId] && p) {
            // エリア検証（兼六園エリアにいるか）
            if(getZone(p.x, p.z) !== 'kenrokuen') {
                return socket.emit('notification', { type: 'error', text: '不正なコイン獲得です' });
            }

            delete coins[coinId]; 
            
            const reward = Math.round(COIN_BASE_VALUE * parseFloat(economyMultiplier));
            usersDb[socket.email].money += reward;
            
            io.emit('coinCollected', coinId);
            socket.emit('moneyUpdated', usersDb[socket.email].money);
            socket.emit('notification', { type: 'success', text: `コイン獲得！ (x${economyMultiplier}倍) +${reward}G` });

            setTimeout(() => { io.emit('newCoin', spawnCoin()); }, 3000);
        }
    });

    // 3. P2P送金機能
    socket.on('sendMoney', (data) => {
        const { targetEmail, amount } = data;
        const parsedAmount = parseInt(amount, 10);

        if (isNaN(parsedAmount) || parsedAmount <= 0) return socket.emit('notification', { type: 'error', text: '正しい金額を入力してください' });
        if (targetEmail === socket.email) return socket.emit('notification', { type: 'error', text: '自分自身には送れません' });
        if (usersDb[socket.email].money < parsedAmount) return socket.emit('notification', { type: 'error', text: '残高が不足しています' });
        if (!usersDb[targetEmail]) return socket.emit('notification', { type: 'error', text: 'ユーザーが存在しません' });

        usersDb[socket.email].money -= parsedAmount;
        usersDb[targetEmail].money += parsedAmount;

        socket.emit('moneyUpdated', usersDb[socket.email].money);
        socket.emit('notification', { type: 'success', text: `${targetEmail} へ ${parsedAmount}G 送金しました` });

        const targetSocket = Object.values(players).find(p => p.email === targetEmail);
        if (targetSocket) {
            io.to(targetSocket.id).emit('moneyUpdated', usersDb[targetEmail].money);
            io.to(targetSocket.id).emit('notification', { type: 'info', text: `${socket.email} から ${parsedAmount}G 受け取りました！` });
        }
    });

    // 4. ギャンブル機能（エリア制限付き）
    socket.on('playGamble', (data) => {
        const p = players[socket.id];
        if(!p) return;
        
        // エリア検証（金沢駅エリアにいるか）
        if(getZone(p.x, p.z) !== 'station') {
            return socket.emit('notification', { type: 'error', text: 'ギャンブルは金沢駅エリアでのみ可能です' });
        }

        const betAmount = parseInt(data.amount, 10);
        if (isNaN(betAmount) || betAmount <= 0) return socket.emit('notification', { type: 'error', text: '正しい賭け金を入力してください' });
        if (usersDb[socket.email].money < betAmount) return socket.emit('notification', { type: 'error', text: '残高が不足しています' });

        usersDb[socket.email].money -= betAmount;
        
        const diceRoll = Math.floor(Math.random() * 6) + 1;
        let isWin = false;
        let reward = 0;

        if (diceRoll >= 4) {
            isWin = true;
            const mult = Math.max(parseFloat(economyMultiplier), 1.1); 
            reward = Math.round(betAmount * mult);
            usersDb[socket.email].money += reward;
        }

        socket.emit('moneyUpdated', usersDb[socket.email].money);
        if (isWin) {
            socket.emit('notification', { type: 'success', text: `🎲 ${diceRoll}！ 大当たり！ ${reward}G 獲得！` });
        } else {
            socket.emit('notification', { type: 'error', text: `🎲 ${diceRoll}... ハズレ。 ${betAmount}G 没収。` });
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Kanazawa 3D Metaverse running on port ${PORT}`);
});