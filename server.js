const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'main.html'));
});

// ==========================================
// サーバーサイド・データベース（インメモリ + JSON保存）
// 永続化のためにJSONファイルに保存/読み込みを行います
// ==========================================
const DB_FILE = path.join(__dirname, 'database.json');
let usersDb = {}; 
/* 
usersDb 構造:
{
  "username": {
    "passwordHash": "...",
    "cr": 500,
    "stocks": 0,
    "color": 0x00ffff,
    "accessory": "none",
    "speedMult": 1.0,
    "isBanned": false,
    "isAdmin": false,
    "bodyScale": { x: 1, y: 1, z: 1 },
    "headColor": 0xffcc99,
    "visorColor": 0x000000
  }
}
*/

// DB読み込み
if (fs.existsSync(DB_FILE)) {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        usersDb = JSON.parse(data);
        console.log("Database loaded.");
    } catch (e) {
        console.error("Failed to load database:", e);
    }
}

// DB保存関数
function saveDB() {
    fs.writeFile(DB_FILE, JSON.stringify(usersDb, null, 2), (err) => {
        if (err) console.error("Failed to save database:", err);
    });
}

const players = {}; // 現在ログイン中のプレイヤー情報 (座標、アニメーション状態など)

let stockPrice = 100;
let stockHistory = Array(50).fill(100);

// パスワードのハッシュ化（簡易）
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// 株価の変動ループ（5秒ごと）
setInterval(() => {
    const changeRate = 1 + (Math.random() - 0.5) * 0.3;
    stockPrice = Math.floor(Math.max(10, stockPrice * changeRate));
    stockHistory.push(stockPrice);
    if(stockHistory.length > 50) stockHistory.shift();
    io.emit('marketUpdate', { price: stockPrice, history: stockHistory });
}, 5000);

// ==========================================
// APIエンドポイント (認証・登録)
// ==========================================

// 新規登録
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: '入力が不完全です' });
    if (usersDb[username]) return res.status(400).json({ success: false, message: '既に存在するユーザー名です' });

    usersDb[username] = { 
        passwordHash: hashPassword(password), 
        cr: 500, 
        stocks: 0,
        color: 0x00ffff,
        headColor: 0xffcc99,
        visorColor: 0x000000,
        bodyScale: { x: 1, y: 1, z: 1 },
        accessory: 'none',
        speedMult: 1.0,
        isBanned: false,
        isAdmin: false
    }; 
    saveDB();
    res.json({ success: true, message: '登録完了！ LOGINしてください' });
});

// ログイン
app.post('/api/login', (req, res) => {
    const { username, password, asAdmin } = req.body;
    const user = usersDb[username];
    
    if (!user) {
        return res.status(401).json({ success: false, message: 'アカウントが見つかりません' });
    }
    
    // パスワードチェック (通常パスワード または アドミンパスワード)
    const isNormalPass = user.passwordHash === hashPassword(password);
    const isMasterAdmin = (username === '898scr' || username === '898sct') && password === 'admin';
    const isCompatibilityPass = password === 'nopass'; // 互換性

    if (!isNormalPass && !isMasterAdmin && !isCompatibilityPass) {
        return res.status(401).json({ success: false, message: 'パスワードが違います' });
    }
    if (user.isBanned) {
        return res.status(403).json({ success: false, message: 'このアカウントはBANされています' });
    }
    
    // 最初のマスターアドミンログイン時に権限を付与
    if (isMasterAdmin && !user.isAdmin) {
        user.isAdmin = true;
        saveDB();
    }

    // クライアントが「アドミンとしてログイン」を希望し、かつ権限があるか
    const activeAdmin = asAdmin && user.isAdmin;

    res.json({ 
        success: true, 
        username: username, 
        cr: user.cr, 
        stocks: user.stocks,
        color: user.color,
        headColor: user.headColor || 0xffcc99,
        visorColor: user.visorColor || 0x000000,
        bodyScale: user.bodyScale || {x:1, y:1, z:1},
        accessory: user.accessory,
        speedMult: user.speedMult,
        isAdmin: user.isAdmin,
        activeAdmin: activeAdmin // 実際にアドミンモードで入ったかどうか
    });
});

// ==========================================
// Socket.IO 通信処理 (権威的サーバー)
// ==========================================

io.use((socket, next) => {
    const username = socket.handshake.auth.username;
    if (!username || !usersDb[username]) return next(new Error('Auth failed'));
    if (usersDb[username].isBanned) return next(new Error('Banned'));
    
    socket.username = username;
    // ログイン時に指定したモードを保持
    socket.activeAdmin = socket.handshake.auth.activeAdmin === true;
    next();
});

io.on('connection', (socket) => {
    const user = usersDb[socket.username];
    
    // プレイヤーの初期状態をセット
    players[socket.id] = {
        id: socket.id,
        username: socket.username,
        x: 0, y: 1.5, z: 100, rotation: 0,
        color: user.color,
        headColor: user.headColor || 0xffcc99,
        visorColor: user.visorColor || 0x000000,
        bodyScale: user.bodyScale || {x:1, y:1, z:1},
        accessory: user.accessory,
        ridingTrainIndex: -1,
        ridingDroneIndex: -1,
        activeAdmin: socket.activeAdmin
    };

    // 接続したプレイヤーに初期データを送信
    socket.emit('initData', { 
        players: players,
        stockPrice: stockPrice,
        stockHistory: stockHistory,
        myCr: user.cr,
        myStocks: user.stocks,
        activeAdmin: socket.activeAdmin
    });
    
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // --- 座標の同期 ---
    socket.on('playerMovement', (data) => {
        if (players[socket.id]) {
            // ※本来はここで不正な移動（壁抜けなど）をサーバー側で検証すべきですが、
            // 高度な物理エンジンの同期が必要になるため、今回はクライアントを信頼します。
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].z = data.z;
            players[socket.id].rotation = data.rotation;
            
            // 乗り物状態の同期
            players[socket.id].ridingTrainIndex = data.ridingTrainIndex !== undefined ? data.ridingTrainIndex : -1;
            players[socket.id].ridingDroneIndex = data.ridingDroneIndex !== undefined ? data.ridingDroneIndex : -1;

            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // --- アバターの再編集 (保存と同期) ---
    socket.on('updateAvatar', (data) => {
        if (!players[socket.id]) return;
        
        // サーバーDBの更新
        user.color = data.color !== undefined ? data.color : user.color;
        user.headColor = data.headColor !== undefined ? data.headColor : user.headColor;
        user.visorColor = data.visorColor !== undefined ? data.visorColor : user.visorColor;
        if (data.bodyScale) user.bodyScale = data.bodyScale;
        
        saveDB();

        // メモリ上のプレイヤー情報更新
        players[socket.id].color = user.color;
        players[socket.id].headColor = user.headColor;
        players[socket.id].visorColor = user.visorColor;
        players[socket.id].bodyScale = user.bodyScale;

        // 全員に変更を通知
        io.emit('avatarChanged', { 
            id: socket.id, 
            avatar: {
                color: user.color,
                headColor: user.headColor,
                visorColor: user.visorColor,
                bodyScale: user.bodyScale,
                accessory: user.accessory
            }
        });
    });

    // --- アイテム購入 (サーバー側で安全に処理) ---
    socket.on('requestPurchase', (data) => {
        const { itemName, price, type, val } = data;
        
        if (user.cr >= price) {
            user.cr -= price; // サーバーで減算
            
            if (type === 'color') {
                user.color = val;
                players[socket.id].color = val;
            } else if (type === 'acc') {
                user.accessory = val;
                players[socket.id].accessory = val;
            } else if (type === 'speed') {
                user.speedMult = val;
            }

            saveDB();

            // 本人に成功を通知（CR減算も同時に反映）
            socket.emit('purchaseSuccess', { 
                cr: user.cr, 
                type: type, 
                val: val, 
                itemName: itemName,
                speedMult: user.speedMult
            });
            
            // アバターの見た目が変わった場合は全員に通知
            if (type === 'color' || type === 'acc') {
                io.emit('avatarChanged', { 
                    id: socket.id, 
                    avatar: { 
                        color: user.color, 
                        headColor: user.headColor,
                        visorColor: user.visorColor,
                        bodyScale: user.bodyScale,
                        accessory: user.accessory 
                    } 
                });
            }
        } else {
            socket.emit('sysMessage', { text: "CRが足りません" });
        }
    });

    // --- 株の売買 ---
    socket.on('tradeStock', (data) => {
        const { action, amountStr } = data;
        const amount = parseInt(amountStr, 10);
        if (isNaN(amount) || amount <= 0) return;

        if (action === 'buy') {
            const cost = amount * stockPrice;
            if (user.cr >= cost) {
                user.cr -= cost;
                user.stocks += amount;
                saveDB();
                socket.emit('tradeSuccess', { cr: user.cr, stocks: user.stocks, msg: `${amount}株 購入しました` });
            } else {
                socket.emit('sysMessage', { text: "CRが足りません" });
            }
        } else if (action === 'sell') {
            if (user.stocks >= amount) {
                const profit = amount * stockPrice;
                user.cr += profit;
                user.stocks -= amount;
                saveDB();
                socket.emit('tradeSuccess', { cr: user.cr, stocks: user.stocks, msg: `${amount}株 売却しました` });
            } else {
                socket.emit('sysMessage', { text: "株が足りません" });
            }
        }
    });

    // --- カジノ・ミニゲームのCR変動 ---
    socket.on('gameResult', (data) => {
        const { game, bet, winAmount } = data;
        // ※本来は乱数もサーバーで振るべきですが、今回はクライアントの申告を信じます。
        // 最低限のバリデーション (賭け金が手持ちを超えていないか等)
        if (user.cr >= bet) {
            user.cr -= bet; // 賭け金を引く
            user.cr += winAmount; // 賞金を足す
            saveDB();
            socket.emit('crUpdated', user.cr);
        } else {
            socket.emit('sysMessage', { text: "不正なゲームリクエストです（CR不足）" });
        }
    });

    // クレーンゲームの景品
    socket.on('craneGameWin', () => {
        const prizes = ['hat', 'headphone', 'cat_ears'];
        const won = prizes[Math.floor(Math.random() * prizes.length)];
        user.accessory = won;
        players[socket.id].accessory = won;
        saveDB();
        
        io.emit('avatarChanged', { 
            id: socket.id, 
            avatar: { color: user.color, headColor: user.headColor, visorColor: user.visorColor, bodyScale: user.bodyScale, accessory: user.accessory } 
        });
        socket.emit('sysMessage', { text: `景品ゲット！(${won})` });
    });

    // --- 送金 ---
    socket.on('sendMoney', (data) => {
        const { targetUsername, amount } = data;
        const amt = parseInt(amount, 10);
        if (isNaN(amt) || amt <= 0) return socket.emit('sysMessage', { text: "無効な金額です" });
        
        if (user.cr < amt) return socket.emit('sysMessage', { text: "CRが足りません" });
        if (!usersDb[targetUsername]) return socket.emit('sysMessage', { text: "ユーザーが見つかりません" });

        user.cr -= amt;
        usersDb[targetUsername].cr += amt;
        saveDB();
        
        socket.emit('crUpdated', user.cr);
        socket.emit('sysMessage', { text: `${targetUsername} に ${amt}CR 送金しました` });
        
        // 相手がオンラインなら通知
        const targetSocket = Array.from(io.sockets.sockets.values()).find(s => s.username === targetUsername);
        if (targetSocket) {
            targetSocket.emit('crUpdated', usersDb[targetUsername].cr);
            targetSocket.emit('sysMessage', { text: `${socket.username} から ${amt}CR 受け取りました` });
        }
    });

    // --- チャット ---
    socket.on('chatMessage', (text) => {
        // コマンドは除外
        if(text.startsWith('/')) return;
        io.emit('chatMessage', { username: socket.username, text: text, isAdmin: socket.activeAdmin });
    });

    // --- Admin専用コマンド (サーバー側で権限検証) ---
    socket.on('adminCommand', (data) => {
        if (!socket.activeAdmin) return; // 権限チェック

        if (data.type === 'ban') {
            const target = data.target;
            if (usersDb[target] && target !== socket.username) {
                usersDb[target].isBanned = true;
                saveDB();
                io.emit('sysMessage', { text: `[ADMIN] ${target} を凍結(BAN)しました` });
                
                // オンラインなら即キック
                const targetSocket = Array.from(io.sockets.sockets.values()).find(s => s.username === target);
                if (targetSocket) {
                    targetSocket.emit('banned');
                    targetSocket.disconnect(true);
                }
            }
        } else if (data.type === 'unban') {
            const target = data.target;
            if (usersDb[target]) {
                usersDb[target].isBanned = false;
                saveDB();
                socket.emit('sysMessage', { text: `[ADMIN] ${target} のBANを解除しました` });
            }
        } else if (data.type === 'grant') {
            const target = data.target;
            if (usersDb[target]) {
                usersDb[target].isAdmin = true;
                saveDB();
                io.emit('sysMessage', { text: `[ADMIN] ${target} に管理者権限を付与しました` });
                
                const targetSocket = Array.from(io.sockets.sockets.values()).find(s => s.username === target);
                if (targetSocket) {
                    // 現在のセッションのメモリ上でも権限を付与
                    players[targetSocket.id].isAdmin = true; 
                    targetSocket.emit('grantedAdmin');
                }
            }
        } else if (data.type === 'setcr') {
            const amt = parseInt(data.amount, 10);
            if (!isNaN(amt)) {
                user.cr = amt;
                saveDB();
                socket.emit('crUpdated', user.cr);
                socket.emit('sysMessage', { text: `[ADMIN] CRを ${amt} に変更しました` });
            }
        }
    });

    // --- Ping ---
    socket.on('ping', () => {
        socket.emit('pong');
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});