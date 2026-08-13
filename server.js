const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB_FILE = 'database.json';
let db = { users: {} };

if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        console.error("Database read error, initializing new DB");
    }
} else {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const adminUsers = ['admin', '898scr', '898sct', '8_98s'];

// 1. 新規登録前のユーザーID重複チェック API
app.post('/api/check-username', (req, res) => {
    const { username } = req.body;
    if (!username) return res.json({ success: false, message: 'UserIDを入力してください' });
    if (db.users[username]) {
        return res.json({ success: false, message: 'そのUserIDは既に登録されています' });
    }
    res.json({ success: true });
});

// 2. 新規登録 API
app.post('/api/register', (req, res) => {
    const { username, password, avatar } = req.body;
    if (!username || !password) {
        return res.json({ success: false, message: 'UserIDとパスワードを入力してください' });
    }
    if (db.users[username]) {
        return res.json({ success: false, message: 'そのUserIDは既に登録されています' });
    }
    
    const isAdmin = adminUsers.includes(username);
    
    db.users[username] = { 
        password: password, 
        cr: 1000, // 初期所持金
        isAdmin: isAdmin,
        avatar: avatar || {
            controlMode: 'keyboard',
            avatarType: 'A',
            colorVisor: '#00f3ff',
            colorBody: '#555555',
            scaleH: 1.0,
            scaleW: 1.0
        }
    };
    saveDB();
    res.json({ 
        success: true, 
        message: '登録完了！',
        username: username,
        cr: db.users[username].cr,
        isAdmin: isAdmin,
        avatar: db.users[username].avatar
    });
});

// 3. ログイン API
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.users[username];
    
    if (!user) {
        return res.json({ success: false, message: 'ユーザーが登録されていません。新規登録を行ってください。' });
    }
    if (user.password !== password) {
        return res.json({ success: false, message: 'パスワードが間違っています。' });
    }
    
    user.isAdmin = adminUsers.includes(username);
    saveDB();

    res.json({ 
        success: true, 
        username: username, 
        cr: user.cr, 
        isAdmin: user.isAdmin,
        avatar: user.avatar
    });
});

const players = {}; 

io.on('connection', (socket) => {
    console.log(`[CONNECT] Socket connected: ${socket.id}`);

    // ゲーム参加
    socket.on('joinGame', (data) => {
        players[socket.id] = {
            id: socket.id,
            username: data.username || 'Guest',
            avatar: data.avatar || {
                avatarType: 'A',
                colorVisor: '#00f3ff',
                colorBody: '#555555',
                scaleH: 1.0,
                scaleW: 1.0
            },
            x: 0, y: 5, z: 0,
            bodyYaw: 0, camYaw: 0, pitch: 0,
            isMoving: false
        };

        socket.emit('initData', { players });
        socket.broadcast.emit('newPlayer', players[socket.id]);
    });

    // プレイヤーの移動同期
    socket.on('playerMovement', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].z = data.z;
            players[socket.id].bodyYaw = data.bodyYaw;
            players[socket.id].camYaw = data.camYaw;
            players[socket.id].pitch = data.pitch;
            players[socket.id].isMoving = data.isMoving;

            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // チャットメッセージの送受信 (発言者の色とIDも送信)
    socket.on('chatMessage', (text) => {
        const user = players[socket.id];
        if (user) {
            io.emit('chatMessage', { 
                id: socket.id, 
                username: user.username, 
                text: text, 
                color: user.avatar.colorVisor 
            });
        }
    });

    socket.on('sendMoney', (data) => {
        const senderInfo = players[socket.id];
        if (!senderInfo) return;

        const senderName = senderInfo.username;
        const targetName = data.targetUsername;
        const amount = parseInt(data.amount, 10);

        if (isNaN(amount) || amount <= 0) {
            return socket.emit('notification', { type: 'error', text: '正しい金額を入力してください' });
        }

        const senderUser = db.users[senderName];
        const targetUser = db.users[targetName];

        if (!targetUser) {
            return socket.emit('notification', { type: 'error', text: `ユーザー '${targetName}' は存在しません` });
        }
        if (senderName === targetName) {
            return socket.emit('notification', { type: 'error', text: '自分自身には送金できません' });
        }
        if (!senderUser || senderUser.cr < amount) {
            return socket.emit('notification', { type: 'error', text: 'CRが不足しています' });
        }

        senderUser.cr -= amount;
        targetUser.cr += amount;
        saveDB();

        socket.emit('moneyUpdated', senderUser.cr);
        socket.emit('notification', { type: 'success', text: `${targetName} に ${amount} CR 送金しました` });

        for (const [sid, p] of Object.entries(players)) {
            if (p.username === targetName) {
                io.to(sid).emit('moneyUpdated', targetUser.cr);
                io.to(sid).emit('notification', { type: 'info', text: `${senderName} から ${amount} CR 受け取りました！` });
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`[DISCONNECT] Socket disconnected: ${socket.id}`);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });

    // --- ここから追加：Ping計測用の応答処理 ---
    socket.on('ping_req', (callback) => {
        if (typeof callback === 'function') callback();
    });
    // --- ここまで追加 ---

});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`HAKUYARC Metaverse Server running on http://localhost:${PORT}`);
});