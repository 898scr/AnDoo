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

// ルートへのアクセス時に、新しい本番用ファイル (main.html) を返すように変更
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'main.html'));
});

// メモリDB
const usersDb = {}; 
const players = {}; 
let coins = {};     

let economyMultiplier = 1.0; 
const MAX_COINS = 30;
const COIN_BASE_VALUE = 10;

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// 街全体にコインを生成する
function spawnCoin() {
    const id = crypto.randomUUID();
    // 64bit版のスケールに合わせて、コインの出現範囲を街全体（半径800m以内）に広げる
    const r = Math.random() * 800;
    const theta = Math.random() * 2 * Math.PI;
    coins[id] = {
        id: id,
        x: r * Math.cos(theta), 
        y: 0.5, 
        z: r * Math.sin(theta)
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
    // 【修正】スポーン位置をタワーの南側（土台から出た広場）に設定
    players[socket.id] = {
        id: socket.id,
        email: socket.email,
        x: (Math.random() - 0.5) * 40, 
        y: 2, 
        z: 150 + (Math.random() - 0.5) * 40, 
        rotation: 0,
        color: '#' + Math.floor(Math.random()*16777215).toString(16) // 初期アバターカラー
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

    // 2. アバターの色変更の同期
    socket.on('changeAvatar', (colorHex) => {
        if (players[socket.id]) {
            players[socket.id].color = colorHex;
            io.emit('avatarChanged', { id: socket.id, color: colorHex });
        }
    });

    // 3. コイン回収
    socket.on('collectCoin', (coinId) => {
        const p = players[socket.id];
        if (coins[coinId] && p) {
            delete coins[coinId]; 
            
            const reward = Math.round(COIN_BASE_VALUE * parseFloat(economyMultiplier));
            usersDb[socket.email].money += reward;
            
            io.emit('coinCollected', coinId);
            socket.emit('moneyUpdated', usersDb[socket.email].money);
            socket.emit('notification', { type: 'success', text: `コイン獲得！ (x${economyMultiplier}倍) +${reward}G` });

            setTimeout(() => { io.emit('newCoin', spawnCoin()); }, 3000);
        }
    });

    // 4. P2P送金機能
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

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`64bit Metaverse running on port ${PORT}`);
});