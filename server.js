const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
// パスワードのハッシュ化などに使う標準モジュール（今回は簡易的にcryptoを使用）
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- 簡易データベース（メモリ上に保存。サーバー再起動で消える点に注意） ---
// 本格運用時はMongoDBやPostgreSQLなどのデータベースを使用します。
const usersDb = {}; // 登録ユーザー情報 { "email@example.com": { passwordHash: "...", money: 0 } }
const players = {}; // 現在接続中のプレイヤー情報 { socketId: { email, x, y, z, rotation, color, money } }
let coins = {};     // マップ上のコイン情報 { coinId: { x, y, z } }

// --- 初期設定 ---
const MAX_COINS = 30; // マップ上に存在する最大コイン数
const MAP_SIZE = 50;  // マップの一辺の長さ

// JSONデータを受け取るための設定
app.use(express.json());
// publicフォルダ内の静的ファイルを配信
app.use(express.static(path.join(__dirname, 'public')));

// ルートへのアクセスでpublic/index.htmlを返す
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// パスワードをハッシュ化する関数（セキュリティ対策）
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// 乱数でスポーン色を選択
function getRandomColor() {
    const colors = [0xff4d4d, 0x4d94ff, 0x4dff88, 0xffd633, 0xff4dff, 0x00ffff];
    return colors[Math.floor(Math.random() * colors.length)];
}

// ランダムな位置にコインを生成する関数
function spawnCoin() {
    const id = crypto.randomUUID();
    // 障害物がないであろうランダムな座標（簡易的に範囲内でランダム）
    coins[id] = {
        id: id,
        x: (Math.random() - 0.5) * (MAP_SIZE - 4),
        y: 0.5, // コインの高さ
        z: (Math.random() - 0.5) * (MAP_SIZE - 4)
    };
    return coins[id];
}

// 初期コインの生成
for(let i = 0; i < MAX_COINS; i++) {
    spawnCoin();
}

// ==========================================
// 1. 簡易メール認証API (Express)
// ==========================================

// 新規登録エンドポイント
app.post('/api/register', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'メールアドレスとパスワードを入力してください' });
    }
    if (usersDb[email]) {
        return res.status(400).json({ success: false, message: 'このメールアドレスは既に登録されています' });
    }

    // ユーザー情報を保存
    usersDb[email] = {
        passwordHash: hashPassword(password),
        money: 0 // 初期所持金
    };
    console.log(`新規登録: ${email}`);
    res.json({ success: true, message: '登録が完了しました。ログインしてください。' });
});

// ログインエンドポイント
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    const user = usersDb[email];
    if (!user || user.passwordHash !== hashPassword(password)) {
        return res.status(401).json({ success: false, message: 'メールアドレスまたはパスワードが間違っています' });
    }

    console.log(`ログイン成功: ${email}`);
    // 成功時、ユーザーデータ（パスワード以外）を返す
    res.json({ success: true, email: email, money: user.money });
});

// ==========================================
// 2 & 4. リアルタイム通信 & 経済システム (Socket.io)
// ==========================================

// クライアント側から認証情報（email）を受け取って接続を許可するミドルウェア
io.use((socket, next) => {
    const email = socket.handshake.auth.email;
    if (!email || !usersDb[email]) {
        return next(new Error('Authentication error'));
    }
    socket.email = email; // ソケットにメールアドレスを紐付け
    next();
});

io.on('connection', (socket) => {
    console.log(`プレイヤー接続 (${socket.email}): ${socket.id}`);
    
    const userDbData = usersDb[socket.email];

    // 新規プレイヤーの初期位置・パラメータ設定
    players[socket.id] = {
        id: socket.id,
        email: socket.email,
        x: (Math.random() - 0.5) * 10,
        y: 0.75,
        z: (Math.random() - 0.5) * 10,
        rotation: 0, // 向きの情報を追加
        color: getRandomColor(),
        money: userDbData.money // DBから所持金を読み込み
    };

    // 接続者本人へ現在の全プレイヤーとコイン情報を送信
    socket.emit('initData', { players: players, coins: coins });

    // 他の全プレイヤーへ新プレイヤーの参加を通知
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // 位置と向きの更新を受信
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].z = movementData.z;
            players[socket.id].rotation = movementData.rotation; // 向きも更新
            
            // 他のプレイヤーに同期
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // コイン取得処理 (経済システム)
    socket.on('collectCoin', (coinId) => {
        if (coins[coinId] && players[socket.id]) {
            // サーバー側でコインを削除
            delete coins[coinId];
            
            // プレイヤーの所持金を増やす (例: 10コイン)
            const earnAmount = 10;
            players[socket.id].money += earnAmount;
            usersDb[socket.email].money += earnAmount; // DBも更新

            console.log(`${socket.email} がコイン取得. 所持金: ${players[socket.id].money}`);

            // 全員にどのコインが消えたかを通知
            io.emit('coinCollected', coinId);
            
            // 本人に所持金更新を通知
            socket.emit('moneyUpdated', players[socket.id].money);

            // 新しいコインを補充（遅延を入れて少し待たせる）
            setTimeout(() => {
                const newCoin = spawnCoin();
                io.emit('newCoin', newCoin);
            }, 3000); // 3秒後に補充
        }
    });

    // 切断処理
    socket.on('disconnect', () => {
        console.log(`プレイヤー切断 (${socket.email}): ${socket.id}`);
        // 最終的な所持金をDBに保存（今回は随時保存しているので省略可能）
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

// Renderの環境変数PORTまたはローカル3000を使用
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`メタバースサーバーが起動しました。 Port: ${PORT}`);
});