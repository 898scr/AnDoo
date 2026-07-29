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
    res.sendFile(path.join(__dirname, 'public', 'main.html'));
});

// ユーザーデータ (キーは username に変更)
const usersDb = {}; 
const players = {}; 
let coins = {};     

let stockPrice = 100; // 株の初期価格
const MAX_COINS = 30;
const COIN_BASE_VALUE = 10; // コイン価値は固定

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// コイン生成
function spawnCoin() {
    const id = crypto.randomUUID();
    const r = Math.random() * 800;
    const theta = Math.random() * 2 * Math.PI;
    coins[id] = { id: id, x: r * Math.cos(theta), y: 0.5, z: r * Math.sin(theta) };
    return coins[id];
}
for (let i = 0; i < MAX_COINS; i++) spawnCoin();

// 経済（株価）の変動ループ（30秒ごと）
setInterval(() => {
    // -20% ～ +20% のランダム変動。最低価格は10G
    const changeRate = 1 + (Math.random() - 0.5) * 0.4;
    stockPrice = Math.floor(Math.max(10, stockPrice * changeRate));
    console.log(`[経済変動] 現在の株価: ${stockPrice}G`);
    io.emit('marketUpdate', stockPrice);
}, 30000);

// API: 新規登録
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: '入力が不完全です' });
    if (usersDb[username]) return res.status(400).json({ success: false, message: '既に存在するユーザー名です' });

    usersDb[username] = { 
        passwordHash: hashPassword(password), 
        money: 500, 
        stocks: 0,
        isBanned: false 
    }; 
    res.json({ success: true, message: '登録完了。ログインしてください。' });
});

// API: ログイン
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = usersDb[username];
    if (!user || user.passwordHash !== hashPassword(password)) {
        return res.status(401).json({ success: false, message: '認証に失敗しました' });
    }
    if (user.isBanned) {
        return res.status(403).json({ success: false, message: 'このアカウントは凍結されています' });
    }
    res.json({ success: true, username: username, money: user.money, stocks: user.stocks });
});

// ソケット認証
io.use((socket, next) => {
    const username = socket.handshake.auth.username;
    if (!username || !usersDb[username] || usersDb[username].isBanned) return next(new Error('Auth failed'));
    socket.username = username;
    socket.isAdmin = false;
    next();
});

io.on('connection', (socket) => {
    const user = usersDb[socket.username];
    
    // スポーン位置：ランドマーク北西 (-50, -50) 付近の歩道
    players[socket.id] = {
        id: socket.id,
        username: socket.username,
        x: -50 + (Math.random() - 0.5) * 10, 
        y: 2, 
        z: -50 + (Math.random() - 0.5) * 10, 
        rotation: 0,
        color: '#' + Math.floor(Math.random()*16777215).toString(16)
    };

    socket.emit('initData', { 
        players: players, 
        coins: coins,
        stockPrice: stockPrice,
        myMoney: user.money,
        myStocks: user.stocks
    });
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // 移動同期
    socket.on('playerMovement', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].z = data.z;
            players[socket.id].rotation = data.rotation;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // アバター色変更
    socket.on('changeAvatar', (colorHex) => {
        if (players[socket.id]) {
            players[socket.id].color = colorHex;
            io.emit('avatarChanged', { id: socket.id, color: colorHex });
        }
    });

    // コイン回収
    socket.on('collectCoin', (coinId) => {
        if (coins[coinId]) {
            delete coins[coinId]; 
            usersDb[socket.username].money += COIN_BASE_VALUE;
            
            io.emit('coinCollected', coinId);
            socket.emit('updateEconomy', { money: usersDb[socket.username].money, stocks: usersDb[socket.username].stocks });
            socket.emit('notification', { type: 'success', text: `コイン獲得！ +${COIN_BASE_VALUE}G` });
            setTimeout(() => { io.emit('newCoin', spawnCoin()); }, 3000);
        }
    });

    // 株購入 (モール内限定)
    socket.on('buyStock', (amountStr) => {
        const amount = parseInt(amountStr, 10);
        if (isNaN(amount) || amount <= 0) return;
        const cost = amount * stockPrice;
        if (usersDb[socket.username].money >= cost) {
            usersDb[socket.username].money -= cost;
            usersDb[socket.username].stocks += amount;
            socket.emit('updateEconomy', { money: usersDb[socket.username].money, stocks: usersDb[socket.username].stocks });
            socket.emit('notification', { type: 'success', text: `株を ${amount}株 購入しました (-${cost}G)` });
        } else {
            socket.emit('notification', { type: 'error', text: '所持金が不足しています' });
        }
    });

    // 株売却 (モール内限定)
    socket.on('sellStock', (amountStr) => {
        const amount = parseInt(amountStr, 10);
        if (isNaN(amount) || amount <= 0) return;
        if (usersDb[socket.username].stocks >= amount) {
            const profit = amount * stockPrice;
            usersDb[socket.username].money += profit;
            usersDb[socket.username].stocks -= amount;
            socket.emit('updateEconomy', { money: usersDb[socket.username].money, stocks: usersDb[socket.username].stocks });
            socket.emit('notification', { type: 'success', text: `株を ${amount}株 売却しました (+${profit}G)` });
        } else {
            socket.emit('notification', { type: 'error', text: '所持株数が不足しています' });
        }
    });

    // チャット＆Adminコマンド処理
    socket.on('chatMessage', (text) => {
        if (text.startsWith('/admin ')) {
            const pass = text.split(' ')[1];
            if (pass === 'admin123') { // 管理者パスワード
                socket.isAdmin = true;
                socket.emit('notification', { type: 'success', text: '【管理者権限】を取得しました' });
            } else {
                socket.emit('notification', { type: 'error', text: 'パスワードが違います' });
            }
            return;
        }
        
        if (socket.isAdmin) {
            if (text.startsWith('/setmoney ')) {
                const parts = text.split(' ');
                const targetUser = parts[1];
                const amount = parseInt(parts[2]);
                if (usersDb[targetUser] && !isNaN(amount)) {
                    usersDb[targetUser].money = amount;
                    io.emit('notification', { type: 'info', text: `[ADMIN] ${targetUser}の所持金を${amount}Gに変更しました` });
                    const targetSocket = Array.from(io.sockets.sockets.values()).find(s => s.username === targetUser);
                    if (targetSocket) targetSocket.emit('updateEconomy', { money: amount, stocks: usersDb[targetUser].stocks });
                }
                return;
            }
            if (text.startsWith('/ban ')) {
                const targetUser = text.split(' ')[1];
                if (usersDb[targetUser]) {
                    usersDb[targetUser].isBanned = true;
                    io.emit('notification', { type: 'error', text: `[ADMIN] ${targetUser} がBANされました` });
                    const targetSocket = Array.from(io.sockets.sockets.values()).find(s => s.username === targetUser);
                    if (targetSocket) targetSocket.disconnect();
                }
                return;
            }
        }

        // 通常のチャットブロードキャスト
        io.emit('chatMessage', { username: socket.username, text: text, isAdmin: socket.isAdmin });
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Metaverse server running on port ${PORT}`);
});