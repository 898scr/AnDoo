const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// JSONと静的ファイルのルーティング設定
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// メモリデータベース（※本番運用時はMongoDB等に置き換えてください）
const usersDb = {}; // { "email": { passwordHash: "...", money: 1000 } }
const players = {}; // 接続中のプレイヤー情報
let coins = {};     // 空間のコイン情報

// 経済システム用のグローバル変数
let economyMultiplier = 1.0; 
const MAP_SIZE = 80;
const MAX_COINS = 40;
const COIN_BASE_VALUE = 10; // コイン1枚の基本価値

// パスワードのハッシュ化関数
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// 初期コイン生成関数
function spawnCoin() {
    const id = crypto.randomUUID();
    coins[id] = {
        id: id,
        x: (Math.random() - 0.5) * (MAP_SIZE - 4),
        y: 0.5, // 地面より少し上
        z: (Math.random() - 0.5) * (MAP_SIZE - 4)
    };
    return coins[id];
}
for (let i = 0; i < MAX_COINS; i++) spawnCoin();

// 経済（市場価値）の変動ループ：30秒ごとに倍率が 0.5倍 〜 2.5倍 の間でランダムに変化
setInterval(() => {
    // 0.50 〜 2.50の範囲でランダム
    economyMultiplier = (Math.random() * 2.0 + 0.5).toFixed(2);
    console.log(`[経済変動] 現在の市場倍率: x${economyMultiplier}`);
    // 全員に新しい倍率を通知
    io.emit('marketUpdate', economyMultiplier);
}, 30000);

// API: 新規登録
app.post('/api/register', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: '入力が不完全です' });
    if (usersDb[email]) return res.status(400).json({ success: false, message: '既に登録されています' });

    usersDb[email] = { passwordHash: hashPassword(password), money: 500 }; // 初期資金500G
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

// Socket.io 接続前の認証チェック
io.use((socket, next) => {
    const email = socket.handshake.auth.email;
    if (!email || !usersDb[email]) return next(new Error('Auth failed'));
    socket.email = email;
    next();
});

io.on('connection', (socket) => {
    console.log(`[接続] ${socket.email} (${socket.id})`);
    
    // 新規プレイヤーの初期化
    players[socket.id] = {
        id: socket.id,
        email: socket.email,
        x: (Math.random() - 0.5) * 20,
        y: 1, // 3Dオブジェクトの中心高さ
        z: (Math.random() - 0.5) * 20,
        rotation: 0,
        color: Math.floor(Math.random() * 0xffffff)
    };

    // 接続者へ初期データを送信（全員の場所、コイン、現在の経済倍率）
    socket.emit('initData', { 
        players: players, 
        coins: coins,
        multiplier: economyMultiplier 
    });
    // 他のプレイヤーに新規参戦を通知
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

    // 2. コイン回収（経済倍率の適用）
    socket.on('collectCoin', (coinId) => {
        if (coins[coinId] && players[socket.id]) {
            delete coins[coinId]; // サーバーから削除
            
            // 現在の倍率を掛けた金額を計算 (四捨五入して整数にする)
            const reward = Math.round(COIN_BASE_VALUE * parseFloat(economyMultiplier));
            usersDb[socket.email].money += reward;
            
            // 全員にコイン消失を通知
            io.emit('coinCollected', coinId);
            // 本人にステータス更新と通知テキストを送信
            socket.emit('moneyUpdated', usersDb[socket.email].money);
            socket.emit('notification', { type: 'success', text: `コイン獲得！ (x${economyMultiplier}倍) +${reward}G` });

            // 3秒後に再生成
            setTimeout(() => { io.emit('newCoin', spawnCoin()); }, 3000);
        }
    });

    // 3. P2P送金機能
    socket.on('sendMoney', (data) => {
        const { targetEmail, amount } = data;
        const parsedAmount = parseInt(amount, 10);

        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return socket.emit('notification', { type: 'error', text: '正しい金額を入力してください' });
        }
        if (targetEmail === socket.email) {
            return socket.emit('notification', { type: 'error', text: '自分自身には送金できません' });
        }
        if (usersDb[socket.email].money < parsedAmount) {
            return socket.emit('notification', { type: 'error', text: '残高が不足しています' });
        }
        if (!usersDb[targetEmail]) {
            return socket.emit('notification', { type: 'error', text: '指定されたユーザーは存在しません' });
        }

        // 送金処理
        usersDb[socket.email].money -= parsedAmount;
        usersDb[targetEmail].money += parsedAmount;

        // 送信元へ通知
        socket.emit('moneyUpdated', usersDb[socket.email].money);
        socket.emit('notification', { type: 'success', text: `${targetEmail} へ ${parsedAmount}G 送金しました` });

        // 送信先がオンラインならリアルタイム通知
        const targetSocket = Object.values(players).find(p => p.email === targetEmail);
        if (targetSocket) {
            io.to(targetSocket.id).emit('moneyUpdated', usersDb[targetEmail].money);
            io.to(targetSocket.id).emit('notification', { type: 'info', text: `${socket.email} から ${parsedAmount}G 受け取りました！` });
        }
    });

    // 4. ギャンブル（ダイス）機能
    socket.on('playGamble', (data) => {
        const betAmount = parseInt(data.amount, 10);
        if (isNaN(betAmount) || betAmount <= 0) {
            return socket.emit('notification', { type: 'error', text: '正しい賭け金を入力してください' });
        }
        if (usersDb[socket.email].money < betAmount) {
            return socket.emit('notification', { type: 'error', text: '残高が不足しています' });
        }

        // まず賭け金を引く
        usersDb[socket.email].money -= betAmount;
        
        // ダイスを振る (1〜6)
        const diceRoll = Math.floor(Math.random() * 6) + 1;
        let isWin = false;
        let reward = 0;

        // ルール: 4, 5, 6 が出たら勝ち。配当は 賭け金 × 現在の経済倍率 (最低1.1倍保証)
        if (diceRoll >= 4) {
            isWin = true;
            const mult = Math.max(parseFloat(economyMultiplier), 1.1); // 最低1.1倍は勝つようにする
            reward = Math.round(betAmount * mult);
            usersDb[socket.email].money += reward;
        }

        // 結果を本人に返す
        socket.emit('moneyUpdated', usersDb[socket.email].money);
        if (isWin) {
            socket.emit('notification', { type: 'success', text: `🎲 ${diceRoll}が出た！ 大当たり！ ${reward}G 獲得！` });
        } else {
            socket.emit('notification', { type: 'error', text: `🎲 ${diceRoll}が出た... ハズレ。 ${betAmount}G 没収。` });
        }
    });

    // 切断処理
    socket.on('disconnect', () => {
        console.log(`[切断] ${socket.email}`);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`3D Metaverse Server running on port ${PORT}`);
});