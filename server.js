const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// どこからでもアクセスできるようにCORSを設定（GitHub Pages用）
app.use(cors({
    origin: "*", 
    methods: ["GET", "POST"]
}));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const players = {};
let coins = {};
const MAX_COINS = 20;

// 初期コインの生成
for(let i = 0; i < MAX_COINS; i++) spawnCoin();

// コインをランダムな位置に生成する関数
function spawnCoin() {
    const id = Math.random().toString(36).substring(2, 9);
    coins[id] = {
        x: Math.floor(Math.random() * 700) + 50, // 画面サイズ(800x600)の範囲内
        y: Math.floor(Math.random() * 500) + 50,
        id: id
    };
    return coins[id];
}

io.on('connection', (socket) => {
    console.log('プレイヤーが接続しました:', socket.id);

    // 新規プレイヤーのデータを初期化
    players[socket.id] = {
        x: 400,
        y: 300,
        playerId: socket.id,
        money: 0, // 経済システム（所持金）
        color: Math.floor(Math.random() * 0xffffff) // ランダムな色
    };

    // 接続した本人に、現在の全プレイヤーとコインの情報を送る
    socket.emit('currentPlayers', players);
    socket.emit('currentCoins', coins);

    // 他の全プレイヤーに、新しいプレイヤーが入ってきたことを知らせる
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // 切断時の処理
    socket.on('disconnect', () => {
        console.log('プレイヤーが切断しました:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });

    // プレイヤーの移動情報を受信して他の人に共有
    socket.on('playerMovement', (movementData) => {
        if(players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // コインを拾った時の処理（経済システムのコア）
    socket.on('collectCoin', (coinId) => {
        if(coins[coinId]) {
            delete coins[coinId]; // コインを削除
            players[socket.id].money += 10; // 所持金を10G増やす

            // 全員に「誰がどのコインを拾って、いくら稼いだか」を共有
            io.emit('coinCollected', coinId);
            io.emit('economyUpdate', { id: socket.id, money: players[socket.id].money });

            // 新しいコインを補充
            const newCoin = spawnCoin();
            io.emit('newCoin', newCoin);
        }
    });
});

// Renderのポート設定に従う
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`サーバーがポート ${PORT} で起動しました`);
});