const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// publicフォルダ内の静的ファイル（index.html等）を配信
app.use(express.static(path.join(__dirname, 'public')));

// ルートへのアクセスでpublic/index.htmlを返す
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 接続中プレイヤーの管理オブジェクト
const players = {};

// 乱数でスポーン色を選択
function getRandomColor() {
    const colors = [0xff4d4d, 0x4d94ff, 0x4dff88, 0xffd633, 0xff4dff, 0x00ffff];
    return colors[Math.floor(Math.random() * colors.length)];
}

io.on('connection', (socket) => {
    console.log('プレイヤーが接続しました:', socket.id);

    // 新規プレイヤーの初期位置・パラメータ設定
    players[socket.id] = {
        id: socket.id,
        x: (Math.random() - 0.5) * 10,
        y: 0.75, // メッシュの高さの半分（接地させるため）
        z: (Math.random() - 0.5) * 10,
        color: getRandomColor()
    };

    // 接続者本人へ現在の全プレイヤー情報を送信
    socket.emit('currentPlayers', players);

    // 他の全プレイヤーへ新プレイヤーの参加を通知
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // 位置更新を受信
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].z = movementData.z;
            
            // 他のプレイヤーに位置を同期
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // 切断処理
    socket.on('disconnect', () => {
        console.log('プレイヤーが切断しました:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

// Renderの環境変数PORTまたはローカル3000を使用
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`メタバースサーバーが起動しました。 Port: ${PORT}`);
});