const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB_FILE = 'database.json';
let db = { users: {}, logs: { chat: [], auth: [], move: [] } };

if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (!db.logs) db.logs = { chat: [], auth: [], move: [] }; 
    } catch (e) {
        console.error("Database read error, initializing new DB");
    }
} else {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function addLog(type, data) {
    db.logs[type].push({ time: new Date().toISOString(), ...data });
    if (db.logs[type].length > 1000) db.logs[type].shift();
    saveDB();
}

const adminUsers = ['898scr'];

// --- ★ マップデータの読み込み (追加) ---
let currentMapData = null;
const MAP_FILE = path.join(__dirname, 'public', 'test_map.json');
try {
    if (fs.existsSync(MAP_FILE)) {
        currentMapData = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
        console.log("Map data loaded successfully.");
    } else {
        console.warn("No map file found at " + MAP_FILE);
    }
} catch (e) {
    console.error("Failed to load map data:", e);
}


app.post('/api/check-username', (req, res) => {
    const { username } = req.body;
    if (!username) return res.json({ success: false, message: 'UserIDを入力してください' });
    if (db.users[username]) return res.json({ success: false, message: 'そのUserIDは既に登録されています' });
    res.json({ success: true });
});

app.post('/api/register', (req, res) => {
    const { username, password, avatar } = req.body;
    if (!username || !password) return res.json({ success: false, message: 'UserIDとパスワードを入力してください' });
    if (db.users[username]) return res.json({ success: false, message: 'そのUserIDは既に登録されています' });
    
    const isAdmin = adminUsers.includes(username);
    
    db.users[username] = { 
        password: password, 
        cr: 1000, 
        isAdmin: isAdmin,
        isBanned: false, 
        avatar: avatar
    };
    saveDB();
    addLog('auth', { user: username, action: 'REGISTER' });

    res.json({ success: true, message: '登録完了！', username: username, cr: db.users[username].cr, isAdmin: isAdmin, avatar: db.users[username].avatar });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.users[username];
    
    if (!user) return res.json({ success: false, message: 'ユーザーが登録されていません。新規登録を行ってください。' });
    if (user.password !== password) return res.json({ success: false, message: 'パスワードが間違っています。' });
    if (user.isBanned) return res.json({ success: false, message: 'このアカウントは管理者により停止(BAN)されています。' });
    
    user.isAdmin = adminUsers.includes(username);
    saveDB();
    addLog('auth', { user: username, action: 'LOGIN' });

    res.json({ success: true, username: username, cr: user.cr, isAdmin: user.isAdmin, avatar: user.avatar });
});

const players = {}; 
const lastMoveLogTime = {}; 

io.on('connection', (socket) => {
    
    socket.on('joinGame', (data) => {
        players[socket.id] = {
            id: socket.id,
            username: data.username || 'Guest',
            avatar: data.avatar,
            x: 0, y: 5, z: 0,
            rotation: 0, pitch: 0,
            isGrounded: true
        };

        // --- ★ プレイヤーにマップデータも一緒に送信する (追加) ---
        socket.emit('initData', { 
            players: players,
            customMap: currentMapData 
        });
        
        socket.broadcast.emit('newPlayer', players[socket.id]);
    });

    socket.on('playerMovement', (data) => {
        const user = players[socket.id];
        if (user) {
            user.x = data.x; user.y = data.y; user.z = data.z;
            user.rotation = data.rotation; user.pitch = data.pitch; user.isGrounded = data.isGrounded;
            socket.broadcast.emit('playerMoved', user);

            const now = Date.now();
            if (!lastMoveLogTime[user.username] || now - lastMoveLogTime[user.username] > 5000) {
                addLog('move', { user: user.username, x: data.x, y: data.y, z: data.z });
                lastMoveLogTime[user.username] = now;
            }
        }
    });

    socket.on('chatMessage', (text) => {
        const user = players[socket.id];
        if (user) {
            io.emit('chatMessage', { id: socket.id, username: user.username, text: text });
            addLog('chat', { user: user.username, text: text });
        }
    });

    socket.on('sendMoney', (data) => {
        const senderInfo = players[socket.id];
        if (!senderInfo) return;

        const senderName = senderInfo.username;
        const targetName = data.targetUsername;
        const amount = parseInt(data.amount, 10);

        if (isNaN(amount) || amount <= 0) return socket.emit('notification', { type: 'error', text: '正しい金額を入力してください' });

        const senderUser = db.users[senderName];
        const targetUser = db.users[targetName];

        if (!targetUser) return socket.emit('notification', { type: 'error', text: `ユーザー '${targetName}' は存在しません` });
        if (senderName === targetName) return socket.emit('notification', { type: 'error', text: '自分自身には送金できません' });
        if (!senderUser || senderUser.cr < amount) return socket.emit('notification', { type: 'error', text: 'CRが不足しています' });

        senderUser.cr -= amount; targetUser.cr += amount;
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

    socket.on('adminCmd', (cmd) => {
        const user = players[socket.id];
        if (!user || !adminUsers.includes(user.username)) return;

        switch(cmd.action) {
            case 'getLogs': socket.emit('adminLogs', db.logs); break;
            case 'setMoney':
                if (db.users[cmd.target]) {
                    db.users[cmd.target].cr = Number(cmd.amount);
                    saveDB();
                    io.emit('forceUpdateCR', { user: cmd.target, cr: cmd.amount });
                }
                break;
            case 'ban':
                if (db.users[cmd.target]) {
                    db.users[cmd.target].isBanned = true;
                    saveDB();
                    io.emit('banned', cmd.target);
                }
                break;
            case 'unban':
                if (db.users[cmd.target]) {
                    db.users[cmd.target].isBanned = false;
                    saveDB();
                }
                break;
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });

    socket.on('ping_req', (callback) => { if (typeof callback === 'function') callback(); });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`HAKUYARC Metaverse Server running on http://localhost:${PORT}`);
});