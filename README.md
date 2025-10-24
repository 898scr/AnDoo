<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no" />
<title>クロノ・フラクタル (Chronos Fractal)</title>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
<style>
  html,body{height:100%;margin:0;background:#1b2430;color:#fff;font-family:monospace;overflow:hidden;}
  .wrap{display:flex;align-items:center;justify-content:center;height:100%}
  canvas{image-rendering:pixelated; background:#7fb4ff; border:8px solid #111; box-shadow:0 8px 24px rgba(0,0,0,0.6)}
  #ui{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;width:100%;height:100%;}
  .dialog{position:absolute;left:50%;bottom:20vh;transform:translateX(-50%);min-width:360px;max-width:90vw;background:rgba(0,0,0,0.75);border:3px solid #333;padding:8px 12px;border-radius:6px;color:#eaeaea;font-size:14px;display:none;z-index:10; pointer-events:all;}
  .dialog .name{font-weight:bold;margin-bottom:6px;color:#ffd27f}
  .menu{position:absolute;left:10px;top:10px;background:rgba(0,0,0,0.6);padding:6px;border-radius:6px;border:2px solid #222;pointer-events:all;z-index:5; cursor: pointer; font-size: 12px;}
  .hint{position:absolute;right:10px;top:10px;background:rgba(0,0,0,0.6);padding:6px;border-radius:6px;border:2px solid #222;font-size:12px;z-index:5}
  /* Overlays */
  #loading-overlay, #fade-overlay, #ending-overlay {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.95); color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; z-index: 100; opacity: 0; transition: opacity 0.3s; pointer-events: none;
  }
  #fade-overlay { background: #000; z-index: 50; }
  #ending-overlay { flex-direction: column; text-align: center; line-height: 2; z-index: 200; }
  #ending-overlay h1 { font-size: 48px; }
  /* Status Message */
  #status-message {
      position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
      padding: 8px 15px; background: #38c172; color: white; border-radius: 4px;
      font-size: 14px; opacity: 0; transition: opacity 0.5s; z-index: 50;
  }
  /* Battle */
  .battle{
    position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
    width:90%;height:80%;background:#000;border:4px solid #555;
    display:none;flex-direction:column;justify-content:space-between;
    padding:10px;box-sizing:border-box;z-index:20;
  }
  .battle-top-area { display: flex; flex: 1; }
  .battle-area { position: relative; width: 60%; height: 100%; }
  #battleCanvas { position: absolute; width: 100%; height: 100%; background-color: #3f684a; image-rendering: pixelated; }
  .battle-info-left {
    position: absolute; bottom: 10px; left: 10px; background: rgba(0,0,0,0.75);
    border: 2px solid #555; padding: 8px; font-size: 13px; z-index: 1; min-width: 120px;
  }
  #party-status { width: 40%; background: rgba(0,0,0,0.75); border-left: 2px solid #555; padding: 8px; font-size: 13px; box-sizing: border-box; }
  .party-status-member { padding: 6px 4px; border-bottom: 1px dashed #444; }
  .party-status-member:last-child { border-bottom: none; }
  .party-status-member.active-turn { background: rgba(255, 255, 100, 0.2); }
  .hp-bar-container { width: 100%; height: 8px; background: #333; border: 1px solid #777; margin-top: 4px; border-radius: 2px; overflow: hidden;}
  .hp-bar { height: 100%; background: #4caf50; transition: width 0.3s; }
  .hp-bar.medium { background: #ffeb3b; }
  .hp-bar.low { background: #f44336; }
  .hp-text { font-size: 12px; margin-top: 2px; color: #ccc; }
  .battle-bottom-area { display: flex; height: 110px; margin-top: 10px; }
  .battle-log{ flex:1; background:#111;border:2px solid #444;padding:6px;font-size:13px;overflow-y:auto;pointer-events:all;z-index:2; margin-right: 10px;}
  .battle-menu-container { width: 200px; display: flex; flex-direction: column;}
  .battle-menu{ flex: 1; background:#111;border:2px solid #444;padding:8px; display:grid;grid-template-columns:repeat(2,1fr);gap:8px; pointer-events:all;z-index:2; }
  .battle-menu button{ background:#333;color:#fff;border:none;padding:6px;font-size:14px;cursor:pointer; border: 2px solid #555; box-shadow: 2px 2px #222; transition: all 0.1s ease; }
  .battle-menu button:active { transform: translate(2px, 2px); box-shadow: none; }
  .battle-menu button:disabled { background: #111; color: #555; cursor: not-allowed; }
  .battle-roll-menu { height: 30px; margin-top: 5px; pointer-events: all; display: flex;}
  .battle-roll-menu button {
      flex: 1; font-size: 14px; background: #4a2d6b; color: #e1bee7; border: 2px solid #7b1fa2; box-shadow: 2px 2px #2a0a3d;
      cursor:pointer; transition: all 0.1s ease;
  }
  .battle-roll-menu button:active { transform: translate(2px, 2px); box-shadow: none; }
  .battle-roll-menu button:disabled { background: #111; color: #555; cursor: not-allowed; }








  /* Modals (Menu, Shop, Inn, Result) */
  #gameMenu, .modal-ui {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    width: 350px; background: rgba(0, 0, 0, 0.95); border: 4px solid #fff;
    padding: 20px; box-sizing: border-box; display: none; z-index: 30; pointer-events: all;
  }
  .menu-screen, .modal-screen { display: none; animation: fadeIn 0.3s; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .menu-screen.active, .modal-screen.active { display: block; }
  .menu-screen h2, .modal-ui h2 { color: #fff; text-align: center; margin-top: 0; border-bottom: 2px solid #777; padding-bottom: 10px; }
  .menu-screen ul, .modal-ui ul { list-style: none; padding: 0; max-height: 200px; overflow-y: auto; }
  .menu-screen li, .menu-screen button, .modal-ui li, .modal-ui button {
    font-family: monospace; font-size: 16px; color: #fff; background: #555;
    border: 2px solid #333; padding: 10px; margin-bottom: 10px; cursor: pointer;
    text-align: center; transition: background 0.2s ease;
  }
  .menu-screen li:hover, .menu-screen button:hover, .modal-ui li:hover, .modal-ui button:hover { background: #777; }
  .menu-screen .selected, .modal-ui .selected, .battle-menu .selected { background: #999; border-color: #fff; }
  .menu-info { font-size: 14px; line-height: 1.5; margin-bottom: 20px; border: 2px solid #fff; padding: 10px; }
  .menu-info p { margin: 0; padding: 2px 0; }
  .party-member { border-top: 1px dashed #555; padding-top: 5px; margin-top: 5px; }
  .gold-display { text-align: right; margin-bottom: 10px; font-size: 16px; }
  .equip-details { font-size: 12px; color: #ccc; }
  #battle-result { z-index: 40; }
  #battle-result-content p { margin: 5px 0; }
  #level-up-info { color: #ffeb3b; font-weight: bold; }
  #roll-menu p {font-size: 14px;}
  #roll-menu small {font-size: 12px; color: #ccc;}








  #mod-menu { width: 500px; max-height: 90vh; overflow-y: auto;}
  #mod-menu textarea { width: 100%; height: 150px; background: #222; color: #eee; border: 1px solid #777; resize: vertical; margin-bottom: 10px; font-family: monospace; font-size: 12px; box-sizing: border-box;}
  #mod-menu .mod-buttons { display: flex; justify-content: space-around; margin-bottom: 15px;}
  #mod-help { font-size: 11px; color: #ccc; line-height: 1.4; border-top: 1px solid #555; padding-top: 10px; max-h: 100px; overflow-y: auto; }
  #loaded-packs-list { font-size: 12px; list-style-position: inside; }
 
  /* CUI */
  #cui-menu { width: 450px; background: #000; border-color: #0f0;}
  #cui-output { height: 200px; background: #000; color: #0f0; overflow-y: scroll; padding: 5px; margin-bottom: 10px; border: 1px solid #0f0; font-size: 12px;}
  #cui-input-wrapper { display: flex; align-items: center; }
  #cui-input-wrapper span { color: #0f0; margin-right: 5px; }
  #cui-input {
    flex: 1; background: transparent; border: none; color: #0f0;
    font-family: monospace; font-size: 14px; outline: none;
  }
  #cui-output textarea { width: 98%; height: 60px; background: #222; color: #0f0; border: 1px solid #0f0; resize: none; margin-top: 5px; }








  /* Touch Controls */
  #touch-controls {
    position: fixed; bottom: 0; left: 0; width: 100%; height: 25vh;
    display: none; justify-content: space-between; align-items: center;
    padding: 10px 20px; box-sizing: border-box; pointer-events: all;
    z-index: 60;
  }
  #touch-controls.active { display: flex; }
  .d-pad, .action-buttons { width: 150px; height: 150px; position: relative; }
  .d-pad-btn, .action-btn {
    position: absolute; background: rgba(0,0,0,0.5); border: 2px solid #fff;
    color: #fff; display: flex; justify-content: center; align-items: center;
    font-size: 2em; border-radius: 50%; user-select: none;
  }
  .d-pad-btn { width: 50px; height: 50px; }
  .d-pad-up { top: 0; left: 50px; } .d-pad-down { bottom: 0; left: 50px; }
  .d-pad-left { top: 50px; left: 0; } .d-pad-right { top: 50px; right: 0; }
  .action-btn { width: 70px; height: 70px; }
  .action-a { bottom: 20px; right: 20px; }








</style>
</head>
<body>
<div id="loading-overlay">ロード中...</div>
<div id="fade-overlay"></div>
<div id="ending-overlay"><h1>The End</h1><p>ありがとうございました！</p></div>
<div class="wrap">
  <canvas id="game" width="320" height="240"></canvas>
  <div id="ui">
    <div id="status-message"></div>
    <div class="menu" id="in-game-menu-hint">移動:矢印/WASD | 決定:Enter/Z | メニュー:X | V0.5.3
    </div>
    <div class="hint" id="in-game-hint">クロノ・フラクタル</div>
    <div id="dialog" class="dialog"><div class="name" id="dname"></div><div id="dtext"></div></div>
    <div id="battle" class="battle">
      <div class="battle-top-area">
        <div class="battle-area">
          <canvas id="battleCanvas" width="320" height="240"></canvas>
          <div class="battle-info-left"><div id="enemy-name"></div><div class="hp-bar-container"><div id="enemy-hp-bar" class="hp-bar"></div></div><div id="enemy-hp-text" class="hp-text"></div></div>
        </div>
        <div id="party-status"></div>
      </div>
      <div class="battle-bottom-area">
        <div class="battle-log" id="battle-log"></div>
        <div class="battle-menu-container">
            <div class="battle-menu" id="battle-menu">
              <button onclick="battleCommand('attack')">たたかう</button><button onclick="battleCommand('skill')">スキル</button>
              <button onclick="battleCommand('item')">アイテム</button><button onclick="battleCommand('run')">にげる</button>
            </div>
            <div class="battle-roll-menu">
                <button onclick="battleCommand('roll')">ロール</button>
            </div>
        </div>
      </div>
    </div>
    <div id="gameMenu">
      <div id="main-menu-screen" class="menu-screen active">
        <h2>メインメニュー</h2><div id="menu-party-info" class="menu-info"></div>
        <ul id="main-menu-list">
          <li onclick="showMenuScreen('item-menu-screen')">アイテム</li><li onclick="showMenuScreen('equipment-menu-screen')">そうび</li>
          <li onclick="showMenuScreen('status-menu-screen')">ステータス</li><li onclick="showMenuScreen('settings-menu-screen')">せってい</li>
          <li onclick="showMenuScreen('mod-menu-screen')">MOD/拡張</li>
          <li onclick="saveGame()">セーブ</li><li onclick="loadGame()">ロード</li>
        </ul><button onclick="closeMenu()">とじる</button>
      </div>
      <div id="item-menu-screen" class="menu-screen"><h2>アイテム</h2><ul id="item-list"></ul><button onclick="showMenuScreen('main-menu-screen')">もどる</button></div>
      <div id="equipment-menu-screen" class="menu-screen"><h2>そうび</h2><ul id="equip-char-list"></ul><button onclick="showMenuScreen('main-menu-screen')">もどる</button></div>
      <div id="status-menu-screen" class="menu-screen"><h2>ステータス</h2><div id="status-party-info"></div><button onclick="showMenuScreen('main-menu-screen')">もどる</button></div>
      <div id="settings-menu-screen" class="menu-screen"><h2>せってい</h2><ul id="settings-list"></ul><button onclick="showMenuScreen('main-menu-screen')">もどる</button></div>
       <div id="hiryu-menu-screen" class="menu-screen"><h2>飛龍 - 行き先選択</h2><ul id="hiryu-dest-list"></ul><button onclick="showMenuScreen('main-menu-screen')">もどる</button></div>
      <div id="mod-menu-screen" class="menu-screen">
          <h2>MOD / 拡張パック</h2>
          <textarea id="mod-input" placeholder="ここにデータパックのJSONを貼り付けます"></textarea>
          <div class="mod-buttons">
              <button onclick="loadSampleMod()">サンプルを試す</button>
              <button onclick="loadDataPack()">ロード</button>
              <button onclick="exportCurrentData()">エクスポート</button>
              <button onclick="unloadAllMods()">全リセット</button>
          </div>
          <h4>ロード済パック:</h4>
          <ul id="loaded-packs-list"><li>なし</li></ul>
          <div id="mod-help">
              <b>ヘルプ:</b> データパックはJSON形式です。「サンプルを試す」を押して形式を確認し、自由に改造してみてください。'items', 'enemies', 'equipment'などを追加できます。
          </div>
          <button onclick="showMenuScreen('main-menu-screen')">もどる</button>
      </div>
    </div>
     <div id="shop-menu" class="modal-ui">
        <div id="shop-category-screen" class="modal-screen active">
            <h2>みせ</h2><div id="shop-gold-category" class="gold-display"></div>
            <ul>
                <li id="shop-buy-weapon">ぶきをかう</li>
                <li id="shop-buy-armor">ぼうぐをかう</li>
                <li id="shop-buy-item">どうぐをかう</li>
            </ul>
            <button onclick="closeShop()">みせをでる</button>
        </div>
        <div id="shop-item-screen" class="modal-screen">
            <h2 id="shop-item-title"></h2><div id="shop-gold-items" class="gold-display"></div>
            <ul id="shop-item-list"></ul>
            <button id="shop-back-to-category">もどる</button>
        </div>
     </div>
     <div id="inn-menu" class="modal-ui"><h2 id="inn-greeting">やどや</h2><p id="inn-cost"></p><button id="inn-yes">はい</button><button id="inn-no">いいえ</button></div>
     <div id="battle-result" class="modal-ui"><h2>戦闘結果</h2><div id="battle-result-content"></div><button onclick="closeBattleResult()">とじる</button></div>
     <div id="roll-menu" class="modal-ui"><h2 id="roll-title">ロール付与</h2><div id="roll-content"></div></div>
     <div id="cui-menu" class="modal-ui"><h2>特殊コマンド</h2> <div id="cui-output"></div> <div id="cui-input-wrapper"><span>&gt;</span><input type="text" id="cui-input" /></div><button onclick="closeSpecialMenu()">閉じる</button></div>
  </div>
</div>
<div id="touch-controls"><div class="d-pad"><div class="d-pad-btn d-pad-up">▲</div><div class="d-pad-btn d-pad-down">▼</div><div class="d-pad-btn d-pad-left">◀</div><div class="d-pad-btn d-pad-right">▶</div></div><div class="action-buttons"><div class="action-btn action-a">A</div></div></div>
<script>
// =========================================================================
// 1. CONSTANTS, SETUP, AND GLOBAL VARIABLES
// =========================================================================
const TILE=16,SCALE=3,VIEW_W=320,VIEW_H=240;
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
canvas.style.width=(VIEW_W*SCALE/2)+'px',canvas.style.height=(VIEW_H*SCALE/2)+'px';ctx.imageSmoothingEnabled=false;
const battleCanvas=document.getElementById('battleCanvas'),btx=battleCanvas.getContext('2d');btx.imageSmoothingEnabled=false;








const dialog=document.getElementById('dialog'),dname=document.getElementById('dname'),dtext=document.getElementById('dtext');
const gameMenu=document.getElementById('gameMenu'),battleUI=document.getElementById('battle'),enemyName=document.getElementById('enemy-name'),enemyHpBar=document.getElementById('enemy-hp-bar'),enemyHpText=document.getElementById('enemy-hp-text'),battleLog=document.getElementById('battle-log'),battleMenu=document.getElementById('battle-menu');
const statusMessage = document.getElementById('status-message'),loadingOverlay = document.getElementById('loading-overlay'),fadeOverlay = document.getElementById('fade-overlay'),endingOverlay = document.getElementById('ending-overlay');
const inGameMenuHint = document.getElementById('in-game-menu-hint'),inGameHint = document.getElementById('in-game-hint');
const shopMenu = document.getElementById('shop-menu'),innMenu = document.getElementById('inn-menu'),battleResult = document.getElementById('battle-result'),rollMenu=document.getElementById('roll-menu');
const cuiMenu = document.getElementById('cui-menu'), cuiOutput = document.getElementById('cui-output'), cuiInput = document.getElementById('cui-input');
const touchControls = document.getElementById('touch-controls');








let app, db, auth, userId = null, isAuthReady = false;
let titleStars = [];
let isWeakMode = false;








// Seeded PRNG function (Mulberry32)
function mulberry32(a) { return function() { let t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; } }
let currentPRNG = Math.random;








// --- GAME STATE ---
let gameState = {
    inTitle: true,
    titleCursor: 0,
    storyFlag: 0,
    party: [
        { name: 'プロシア', hp: 60, maxHP: 60, baseAtk: 8, baseDef: 6, exp: 0, level: 1, weapon: null, armor: null, roll: null, rollTurns: 0, baseMaxHP: 60, type: 'M', status: null, statusTurns: 0 },
    ],
    inventory: { 'potion': 3 },
    equipment: {},
    gold: 100,
    chests: {},
    repairedBridges: {},
    puzzleSwitches: {},
    currentMapId: 'village',
    playerX: 4 * TILE,
    playerY: 5 * TILE,
    playerDir: 'down',
    cameraX: 0, cameraY: 0,
    controlType: 'keyboard',
    luiniaDestroyed: false,
    caveRockMoved: false,
    hasExplainedRoles: false,
    hasTimeFragment: false,
    hiryuActivated: false,
    hasDungeonMap: false,
    showEncounterAreas: false,
    battleState: {
        turnQueue: [],
        turnIndex: 0,
        animation: { active: false, progress: 0, resolve: null },
        enemyAnimation: { active: false, progress: 0, resolve: null }
    }
};








// Menu navigation state
const menuState = {
    active: false,
    screenId: '',
    cursor: 0,
    items: [],
    container: null,
};








// --- Party Follower System ---
let playerPositionHistory = [];
const FOLLOWER_DELAY = 8;








let dialogQueue=[],showingDialog=false,inMenu=false,inBattle=false,inShop=false,inInn=false,inResult=false,inRollMenu=false,inSpecialMenu=false,currentEnemy=null, inEvent=false;
let encounterCooldown = 0;
const keys={};
let isTyping = false, typewriterInterval;
const secretCommand = 'ult';
let inputSequence = '';
let sequenceTimer;








let tiles={ 0:{color:'#66bb66',walk:true}, 1:{color:'#8a8a8a',walk:false}, 2:{color:'#4aa3ff',walk:false}, 3:{color:'#cfa56f',walk:true}, 4:{color:'#227722',walk:false}, 5:{color:'#66bb66',walk:true,encounter:true}, 6:{color:'#444444',walk:true, encounter: true}, 7:{color:'#8a8a8a',walk:false}, 8:{color:'#cfa56f',walk:true,encounter:true}, 9:{color:'#66bb66',walk:true, encounter:true}, 'A':{color:'#9e8a78',walk:true, encounter:true}, 'S':{color:'#d4a017',walk:false}, 'I':{color:'#a0d6b4',walk:false}, 'H':{color:'#b5651d',walk:false}, 'C':{color:'#DAA520',walk:false}, 'R':{color:'#333333',walk:false}, 'B':{color:'#5d4037', walk:false}, 'D':{color:'#5d4037',walk:false}, 'W':{color:'#f0f8ff',walk:true, encounter:true}, 'F':{color:'#d2b48c',walk:false}, 'P':{color:'#000000',walk:false}, 'T': {color: '#555', walk: true} };








// =========================================================================
// 2. DATA
// =========================================================================
const STATUS_EFFECTS = {
    poison: { name: 'どく', short: '毒', color: '#6a0dad' },
    paralysis: { name: 'まひ', short: '麻', color: '#ffd700' }
};
let ITEM_CATALOG = { 'potion': { name: 'やくそう', price: 10, description: 'HPを30かいふくする。', type: 'consumable'}, 'antidote': { name: 'どくけし', price: 20, description: 'どくじょうたいをかいふくする。', type: 'cure', cures: 'poison'}, 'all_rounder_key': { name: '万能型・キー', price: 100, description: 'HP,ATK,DEFを1.1倍(常時)', type: 'roll_key'}, 'attack_key': { name: '攻撃型・キー', price: 100, description: 'ATK1.5倍(2ターン)', type: 'roll_key'}, 'defense_key': { name: '防御型・キー', price: 100, description: 'DEF1.5倍(2ターン)', type: 'roll_key'}, 'counter_key': { name: '迎撃型・キー', price: 150, description: '被弾時80%で1割カウンター', type: 'roll_key'}, 'chloctaria_key': { name: 'クロクタリア・キー', price: 1000, description: '全能力1.2倍,戦闘不能から1度だけ全快で復活', type: 'roll_key'}, 'flaria_key': { name: 'フラリア・キー', price: 1000, description: '全能力1.2倍,一度だけ敵を即死させる(ボス無効)', type: 'roll_key'}};
let ROLL_CATALOG = { 'all_rounder_key': { name: '万能型', effects: {hp:1.1, atk:1.1, def:1.1}, passive: true}, 'attack_key': { name: '攻撃型', effects: {atk:1.5}, passive: false, turns: 2}, 'defense_key': { name: '防御型', effects: {def:1.5}, passive: false, turns: 2}, 'counter_key': { name: '迎撃型', effects: {counter: 0.8}, passive: true}, 'chloctaria_key': { name: 'クロクタリア', effects: {hp:1.2, atk:1.2, def:1.2, revive:1}, passive: true}, 'flaria_key': { name: 'フラリア', effects: {hp:1.2, atk:1.2, def:1.2, death:1}, passive: true}};
let EQUIPMENT_CATALOG = { 'bronze_sword': { name: 'どうのつるぎ', type: 'weapon', atk: 5, def: 0, price: 50 }, 'leather_armor': { name: 'かわのよろい', type: 'armor', atk: 0, def: 5, price: 70 }, 'iron_sword': { name: 'てつのつるぎ', type: 'weapon', atk: 12, def: 0, price: 250 }, 'chain_mail': { name: 'くさりかたびら', type: 'armor', atk: 0, def: 12, price: 300 }};
let SHOP_CATALOG = {
    'village': { weapons: ['bronze_sword'], armor: ['leather_armor'], items: ['potion', 'antidote'] },
    'luinia_normal': { weapons: ['bronze_sword', 'iron_sword'], armor: ['leather_armor', 'chain_mail'], items: ['potion', 'antidote', 'all_rounder_key'] },
    'feronia': { weapons: ['iron_sword'], armor: ['chain_mail'], items: ['potion', 'antidote', 'attack_key', 'defense_key'] }
};
let ENEMY_CATALOG = {
    'slime': { name: 'スライム', hp: 20, maxHP: 20, exp: 5, atk: 8, def: 2, gold: 5, skin: '#a2d2ff', body: '#bde0fe', drawType: 'slime' },
    'goblin': { name: 'ゴブリン', hp: 35, maxHP: 35, exp: 12, atk: 12, def: 4, gold: 15, skin: '#70e000', body: '#55a630', drawType: 'goblin' },
    'scorpion': { name: 'サソリ', hp: 40, maxHP: 40, exp: 15, atk: 15, def: 6, gold: 20, skin: '#ffc300', body: '#c36f09', drawType: 'scorpion', specialAttack: { type: 'poison', chance: 0.4 } },
    'sandworm': { name: 'サンドワーム', hp: 60, maxHP: 60, exp: 25, atk: 16, def: 5, gold: 35, skin: '#e9c46a', body: '#f4a261', drawType: 'sandworm' },
    'bat': { name: 'オオコウモリ', hp: 50, maxHP: 50, exp: 20, atk: 15, def: 3, gold: 25, skin: '#495057', body: '#343a40', drawType: 'bat', specialAttack: { type: 'paralysis', chance: 0.2 } },
    'golem': { name: 'ゴーレム', hp: 100, maxHP: 100, exp: 70, atk: 22, def: 15, gold: 80, skin: '#adb5bd', body: '#6c757d', drawType: 'golem' },
    'ghost': { name: 'ゴースト', hp: 80, maxHP: 80, exp: 60, atk: 20, def: 8, gold: 60, skin: '#e0e0e0', body: '#f5f5f5', drawType: 'humanoid', specialAttack: { type: 'paralysis', chance: 0.3 } },
    'yeti': { name: 'イエティ', hp: 120, maxHP: 120, exp: 80, atk: 25, def: 12, gold: 90, skin: '#ffffff', body: '#e9ecef', drawType: 'yeti' },
    'forest_wolf': { name: 'フォレストウルフ', hp: 80, maxHP: 80, exp: 50, atk: 18, def: 8, gold: 100, isBoss: true, skin: '#AAB7B8', body: '#5D6D7E', drawType: 'wolf' },
    'ratio': { name: 'ラティオ', hp: 150, maxHP: 150, exp: 100, atk: 25, def: 10, gold: 500, isBoss: true, skin: '#e9ecef', body: '#ced4da', drawType: 'humanoid' },
    'log_scripted': { name: 'ログ', hp: 999, maxHP: 999, exp: 0, atk: 500, def: 500, gold: 0, isBoss: true, scriptedLoss: true, skin: '#f8f9fa', body: '#212529', drawType: 'humanoid' },
    'ratio_2': { name: 'ラティオ', hp: 500, maxHP: 500, exp: 500, atk: 60, def: 50, gold: 1500, isBoss: true, skin: '#d0d0d0', body: '#a0a0a0', drawType: 'humanoid' },
    'log_final': { name: 'ログ', hp: 1000, maxHP: 1000, exp: 2000, atk: 650, def: 500, gold: 5000, isBoss: true, skin: '#f8f9fa', body: '#212529', drawType: 'humanoid' },
    'infinity': { name: 'インフィニティ', hp: 5200, maxHP: 5200, exp: 1000, atk: 560, def: 430, gold: 2000, isBoss: true, skin: '#ffadad', body: '#ff5252', drawType: 'golem' },
    'singularity': { name: 'シンギュラリティ', hp: 4500, maxHP: 4500, exp: 1000, atk: 1000, def: 500, gold: 2000, isBoss: true, skin: '#a0c4ff', body: '#4d8cff', drawType: 'humanoid' },
    'linearity': { name: 'リニアリティ', hp: 4750, maxHP: 4750, exp: 1000, atk: 55, def: 850, gold: 2000, isBoss: true, skin: '#b2fab4', body: '#69f0ae', drawType: 'goblin' },
    'absoluty': { name: 'アブソリュティ', hp: 5000, maxHP: 5000, exp: 1000, atk: 750, def: 500, gold: 2000, isBoss: true, skin: '#fdffb6', body: '#ffee32', drawType: 'yeti' },
    'remniscate': { name: 'レムニスケート', hp: 9999, maxHP: 9999, exp: 0, atk: 999, def: 999, gold: 10000, isBoss: true, skin: '#e0c3fc', body: '#6a0dad', drawType: 'humanoid' },
};
const LEVEL_UP_TABLE = [0, 0, 10, 30, 60, 100, 150, 220, 300, 400, 550];
const CHEST_CATALOG = {
    'forest_1_24': { type: 'equipment', key: 'leather_armor', name: 'かわのよろい' },
    'plains_45_25': {type: 'item', key: 'potion', name: 'やくそう'}
};




// =========================================================================
// 3. MAP DATA
// =========================================================================
const MAP_VILLAGE = [ '11111111111331111111','1..444.....33...T..1', '1..444..1..33HH....1', '1.H.....1..33HH....1', '1.H.....1..33......1', '1...33333333333333.1', '1...3..............1', '1...3..............1', '1...3....SI........1', '1...3..............1', '1...3..............1', '1...3....4444......1', '1........4444......1', '1..................1', '11111111111111111111' ];
const MAP_PLAINS_TEMPLATE = {width: 50, height: 30, borderCenter: 30, borderWaviness: 4};
const MAP_FOREST = [ '4444444444444444444333444444444444444444', '49999994444449999993.3999999999999999994', '49444499999999444443.3444499999999944494', '49444444449444499943.3499944444944444494', '49999499994999994443.3444944999499999994', '44494449444944444444.4444944944494444494', '49994949499999999999.9999944999499994494', '4944494949444444494449444444444944494494', '4944499999499999499999999999994999994994', '4944444444494449444444444444444444444944', '4999999999994999999999999999999999999994', '4444444944444944444444444449444444444444', '49999949999999999999.9999949999999999994', '494449444444444444444.4444944444444444494', '494449999999999999994.4999999999999994494', '494444444444444444444.4444444444444449494', '499999999999999999994.9999999999999949994', '444444494444444444494444.4444444444494444', '499999499999999999499994.99999999994999994', '494449444444444449444444.44444444494444494', '494449999999999949999999.99999994999999494', '4944444444444449444444444.444494444444494', '4999999999999949999999994.999949999999994', '444444444444494444444444444.444444444444', '4C9999999999499999999999994.999999999994', '444444444449444444444444444.444444444444', '499999999999999999999999994.999999999994', '494444444444444444444444444.4444444444494', '499999999999999999999999999.9999999999994', '1111111111111111113331111111111111111111',];
const MAP_FOREST_B = [ '11111111113331111111', '14949494943.349494943', '14949494943.349494943', '14949494943.349494941', '14949400000000049493', '14949000000000009493', '14940000000000000493', '14940000000000000491', '14940000000000000491', '333333300000003333333', '194900000000000004941', '149490000000000094941', '194949000000004949491', '14949494943.349494941', '19494949493.394949491', '14949494943.349494941', '19494949493.394949491', '14949494943.349494941', '133333333333333333331', '11111111113331111111',];
const MAP_CLIFF = [ '22222222222222222232', '29999999999999999939', '29999999999999999939', '33333888888888833333', '29999222222222299992', '29999222222222299992', '29999222222222299992', '29999222222222299992', '29999222222222299992', '29999222222222299992', '29999222222222299992', '29999222222222299992', '29999222222222299992', '29999999999999999992', '22222222222222222222',];
let MAP_LUINIA_NORMAL_TEMPLATE = [ '111111111111111111111111111111', '133333333333333333333333333331', '13..H.H..3.H.H....3.H.H....331', '13..H.H..3.H.H....3.H.H....331', '13.......3........3........331', '13.3333333.33333333.3333333331', '13.3.SI..3.3.H...3.3.......331', '13.3.....3.3.H...3.3.......331', '13.3333333.33333333.3333333331', '13...........................1', '13.H.H.H.3.H.H.H.3.H.H.H.....1', '13.H.H.H.3.H.H.H.3.H.H.H.....1', '13.......3.......3...........1', '133333333333333333333333333331', '111111111111111111111111111111', ].map(row => row.split(''));
const MAP_FORBIDDEN_ROAD = [ '1111111111111111', '1555555555555551', '1511111111111151', '151..........151', '151..........151', '151..........151', '3.1..........1.3', '3.1..........1.3', '151..........151', '151..........151', '1511111111111151', '1555555555555551', '1111111111111111',];
const MAP_CAVE = [ '77777777777777777777', '76666766666666666667', '76766767777777777667', '76766666666667666667', '76777677777767677767', '76667666666767666667', '77676777776767777677', '3.6666666666666666.3', '3.6777777777777777.3', '77777777777777777777',];
const MAP_LOG_FORTRESS_SCRIPTED = [ '11111111111111111111', '16661666666661666661', '16161611111116161161', '16166666666666661161', '16111116666611111161', '166666666R6666666661', '11111116666611111111', '77777716666617777777', '7....716666617....7', '7....716666617....7', '7777773......3777777',];
const MAP_FERONIA = [ '111111111111111111111111', '188888888338888888888881', '18H.H....8.8.H.H.H.8.H.H.81', '18H.H....8.8.H.H.H.8.H.H.81', '18.......8.......8.....81', '18.8888888.8888888.8888881', '18.8.SI..8.8.H.H.8.8.....81', '18.8.....8.8.H.H.8.8.....81', '18.8888888.8888888.8888881', '18.....................81', '18H.H.H..8.H.H.H.8.H.H.H.81', '18H.H.H..8.H.H.H.8.H.H.H.81', '18.......8.......8.....81', '1888888888888888888888881', '111111111111111111111111',];
const MAP_CAVE_2 = [ '777777777B7777777777', '766666666.6666666667', '767777776.6777777767', '766666766.6676666667', '777767677.7767677777', '766667666.6667666667', '767777776.6777777767', '766666666.6676666667', '777767677.7767677777', '766667666.6667666667', '767777776.6777777767', '766666666.6666666667', '777777777.7777777777', '333333333.3333333333', ];
const MAP_MOUNTAIN = [ '222222222222222222222222222222', '2AWWWWWWWWWWWWWWWWWWWWWWWWWFFA2', '2AWWWWWWWWWWWWWWWWWWWWWWWWWFFA2', '2AWWWWWWWWWWWWWWWWWWWWWWWWWFFA2', '2AWWWWWWWWWWWWWWWWWWWWWWWWWFFA2', '2AAAAAAAAAAAAAADAAAAAAAAAAAAAA2', '2A..A..A..A..A.A.A.A.A.A..A..A2', '2A.A..A..A.A...A.A.A.A.A..A..A.2', '2A.A..A..A.A...A.A.D.A.A..A..A.2', '2A..A..A..A..A.A.A.A.A.A..A..A.2', '2A..A..A..A..A.A.A.A.A.A..A..A.2', '2AAAAAAAAAAAAAAAAAAAAAAAAAAAAA2', '222222222222333222222222222222' ];
const MAP_DESERT = [ '2222222222222222222222222222222222222222', '2888888888888888888888888888888888888882', '2888888888888888888888888888888888888882', '28888...888...8888888...888...8888888882', '2888...88888...888888...88888...888888882', '2888..8888888..888888..8888888..888888882', '2888.888888888.888888.888888888.888888882', '2888.888888888.888888.888888888.888888882', '2888..8888888..888888..8888888..888888882', '2888...88888...888888...88888...888888882', '288888...888...8888888...888...8888888882', '2888888888888888888888888888888888888882', '2888888888888888888888888888888888888882', '2222222222222222222222222222222222222222', ];
const MAP_LOG_FORTRESS_FINAL = [ '11111111111111111111', '16661666666661666661', '161616111B1116161161', '161666666.66666661161', '161111166.6611111161', '166666666.6666666661', '11111G166.661R111111', '77771Y166.661B17777', '7...11166.66111...7', '7...77166.66177...7', '7777773......3777777', ];
const MAP_FINAL_DUNGEON = [ 'PPPPPPPPPPPPPPPPPPPP', 'P..................P', 'P..................P', 'P..................P', 'P..................P', 'P..................P', 'P..................P', 'P..................P', 'P..................P', 'P.........R........P', 'P..................P', 'P..................P', 'P..................P', 'P..................P', 'PPPPPP333333PPPPPPPP',];








let map = [], npcs = [], MAP_W = 0, MAP_H = 0;








let MAP_TRANSITIONS = {
    'village': [{ x_range: [10, 12], y: 0, destMap: 'plains', destX: 15, destY: 28 }, {x: 19, y_range: [5, 6], destMap: 'forbidden_road', destX: 1, destY: 7, requiredFlag: 6 }],
    'plains': [ { x_range: [14, 16], y: 29, destMap: 'village', destX: 11, destY: 1 }, { x_range: [19, 21], y: 0, destMap: 'forest', destX: 20, destY: 28 }, { x: 49, y_range: [14, 16], destMap: 'cliff', destX: 1, destY: 5 } ],
    'forest': [ { x_range: [19, 21], y: 29, destMap: 'plains', destX: 20, destY: 1 }, { x_range: [19, 21], y: 0, destMap: 'forest_b', destX: 11, destY: 18 } ],
    'forest_b': [{ x_range: [10, 12], y: 19, destMap: 'forest', destX: 20, destY: 1 }, {x: 19, y_range: [4, 9], destMap: 'cliff', destX: 1, destY: 3, requiredFlag: 3}],
    'cliff': [{x: 0, y_range: [3,3], destMap: 'forest_b', destX: 18, destY: 9}, {x: 19, y_range: [3,3], destMap: 'luinia_normal', destX: 1, destY: 7}],
    'luinia_normal': [],
    'forbidden_road': [{x: 0, y_range: [6,7], destMap: 'village', destX: 18, destY: 6}, {x: 15, y_range: [6,7], destMap: 'cave', destX: 1, destY: 8}],
    // ***** 修正箇所 *****
    'cave': [{x: 0, y_range: [7,8], destMap: 'forbidden_road', destX: 14, destY: 7}, {x: 19, y_range: [7,8], destMap: 'log_fortress_scripted', destX: 12, destY: 10}], // destY を 9 から 10 に戻す
    // ***** 修正箇所 *****
    'log_fortress_scripted': [ {x: 0, y_range: [7,8], destMap: 'cave_2', destX: 18, destY: 8}],
    'feronia': [{x_range: [8, 10], y: 1, destMap: 'mountain', destX: 13, destY: 12}],
    'cave_2': [ { x_range: [8,10], y: 13, destMap: 'luinia_normal', destX: 28, destY: 7 }, { x: 9, y: 0, destMap: 'plains', destX: 10, destY: 15 }, { x: 19, y_range: [7,8], destMap: 'log_fortress_scripted', destX: 12, destY: 10 }],
    'mountain': [{x_range: [12,14], y:13, destMap: 'feronia', destX: 9, destY: 2}],
    'log_fortress_final': [{x_range: [11, 13], y: 10, destMap: 'desert', destX: 19, destY: 1}],
    'final_dungeon': [{x_range: [6,12], y:14, destMap: 'village', destX: 17, destY: 2}]
};
let MAP_DATA = {
    'village': MAP_VILLAGE, 'plains': null, 'forest': MAP_FOREST, 'forest_b': MAP_FOREST_B, 'cliff': MAP_CLIFF, 'luinia_normal': null, 'forbidden_road': MAP_FORBIDDEN_ROAD, 'cave': MAP_CAVE, 'log_fortress_scripted': MAP_LOG_FORTRESS_SCRIPTED, 'feronia': MAP_FERONIA, 'cave_2': MAP_CAVE_2, 'mountain': MAP_MOUNTAIN, 'desert': MAP_DESERT, 'log_fortress_final': MAP_LOG_FORTRESS_FINAL, 'final_dungeon': MAP_FINAL_DUNGEON
};








function parseRow(ch){ if(!isNaN(ch)) return parseInt(ch); if(ch==='.') return 0; return ch; }








function loadMap(mapData, initialX, initialY, mapId) {
    let mapStringArray;
    let mapSeed = mapId.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
    currentPRNG = mulberry32(mapSeed);








    if (mapId === 'plains') {
        const {width, height, borderCenter, borderWaviness} = MAP_PLAINS_TEMPLATE;
        MAP_W = width; MAP_H = height;
        mapStringArray = Array(height).fill(0).map((_, y) => {
            const borderX = borderCenter + Math.floor(Math.sin(y / 4 + 1) * borderWaviness + Math.cos(y/7) * 2);
            return Array(width).fill(0).map((_, x) => {
                if (y === 0 || y === height-1 || x === 0 || x === width-1) return (y === 15 && (x === 0 || x === 49)) || ((x >= 19 && x <= 21) && y === 0) || ((x >= 14 && x <= 16) && y === 29) ? 3 : 1;
                if (x === 45 && y === 25) return 'C';
                if (x > borderX) return (currentPRNG() < 0.03) ? 4 : (currentPRNG() < 0.2 ? 8 : 3);
                else return (currentPRNG() < 0.05) ? 4 : (currentPRNG() < 0.2 ? 5 : 0);
            }).join('');
        });
    } else if (mapId === 'luinia_normal') {
        let baseMap = JSON.parse(JSON.stringify(MAP_LUINIA_NORMAL_TEMPLATE));
        if (gameState.luiniaDestroyed) {
            for (let y = 2; y < 13; y++) for (let x = 2; x < 29; x++) {
                if (currentPRNG() < 0.3) baseMap[y][x] = 'R';
                if (currentPRNG() < 0.1) baseMap[y][x] = '1';
            }
        }
        mapStringArray = baseMap.map(r => r.join(''));
    } else {
        mapStringArray = mapData;
    }
   
    MAP_W = mapStringArray[0].length; MAP_H = mapStringArray.length;
    map = mapStringArray.map(r => r.split('').map(parseRow));
   
    // Apply dynamic map changes
    if (mapId === 'cave_2' && gameState.caveRockMoved) {
        for (let y = 0; y < map.length; y++) for (let x = 0; x < map[y].length; x++) {
            if (map[y][x] === 'B') { map[y][x] = 6; break; }
        }
    }
     if (mapId === 'log_fortress_final' && gameState.puzzleSwitches.solved) {
        map[2][10] = 6; // Open door
    }
    Object.entries(gameState.repairedBridges).forEach(([key, value]) => {
        if (value.mapId === mapId) {
            map[value.y][value.x] = 3;
        }
    });








    gameState.playerX = initialX * TILE; gameState.playerY = initialY * TILE; gameState.currentMapId = mapId; npcs = setupNPCs(mapId);
}






// =========================================================================
// 4. FIREBASE & UTILITY FUNCTIONS
// =========================================================================
function showLoading(show) { loadingOverlay.style.pointerEvents = show ? 'all' : 'none'; loadingOverlay.style.opacity = show ? 1 : 0; }
function showStatus(message, duration = 3000) { statusMessage.textContent = message; statusMessage.style.opacity = 1; clearTimeout(statusMessage.timer); statusMessage.timer = setTimeout(() => { statusMessage.style.opacity = 0; }, duration); }



// Firebase 初期化
async function initializeFirebase() {
  showLoading(true);
  try {
    // Firebase設定を取得
    const firebaseConfig = JSON.parse(
      typeof __firebase_config !== 'undefined' ? __firebase_config : '{}'
    );

    // Firebase設定がある場合のみ初期化
    if (Object.keys(firebaseConfig).length > 0 && typeof firebase !== 'undefined') {
      app = firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      auth = firebase.auth();

      const authToken =
        typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

      if (authToken) {
        await auth.signInWithCustomToken(authToken);
      } else {
        await auth.signInAnonymously();
      }

      auth.onAuthStateChanged((user) => {
        userId = user ? user.uid : 'anon-' + crypto.randomUUID();
        isAuthReady = true;
        showLoading(false);
      });

    } else {
      // Firebase設定がない場合（ローカルモード）
      console.warn("Firebase config not found. Running in local mode.");
      auth = { currentUser: { uid: 'anon-' + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)) } };
      db = null;
      userId = auth.currentUser.uid;
      isAuthReady = true;
      showLoading(false);
    }

  } catch (e) {
    console.error("Firebase init failed:", e);
    showStatus("データ保存機能が利用できません。", 5000);
    showLoading(false);
    // ローカルモードにフォールバック
    auth = { currentUser: { uid: 'anon-' + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)) } };
    db = null;
    userId = auth.currentUser.uid;
    isAuthReady = true;
  }
}

// セーブ処理
async function saveGame() {
  if (!isAuthReady) return;
  showLoading(true);
  try {
    if (!db) throw new Error("Firestore not available");

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const savePath = `artifacts/${appId}/users/${userId}/saveData/rpgSave`;
    await db.doc(savePath).set({ ...gameState, saveTime: new Date().toISOString() });

    showStatus("ゲームをセーブしました！");
  } catch (e) {
    console.error("Save failed:", e);
    showStatus("セーブに失敗しました。");
  } finally {
    showLoading(false);
    closeMenu();
  }
}

// ロード処理
async function loadGame() {
  if (!isAuthReady) return;
  showLoading(true);
  try {
    if (!db) throw new Error("Firestore not available");

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const savePath = `artifacts/${appId}/users/${userId}/saveData/rpgSave`;
    const doc = await db.doc(savePath).get();

    if (doc.exists) {
      gameState = { ...gameState, ...doc.data() };
      teleport(gameState.currentMapId, gameState.playerX / TILE, gameState.playerY / TILE);
      startGame(true);
      showStatus("ゲームをロードしました！");
    } else {
      showStatus("セーブデータが見つかりませんでした。");
    }

  } catch (e) {
    console.error("Load failed:", e);
    showStatus("ロードに失敗しました。");
  } finally {
    showLoading(false);
    if (!gameState.inTitle) closeMenu();
  }
}




// =========================================================================
// 5. GAME LOGIC / STORY EVENTS
// =========================================================================
const NPC_DEFAULTS = { w: TILE, h: TILE, vx: 0, vy: 0, moveTimer: 0, pattern: 'static' };








function teleport(mapId, tileX, tileY) {
    playerPositionHistory = [];
    loadMap(MAP_DATA[mapId], tileX, tileY, mapId);
}








const onWolfWin = async () => {
    inEvent = true;
    npcs = npcs.filter(n => n.name !== 'リディア' && n.name !== 'フォレストウルフ');
    await new Promise(r => setTimeout(r, 500));
    showDialog('？？？', ['ふぅ...危なかったわね。助かったわ、ありがとう。']);
    await waitDialog();
    showDialog('プロシア', ['無事でよかった。それにしても、なぜこんな森の奥に？']);
    await waitDialog();
    showDialog('リディア', ['ありがとう。私はリディア、魔法使いよ。あなたこそ、なぜ？']);
    await waitDialog();
    showDialog('プロシア', ['俺はプロシア。「ログ」という存在を追っている。世界の時間を歪めている元凶らしい。']);
    await waitDialog();
    showDialog('リディア', ['ログを！？奇遇ね、私もよ。最近の魔物の凶暴化も、異常気象も、全てアイツの仕業だと睨んでいるわ。']);
    await waitDialog();
    showDialog('リディア', ['この先のルイニアという街に、奴の手がかりがあるはず。よかったら、一緒に行かない？']);
    await waitDialog();
    showDialog('プロシア', ['ああ、助かる。よろしく頼む、リディア。']);
    await waitDialog();








    gameState.party.push({ name: 'リディア', hp: 35, maxHP: 35, baseAtk: 15, baseDef: 6, exp: 0, level: 1, weapon: null, armor: null, roll: null, rollTurns: 0, baseMaxHP: 35, type: 'W', status: null, statusTurns: 0 });
    showStatus('リディアが仲間に加わった！');
    gameState.storyFlag = 3;
    inEvent = false;
};








const onRatioWin = async () => {
    inEvent = true;
    npcs = npcs.filter(n => n.name !== 'ラティオ' && n.name !== '襲われている人');
   
    await new Promise(r => setTimeout(r, 500));
    showDialog('市民', ['た...助かった。本当にありがとうございました！']);
    await waitDialog();
    showDialog('？？？', ['・・・見事な戦いだったな。']);
    await waitDialog();
    showDialog('カイン', ['俺はカイン、この街の用心棒だ。']);
    await waitDialog();
    showDialog('プロシア', ['用心棒？この街は平和そうに見えたが。']);
    await waitDialog();
    showDialog('カイン', ['ああ、表向きはな。だが、今の奴のように、最近は不穏な輩が嗅ぎ回っている。お前たち、ただの旅人じゃないだろう？']);
    await waitDialog();
    showDialog('リディア', ['私たちはログを追っているの。世界の混乱の元凶よ。']);
    await waitDialog();
    showDialog('カイン', ['ログ...！やはりそうか。俺も奴の悪行は聞き及んでいる。お前たちの強さ、見込んだ。共に戦わせてくれ。']);
    await waitDialog();
    gameState.party.push({ name: 'カイン', hp: 75, maxHP: 75, baseAtk: 16, baseDef: 15, exp: 0, level: 1, weapon: null, armor: null, roll: null, rollTurns: 0, baseMaxHP: 75, type: 'M', status: null, statusTurns: 0 });
    showStatus('カインが仲間に加わった！');








    await new Promise(r => setTimeout(r, 1000));
    showDialog('ログの声', ['ラティオがやられたか...。だが、この街ごと消し去れば問題あるまい。']);
    await waitDialog();
   
    canvas.style.transition = 'transform 0.05s';
    let shakes = 0;
    const shakeInterval = setInterval(() => {
        const x = (Math.random() - 0.5) * 20;
        const y = (Math.random() - 0.5) * 20;
        canvas.style.transform = `translate(${x}px, ${y}px)`;
        shakes++;
        if (shakes > 40) {
            clearInterval(shakeInterval);
            canvas.style.transform = 'translate(0,0)';
            canvas.style.transition = '';
        }
    }, 50);
    showDialog('リディア', ['...！？すごい揺れよ！街が...崩れていく！']);
    await waitDialog();
    fadeOverlay.style.opacity = 1;
    await new Promise(r => setTimeout(r, 1500));
   
    gameState.luiniaDestroyed = true;
    teleport('luinia_normal', 15, 7);
    gameState.party.find(p => p.name === 'リディア').hp = 5;








    fadeOverlay.style.opacity = 0;
    await new Promise(r => setTimeout(r, 500));








    showDialog('プロシア', ['くっ...なんてことだ...街が...。']);
    await waitDialog();
    showDialog('カイン', ['これがログのやり方か...！許せん！']);
    await waitDialog();
    showDialog('プロシア', ['リディア、大丈夫か！？ひどい怪我だ...。急いで安全な場所へ！まずは村に戻るぞ！']);
    await waitDialog();
   
    gameState.storyFlag = 5;
    inEvent = false;
};








const onScriptedLogDefeat = async () => {
    inEvent = true;
    await new Promise(r => setTimeout(r, 1000));
    showDialog('プロシア', ['グハッ....']);
    await waitDialog();
    showDialog('ログ', ['フハハハ…！愚かな者どもよ。我が力の前では、貴様らなど赤子同然。']);
    await waitDialog();
    showDialog('プロシア', ['くっ…！なんて力だ…！これが、時を歪める者の…！']);
    await waitDialog();
    showDialog('ログ', ['消え失せろ。だが、命だけは助けてやろう。その無力さを世界に伝える語り手としてな！']);
    await waitDialog();








    fadeOverlay.style.opacity = 1;
    await new Promise(r => setTimeout(r, 1500));
   
    gameState.party.forEach(p => p.hp = Math.max(1, Math.floor(p.maxHP / 10)));
    teleport('feronia', 12, 13);
   
    fadeOverlay.style.opacity = 0;
    await new Promise(r => setTimeout(r, 1000));
   
    showDialog('カイン', ['…ここは…どこだ…？']);
    await waitDialog();
    showDialog('リディア', ['わからない…でも、なんとか逃げ延びたみたいね…。']);
    await waitDialog();
    showDialog('プロシア', ['今は態勢を立て直すのが先だ。この街で情報を集めよう。']);
    await waitDialog();








    gameState.storyFlag = 7;
    inEvent = false;
}








const onRatio2Win = async () => {
    inEvent = true;
    await new Promise(r => setTimeout(r, 500));
    showDialog('ラティオ', ['ぐっ...！またしても...この私がお前たちごときに...。']);
    await waitDialog();
    showDialog('プロシア', ['もう終わりだ、ラティオ！']);
    await waitDialog();
    showDialog('ラティオ', ['フ...フフ...。これで終わりだと思うな...。ログ様の要塞は、すぐそこだ...。ログ様はきっとお前たちを倒すだろう！']);
    await waitDialog();
    showDialog('', ['ラティオは不気味に笑いながら消えていった...。', '足元に、羊皮紙の地図が落ちている。']);
    await waitDialog();
    showStatus('ログの要塞の地図を手に入れた！');
    gameState.storyFlag = 9;
    gameState.hasDungeonMap = true;
    inEvent = false;
};








const onLogFinalWin = async () => {
    inEvent = true;
    await new Promise(r => setTimeout(r, 1000));
    showDialog('ログ', ['ばかな...この私が...。だが、これで...全て終わる...。']);
    await waitDialog();
    showDialog('プロシア', ['終わり？どういうことだ！']);
    await waitDialog();
    showDialog('ログ', ['私ですら...ただの駒だったのだ...。真の黒幕は...奴だ。奴は...時の概念そのものを...無に...']);
    await waitDialog();
    showDialog('ログ', ['奴の名は....']);
    await waitDialog();
    showDialog('？？？', ['役立たずめ。そこまでだ。']);
    await waitDialog();








    // Remniscate appears and kills Log
    npcs.push({ ...NPC_DEFAULTS, isProp: true, skin: '#e0c3fc', body: '#6a0dad', x: 10 * TILE, y: 5 * TILE });
    await new Promise(r => setTimeout(r, 1000));
    npcs = npcs.filter(n => n.name !== 'ログ');
   
    showDialog('？？？', ['よくぞここまで来たな、時の異分子どもよ。']);
    await waitDialog();
    showDialog('レム二スケート', ['我が名はレム二スケート。お前たちの旅もここまでだ！']);
    await waitDialog();
    showDialog('カイン', ['お前が..レム二スケートか。']);
    await waitDialog();
    showDialog('リディア', ['伝説として本で読んだけど、まさか実際にいたなんて..']);
    await waitDialog();
    showDialog('セリナ', ['あなたは一体何が目的なのよ！']);
    await waitDialog();
    showDialog('レムニスケート', ['時という不安定な概念に揺れるこの世界を、完全な無に還す。それだけだ。']);
    await waitDialog();
    showDialog('レムニスケート', ['始まりの場所で待つ。世界の真の終わりを見せてやろう。']);
    await waitDialog();








    fadeOverlay.style.opacity = 1;
    await new Promise(r => setTimeout(r, 1500));
    teleport('village', 11, 13);
    fadeOverlay.style.opacity = 0;
   
    gameState.storyFlag = 11;
    inEvent = false;
};








const onRemniscateWin = async () => {
    inEvent = true;
    await new Promise(r => setTimeout(r, 1000));
    showDialog('レムニスケート', ['なぜだ...なぜ時を司る私が...ただの人間ごときに...。']);
    await waitDialog();
    showDialog('プロシア', ['お前の歪んだ支配は終わりだ！']);
    await waitDialog();
    showDialog('レムニスケート', ['終わり...そうか、これもまた...時が生み出す結末か...。']);
    await waitDialog();
   
    fadeOverlay.style.transition = 'opacity 2s';
    fadeOverlay.style.background = '#fff';
    fadeOverlay.style.opacity = 1;
    await new Promise(r => setTimeout(r, 2500));








    showDialog('プロシア', ['時空の原石の力が...完全に戻ってきた...！']);
    await waitDialog();
    showDialog('リディア', ['やったのね...！世界が...元の時の流れを取り戻していくのがわかるわ...！']);
    await waitDialog();
    showDialog('カイン', ['ああ、長かった戦いも...これで終わりだな。']);
    await waitDialog();
    showDialog('セリナ', ['みんな、本当にお疲れ様...！']);
    await waitDialog();
    showDialog('プロシア', ['みんながいてくれたからだ。ありがとう。さあ、帰ろう。俺たちの時間に。']);
    await waitDialog();
   
    endingOverlay.style.opacity = 1;
    endingOverlay.style.pointerEvents = 'all';








    inEvent = false;
};








function setupNPCs(mapId) {
    let currentNpcs = [];
    if (mapId === 'village') {
        currentNpcs.push({ ...NPC_DEFAULTS, x: 7 * TILE, y: 3 * TILE, name: '長老', type: 'M', text: gameState.storyFlag < 1.5 ? ["なんと…！プロシア、詳しく話してごらん。", "閃光、か…。そして原石の力が消えた…。まさか…。", "古の言い伝えにある…。世界から時を喰らい、記録を歪める存在…『ログ』。奴が復活したというのか…？", "その閃光は、奴が原石の力を奪った証やもしれん。", "お前にとっては酷な旅となろうが…原石を取り戻さねばならん。まずは村の北にある平原を抜け、魔の森へ向かいなさい。そこに手がかりがあるやもしれん。"] : (gameState.storyFlag >= 11 ? ["おお、プロシア！よくぞ世界を救ってくれた！お前は村の誇りじゃ！"] : ["ログの手がかりは掴めたかの？"]) });
        currentNpcs.push({ ...NPC_DEFAULTS, x: 2 * TILE, y: 7 * TILE, name: '与力者', type: 'M', isBestower: true, text: ["ロールの力を付与しよう。ロール・キーを持っているかね？"] });
        if (gameState.storyFlag >= 5.5 && !gameState.party.find(p => p.name === 'セリナ')) {
            currentNpcs.push({ ...NPC_DEFAULTS, x: 3 * TILE, y: 4 * TILE, name: 'セリナ', type: 'W', isEvent: true, eventType: 'selina_joins' });
        } else if (!gameState.party.find(p => p.name === 'セリナ')) {
            currentNpcs.push({ ...NPC_DEFAULTS, x: 3 * TILE, y: 4 * TILE, name: 'セリナ', type: 'W', pattern: 'random', text: ["プロシア、気をつけてね…。なんだか胸騒ぎがするの。"] });
        }
        currentNpcs.push({ ...NPC_DEFAULTS, x: 12 * TILE, y: 8 * TILE, name: '村の女性', type: 'W', pattern: 'random', text: ["最近、森の魔物たちが少し凶暴になっている気がするわ。"] });
        currentNpcs.push({ ...NPC_DEFAULTS, x: 15 * TILE, y: 3 * TILE, name: '男の子', type: 'M+C', pattern: 'random', text: ["わーい！プロシア兄ちゃんだ！冒険に行くの？"] });
        currentNpcs.push({ ...NPC_DEFAULTS, isSign: true, x: 10 * TILE, y: 2 * TILE, text: ["↑ 平原"] });
        if (gameState.storyFlag >= 6) { currentNpcs.push({ ...NPC_DEFAULTS, isSign: true, x: 18 * TILE, y: 4 * TILE, text: ["→ 禁じられた道"] }); }








    } else if (mapId === 'luinia_normal') {
        if (!gameState.luiniaDestroyed) {
            currentNpcs.push({ ...NPC_DEFAULTS, x: 2 * TILE, y: 10 * TILE, name: '兵士', type: 'M', text: ["ここは中都市ルイニア。ようこそ。"] });
            currentNpcs.push({ ...NPC_DEFAULTS, x: 15 * TILE, y: 5 * TILE, name: '町の人A', type: 'W', pattern: 'random', text: ["最近、街の時計がよく狂うんだ。まるで誰かが時間をいじっているみたいに…"] });
            currentNpcs.push({ ...NPC_DEFAULTS, x: 20 * TILE, y: 10 * TILE, name: '旅商人', type: 'M', text: ["遠くの鉱山から来たが、名産だった『時空の原石』がごっそり消えちまって商売あがったりだよ。"] });
            currentNpcs.push({ ...NPC_DEFAULTS, x: 8 * TILE, y: 3 * TILE, name: '学者風の男', type: 'M', text: ["この世界の記録…いわば『ログ』が乱れているような、奇妙な感覚に陥ることがある。考えすぎかね。"] });
            currentNpcs.push({ ...NPC_DEFAULTS, x: 25 * TILE, y: 3 * TILE, name: '与力者', type: 'M', isBestower: true, text: ["ロールの力を付与しよう。"] });
            currentNpcs.push({ ...NPC_DEFAULTS, x: 10 * TILE, y: 12 * TILE, name: '主婦', type: 'W', pattern: 'random', text: ["お買い物に来たけど、なんだか物価が上がっているような…。"] });
            currentNpcs.push({ ...NPC_DEFAULTS, x: 18 * TILE, y: 8 * TILE, name: '子供', type: 'M+C', pattern: 'random', text: ["ねえねえ、時空の原石ってキラキラしてて綺麗なんだって！見てみたいなあ。"] });
            currentNpcs.push({ ...NPC_DEFAULTS, x: 22 * TILE, y: 5 * TILE, name: '裕福そうな男', type: 'M', text: ["ふむ…私のコレクションであるアンティーク時計も最近ズレる。由々しき事態だ。"] });
        } else {
             currentNpcs.push({ ...NPC_DEFAULTS, x: 12 * TILE, y: 10 * TILE, name: '生存者', type: 'W', text: ["うぅ...街が...。東の方に、洞窟への道ができていたぞ…"]});
        }
    } else if (mapId === 'forest_b' && gameState.storyFlag < 3 && !gameState.party.find(p => p.name === 'リディア')) {
        currentNpcs.push({ ...NPC_DEFAULTS, x: 10 * TILE, y: 8 * TILE, name: 'リディア', type: 'W', onWin: onWolfWin });
        currentNpcs.push({ ...NPC_DEFAULTS, x: 11 * TILE, y: 8 * TILE, name: 'フォレストウルフ', isProp: true, skin: '#AAB7B8', body: '#5D6D7E' });
    } else if (mapId === 'feronia') {
        currentNpcs.push({ ...NPC_DEFAULTS, x: 3 * TILE, y: 3 * TILE, name: '鉱夫', type: 'M', pattern: 'random', text: ["この街は昔、時空の原石の鉱山で栄えたんだがな…2年前に急に原石が枯渇しちまってこのザマさ。"] });
        currentNpcs.push({ ...NPC_DEFAULTS, x: 20 * TILE, y: 10 * TILE, name: '老婆', type: 'W', text: ["山の頂には、昔使われていた天空艇『飛龍』が眠っているそうじゃよ。"] });
        currentNpcs.push({ ...NPC_DEFAULTS, x: 15 * TILE, y: 4 * TILE, name: '元鉱山長', type: 'M', text: ['時空の原石は、まるで生きているようじゃった。一夜にして、脈が完全に消え失せたのは、今でも信じられん…。'] });
        currentNpcs.push({ ...NPC_DEFAULTS, x: 10 * TILE, y: 10 * TILE, name: '与力者', type: 'M', isBestower: true, text: ["おぬしらにも、ロールの力を与えよう。"] });
        currentNpcs.push({ ...NPC_DEFAULTS, x: 5 * TILE, y: 12 * TILE, name: '元鉱夫A', type: 'M', pattern: 'random', text: ["ちくしょう…あの山にもう原石はねえってのか…。"] });
        currentNpcs.push({ ...NPC_DEFAULTS, x: 18 * TILE, y: 12 * TILE, name: '元鉱夫B', type: 'M', text: ["鉱山が閉鎖されてから、この街もすっかり寂れちまった。"] });
        currentNpcs.push({ ...NPC_DEFAULTS, x: 7 * TILE, y: 6 * TILE, name: '宿屋の主人', type: 'M', text: ["へい、いらっしゃい！…と言っても、最近は客もまばらでね。"] });
        currentNpcs.push({ ...NPC_DEFAULTS, x: 2 * TILE, y: 6 * TILE, name: '武器屋の主人', type: 'M', text: ["鉱夫相手の商売だったからなあ。もうつるはしは売れねえよ。"] });
        currentNpcs.push({ ...NPC_DEFAULTS, x: 12 * TILE, y: 3 * TILE, name: '子供A', type: 'M+C', pattern: 'random', text: ["山のてっぺんの『飛龍』、本当に飛ぶのかなあ？"] });
        currentNpcs.push({ ...NPC_DEFAULTS, x: 13 * TILE, y: 3 * TILE, name: '子供B', type: 'W+C', pattern: 'random', text: ["父ちゃんが言ってた！昔は空飛ぶ船があったんだって！"] });
        currentNpcs.push({ ...NPC_DEFAULTS, x: 20 * TILE, y: 3 * TILE, name: '主婦A', type: 'W', pattern: 'random', text: ["昔は活気があったんだけどねえ、この街も…。"] });
        currentNpcs.push({ ...NPC_DEFAULTS, x: 21 * TILE, y: 8 * TILE, name: '主婦B', type: 'W', text: ["山の道は危ないよ。もう誰も手入れしてないからね。"] });
        currentNpcs.push({ ...NPC_DEFAULTS, x: 15 * TILE, y: 10 * TILE, name: '旅の商人', type: 'M', pattern: 'random', text: ["こんな寂れた街に用かい？物好きもいたもんだ。"] });
        currentNpcs.push({ ...NPC_DEFAULTS, x: 2 * TILE, y: 10 * TILE, name: '若者', type: 'M', text: ["もうこの街には未来はねえ。俺もどこか別の街に行くつもりさ。"] });
        currentNpcs.push({ ...NPC_DEFAULTS, x: 18 * TILE, y: 5 * TILE, name: '学者', type: 'M', text: ["『飛龍』は古代の技術の結晶…一度でいいから調査してみたいものだ。"] });
    }
    return currentNpcs;
}








function getFacingTile() {
    const px = Math.floor(gameState.playerX / TILE);
    const py = Math.floor(gameState.playerY / TILE);
    if (gameState.playerDir === 'up') return { x: px, y: py - 1 };
    if (gameState.playerDir === 'down') return { x: px, y: py + 1 };
    if (gameState.playerDir === 'left') return { x: px - 1, y: py };
    if (gameState.playerDir === 'right') return { x: px + 1, y: py };
    return {x: px, y: py};
}
















async function checkInteraction() {
    // Part 1: Distance-based check for talking to NPCs
    const playerCenterX = gameState.playerX + TILE / 2;
    const playerCenterY = gameState.playerY + TILE / 2;
    const INTERACTION_DISTANCE = TILE * 1.4;








    let closestNpc = null;
    let minDistance = INTERACTION_DISTANCE;








    for (const n of npcs) {
        if (n.isSign || n.isProp) continue;








        const npcCenterX = n.x + TILE / 2;
        const npcCenterY = n.y + TILE / 2;
        const dx = npcCenterX - playerCenterX;
        const dy = npcCenterY - playerCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);








        if (distance < minDistance) {
            const dir = gameState.playerDir;
            if ((dir === 'up' && dy < 0 && Math.abs(dy) > Math.abs(dx)) ||
                (dir === 'down' && dy > 0 && Math.abs(dy) > Math.abs(dx)) ||
                (dir === 'left' && dx < 0 && Math.abs(dx) > Math.abs(dy)) ||
                (dir === 'right' && dx > 0 && Math.abs(dx) > Math.abs(dy))) {
                minDistance = distance;
                closestNpc = n;
            }
        }
    }








    if (closestNpc) {
        if(closestNpc.isBestower) {
            if (!gameState.hasExplainedRoles) {
                showDialog(closestNpc.name, ["おぉ、見どころのある顔つきじゃな。わしは「ロール」…つまりは役割の力を人に与えることができる。", "「ロール・キー」と呼ばれるアイテムがあれば、その者に秘められた力を引き出し、戦闘を有利にすることができるのじゃ。", "さあ、誰に力を与える？"]);
                await waitDialog();
                gameState.hasExplainedRoles = true;
            }
            openRollMenu();
            return true;
        }
        if (closestNpc.isEvent && closestNpc.eventType === 'selina_joins') {
            inEvent = true;
            showDialog('セリナ', ['プロシア！ルイニアで私の友達を助けてくれたって聞いたわ！ありがとう！']);
            await waitDialog();
            showDialog('セリナ', ['私も、あなたたちの力になりたい。一緒に連れて行って！']);
            await waitDialog();
            showDialog('プロシア', ['セリナ...だが、これからの旅は危険だぞ。']);
            await waitDialog();
            showDialog('セリナ', ['覚悟の上よ！私も、この世界を守りたいの！']);
            await waitDialog();
            gameState.party.push({ name: 'セリナ', hp: 50, maxHP: 50, baseAtk: 9, baseDef: 14, exp: 0, level: 1, weapon: null, armor: null, roll: null, rollTurns: 0, baseMaxHP: 50, type: 'W', status: null, statusTurns: 0 });
            showStatus('セリナが仲間に加わった！');
            npcs = npcs.filter(npc => npc.name !== 'セリナ');
            gameState.storyFlag = 6;
            inEvent = false;
            return true;
        }
        if (closestNpc.name === '長老' && gameState.storyFlag < 1.5) { gameState.storyFlag = 1.5; }
        showDialog(closestNpc.name, closestNpc.text);
        return true;
    }








    // Part 2: Tile-based check for objects, signs, etc.
    const facing = getFacingTile();
    const {x, y} = facing;
   
    // Check for puzzle switches
    const puzzleKey = `${gameState.currentMapId}_${x}_${y}`;
    if (gameState.currentMapId === 'log_fortress_final' && !gameState.puzzleSwitches.solved) {
        const switchId = ['B', 'R', 'G', 'Y'].find(id => tileAt(x, y) === id);
        if (switchId) {
            handlePuzzleSwitch(switchId);
            return true;
        }
    }
    // Check for signs at the facing tile
    for (const n of npcs) {
         if (n.isSign) {
             const nx = Math.floor(n.x / TILE), ny = Math.floor(n.y / TILE);
             if (nx === x && ny === y) {
                 showDialog('看板', n.text);
                 return true;
             }
        }
    }
   
    // Check for interactive map tiles
    const tid = tileAt(x, y);
    if (tid === 'S' && !gameState.luiniaDestroyed) { const shopId = gameState.currentMapId; openShop(shopId); return true; }
    if (tid === 'I' && !gameState.luiniaDestroyed) { openInn(); return true; }
    if (tid === 'C') { openChest(x, y); return true; }
    if (tid === 'B' && gameState.currentMapId === 'cave_2') {
        const cain = gameState.party.find(p => p.name === 'カイン');
        if (cain) {
            inEvent = true;
            showDialog('プロシア', ['この岩が道を塞いでいるな…']);
            await waitDialog();
            showDialog('カイン', ['ふん、俺に任せろ。これくらい、どうということはない。']);
            await waitDialog();
           
            const rockNpc = { ...NPC_DEFAULTS, x: x * TILE, y: y * TILE, isProp: true, skin: '#6d4c41', body: '#4e342e', id: 'temp_rock'};
            npcs.push(rockNpc);
           
            for (let i = 0; i < TILE; i++) {
                rockNpc.x++;
                await new Promise(r => setTimeout(r, 50));
            }
           
            npcs = npcs.filter(n => n.id !== 'temp_rock');
            map[y][x] = 6;
            gameState.caveRockMoved = true;
           
            showDialog('リディア', ['すごい力ね、カイン！']);
            await waitDialog();
            showDialog('カイン', ['これでお前たちの役に立てたなら、安いものだ。']);
            await waitDialog();
            inEvent = false;
        } else {
            showDialog('プロシア', ['大きな岩だ。俺たちだけでは動かせそうにない…。']);
        }
        return true;
    }
     if (tid === 'D') {
        if (gameState.hasTimeFragment) {
            inEvent = true;
            showDialog('プロシア', ['この橋は壊れているな…。だが、「時のかけら」の力を使えば…！']);
            await waitDialog();
            showDialog('プロシア', ['リバース！']);
            await waitDialog();








            fadeOverlay.style.transition = 'opacity 0.1s';
            fadeOverlay.style.background = '#fff';
            fadeOverlay.style.opacity = 1;
            await new Promise(r => setTimeout(r, 200));
           
            const bridgeId = `${gameState.currentMapId}_${x}_${y}`;
            gameState.repairedBridges[bridgeId] = { mapId: gameState.currentMapId, x, y };
            map[y][x] = 3; // Change tile to repaired bridge








            fadeOverlay.style.opacity = 0;
            await new Promise(r => setTimeout(r, 200));
            fadeOverlay.style.background = '#000';
            fadeOverlay.style.transition = 'opacity 0.3s';








            showDialog('プロシア', ['よし、これで渡れるぞ！']);
            await waitDialog();
            inEvent = false;








        } else {
            showDialog('プロシア', ['橋が壊れていて、これ以上進めない。']);
        }
        return true;
    }
    if (tid === 'F') {
        if (gameState.hasTimeFragment) {
            inEvent = true;
            showDialog('プロシア', ['この古びた天空艇...「時のかけら」の力を使えば・・・あるいは...']);
            await waitDialog();
            showDialog('プロシア', ['リバース！！！']);
            await waitDialog();








            fadeOverlay.style.transition = 'opacity 0.2s';
            fadeOverlay.style.background = '#fff';
            for(let i=0; i<3; i++) {
                fadeOverlay.style.opacity = 1; await new Promise(r => setTimeout(r, 150));
                fadeOverlay.style.opacity = 0; await new Promise(r => setTimeout(r, 150));
            }
            fadeOverlay.style.background = '#000'; fadeOverlay.style.transition = 'opacity 0.3s';
           
            showStatus('天空艇「飛龍」が起動した！');
            gameState.hiryuActivated = true;
            gameState.storyFlag = 8.5;








            showDialog('リディア', ['すごい...！本当に動くようになったわ！']);
            await waitDialog();
            showDialog('カイン', ['これで行動範囲が広がるな。']);
            await waitDialog();
            inEvent = false;
        } else {
            showDialog('', ['古びた天空艇だ。今は動かないようだ…']);
        }
        return true;
    }
    if (tid === 'T' && gameState.storyFlag >= 11) {
        inEvent = true;
        showDialog('プロシア', ['レムニスケートは言っていた...「始まりの場所」と...。たぶん、この村のどこかに...。']);
        await waitDialog();
        showDialog('セリナ', ['この木...昔からあるけど、なんだか不思議な感じがするの。']);
        await waitDialog();
        showDialog('プロシア', ['......！間違いない、ここだ！みんな、最終決戦だ！']);
        await waitDialog();
        fadeOverlay.style.opacity = 1;
        await new Promise(r => setTimeout(r, 1000));
        teleport('final_dungeon', 9, 13);
        fadeOverlay.style.opacity = 0;
        gameState.storyFlag = 12;
        inEvent = false;
        return true;
    }
    return false;
}








async function openChest(x, y) {
    const chestId = `${gameState.currentMapId}_${x}_${y}`;
    if (gameState.chests[chestId]) {
        showDialog('宝箱', ['もう空っぽだ。']);
        return;
    }
    const contents = CHEST_CATALOG[chestId];
    if (contents) {
        showDialog('宝箱', [`中から ${contents.name} をみつけた！`]);
        if (contents.type === 'equipment') gameState.equipment[contents.key] = (gameState.equipment[contents.key] || 0) + 1;
        else if (contents.type === 'item') gameState.inventory[contents.key] = (gameState.inventory[contents.key] || 0) + 1;
        gameState.chests[chestId] = true;
    } else {
        showDialog('宝箱', ['何も入っていなかった...']);
    }
}
















// =========================================================================
// 6. MENU & UI FUNCTIONS
// =========================================================================
function typeWriter(text, onComplete) {
    let i = 0;
    dtext.textContent = "";
    isTyping = true;
    clearInterval(typewriterInterval);
    typewriterInterval = setInterval(() => {
        if (i < text.length) {
            dtext.textContent += text.charAt(i);
            i++;
        } else {
            clearInterval(typewriterInterval);
            isTyping = false;
            if(onComplete) onComplete();
        }
    }, 30);
}








function showDialog(name, lines) {
    dialogQueue = Array.isArray(lines) ? lines.slice() : [lines];
    dname.textContent = name || '';
    dialog.style.display = 'block';
    showingDialog = true;
    showNextDialogLine();
}








function showNextDialogLine() {
    if (isTyping) {
        clearInterval(typewriterInterval);
        dtext.textContent = dialogQueue[0];
        isTyping = false;
        dialogQueue.shift();
        return;
    }
    if (dialogQueue.length === 0) {
        hideDialog();
        return;
    }
    const currentLine = dialogQueue[0];
    typeWriter(currentLine, () => {
        dialogQueue.shift();
    });
}
function hideDialog(){dialog.style.display='none';showingDialog=false;}








function openMenu(){
    inMenu=true;
    gameMenu.style.display='block';
    const mainMenu = document.getElementById('main-menu-list');
    let hiryuItem = mainMenu.querySelector('#hiryu-menu-item');
    if (gameState.hiryuActivated) {
        if (!hiryuItem) {
            const newItem = document.createElement('li');
            newItem.id = 'hiryu-menu-item';
            newItem.textContent = '飛龍';
            newItem.onclick = () => showMenuScreen('hiryu-menu-screen');
            mainMenu.insertBefore(newItem, mainMenu.children[4]);
        }
    } else if (hiryuItem) {
        hiryuItem.remove();
    }
    showMenuScreen('main-menu-screen');
}
function closeMenu(){ inMenu=false; menuState.active = false; gameMenu.style.display='none'; }
function showMenuScreen(screenId){
    document.querySelectorAll('.menu-screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(screenId);
    screen.classList.add('active');
   
    menuState.active = true;
    menuState.screenId = screenId;
    menuState.container = screen.querySelector('ul') || screen;
    menuState.items = Array.from(menuState.container.querySelectorAll('li, button'));
    menuState.cursor = 0;
    updateMenuSelection();
   
    if (screenId === 'item-menu-screen') updateItemMenu();
    else if (screenId === 'equipment-menu-screen') openEquipmentMenu();
    else if (screenId === 'settings-menu-screen') setupSettings();
    else if (screenId === 'main-menu-screen' || screenId === 'status-menu-screen') updateMenuInfo();
    else if (screenId === 'mod-menu-screen') updateModMenu();
    else if (screenId === 'hiryu-menu-screen') updateHiryuMenu();
}
function updateMenuSelection() {
    menuState.items.forEach((item, index) => {
        item.classList.toggle('selected', index === menuState.cursor);
    });
}








function setupSettings() {
    const list = document.getElementById('settings-list');
    list.innerHTML = '';
    const controlsLi = document.createElement('li');
    controlsLi.textContent = `操作方法: ${gameState.controlType === 'keyboard' ? 'キーボード' : 'タッチパネル'}`;
    controlsLi.onclick = () => {
        gameState.controlType = gameState.controlType === 'keyboard' ? 'touch' : 'keyboard';
        touchControls.classList.toggle('active', gameState.controlType === 'touch');
        setupSettings();
    };
    list.appendChild(controlsLi);
    menuState.items = Array.from(list.parentElement.querySelectorAll('li, button'));
    menuState.cursor = 0;
    updateMenuSelection();
}








function calculateStats(member, isBattle = false) {
    if(!member.baseMaxHP) member.baseMaxHP = member.maxHP;
    let baseMaxHP = member.baseMaxHP;
    let atk = member.baseAtk, def = member.baseDef;
    if(member.weapon && EQUIPMENT_CATALOG[member.weapon]) atk += EQUIPMENT_CATALOG[member.weapon].atk;
    if(member.armor && EQUIPMENT_CATALOG[member.armor]) def += EQUIPMENT_CATALOG[member.armor].def;
    if(member.roll) {
        const roll = ROLL_CATALOG[member.roll];
        if(roll.passive || (isBattle && member.rollTurns > 0)) {
            if(roll.effects.hp) baseMaxHP = Math.floor(baseMaxHP * roll.effects.hp);
            if(roll.effects.atk) atk = Math.floor(atk * roll.effects.atk);
            if(roll.effects.def) def = Math.floor(def * roll.effects.def);
        }
    }
    member.atk = atk; member.def = def; member.maxHP = baseMaxHP;
}
function updateMenuInfo() { const partyInfo = document.getElementById('menu-party-info'), statusInfo = document.getElementById('status-party-info'); let html = `<h3>パーティ (所持金: ${gameState.gold}G)</h3>`, statusHtml = '<h3>詳細ステータス</h3>'; gameState.party.forEach(m => { calculateStats(m); const statusText = m.status ? ` (<span style="color:${STATUS_EFFECTS[m.status].color}">${STATUS_EFFECTS[m.status].short}</span>)` : ''; html += `<div class="party-member"><p><strong>${m.name}${statusText}</strong> Lv:${m.level}</p><p>HP:${m.hp}/${m.maxHP}|ATK:${m.atk}|DEF:${m.def}</p></div>`; statusHtml += `<div class="party-member"><p><strong>${m.name}${statusText}</strong> Lv:${m.level}</p><p>HP:${m.hp}/${m.maxHP}</p><p>ATK:${m.atk} | DEF:${m.def}</p><p>EXP:${m.exp} / ${LEVEL_UP_TABLE[m.level+1]||'MAX'}</p><p class="equip-details">武:${m.weapon?EQUIPMENT_CATALOG[m.weapon].name:'-'} | 鎧:${m.armor?EQUIPMENT_CATALOG[m.armor].name:'-'}<br>ロール: ${m.roll ? ROLL_CATALOG[m.roll].name : '-'}</p></div>`; }); partyInfo.innerHTML = html; statusInfo.innerHTML = statusHtml; }
function updateItemMenu() { const itemList = document.getElementById('item-list'); itemList.innerHTML = ''; let hasItem = false; for (const itemKey in gameState.inventory) { if (gameState.inventory[itemKey] > 0) { hasItem=true; const li = document.createElement('li'); const itemData = ITEM_CATALOG[itemKey]; li.textContent = `${itemData.name} x ${gameState.inventory[itemKey]}`; if(itemData.type==='consumable' || itemData.type === 'cure' || itemData.type === 'consumable_full_heal') li.onclick = () => useItem(itemKey); itemList.appendChild(li); } } if (!hasItem) itemList.innerHTML = '<li>アイテムを持っていません。</li>'; menuState.items = Array.from(itemList.parentElement.querySelectorAll('li, button')); menuState.cursor=0; updateMenuSelection(); }
function useItem(itemName, targetMember = null) {
    if (gameState.inventory[itemName] <= 0) return;
    const itemData = ITEM_CATALOG[itemName];








    if (itemData.type === 'consumable' && itemName === 'potion') {
        const target = targetMember || gameState.party.find(p => p.hp > 0 && p.hp < p.maxHP) || gameState.party[0];
        if (target.hp < target.maxHP) {
            const heal = 30;
            target.hp = Math.min(target.hp + heal, target.maxHP);
            gameState.inventory.potion--;
            updateMenuInfo();
            closeMenu();
            showDialog('システム', [`${itemData.name}をつかった。${target.name}のHPが${heal}回復した。`]);
        } else {
            showDialog('システム', [`パーティのHPはまんたんだ。`]);
        }
    } else if (itemData.type === 'consumable_full_heal') {
        const target = targetMember || gameState.party.find(p => p.hp > 0 && p.hp < p.maxHP) || gameState.party[0];
        if (target.hp < target.maxHP) {
            target.hp = target.maxHP;
            gameState.inventory[itemName]--;
            updateMenuInfo();
            closeMenu();
            showDialog('システム', [`${itemData.name}をつかった。${target.name}のHPがかんぜんに回復した。`]);
        } else {
            showDialog('システム', [`つかう必要がないようだ。`]);
        }
    } else if (itemData.type === 'cure') {
        const target = targetMember || gameState.party.find(p => p.status === itemData.cures);
        if (target && target.status === itemData.cures) {
            target.status = null;
            target.statusTurns = 0;
            gameState.inventory[itemName]--;
            updateMenuInfo();
            closeMenu();
             showDialog('システム', [`${itemData.name}をつかった。${target.name}の${STATUS_EFFECTS[itemData.cures].name}が治った。`]);
        } else {
            showDialog('システム', [`つかう必要がないようだ。`]);
        }
    }
}
















// Shop Functions
let currentShopId = 'village';
function openShop(mapId) { inShop = true; currentShopId = mapId; shopMenu.style.display = 'block'; showShopScreen('shop-category-screen'); document.getElementById('shop-gold-category').textContent = `所持金: ${gameState.gold}G`; document.getElementById('shop-buy-weapon').onclick = () => showShopItems('weapons'); document.getElementById('shop-buy-armor').onclick = () => showShopItems('armor'); document.getElementById('shop-buy-item').onclick = () => showShopItems('items'); document.getElementById('shop-back-to-category').onclick = () => showShopScreen('shop-category-screen'); }
function showShopScreen(screenId) {
    shopMenu.querySelectorAll('.modal-screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(screenId);
    screen.classList.add('active');
    menuState.active = true;
    menuState.screenId = screenId;
    menuState.container = screen.querySelector('ul') || screen;
    menuState.items = Array.from(menuState.container.querySelectorAll('li, button'));
    menuState.cursor = 0;
    updateMenuSelection();
}
function closeShop() { inShop = false; menuState.active = false; shopMenu.style.display = 'none'; }
function getItemData(key) { return ITEM_CATALOG[key] || EQUIPMENT_CATALOG[key]; }
function showShopItems(category) {
    showShopScreen('shop-item-screen');
    const titleMap = { weapons: 'ぶき', armor: 'ぼうぐ', items: 'どうぐ' };
    document.getElementById('shop-item-title').textContent = titleMap[category];
    document.getElementById('shop-gold-items').textContent = `所持金: ${gameState.gold}G`;
    const list = document.getElementById('shop-item-list');
    list.innerHTML = '';
    const shopInventory = SHOP_CATALOG[currentShopId] ? (SHOP_CATALOG[currentShopId][category] || []) : [];
    if (shopInventory.length === 0) { list.innerHTML = '<li>うりものがない</li>'; return; }
    shopInventory.forEach(key => {
        const item = getItemData(key);
        if (!item) { console.warn(`Shop item not found: ${key}`); return; }
        const li = document.createElement('li');
        li.textContent = `${item.name} - ${item.price}G`;
        li.onclick = () => buyItem(key, category);
        list.appendChild(li);
    });
    menuState.items = Array.from(list.parentElement.querySelectorAll('li, button'));
    menuState.cursor = 0;
    updateMenuSelection();
}
function buyItem(key, category) {
    const item = getItemData(key);
    if (gameState.gold >= item.price) {
        gameState.gold -= item.price;
        if (item.type === 'weapon' || item.type === 'armor') {
            gameState.equipment[key] = (gameState.equipment[key] || 0) + 1;
        } else {
            gameState.inventory[key] = (gameState.inventory[key] || 0) + 1;
        }
        showStatus(`${item.name}をかった！`);
        showShopItems(category);
    } else {
        showStatus('ゴールドがたりない！');
    }
}
















function openInn() { inInn = true; innMenu.style.display = 'block'; const cost = 10 * gameState.party.length; document.getElementById('inn-cost').textContent = `ひとばん ${cost}G です。おとまりになりますか？`; document.getElementById('inn-yes').onclick = () => restAtInn(cost); document.getElementById('inn-no').onclick = closeInn; menuState.active=true; menuState.items=Array.from(innMenu.querySelectorAll('button')); menuState.cursor=0; updateMenuSelection(); }
function closeInn() { inInn = false; menuState.active=false; innMenu.style.display = 'none'; }
function restAtInn(cost) { if (gameState.gold >= cost) { gameState.gold -= cost; gameState.party.forEach(p => { p.hp = p.maxHP; p.status = null; p.statusTurns = 0; }); closeInn(); showDialog('やどやの主人', ['ごゆっくりどうぞ。']); } else { closeInn(); showDialog('やどやの主人', ['おや、ゴールドがたりないようですな。']); } }
function openEquipmentMenu() { const list = document.getElementById('equip-char-list'); list.innerHTML = ''; gameState.party.forEach((member, index) => { const li = document.createElement('li'); calculateStats(member); li.innerHTML = `<strong>${member.name}</strong><br><span class="equip-details">武:${member.weapon?EQUIPMENT_CATALOG[member.weapon].name:'-'} | 鎧:${member.armor?EQUIPMENT_CATALOG[member.armor].name:'-'}</span>`; li.onclick = () => showEquipSelection(index); list.appendChild(li); }); menuState.items = Array.from(list.parentElement.querySelectorAll('li, button')); menuState.cursor=0; updateMenuSelection(); }
function showEquipSelection(charIndex) { const member = gameState.party[charIndex]; const list = document.getElementById('equip-char-list'); list.innerHTML = `<h3>${member.name}にそうびさせる</h3>`; for (const key in gameState.equipment) { if (gameState.equipment[key] > 0) { const item = EQUIPMENT_CATALOG[key]; const li = document.createElement('li'); li.textContent = `${item.name} (ATK:${item.atk} DEF:${item.def})`; li.onclick = () => equipItem(charIndex, key); list.appendChild(li); } } const unequipLi = document.createElement('li'); unequipLi.textContent = "そうびをはずす"; unequipLi.onclick = () => showUnequipSelection(charIndex); list.appendChild(unequipLi); const backButton = document.createElement('button'); backButton.textContent = 'もどる'; backButton.onclick = openEquipmentMenu; list.appendChild(backButton); menuState.items=Array.from(list.querySelectorAll('li, button'));menuState.cursor=0;updateMenuSelection();}
function showUnequipSelection(charIndex) { const member = gameState.party[charIndex]; const list = document.getElementById('equip-char-list'); list.innerHTML = `<h3>${member.name}のそうびをはずす</h3>`; if(member.weapon) { const li=document.createElement('li'); li.textContent=`武:${EQUIPMENT_CATALOG[member.weapon].name}`; li.onclick=()=>equipItem(charIndex,null,'weapon'); list.appendChild(li); } if(member.armor) { const li=document.createElement('li'); li.textContent=`鎧:${EQUIPMENT_CATALOG[member.armor].name}`; li.onclick=()=>equipItem(charIndex,null,'armor'); list.appendChild(li); } const backButton=document.createElement('button'); backButton.textContent='もどる'; backButton.onclick=()=>showEquipSelection(charIndex); list.appendChild(backButton); menuState.items=Array.from(list.querySelectorAll('li, button'));menuState.cursor=0;updateMenuSelection();}
function equipItem(charIndex, key, slot = null) { const member = gameState.party[charIndex]; const item = key ? EQUIPMENT_CATALOG[key] : null; const type = slot || item.type; const oldItemKey = member[type]; if (oldItemKey) gameState.equipment[oldItemKey] = (gameState.equipment[oldItemKey] || 0) + 1; if (key) { member[type] = key; gameState.equipment[key]--; } else { member[type] = null; } showStatus('そうびをへんこうした'); openEquipmentMenu(); }
function openRollMenu() { inRollMenu=true; rollMenu.style.display='block'; const c=document.getElementById('roll-content'); c.innerHTML='<p>誰にロールを付与しますか？</p><ul id="roll-char-select"></ul><button onclick="closeRollMenu()">やめる</button>'; const l=document.getElementById('roll-char-select'); gameState.party.forEach((m,i)=>{const li=document.createElement('li'); const cr=m.roll?ROLL_CATALOG[m.roll].name:"なし"; li.innerHTML=`${m.name}<small>(現在:${cr})</small>`; li.onclick=()=>selectRollForKey(i);l.appendChild(li);}); menuState.active=true;menuState.items=Array.from(c.querySelectorAll('li, button'));menuState.cursor=0;updateMenuSelection(); }
function selectRollForKey(charIndex){const c=document.getElementById('roll-content'); c.innerHTML=`<p>どのキーを使いますか？</p><ul id="roll-key-select"></ul><button onclick="openRollMenu()">もどる</button>`; const l=document.getElementById('roll-key-select');let hasKey=false;for(const k in gameState.inventory){if(ITEM_CATALOG[k]&&ITEM_CATALOG[k].type==='roll_key'&&gameState.inventory[k]>0){hasKey=true;const li=document.createElement('li');li.innerHTML=`${ITEM_CATALOG[k].name}<small>(${ITEM_CATALOG[k].description})</small>`;li.onclick=()=>applyRoll(charIndex,k);l.appendChild(li);}}if(!hasKey)l.innerHTML='<li>使えるキーがありません</li>'; menuState.items=Array.from(c.querySelectorAll('li, button'));menuState.cursor=0;updateMenuSelection();}
function applyRoll(charIndex, rollKey) { const member = gameState.party[charIndex]; member.roll = rollKey; gameState.inventory[rollKey]--; showStatus(`${member.name}に「${ROLL_CATALOG[rollKey].name}」を付与した。`); closeRollMenu(); }
function closeRollMenu() { inRollMenu=false; menuState.active=false; rollMenu.style.display='none'; }
function updateHiryuMenu() {
    const destList = document.getElementById('hiryu-dest-list');
    destList.innerHTML = '';
    const destinations = [
        { name: '始まりの村', mapId: 'village', x: 11, y: 13 },
        { name: '中都市ルイニア', mapId: 'luinia_normal', x: 15, y: 7 },
        { name: '鉱山の街フェロニア', mapId: 'feronia', x: 12, y: 13 },
        { name: '熱砂の砂漠', mapId: 'desert', x: 3, y: 7 },
    ];
    if (gameState.hasDungeonMap) {
        destinations.push({ name: 'ログの要塞', mapId: 'log_fortress_final', x: 12, y: 9 });
    }
    destinations.forEach(dest => {
        if (gameState.currentMapId !== dest.mapId) {
            const li = document.createElement('li');
            li.textContent = dest.name;
            li.onclick = () => {
                closeMenu();
                teleport(dest.mapId, dest.x, dest.y);
            };
            destList.appendChild(li);
        }
    });
     menuState.items=Array.from(destList.parentElement.querySelectorAll('li, button'));menuState.cursor=0;updateMenuSelection();
}
function openSpecialMenu() { inSpecialMenu = true; cuiMenu.style.display='block'; cuiOutput.innerHTML = "特殊コマンドを入力してください (helpで一覧表示)<br>"; cuiInput.focus(); }
function closeSpecialMenu() { inSpecialMenu = false; cuiMenu.style.display='none'; closeMenu(); }








// =========================================================================
// 7. MAP/COLLISION FUNCTIONS
// =========================================================================
function tileAt(tx,ty){if(ty<0||ty>=MAP_H||tx<0||tx>=MAP_W)return 1;return map[ty][tx];}
function isWalkableAt(tx,ty){const id=tileAt(tx,ty);return tiles[id]&&tiles[id].walk;}
function collidesAt(px,py,w,h){const l=Math.floor(px/TILE),r=Math.floor((px+w-1)/TILE),t=Math.floor(py/TILE),b=Math.floor((py+h-1)/TILE);for(let y=t;y<=b;y++)for(let x=l;x<=r;x++){if(!isWalkableAt(x,y))return true;}return false;}








function checkEntityCollision(x, y, selfId) {
    const COLLISION_INSET_X = 4;
    const COLLISION_INSET_Y_TOP = 8;
    const COLLISION_INSET_Y_BOTTOM = 2;








    const selfLeft = x + COLLISION_INSET_X;
    const selfRight = x + TILE - COLLISION_INSET_X;
    const selfTop = y + COLLISION_INSET_Y_TOP;
    const selfBottom = y + TILE - COLLISION_INSET_Y_BOTTOM;








    // Check against all NPCs
    for (const other of npcs) {
        if (other.id === selfId) continue;








        const otherLeft = other.x + COLLISION_INSET_X;
        const otherRight = other.x + TILE - COLLISION_INSET_X;
        const otherTop = other.y + COLLISION_INSET_Y_TOP;
        const otherBottom = other.y + TILE - COLLISION_INSET_Y_BOTTOM;








        if (selfRight > otherLeft && selfLeft < otherRight && selfBottom > otherTop && selfTop < otherBottom) {
            return true;
        }
    }








    // If the moving entity is an NPC, check against the player
    if (selfId !== 'player') {
        const playerLeft = gameState.playerX + COLLISION_INSET_X;
        const playerRight = gameState.playerX + TILE - COLLISION_INSET_X;
        const playerTop = gameState.playerY + COLLISION_INSET_Y_TOP;
        const playerBottom = gameState.playerY + TILE - COLLISION_INSET_Y_BOTTOM;








        if (selfRight > playerLeft && selfLeft < playerRight && selfBottom > playerTop && selfTop < playerBottom) {
            return true;
        }
    }
    return false;
}


// =========================================================================
// 8. MAIN LOOP AND UPDATE
// =========================================================================
let last=performance.now();
function loop(now){ 
    const dt=(now-last)/1000; 
    last=now; 
    if(encounterCooldown > 0) encounterCooldown -= dt; 
    if (gameState.inTitle) updateTitle(dt); 
    else if(!inBattle && isAuthReady) update(dt); 




    if (inBattle) {
        updateBattleAnimation(dt);
        renderBattle();
    } else {
        render();
    }
    requestAnimationFrame(loop); 
}




async function startGame(isLoad = false) { 
    gameState.inTitle = false; 
    inGameMenuHint.style.display = 'block'; 
    inGameHint.style.display = 'block';
    touchControls.classList.toggle('active', gameState.controlType === 'touch');




    if (!isLoad && gameState.storyFlag < 1) {
        inEvent = true;
        await new Promise(r => setTimeout(r, 500));
        showDialog('プロシア', ["俺はプロシア。この『時空の原石』の力で時を渡る、タイムトラベラーだ。"]);
        await waitDialog();
        showDialog('プロシア', ["これは先祖代々の家宝で、世界の時の流れを安定させる要石でもあるんだ。"]);
        await waitDialog();
        
        fadeOverlay.style.transition = 'opacity 0.1s';
        fadeOverlay.style.background = '#fff';
        fadeOverlay.style.opacity = 1;
        await new Promise(r => setTimeout(r, 200));
        fadeOverlay.style.opacity = 0;
        await new Promise(r => setTimeout(r, 200));
        fadeOverlay.style.background = '#000';
        fadeOverlay.style.transition = 'opacity 0.3s';
        
        showDialog('プロシア', ["な、なんだ...！？ 今の光は..."]);
        await waitDialog();
        showDialog('プロシア', ["...ッ！原石の力が...消えている...！？"]);
        await waitDialog();
        showDialog('プロシア', ["まずい...このままでは世界の時が歪み、環境が崩れてしまう...！"]);
        await waitDialog();
        showDialog('プロシア', ["何が起きたんだ？とにかく、村の長老なら何か知っているかもしれない。話を聞きに行こう。"]);
        gameState.storyFlag = 1;
        inEvent = false;
    } 
}
function waitDialog() { return new Promise(resolve => { const check = setInterval(() => { if(!showingDialog) { clearInterval(check); resolve(); } }, 100); }); }




function updateTitle(dt) { 
    if (!isAuthReady) return; 
    if(keys['arrowup']||keys['w']){ keys['arrowup']=keys['w']=false; gameState.titleCursor=(gameState.titleCursor-1+2)%2; } 
    if(keys['arrowdown']||keys['s']){ keys['arrowdown']=keys['s']=false; gameState.titleCursor=(gameState.titleCursor+1)%2; } 
    if(keys['enter']||keys['z']){ keys['enter']=keys['z']=false; if(gameState.titleCursor===0) startGame(); else loadGame(); } 
}




// メインゲームループ - プレイヤーの移動、エンカウント、イベント処理
async function update(dt){
    // メニューやダイアログ表示中は移動処理をスキップ
    if(inMenu || inShop || inInn || showingDialog || inBattle || inResult || inRollMenu || inSpecialMenu || fadeOverlay.style.opacity > 0 || inEvent) {
        if(showingDialog && (keys['enter']||keys['z'])) { keys['enter']=keys['z']=false; showNextDialogLine(); }
        return;
    }
    
    // キー入力による移動方向の取得
    let vx=0,vy=0; if(keys['arrowleft']||keys['a'])vx=-1; if(keys['arrowright']||keys['d'])vx=1; if(keys['arrowup']||keys['w'])vy=-1; if(keys['arrowdown']||keys['s'])vy=1;




    // 毒状態のダメージ処理 - 移動時のみ発動
    if (vx !== 0 || vy !== 0) {
        if (gameState.party.some(p => p.status === 'poison')) {
            if (!gameState.poisonStepCounter) gameState.poisonStepCounter = 0;
            gameState.poisonStepCounter += Math.sqrt(vx*vx + vy*vy); // 移動距離をカウント
            if (gameState.poisonStepCounter >= TILE * 4) { // 4タイル移動ごとにダメージ
                gameState.poisonStepCounter = 0;
                const poisonedMember = gameState.party.find(p => p.status === 'poison' && p.hp > 1);
                if (poisonedMember) {
                    poisonedMember.hp--;
                    showStatus(`${poisonedMember.name}は毒でダメージを受けた...`, 1500);
                }
            }
        }
    }








    // パーティメンバーの追従システム用の位置履歴を更新
    playerPositionHistory.unshift({ x: gameState.playerX, y: gameState.playerY });
    if (playerPositionHistory.length > gameState.party.length * FOLLOWER_DELAY) {
        playerPositionHistory.pop();
    }
    
    // インタラクション（NPCとの会話、アイテム取得など）
    if(keys['enter']||keys['z']){ keys['enter']=keys['z']=false; if(await checkInteraction()) return; }
    
    // プレイヤーの向きを更新
    if (vy<0) gameState.playerDir='up'; else if(vy>0) gameState.playerDir='down'; else if(vx<0) gameState.playerDir='left'; else if(vx>0) gameState.playerDir='right';




    // 斜め移動時の速度調整（対角線移動は遅くなる）
    if(vx!==0&&vy!==0){vx*=Math.SQRT1_2;vy*=Math.SQRT1_2;}
    const speed=100,dx=vx*speed*dt,dy=vy*speed*dt;
    const nx=gameState.playerX+dx,ny=gameState.playerY+dy;
    
    // 衝突判定を行いながら移動
    if(!collidesAt(nx,gameState.playerY,TILE,TILE) && !checkEntityCollision(nx, gameState.playerY, 'player')) gameState.playerX=nx;
    if(!collidesAt(gameState.playerX,ny,TILE,TILE) && !checkEntityCollision(gameState.playerX, ny, 'player')) gameState.playerY=ny;
    
    // NPC Movement
    npcs.forEach(n => {
        if (n.pattern === 'random') {
            n.moveTimer = (n.moveTimer || 0) - dt;
            if (n.moveTimer <= 0) {
                const choice = Math.random();
                if (choice < 0.2) { n.vx = 1; n.vy = 0; } // Right
                else if (choice < 0.4) { n.vx = -1; n.vy = 0; } // Left
                else if (choice < 0.6) { n.vx = 0; n.vy = 1; } // Down
                else if (choice < 0.8) { n.vx = 0; n.vy = -1; } // Up
                else { n.vx = 0; n.vy = 0; } // Still
                n.moveTimer = Math.random() * 2 + 1; // Wait 1-3 seconds
            }




            if (n.vx !== 0 || n.vy !== 0) {
                const npcSpeed = 30; // Slower than player
                const npcDx = n.vx * npcSpeed * dt;
                const npcDy = n.vy * npcSpeed * dt;
                const npcNx = n.x + npcDx;
                const npcNy = n.y + npcDy;
                
                if (!n.id) n.id = crypto.randomUUID();




                if (!collidesAt(npcNx, n.y, TILE, TILE) && !checkEntityCollision(npcNx, n.y, n.id)) {
                    n.x = npcNx;
                } else {
                    n.vx = 0;
                    n.moveTimer = 0.5; // Quickly pick a new direction
                }
                
                if (!collidesAt(n.x, npcNy, TILE, TILE) && !checkEntityCollision(n.x, npcNy, n.id)) {
                    n.y = npcNy;
                } else {
                    n.vy = 0;
                    n.moveTimer = 0.5;
                }
            }
        }
    });




    const ptilex=Math.floor((gameState.playerX+TILE/2)/TILE), ptiley=Math.floor((gameState.playerY+TILE/2)/TILE);
    
    // エンカウントシステム - 移動時にランダムエンカウントをチェック
    if((vx!==0||vy!==0) && encounterCooldown <= 0){
        const tid=tileAt(ptilex,ptiley);
        const tileInfo = tiles[tid] || {};
        
        // デバッグ用ログ - エンカウントチェックの詳細
        if (tileInfo.encounter) {
            console.log(`エンカウントチェック: マップ=${gameState.currentMapId}, タイルID=${tid}, エンカウント可能=true, 確率=${Math.random()}`);
        }
        
        // エンカウント可能なタイルで、エンカウント確率をチェック（デバッグ用に確率を上げる）
        if(tileInfo.encounter && Math.random()<0.15) {
             // エンカウント発生時にクールダウンを設定
             encounterCooldown = 2.0; // 2秒のクールダウン
             
             // マップ別の敵を選択
             if (gameState.currentMapId === 'desert') triggerRandomEncounter(['scorpion', 'sandworm']);
             else if (gameState.currentMapId === 'cave' || gameState.currentMapId === 'cave_2') triggerRandomEncounter(['bat', 'golem', 'ghost']);
             else if (gameState.currentMapId === 'mountain') triggerRandomEncounter(['yeti', 'bat']);
             else triggerRandomEncounter(['slime', 'goblin']);
        }
    }
    
    let transitions = MAP_TRANSITIONS[gameState.currentMapId] || [];
    if (gameState.currentMapId === 'luinia_normal') {
        if (gameState.luiniaDestroyed) {
             transitions = [
                { x: 0, y_range: [6, 8], destMap: 'cliff', destX: 18, destY: 3 },
                { x: 29, y_range: [6, 8], destMap: 'cave_2', destX: 9, destY: 12 }
            ];
        } else if (gameState.storyFlag >= 4) {
            transitions = [{ x: 0, y_range: [6, 8], destMap: 'cliff', destX: 18, destY: 3 }];
        }
    }




    for(const t of transitions) {
        const in_x = t.x_range ? (ptilex >= t.x_range[0] && ptilex <= t.x_range[1]) : (ptilex === t.x);
        const in_y = t.y_range ? (ptiley >= t.y_range[0] && ptiley <= t.y_range[1]) : (ptiley === t.y);
        if (in_x && in_y) {
            if (t.requiredFlag && gameState.storyFlag < t.requiredFlag) {
                showStatus("今はまだ先に進めないようだ...");
                if(vy < 0) gameState.playerY += TILE/2; if(vy > 0) gameState.playerY -= TILE/2;
                if(vx < 0) gameState.playerX += TILE/2; if(vx > 0) gameState.playerX -= TILE/2;
                return;
            }
            teleport(t.destMap, t.destX, t.destY);
            return;
        }
    }
    
    // Story Event Triggers
    if (gameState.currentMapId === 'mountain' && gameState.storyFlag === 7) {
        inEvent = true;
        await new Promise(r => setTimeout(r, 500));
        showDialog('', ['足元がキラリと光った...。']);
        await waitDialog();
        showDialog('プロシア', ['これは...！「時空の原石」のかけら...！']);
        await waitDialog();
        showDialog('プロシア', ['力が...少しだけ戻ってきたようだ！壊れたものの時間を少しだけ戻せるかもしれない！']);
        await waitDialog();
        gameState.storyFlag = 8;
        gameState.hasTimeFragment = true;
        showStatus('「時のかけら」を手に入れた！');
        inEvent = false;
    }
    if (gameState.currentMapId === 'desert' && gameState.storyFlag === 8.5) {
        gameState.storyFlag = 9;
        triggerEncounter(ENEMY_CATALOG['ratio_2'], true, onRatio2Win);
    }
    if (gameState.currentMapId === 'log_fortress_final' && gameState.storyFlag === 10 && ptiley < 3) {
        gameState.storyFlag = 10.5;
        triggerEncounter(ENEMY_CATALOG['log_final'], true, onLogFinalWin);
    }
     if (gameState.currentMapId === 'final_dungeon' && gameState.storyFlag >= 12 && gameState.storyFlag < 13 && ptiley < 12) {
        gameState.storyFlag = 12.1;
        triggerEncounter(ENEMY_CATALOG['infinity'], true, async () => {
            await new Promise(r => setTimeout(r, 500));
            triggerEncounter(ENEMY_CATALOG['singularity'], true, async () => {
                 await new Promise(r => setTimeout(r, 500));
                triggerEncounter(ENEMY_CATALOG['linearity'], true, async () => {
                     await new Promise(r => setTimeout(r, 500));
                    triggerEncounter(ENEMY_CATALOG['absoluty'], true, () => { gameState.storyFlag = 13; });
                });
            });
        });
    }
    if (gameState.currentMapId === 'final_dungeon' && gameState.storyFlag === 13 && ptiley < 4) {
         gameState.storyFlag = 14;
         triggerEncounter(ENEMY_CATALOG['remniscate'], true, onRemniscateWin);
    }
    if (gameState.currentMapId === 'luinia_normal' && gameState.storyFlag === 3 && !inEvent) {
        inEvent = true;
        showDialog('リディア', ['ここがルイニア...思ったより大きな街ね。まずは情報収集と装備を整えましょう。']);
        await waitDialog();
        gameState.storyFlag = 3.5;
        inEvent = false;
    }
    if (gameState.currentMapId === 'forest_b' && gameState.storyFlag < 3 && ptiley < 15 && ptilex > 5 && ptilex < 15) {
        const lydia = npcs.find(n => n.name === 'リディア');
        if (lydia) { triggerEncounter(ENEMY_CATALOG['forest_wolf'], true, lydia.onWin); }
    }
    if (gameState.currentMapId === 'luinia_normal' && gameState.storyFlag >= 3.5 && gameState.storyFlag < 4 && ptilex > 20 && !gameState.luiniaDestroyed) {
        gameState.storyFlag = 4;
        inEvent = true;
        showDialog('', ['キャー！だれか...助けて！']);
        await waitDialog();
        npcs.push({ ...NPC_DEFAULTS, x: 27 * TILE, y: 8 * TILE, name: 'ラティオ', type: 'M' });
        npcs.push({ ...NPC_DEFAULTS, x: 28 * TILE, y: 8 * TILE, name: '襲われている人', type: 'W', text: ["..."] });
        inEvent = false;
        triggerEncounter(ENEMY_CATALOG['ratio'], true, onRatioWin);
    }
    if (gameState.currentMapId === 'village' && gameState.storyFlag === 5) {
        inEvent = true;
        await new Promise(r => setTimeout(r, 500));
        showDialog('プロシア', ['なんとか村まで戻ってこれたな...。']);
        await waitDialog();
        showDialog('カイン', ['リディアの怪我が心配だ。早く休ませてやらないと。']);
        await waitDialog();
        gameState.storyFlag = 5.5;
        teleport('village', gameState.playerX / TILE, gameState.playerY / TILE);
        inEvent = false;
    }
    if (gameState.currentMapId === 'log_fortress_scripted' && ptiley < 7 && gameState.storyFlag < 7) {
        gameState.storyFlag = 6.5;
        triggerEncounter(ENEMY_CATALOG['log_scripted'], true, null, onScriptedLogDefeat);
    }
}




// =========================================================================
// 9. BATTLE SYSTEM
// =========================================================================
function playPlayerAttackAnimation(attacker) {
    return new Promise(resolve => {
        const anim = gameState.battleState.animation;
        anim.active = true;
        anim.progress = 0;
        anim.hitTriggered = false;
        anim.memberIndex = gameState.party.findIndex(p => p === attacker);
        anim.type = (attacker.name === 'リディア' || attacker.name === 'セリナ') ? 'magic' : 'physical';
        anim.resolve = resolve;
    });
}




function playEnemyAttackAnimation() {
    return new Promise(resolve => {
        const anim = gameState.battleState.enemyAnimation;
        anim.active = true;
        anim.progress = 0;
        anim.hitTriggered = false;
        anim.resolve = resolve;
    });
}




function updateBattleAnimation(dt) {
    const playerAnim = gameState.battleState.animation;
    if (playerAnim.active) {
        playerAnim.progress += dt * 2; // Animation speed, complete in 0.5s
        if (playerAnim.progress >= 1) {
            playerAnim.active = false;
            playerAnim.progress = 0;
            if (currentEnemy) currentEnemy.isHit = false;
            if (playerAnim.resolve) playerAnim.resolve();
            playerAnim.resolve = null;
        } else if (playerAnim.progress >= 0.5 && !playerAnim.hitTriggered) {
            if (currentEnemy) currentEnemy.isHit = true;
            playerAnim.hitTriggered = true;
            setTimeout(() => { if (currentEnemy) currentEnemy.isHit = false; }, 150);
        }
    }




    const enemyAnim = gameState.battleState.enemyAnimation;
    if (enemyAnim.active) {
        enemyAnim.progress += dt * 2.5; // Slightly faster
        if (enemyAnim.progress >= 1) {
            enemyAnim.active = false;
            enemyAnim.progress = 0;
            if (enemyAnim.resolve) enemyAnim.resolve();
            enemyAnim.resolve = null;
        }
    }
}




// ランダムエンカウント発生関数 - 敵リストからランダムに選択してエンカウントを開始
function triggerRandomEncounter(enemyList) {
    const enemyKey = enemyList[Math.floor(Math.random() * enemyList.length)];
    triggerEncounter(ENEMY_CATALOG[enemyKey]);
}

// エンカウント開始処理 - バトル画面を表示し、敵とパーティの状態を設定
async function triggerEncounter(enemy, isBoss = false, onWin = null, onLose = null) {
    if(inBattle) return; // 既にバトル中の場合は処理しない
    inBattle = true;
    
    // フェードイン効果
    fadeOverlay.style.pointerEvents = 'all';
    fadeOverlay.style.opacity = 1;
    await new Promise(r => setTimeout(r, 300));

    // 敵の状態を設定（勝利時・敗北時のコールバック含む）
    currentEnemy={...enemy, onWin: onWin, onLose: onLose, alpha: 1.0, isHit: false };
    if (isWeakMode && !currentEnemy.isBoss) currentEnemy.hp = 1; // 弱体化モード
    enemyName.textContent = currentEnemy.name; 
    battleLog.innerHTML=`${currentEnemy.name} があらわれた！<br>`;
    
    // バトル開始時のパーティ状態を設定
    gameState.battleState.turnQueue = gameState.party.filter(p => p.hp > 0);
    gameState.battleState.turnIndex = 0;
    
    // バトルメニューの設定
    menuState.active = true;
    menuState.screenId = 'battle-menu';
    menuState.container = battleMenu;
    let allButtons = Array.from(battleMenu.querySelectorAll('button'));
    allButtons.push(document.querySelector('.battle-roll-menu button'));
    menuState.items = allButtons;
    menuState.cursor = 0;
    updateMenuSelection();
    
    // UI更新
    updatePartyStatusUI(); 
    updateEnemyHPBar();
    setBattleMenuEnabled(true);
    battleUI.style.display='flex';
    
    // フェードアウト効果
    fadeOverlay.style.opacity = 0;
    await new Promise(r => setTimeout(r, 300));
    fadeOverlay.style.pointerEvents = 'none';
    
    // 最初のパーティメンバーの状態効果をチェック
    if (gameState.battleState.turnQueue.length > 0) {
        await handleStatusEffects(gameState.battleState.turnQueue[0], true);
    }
}
function updatePartyStatusUI() {
    const container = document.getElementById('party-status');
    container.innerHTML = '';
    gameState.party.forEach((p, index) => {
        const memberDiv = document.createElement('div');
        memberDiv.className = 'party-status-member';
        if (gameState.battleState.turnQueue[gameState.battleState.turnIndex] === p) {
            memberDiv.classList.add('active-turn');
        }




        const hpPercentage = p.hp > 0 ? (p.hp / p.maxHP) * 100 : 0;
        let barClass = 'hp-bar';
        if (hpPercentage <= 50) barClass += ' medium';
        if (hpPercentage <= 25) barClass += ' low';




        const statusText = p.status ? ` (<span style="color:${STATUS_EFFECTS[p.status].color}">${STATUS_EFFECTS[p.status].short}</span>)` : '';
        
        memberDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong>${p.name}${statusText}</strong>
                <span class="hp-text">${p.hp} / ${p.maxHP}</span>
            </div>
            <div class="hp-bar-container">
                <div class="${barClass}" style="width: ${hpPercentage}%;"></div>
            </div>
        `;
        container.appendChild(memberDiv);
    });
}
function updateEnemyHPBar() { enemyHpBar.style.width = (currentEnemy.hp/currentEnemy.maxHP)*100+'%'; enemyHpText.textContent=`HP:${currentEnemy.hp}/${currentEnemy.maxHP}`; }
function checkLevelUp(member) { let leveledUp=false, gains={hp:0,atk:0,def:0}; while(member.level<LEVEL_UP_TABLE.length-1 && member.exp>=LEVEL_UP_TABLE[member.level+1]){ member.level++; leveledUp=true; const hg=Math.floor(Math.random()*5+3), ag=Math.floor(Math.random()*2+1), dg=Math.floor(Math.random()*2+1); member.maxHP+=hg; member.hp+=hg; member.baseAtk+=ag; member.baseDef+=dg; member.baseMaxHP+=hg; gains.hp+=hg; gains.atk+=ag; gains.def+=dg; } return leveledUp ? gains : null; }
function showBattleResult(exp, goldBase) {
    const gold = Math.floor(goldBase * (Math.random() * 0.4 + 0.8)); // 80% to 120%
    inResult = true; let html=`<p>けいけんち ${exp} を獲得！</p><p>${gold} ゴールドを手に入れた！</p><hr><div id="level-up-info">`; let anyLevelUp=false; gameState.party.forEach(m=>{if(m.hp>0){m.exp+=exp; const g=checkLevelUp(m); if(g){anyLevelUp=true; html+=`<p>${m.name}はレベル${m.level}にあがった！</p>`;}}}); if(!anyLevelUp)html+="<p>レベルアップしたメンバーはいなかった。</p>"; html+='</div>'; gameState.gold += gold; document.getElementById('battle-result-content').innerHTML=html; battleResult.style.display='block';
    menuState.active=true; menuState.items = Array.from(battleResult.querySelectorAll('button')); menuState.cursor=0; updateMenuSelection();
}
function closeBattleResult() { inResult=false; menuState.active=false; battleResult.style.display='none'; if(currentEnemy.onWin) currentEnemy.onWin(); for(const k in keys) keys[k]=false; }
function setBattleMenuEnabled(enabled) { 
    battleMenu.querySelectorAll('button').forEach(b => b.disabled = !enabled); 
    document.querySelector('.battle-roll-menu button').disabled = !enabled;
}




async function handleStatusEffects(character, isPlayerTurn) {
    if (!character.status) return true; // Can act




    let canAct = true;
    if (character.status === 'paralysis') {
        if (Math.random() < 0.4) {
            logMsg(`${character.name}は しびれてうごけない！`);
            canAct = false;
        }
    }
    
    if (!canAct) {
        await new Promise(r => setTimeout(r, 1000));
        if (isPlayerTurn) {
            nextTurn(); 
        }
        return false;
    }
    return true; 
}




function fadeOutEnemy() {
    return new Promise(resolve => {
        let alpha = 1.0;
        const fadeInterval = setInterval(() => {
            alpha -= 0.05;
            if (currentEnemy) currentEnemy.alpha = alpha;
            if (alpha <= 0) { clearInterval(fadeInterval); if (currentEnemy) currentEnemy.alpha = 0; resolve(); }
        }, 50);
    });
}
// バトルコマンド処理 - プレイヤーの行動を実行
async function battleCommand(cmd) {
    setBattleMenuEnabled(false); // メニューを一時的に無効化
    const attacker = gameState.battleState.turnQueue[gameState.battleState.turnIndex];
    if (!attacker) { nextTurn(); return; } // 攻撃者がいない場合は次のターンへ
    
    // 状態効果のチェック（毒、麻痺など）
    const canAct = await handleStatusEffects(attacker, true);
    if (!canAct) return; // 行動できない場合は処理終了
    
    // 装備によるステータス計算
    calculateStats(attacker, true);
    
    if (cmd === 'attack') {
        // 攻撃アニメーション再生
        await playPlayerAttackAnimation(attacker);
        
        // クリティカルヒット判定
        let isCritical = false;
        let criticalChance = (attacker.roll === 'counter_key') ? 0.10 : 0.05;
        if (Math.random() < criticalChance) isCritical = true;
        
        // ダメージ計算（攻撃力の70-120%から敵の防御力を引く）
        let dmg = Math.max(1, Math.floor(Math.random() * (attacker.atk / 2) + attacker.atk * 0.7) - currentEnemy.def);




        // ダメージ適用とメッセージ表示
        if (isCritical) {
            dmg *= 2;
            logMsg(`${attacker.name}のかいしんのいちげき！${dmg}ダメージ`);
        } else {
            logMsg(`${attacker.name}のこうげき！${dmg}ダメージ`);
        }

        // 敵にダメージを与える
        currentEnemy.hp -= dmg;
        updateEnemyHPBar();
        if (currentEnemy.hp <= 0) { await endBattle(true); return; } // 敵撃破時




    } else if (cmd === 'skill') {
        // スキルコマンド（未実装）
        logMsg('スキルはまだ使えない！');
        setBattleMenuEnabled(true);
        return;
    } else if (cmd === 'roll') {
        // ロール発動コマンド
        const r = attacker.roll ? ROLL_CATALOG[attacker.roll] : null;
        if(r && !r.passive && !attacker.rollUsed){
            attacker.rollTurns = r.turns;
            attacker.rollUsed = true;
            logMsg(`${attacker.name}は「${r.name}」を発動！`);
        } else {
            logMsg('ロールを発動できない！');
        }
    } else if (cmd === 'run') {
        // 逃走コマンド
        if (currentEnemy.isBoss) {
            logMsg('ボスからはにげられない！');
            setBattleMenuEnabled(true);
            return;
        } else if (Math.random() < 0.5) {
            logMsg('うまくにげられた！');
            await endBattle(false, true);
            return;
        } else {
            logMsg('にげられない！');
        }
    } else {
        // 未実装コマンド
        logMsg('まだつかえない');
        setBattleMenuEnabled(true);
        return;
    }
    nextTurn(); // 次のターンへ
}




async function nextTurn() {
    // End of previous turn's effects
    const previousAttacker = gameState.battleState.turnQueue[gameState.battleState.turnIndex];
    if (previousAttacker && previousAttacker.status === 'poison') {
        const poisonDmg = Math.max(1, Math.floor(previousAttacker.maxHP * 0.1));
        previousAttacker.hp = Math.max(0, previousAttacker.hp - poisonDmg);
        logMsg(`${previousAttacker.name}は どくで ${poisonDmg} のダメージ！`);
        updatePartyStatusUI();
        if (previousAttacker.hp <= 0) {
             logMsg(`${previousAttacker.name}はたおれた！`);
             if (gameState.party.every(p => p.hp <= 0)) { await endBattle(false); return; }
        }
        await new Promise(r => setTimeout(r, 800));
    }








    gameState.battleState.turnIndex++;
    if (gameState.battleState.turnIndex >= gameState.battleState.turnQueue.length) {
        enemyTurn();
    } else {
        updatePartyStatusUI();
        const nextAttacker = gameState.battleState.turnQueue[gameState.battleState.turnIndex];
        const canAct = await handleStatusEffects(nextAttacker, true);
        if(canAct) {
            setBattleMenuEnabled(true);
        }
    }
}




async function enemyTurn() {
    if(!inBattle) return;
    updatePartyStatusUI(); 
    await new Promise(r => setTimeout(r, 1000));
        
    gameState.party.forEach(m => { if(m.rollTurns > 0) m.rollTurns--; if(m.statusTurns > 0) {m.statusTurns--; if(m.statusTurns === 0) {logMsg(`${m.name}の${STATUS_EFFECTS[m.status].name}が治った！`); m.status = null;}} });
    
    const aliveParty = gameState.party.filter(p => p.hp > 0);
    if(aliveParty.length === 0) return;
    const target = aliveParty[Math.floor(Math.random() * aliveParty.length)];




    await playEnemyAttackAnimation();
    calculateStats(target, true);




    if (currentEnemy.specialAttack && Math.random() < currentEnemy.specialAttack.chance) {
        const { type } = currentEnemy.specialAttack;
        if (!target.status) {
            target.status = type;
            target.statusTurns = Math.floor(Math.random() * 3 + 2); // 2-4 turns
            logMsg(`${currentEnemy.name}の特殊攻撃！ ${target.name}は${STATUS_EFFECTS[type].name}におちいった！`);
        } else {
            const dmg = Math.max(1, Math.floor(Math.random() * (currentEnemy.atk / 2) + currentEnemy.atk * 0.7) - target.def);
            target.hp = Math.max(0, target.hp - dmg);
            logMsg(`${currentEnemy.name}のこうげき！${target.name}に${dmg}ダメージ`);
        }
    } else {
        const dmg = Math.max(1, Math.floor(Math.random() * (currentEnemy.atk / 2) + currentEnemy.atk * 0.7) - target.def);
        target.hp = Math.max(0, target.hp - dmg);
        logMsg(`${currentEnemy.name}のこうげき！${target.name}に${dmg}ダメージ`);
    }
    
    target.isHit = true;
    setTimeout(() => { if (target) target.isHit = false; }, 150);




    updatePartyStatusUI();
    if (target.hp <= 0) logMsg(`${target.name}はたおれた！`);




    if(target.roll && ROLL_CATALOG[target.roll].effects.counter && Math.random() < ROLL_CATALOG[target.roll].effects.counter){
        await new Promise(r => setTimeout(r, 500));
        const cdmg = Math.floor(currentEnemy.atk * 0.1);
        currentEnemy.hp -= cdmg;
        logMsg(`${target.name}のカウンター！${cdmg}ダメージ`);
        updateEnemyHPBar();
        if (currentEnemy.hp <= 0) { await endBattle(true); return; }
    }
    
    if(gameState.party.every(p => p.hp <= 0)) {
        await endBattle(false);
    } else {
        gameState.battleState.turnQueue = gameState.party.filter(p => p.hp > 0);
        gameState.battleState.turnIndex = 0;
        updatePartyStatusUI();
        const firstPlayer = gameState.battleState.turnQueue[0];
        if (firstPlayer) {
             const canAct = await handleStatusEffects(firstPlayer, true);
             if (canAct) {
                setBattleMenuEnabled(true);
             }
        }
    }
}
async function endBattle(victory, isSkip = false) { 
    setBattleMenuEnabled(true);
    menuState.active = false;
    gameState.party.forEach(p => {
        if(p.status === 'paralysis') { p.status = null; p.statusTurns = 0; }
    });




    if (victory) { 
        await fadeOutEnemy();
        showBattleResult(currentEnemy.exp, currentEnemy.gold); 
    } else if (!isSkip) {
        if(currentEnemy.scriptedLoss && currentEnemy.onLose) {
            battleUI.style.display = 'none'; 
            inBattle = false; 
            currentEnemy.onLose();
            return;
        }
        const reviver = gameState.party.find(p=> p.hp <= 0 && p.roll === 'chloctaria_key' && ROLL_CATALOG[p.roll].effects.revive > 0); 
        if(reviver) { 
            ROLL_CATALOG[reviver.roll].effects.revive--; 
            reviver.hp = reviver.maxHP; 
            logMsg(`${reviver.name}はクロクタリアの力で復活した！`);
            setBattleMenuEnabled(true);
            return; 
        } 
        logMsg('パーティは全滅した...'); 
        await new Promise(r => setTimeout(r, 2000)); 
        showGameOver();
        return;
    } 
    battleUI.style.display = 'none'; 
    inBattle = false; 
    encounterCooldown = 5; 
    if (!victory || isSkip) { 
        for (const key in keys) { keys[key] = false; } 
    } 
}
function showGameOver() {
    inBattle = false;
    battleUI.style.display = 'none';
    fadeOverlay.style.transition = 'opacity 1s';
    fadeOverlay.style.opacity = 1;
    
    const gameOverText = document.createElement('div');
    gameOverText.id = 'game-over-text';
    gameOverText.textContent = 'GAME OVER';
    gameOverText.style.position = 'absolute';
    gameOverText.style.left = '50%';
    gameOverText.style.top = '50%';
    gameOverText.style.transform = 'translate(-50%, -50%)';
    gameOverText.style.color = 'red';
    gameOverText.style.fontSize = '48px';
    gameOverText.style.zIndex = '101';
    gameOverText.style.textShadow = '2px 2px 5px black';
    ui.appendChild(gameOverText);




    setTimeout(() => {
        window.location.reload();
    }, 4000);
}




function logMsg(msg){ battleLog.innerHTML+=msg+"<br>"; battleLog.scrollTop=battleLog.scrollHeight; }




// =========================================================================
// 10. RENDERING
// =========================================================================
function render(){
    ctx.clearRect(0,0,VIEW_W,VIEW_H);
    if(gameState.inTitle) { renderTitle(); return; }
    
    gameState.cameraX = Math.max(0, Math.min(gameState.playerX - VIEW_W / 2, MAP_W * TILE - VIEW_W));
    gameState.cameraY = Math.max(0, Math.min(gameState.playerY - VIEW_H / 2, MAP_H * TILE - VIEW_H));
    
    ctx.save();
    ctx.translate(-gameState.cameraX, -gameState.cameraY);
    
    const startX=Math.floor(gameState.cameraX/TILE), endX=Math.min(startX+(VIEW_W/TILE)+2,MAP_W);
    const startY=Math.floor(gameState.cameraY/TILE), endY=Math.min(startY+(VIEW_H/TILE)+2,MAP_H);




    for(let y=startY;y<endY;y++)for(let x=startX;x<endX;x++){
        const id=map[y]?.[x]; if(id===undefined) continue;
        
        let groundTileId = (id === 'S' || id === 'I' || id === 'H' || id === 'C' || id === 'R' || id === 'B' || id === 'D' || id === 'F') ? (id === 'C' ? 9 : (id === 'R' || id === 'B' ? 6 : (gameState.currentMapId === 'feronia' ? 8 : (gameState.currentMapId === 'mountain' ? 'A' : 0)) )) : id;
        const t = tiles[groundTileId] || tiles[0];
        
        if (gameState.showEncounterAreas && t.encounter) { ctx.fillStyle = '#b24d4d'; } else { ctx.fillStyle = t.color; }
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        
        ctx.fillStyle="rgba(0,0,0,0.1)";
        if(groundTileId===0||groundTileId===9){ctx.fillRect(x*TILE+2,y*TILE+5,2,5);ctx.fillRect(x*TILE+10,y*TILE+10,2,5);}
        else if(groundTileId===3||groundTileId===8){ctx.fillRect(x*TILE+Math.sin(y/2)*4,y*TILE,2,2);ctx.fillRect(x*TILE+8+Math.cos(x/2)*4,y*TILE+8,2,2);}
        else if (groundTileId === 'A') { ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.beginPath(); ctx.moveTo(x*TILE, y*TILE); ctx.lineTo(x*TILE+TILE, y*TILE+TILE); ctx.stroke(); }
        
        if (id === 'S') drawShop(x * TILE, y * TILE);
        else if (id === 'I') drawInn(x * TILE, y * TILE);
        else if (id === 'H') drawHouse(x * TILE, y * TILE);
        else if (id === 'C') drawChest(x * TILE, y * TILE, x, y);
        else if (id === 'B') drawRock(x * TILE, y * TILE);
        else if (id === 'D') drawBrokenBridge(x * TILE, y * TILE);
        else if (id === 'F') drawHiry(x * TILE, y * TILE);
    }
    for(const n of npcs) { 
        if (n.isProp) drawPixelCharacter(ctx, n.x, n.y, 1, n.skin, n.body);
        else if(n.isSign) drawSign(n.x, n.y);
        else if(n.name === 'フォレストウルフ') drawForestWolf(n.x, n.y); // フォレストウルフの特別描画
        else if(n.name === 'ラティオ') drawRatio(n.x, n.y); // ラティオの特別描画
        else drawSprite(n.x, n.y, n.name === 'セリナ' ? '#ffc8dd' : '#ffd27f', n.isBestower ? '#800080' : (n.name === 'セリナ' ? '#ffafcc' : '#c7c7c7'), n.type);
    }
    
    const partyColors = [{skin: '#ffd1b3', body: '#2f8bd2'}, {skin: '#fde2e4', body: '#8c1c13'}, {skin: '#e0cfa8', body: '#5f0f40'}, {skin: '#ffc8dd', body: '#ffafcc'}]
    if (playerPositionHistory.length > 0) {
        for (let i = 1; i < gameState.party.length; i++) {
            const follower = gameState.party[i];
            const posIndex = Math.min(i * FOLLOWER_DELAY, playerPositionHistory.length - 1);
            const pos = playerPositionHistory[posIndex];
            if (pos) {
                const colors = partyColors[i % partyColors.length];
                drawSprite(Math.floor(pos.x), Math.floor(pos.y), colors.skin, colors.body, follower.type);
            }
        }
    }
    drawPlayer(Math.floor(gameState.playerX),Math.floor(gameState.playerY));
    ctx.restore();
}
function renderTitle() {
    ctx.fillStyle = '#0a192f';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = 'white';
    for (const star of titleStars) { ctx.beginPath(); ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2); ctx.fill(); }
    
    ctx.textAlign='center';
    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = '#f7b733';
    ctx.strokeStyle = '#3a1c02';
    ctx.lineWidth = 3;
    ctx.strokeText('CHRONO', VIEW_W / 2, 60);
    ctx.fillText('CHRONO', VIEW_W / 2, 60);
    ctx.strokeText('FRACTAL', VIEW_W / 2, 100);
    ctx.fillText('FRACTAL', VIEW_W / 2, 100);




    ctx.font='16px mono';
    const opts=['はじめから','つづきから'];
    for(let i=0;i<opts.length;i++){
        ctx.fillStyle=i===gameState.titleCursor?'#ffd700':'#ffffff';
        ctx.fillText(opts[i],VIEW_W/2,170+i*25);
        const blinkOn = Math.floor(performance.now() / 250) % 2 === 0;
        if(i === gameState.titleCursor && blinkOn) ctx.fillText('▶',VIEW_W/2-70,170+i*25);
    }
    
    ctx.font = '10px monospace';
    ctx.fillStyle = '#a0a0a0';
    ctx.fillText('Developed by: AnDoo, 898scr, no-pro0305', VIEW_W / 2, VIEW_H - 20);
    ctx.fillText('© 2024 Chronos Team', VIEW_W / 2, VIEW_H - 8);
}
function drawPixelCharacter(canvasCtx, x, y, scale, skin, body) { canvasCtx.fillStyle='rgba(0,0,0,0.25)';canvasCtx.fillRect(x+2*scale,y+TILE*scale-3*scale,TILE*scale-4*scale,2*scale); canvasCtx.fillStyle=body;canvasCtx.fillRect(x+3*scale,y+6*scale,10*scale,8*scale); canvasCtx.fillStyle=skin;canvasCtx.fillRect(x+5*scale,y+2*scale,6*scale,4*scale); canvasCtx.fillStyle='#2b2b2b';canvasCtx.fillRect(x+4*scale,y+1*scale,8*scale,2*scale); canvasCtx.fillStyle='#000';canvasCtx.fillRect(x+6*scale,y+3*scale,1*scale,1*scale);canvasCtx.fillRect(x+9*scale,y+3*scale,1*scale,1*scale); }
// フォレストウルフの特別な描画関数
function drawForestWolf(x, y) {
    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + 3, y + TILE - 2, TILE - 6, 2);
    
    // 体（灰色の毛皮）
    ctx.fillStyle = '#8B7355'; // 茶色がかった灰色
    ctx.fillRect(x + 4, y + 8, 8, 6);
    
    // 頭
    ctx.fillStyle = '#A0522D'; // 濃い茶色
    ctx.fillRect(x + 5, y + 4, 6, 4);
    
    // 耳
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(x + 4, y + 3, 2, 2);
    ctx.fillRect(x + 10, y + 3, 2, 2);
    
    // 目（赤い目）
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(x + 6, y + 5, 1, 1);
    ctx.fillRect(x + 9, y + 5, 1, 1);
    
    // 鼻
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 7, y + 6, 2, 1);
    
    // 牙
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x + 6, y + 7, 1, 1);
    ctx.fillRect(x + 9, y + 7, 1, 1);
    
    // 尻尾
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(x + 1, y + 10, 3, 1);
    ctx.fillRect(x + 1, y + 11, 2, 1);
}

// ラティオの特別な描画関数（普通のNPCと区別する）
function drawRatio(x, y) {
    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x + 2, y + TILE - 3, TILE - 4, 2);
    
    // 体（ダークな装備）
    ctx.fillStyle = '#2C1810'; // 濃い茶色の鎧
    ctx.fillRect(x + 3, y + 6, 10, 8);
    
    // 頭
    ctx.fillStyle = '#8B4513'; // 茶色の肌
    ctx.fillRect(x + 5, y + 2, 6, 4);
    
    // 目（不気味な赤い目）
    ctx.fillStyle = '#FF4444';
    ctx.fillRect(x + 6, y + 3, 1, 1);
    ctx.fillRect(x + 9, y + 3, 1, 1);
    
    // 髪（黒い髪）
    ctx.fillStyle = '#1A1A1A';
    ctx.fillRect(x + 4, y + 1, 8, 2);
    
    // 角（悪魔的な角）
    ctx.fillStyle = '#8B0000';
    ctx.fillRect(x + 5, y, 1, 2);
    ctx.fillRect(x + 10, y, 1, 2);
    
    // 鎧の装飾
    ctx.fillStyle = '#654321';
    ctx.fillRect(x + 4, y + 7, 2, 2);
    ctx.fillRect(x + 10, y + 7, 2, 2);
    
    // 武器（剣）
    ctx.fillStyle = '#C0C0C0';
    ctx.fillRect(x + 13, y + 4, 2, 6);
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x + 12, y + 9, 4, 1);
}

function drawSprite(x, y, skin, body, type = 'M') {
    const isChild = type.includes('+C');
    const isFemale = type.includes('W');
    const scale = isChild ? 0.8 : 1.0;
    const yOffset = isChild ? TILE * (1 - scale) + 2 : 0; // Place child lower to stand on ground




    // Shadow - drawn relative to the full tile space
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + 2, y + TILE - 3, TILE - 4, 2);




    // Body
    ctx.fillStyle = body;
    ctx.fillRect(x + (TILE - 10 * scale) / 2, y + yOffset + 6 * scale, 10 * scale, 8 * scale);




    // Head
    ctx.fillStyle = skin;
    ctx.fillRect(x + (TILE - 6 * scale) / 2, y + yOffset + 2 * scale, 6 * scale, 4 * scale);
    
    // Eyes
    ctx.fillStyle = '#000';
    ctx.fillRect(x + (TILE - 6 * scale) / 2 + 1 * scale, y + yOffset + 3 * scale, 1 * scale, 1 * scale);
    ctx.fillRect(x + (TILE - 6 * scale) / 2 + 4 * scale, y + yOffset + 3 * scale, 1 * scale, 1 * scale);




    // Hair
    ctx.fillStyle = '#2b2b2b';
    if (isFemale) {
        ctx.fillRect(x + (TILE - 8 * scale) / 2, y + yOffset + 1 * scale, 8 * scale, 2 * scale); 
        // Long hair for adult women
        if (!isChild) {
           ctx.fillRect(x + (TILE - 8 * scale) / 2 - 1 * scale, y + yOffset + 3 * scale, 2 * scale, 4 * scale); 
           ctx.fillRect(x + (TILE - 8 * scale) / 2 + 7 * scale, y + yOffset + 3 * scale, 2 * scale, 4 * scale);
        }
    } else { // Male hair
        ctx.fillRect(x + (TILE - 8 * scale) / 2, y + yOffset + 1 * scale, 8 * scale, 2 * scale);
    }
}




function drawBattleSprite(btx, x, y, scale, skin, body, type = 'M', member, animationState = 'idle') {
    const p = (px, py, color) => { btx.fillStyle = color; btx.fillRect(x + px * scale, y + py * scale, scale, scale); };
    btx.fillStyle = 'rgba(0,0,0,0.3)'; btx.beginPath(); btx.ellipse(x + 8 * scale, y + 21 * scale, 7 * scale, 2 * scale, 0, 0, 2 * Math.PI); btx.fill();
    
    let name = member ? member.name : '';
    let hair = '#5a3825', hair_s = '#3e2719', hair_h = '#875b3e', skin_s = '#d3a068', body_s = '#2a5e84', body_h = '#63b1e6', pants = '#4a4a4a', pants_s = '#2e2e2e', boots = '#6b4f39', boots_s = '#493628', belt = '#895a34';
    switch (name) {
        case 'リディア': hair = '#333'; hair_s = '#111'; hair_h = '#555'; skin_s = '#e6bc9a'; body = '#a12a2a'; body_s = '#751e1e'; body_h = '#d15a5a'; pants = '#444'; pants_s = '#222'; boots = '#444'; boots_s = '#222'; break;
        case 'カイン': hair = '#4a4a4a'; hair_s = '#2a2a2a'; hair_h = '#6a6a6a'; skin_s = '#c6955a'; body = '#5f0f40'; body_s = '#3c0928'; body_h = '#8e2f69'; pants = '#222'; pants_s = '#000'; boots = '#333'; boots_s = '#111'; break;
        case 'セリナ': hair = '#a86f3f'; hair_s = '#7a4f2a'; hair_h = '#d19a66'; skin_s = '#f2d0b1'; body = '#c77d9e'; body_s = '#a35f7e'; body_h = '#e0a0ba'; pants = '#f0f0f0'; pants_s = '#ccc'; boots = '#a88f79'; boots_s = '#806955'; break;
    }




    p(5, 19, boots_s); p(6, 19, boots); p(7, 19, boots); p(9, 19, boots_s); p(10, 19, boots); p(11, 19, boots);
    p(5, 20, boots_s); p(6, 20, boots_s); p(7, 20, boots); p(9, 20, boots_s); p(10, 20, boots_s); p(11, 20, boots);
    p(6, 17, pants); p(7, 17, pants_s); p(9, 17, pants); p(10, 17, pants_s); p(6, 18, pants); p(7, 18, pants_s); p(9, 18, pants); p(10, 18, pants_s);
    for (let j = 11; j <= 16; j++) { for (let i = 5; i <= 11; i++) { p(i, j, body); } }
    p(5, 11, body_s); p(11, 11, body_s); p(5, 12, body_s); p(11, 12, body_s); p(5, 13, body_s); p(11, 13, body_s);
    p(5, 14, body_s); p(5, 15, body_s); p(5, 16, body_s); p(7, 12, body_h); p(8, 12, body_h); p(9, 12, body_h); p(7, 13, body_h);
    if (name === 'プロシア') { for(let i=5; i<=11; i++) { p(i, 15, belt); } }
    else if (name === 'リディア') { for(let j=17; j<=20; j++) { for(let i=4; i<=12; i++) { p(i, j, body); } } for(let j=17; j<=20; j++) { p(4,j,body_s); p(12,j,body_s); } for(let i=4; i<=12; i++) { p(i, 21, '#ffd700'); } }
    else if (name === 'カイン') { p(4, 11, body_s); p(12, 11, body_s); p(3, 12, body_s); p(4, 12, body); p(12, 12, body); p(13, 12, body_s); p(3, 13, body_s); p(4, 13, body); p(12, 13, body); p(13, 13, body_s); }
    
    for (let j = 4; j <= 10; j++) { for (let i = 5; i <= 10; i++) { p(i, j, skin); } }
    for (let i = 5; i <= 10; i++) { p(i, 4, skin_s); } 
    for (let j = 2; j <= 5; j++) { for (let i = 4; i <= 11; i++) { p(i, j, hair); } }
    for (let i = 5; i <= 10; i++) { p(i, 1, hair_s); }
    p(6, 1, hair_h); p(7, 1, hair_h); p(8, 1, hair_h); p(9, 1, hair_h);
    if (name === 'プロシア') { p(5, 5, hair); p(7, 5, hair); p(9, 5, hair); }
    else if (name === 'リディア') { for(let j=4; j<=12; j++) { p(3,j,hair_s); p(4,j,hair); p(11,j,hair); p(12,j,hair_s); } }
    else if (name === 'セリナ') { for(let j=4; j<=8; j++) { p(4,j,hair_s); p(11,j,hair); } }
    p(6, 7, '#000'); p(9, 7, '#000');
    
    const isCasting = animationState === 'casting';
    if(isCasting) {
        p(4, 10, skin); p(4, 11, skin_s); p(12, 10, skin); p(12, 11, skin_s);
    } else {
        p(4, 12, skin); p(4, 13, skin); p(4, 14, skin_s); 
        p(12, 12, skin); p(12, 13, skin); p(12, 14, skin_s);
    }




    if (member && member.armor) {
        if (member.armor === 'chain_mail') { btx.fillStyle = 'rgba(150, 150, 150, 0.4)'; btx.fillRect(x + 5 * scale, y + 11 * scale, 7 * scale, 6 * scale); } 
        else if (member.armor === 'leather_armor') { btx.fillStyle = '#8b5a2b'; btx.fillRect(x + 4 * scale, y + 11 * scale, 9 * scale, 3 * scale); btx.fillStyle = '#654321'; btx.fillRect(x + 4 * scale, y + 11 * scale, 9 * scale, 1 * scale); }
    }




    if (animationState === 'swing_weapon') {
        btx.save();
        btx.translate(x + 4 * scale, y + 13 * scale);
        p(-1, -1, skin); p(0, -1, skin); p(1, -1, skin);
        p(-1, 0, skin_s); p(0, 0, skin_s); p(1, 0, skin_s);
        
        btx.translate(0, -3 * scale); btx.rotate(-Math.PI / 4);
        if (member && member.weapon) {
            if (member.weapon === 'bronze_sword') { btx.fillStyle = '#a17448'; btx.fillRect(-2 * scale, -1 * scale, 4 * scale, 2 * scale); btx.fillStyle = '#cd7f32'; btx.fillRect(-1 * scale, -12 * scale, 2 * scale, 11 * scale); } 
            else if (member.weapon === 'iron_sword') { btx.fillStyle = '#6c757d'; btx.fillRect(-2.5*scale,-1.5*scale,5*scale,3*scale); btx.fillStyle='#adb5bd'; btx.fillRect(-1*scale,-15*scale,2*scale,14*scale); btx.fillStyle='#e9ecef'; btx.fillRect(-1*scale,-14*scale,1*scale,12*scale); }
        } else { btx.fillStyle = skin; btx.fillRect(0, 0, 3*scale, 3*scale); }
        btx.restore();
    }
}
function drawSign(x,y) { ctx.fillStyle='#8B4513';ctx.fillRect(x+6,y+8,4,8);ctx.fillStyle='#D2B48C';ctx.fillRect(x,y,16,10);ctx.fillStyle='#000';ctx.font='8px mono';ctx.textAlign='center';ctx.fillText('...',x+TILE/2,y+8);ctx.textAlign='left'; }
function drawPlayer(x,y){ drawSprite(x, y, '#ffd1b3', '#2f8bd2', 'M'); }
function drawHouse(x, y) { ctx.fillStyle = '#8B4513'; ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.lineTo(x + 8, y); ctx.lineTo(x + 16, y + 8); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#CD853F'; ctx.fillRect(x, y + 8, 16, 8); ctx.fillStyle = '#663300'; ctx.fillRect(x + 3, y + 9, 5, 7); ctx.fillStyle = '#ADD8E6'; ctx.fillRect(x + 10, y + 9, 4, 3); }
function drawShop(x, y) { ctx.fillStyle = '#A0522D'; ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.lineTo(x + 8, y); ctx.lineTo(x + 16, y + 8); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#D2B48C'; ctx.fillRect(x, y + 8, 16, 8); ctx.fillStyle = '#654321'; ctx.fillRect(x + 5, y + 10, 6, 6); ctx.fillStyle = '#000'; ctx.font = 'bold 8px monospace'; ctx.textAlign='center'; ctx.fillText("SHOP", x + 8, y + 2); ctx.textAlign='left'; }
function drawInn(x, y) { ctx.fillStyle = '#4682B4'; ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.lineTo(x + 8, y); ctx.lineTo(x + 16, y + 8); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#F5DEB3'; ctx.fillRect(x, y + 8, 16, 8); ctx.fillStyle = '#8B4513'; ctx.fillRect(x + 5, y + 10, 6, 6); ctx.fillStyle = '#FFFFE0'; ctx.fillRect(x + 2, y + 9, 3, 2); ctx.fillStyle = '#000'; ctx.font = 'bold 8px monospace'; ctx.textAlign='center'; ctx.fillText("INN", x + 8, y + 2); ctx.textAlign='left';}
function drawChest(x, y, tx, ty) { const chestId = `${gameState.currentMapId}_${tx}_${ty}`; const isOpen = gameState.chests[chestId]; ctx.fillStyle = '#8B4513'; ctx.fillRect(x + 2, y + 6, 12, 10); ctx.fillStyle = '#FFD700'; ctx.fillRect(x + 1, y + 8, 14, 2); if (!isOpen) { ctx.fillRect(x + 7, y + 4, 2, 4); } else { ctx.fillStyle = '#333'; ctx.fillRect(x + 4, y + 7, 8, 3); } }
function drawRock(x, y) { ctx.fillStyle = '#6d4c41'; ctx.fillRect(x, y, TILE, TILE); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x+2, y+2, TILE-4, TILE-4); }
function drawBrokenBridge(x, y) { ctx.fillStyle = '#8B4513'; ctx.fillRect(x, y + 5, TILE / 3, 3); ctx.fillRect(x + TILE * 2/3, y + 7, TILE / 3, 3); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + TILE/3, y, TILE/3, TILE); }
function drawHiry(x, y) { ctx.fillStyle = '#e0e0e0'; ctx.fillRect(x, y, TILE*3, TILE*2); ctx.fillStyle = '#a0a0a0'; ctx.fillRect(x+TILE, y-TILE, TILE, TILE); ctx.fillStyle = '#c0c0c0'; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-TILE, y+TILE); ctx.lineTo(x, y+TILE*2); ctx.fill(); ctx.beginPath(); ctx.moveTo(x+TILE*3,y); ctx.lineTo(x+TILE*4, y+TILE); ctx.lineTo(x+TILE*3, y+TILE*2); ctx.fill(); }




function drawBattleSlime(ctx, x, y, scale, skin, body) {
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(x, y + 15 * scale);
    ctx.quadraticCurveTo(x + 8 * scale, y - 5 * scale, x + 16 * scale, y + 15 * scale);
    ctx.closePath();
    ctx.fill();




    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 4 * scale, y + 8 * scale, 3 * scale, 3 * scale);
    ctx.fillRect(x + 9 * scale, y + 8 * scale, 3 * scale, 3 * scale);
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 5 * scale, y + 9 * scale, 1 * scale, 1 * scale);
    ctx.fillRect(x + 10 * scale, y + 9 * scale, 1 * scale, 1 * scale);
}
function drawBattleGoblin(ctx, x, y, scale, skin, body) { drawPixelCharacter(ctx, x, y + 2 * scale, scale, skin, body); ctx.fillStyle = skin; ctx.fillRect(x + 3 * scale, y + 4 * scale, 2 * scale, 3 * scale); ctx.fillRect(x + 11 * scale, y + 4 * scale, 2 * scale, 3 * scale); }
function drawBattleBat(ctx, x, y, scale, skin, body) { ctx.fillStyle = body; ctx.fillRect(x + 6 * scale, y + 4 * scale, 4 * scale, 6 * scale); ctx.fillRect(x + 7 * scale, y + 3 * scale, 2 * scale, 1 * scale); ctx.fillStyle = skin; ctx.fillRect(x + 1 * scale, y + 5 * scale, 5 * scale, 1 * scale); ctx.fillRect(x + 10 * scale, y + 5 * scale, 5 * scale, 1 * scale); ctx.fillRect(x + 2 * scale, y + 6 * scale, 4 * scale, 1 * scale); ctx.fillRect(x + 10 * scale, y + 6 * scale, 4 * scale, 1 * scale); ctx.fillRect(x + 3 * scale, y + 7 * scale, 3 * scale, 2 * scale); ctx.fillRect(x + 10 * scale, y + 7 * scale, 3 * scale, 2 * scale); ctx.fillStyle = 'red'; ctx.fillRect(x + 7 * scale, y + 6 * scale, 1 * scale, 1 * scale); ctx.fillRect(x + 8 * scale, y + 6 * scale, 1 * scale, 1 * scale); }
function drawBattleGolem(ctx, x, y, scale, skin, body) { ctx.fillStyle = body; ctx.fillRect(x + 2 * scale, y + 5 * scale, 12 * scale, 10 * scale); ctx.fillStyle = skin; ctx.fillRect(x + 3 * scale, y + 6 * scale, 10 * scale, 8 * scale); ctx.fillStyle = body; ctx.fillRect(x + 4 * scale, y + 1 * scale, 8 * scale, 5 * scale); ctx.fillStyle = 'red'; ctx.fillRect(x + 6 * scale, y + 3 * scale, 4 * scale, 1 * scale); }
function drawBattleWolf(ctx, x, y, scale, skin, body) { ctx.fillStyle = skin; ctx.fillRect(x + 1 * scale, y + 6 * scale, 14 * scale, 6 * scale); ctx.fillStyle = body; ctx.fillRect(x + 2 * scale, y + 12 * scale, 3 * scale, 4 * scale); ctx.fillRect(x + 11 * scale, y + 12 * scale, 3 * scale, 4 * scale); ctx.fillStyle = skin; ctx.fillRect(x + 11 * scale, y + 2 * scale, 5 * scale, 5 * scale); ctx.fillRect(x + 15 * scale, y + 4 * scale, 3 * scale, 2 * scale); ctx.beginPath(); ctx.moveTo(x + 11 * scale, y + 2 * scale); ctx.lineTo(x + 13 * scale, y); ctx.lineTo(x + 13 * scale, y + 2 * scale); ctx.fill(); ctx.fillStyle = '#000'; ctx.fillRect(x + 13 * scale, y + 4 * scale, 1 * scale, 1 * scale); ctx.fillStyle = skin; ctx.fillRect(x, y + 5 * scale, 2 * scale, 4 * scale); }
function drawBattleScorpion(ctx, x, y, scale, skin, body) { ctx.fillStyle = body; ctx.fillRect(x, y, 3 * scale, 3 * scale); ctx.fillRect(x + 2 * scale, y + 2 * scale, 3 * scale, 3 * scale); ctx.fillRect(x + 4 * scale, y + 4 * scale, 3 * scale, 3 * scale); ctx.fillStyle = skin; ctx.fillRect(x + 6 * scale, y + 6 * scale, 8 * scale, 8 * scale); ctx.fillStyle = body; ctx.fillRect(x + 4 * scale, y + 10 * scale, 3 * scale, 5 * scale); ctx.fillRect(x + 13 * scale, y + 10 * scale, 3 * scale, 5 * scale); ctx.fillRect(x + 2 * scale, y + 14 * scale, 3 * scale, 3 * scale); ctx.fillRect(x + 15 * scale, y + 14 * scale, 3 * scale, 3 * scale); }
function drawBattleSandworm(ctx, x, y, scale, skin, body) { ctx.fillStyle = skin; ctx.fillRect(x+4*scale, y, 8*scale, 16*scale); ctx.fillStyle = body; for(let i=0; i<4; i++){ ctx.fillRect(x+3*scale, y + (i*4)*scale, 10*scale, 2*scale); } ctx.fillStyle = '#000'; ctx.fillRect(x + 6 * scale, y, 4 * scale, 3 * scale); }
function drawBattleYeti(ctx, x, y, scale, skin, body) { ctx.fillStyle = body; ctx.fillRect(x+2*scale, y+2*scale, 12*scale, 12*scale); ctx.fillStyle=skin; ctx.fillRect(x+4*scale, y+4*scale, 8*scale, 6*scale); ctx.fillStyle='#000'; ctx.fillRect(x+6*scale, y+6*scale, 1*scale, 1*scale); ctx.fillRect(x+9*scale, y+6*scale, 1*scale, 1*scale); ctx.fillStyle=body; ctx.fillRect(x,y,4*scale, 6*scale); ctx.fillRect(x+12*scale,y,4*scale, 6*scale); }

// フォレストウルフのバトル描画関数（改良版）
function drawBattleForestWolf(ctx, x, y, scale, skin, body) {
    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + 8 * scale, y + 20 * scale, 10 * scale, 3 * scale, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    // 体（より詳細な毛皮模様）
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(x + 2 * scale, y + 8 * scale, 12 * scale, 8 * scale);
    
    // 毛皮の模様
    ctx.fillStyle = '#A0522D';
    ctx.fillRect(x + 3 * scale, y + 9 * scale, 2 * scale, 2 * scale);
    ctx.fillRect(x + 7 * scale, y + 11 * scale, 2 * scale, 2 * scale);
    ctx.fillRect(x + 11 * scale, y + 9 * scale, 2 * scale, 2 * scale);
    
    // 頭
    ctx.fillStyle = '#A0522D';
    ctx.fillRect(x + 5 * scale, y + 4 * scale, 6 * scale, 4 * scale);
    
    // 耳（より大きく）
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(x + 4 * scale, y + 3 * scale, 2 * scale, 3 * scale);
    ctx.fillRect(x + 10 * scale, y + 3 * scale, 2 * scale, 3 * scale);
    
    // 目（赤く光る）
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(x + 6 * scale, y + 5 * scale, 1 * scale, 1 * scale);
    ctx.fillRect(x + 9 * scale, y + 5 * scale, 1 * scale, 1 * scale);
    
    // 鼻
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 7 * scale, y + 6 * scale, 2 * scale, 1 * scale);
    
    // 牙（より長く）
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x + 6 * scale, y + 7 * scale, 1 * scale, 2 * scale);
    ctx.fillRect(x + 9 * scale, y + 7 * scale, 1 * scale, 2 * scale);
    
    // 尻尾（よりふさふさ）
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(x + 1 * scale, y + 12 * scale, 3 * scale, 1 * scale);
    ctx.fillRect(x + 1 * scale, y + 13 * scale, 2 * scale, 1 * scale);
    ctx.fillRect(x + 1 * scale, y + 14 * scale, 1 * scale, 1 * scale);
    
    // 足
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(x + 4 * scale, y + 16 * scale, 2 * scale, 3 * scale);
    ctx.fillRect(x + 10 * scale, y + 16 * scale, 2 * scale, 3 * scale);
}

// ラティオのバトル描画関数（特別な敵として）
function drawBattleRatio(ctx, x, y, scale, skin, body) {
    // 影（より濃い）
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(x + 8 * scale, y + 20 * scale, 8 * scale, 3 * scale, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    // 体（重装備）
    ctx.fillStyle = '#2C1810';
    ctx.fillRect(x + 3 * scale, y + 8 * scale, 10 * scale, 8 * scale);
    
    // 鎧の装飾（より詳細）
    ctx.fillStyle = '#654321';
    ctx.fillRect(x + 4 * scale, y + 9 * scale, 2 * scale, 2 * scale);
    ctx.fillRect(x + 10 * scale, y + 9 * scale, 2 * scale, 2 * scale);
    ctx.fillRect(x + 6 * scale, y + 11 * scale, 4 * scale, 1 * scale);
    
    // 頭
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x + 5 * scale, y + 4 * scale, 6 * scale, 4 * scale);
    
    // 目（不気味な赤い光）
    ctx.fillStyle = '#FF4444';
    ctx.fillRect(x + 6 * scale, y + 5 * scale, 1 * scale, 1 * scale);
    ctx.fillRect(x + 9 * scale, y + 5 * scale, 1 * scale, 1 * scale);
    
    // 髪（黒い髪）
    ctx.fillStyle = '#1A1A1A';
    ctx.fillRect(x + 4 * scale, y + 2 * scale, 8 * scale, 2 * scale);
    
    // 角（悪魔的な角）
    ctx.fillStyle = '#8B0000';
    ctx.fillRect(x + 5 * scale, y + 1 * scale, 1 * scale, 2 * scale);
    ctx.fillRect(x + 10 * scale, y + 1 * scale, 1 * scale, 2 * scale);
    
    // 武器（大きな剣）
    ctx.fillStyle = '#C0C0C0';
    ctx.fillRect(x + 14 * scale, y + 2 * scale, 3 * scale, 10 * scale);
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x + 13 * scale, y + 11 * scale, 5 * scale, 2 * scale);
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(x + 15 * scale, y + 3 * scale, 1 * scale, 1 * scale);
    
    // マント
    ctx.fillStyle = '#8B0000';
    ctx.fillRect(x + 2 * scale, y + 10 * scale, 2 * scale, 6 * scale);
    ctx.fillRect(x + 12 * scale, y + 10 * scale, 2 * scale, 6 * scale);
}




function renderBattle() {
    btx.clearRect(0, 0, battleCanvas.width, battleCanvas.height);
    if (currentEnemy) {
        let enemyX = 100, enemyY = 40;
        const enemyAnim = gameState.battleState.enemyAnimation;
        if (enemyAnim.active) {
            const moveProgress = Math.sin(enemyAnim.progress * Math.PI);
            enemyX += 40 * moveProgress;
        }




        const alpha = currentEnemy.isHit ? 0.5 : (currentEnemy.alpha !== undefined ? currentEnemy.alpha : 1.0);
        btx.globalAlpha = alpha;
        
        // 敵の種類に応じた描画関数を選択（フォレストウルフとラティオは特別扱い）
        let drawFunc;
        if (currentEnemy.name === 'フォレストウルフ') {
            drawFunc = drawBattleForestWolf;
        } else if (currentEnemy.name === 'ラティオ' || currentEnemy.name.includes('ラティオ')) {
            drawFunc = drawBattleRatio;
        } else {
            const drawFuncs = { slime: drawBattleSlime, bat: drawBattleBat, wolf: drawBattleWolf, goblin: drawBattleGoblin, golem: drawBattleGolem, scorpion: drawBattleScorpion, sandworm: drawBattleSandworm, yeti: drawBattleYeti, humanoid: drawPixelCharacter };
            drawFunc = drawFuncs[currentEnemy.drawType || 'humanoid'] || drawPixelCharacter;
        }
        drawFunc(btx, enemyX, enemyY, 5, currentEnemy.skin, currentEnemy.body);
        
        if (currentEnemy.isHit) { btx.globalAlpha = 1.0; btx.fillStyle = 'rgba(255,255,255,0.7)'; btx.fillRect(0,0,battleCanvas.width, battleCanvas.height); }
        btx.globalAlpha = 1.0;
    }
    
    const partyPositions = [{x:160, y:100}, {x:190, y:120}, {x:130, y:120}, {x:160, y:140}];
    const partyColors = [{skin: '#ffd1b3', body: '#2f8bd2'}, {skin: '#fde2e4', body: '#8c1c13'}, {skin: '#e0cfa8', body: '#5f0f40'}, {skin: '#ffc8dd', body: '#ffafcc'}]
    const playerAnim = gameState.battleState.animation;
    
    gameState.party.forEach((p, i) => {
        if(p.hp > 0 && i < partyPositions.length) {
            btx.globalAlpha = p.isHit ? 0.5 : 1.0;




            let currentX = partyPositions[i].x, currentY = partyPositions[i].y;
            let animState = 'idle';
            if (playerAnim.active && playerAnim.memberIndex === i) {
                if (playerAnim.type === 'physical') {
                    const moveProgress = Math.sin(playerAnim.progress * Math.PI);
                    currentX -= 40 * moveProgress;
                    if (playerAnim.progress > 0.3 && playerAnim.progress < 0.7) animState = 'swing_weapon';
                } else { // magic
                    if (playerAnim.progress > 0.1 && playerAnim.progress < 0.8) animState = 'casting';
                }
            }
            const colors = partyColors[i % partyColors.length];
            drawBattleSprite(btx, currentX, currentY, 3, colors.skin, colors.body, p.type, p, animState);
            btx.globalAlpha = 1.0;
        }
    });




    if (playerAnim.active && playerAnim.type === 'magic' && playerAnim.progress < 0.8) {
        const caster = gameState.party[playerAnim.memberIndex];
        const startX = partyPositions[playerAnim.memberIndex].x + 20;
        const startY = partyPositions[playerAnim.memberIndex].y + 20;
        const endX = 100 + 8 * 5; // center of enemy
        const endY = 40 + 8 * 5;
        const particleX = startX + (endX - startX) * (playerAnim.progress / 0.8);
        const particleY = startY + (endY - startY) * (playerAnim.progress / 0.8);
        const size = Math.sin(playerAnim.progress * Math.PI) * 10;
        
        btx.fillStyle = caster.name === 'リディア' ? 'rgba(255, 0, 255, 0.8)' : 'rgba(255, 255, 100, 0.8)';
        btx.beginPath();
        btx.arc(particleX, particleY, size, 0, Math.PI * 2);
        btx.fill();
    }
}


// =========================================================================
// 11. KEYBOARD, TOUCH, AND INITIALIZATION
// =========================================================================
function generateTitleStars() {
    for (let i = 0; i < 100; i++) {
        titleStars.push({
            x: Math.random() * VIEW_W,
            y: Math.random() * VIEW_H,
            radius: Math.random() * 0.8
        });
    }
}
function handleCuiCommand(command) {
    cuiOutput.innerHTML += `> ${command}<br>`;
    const parts = command.trim().split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);




    switch(cmd) {
        case 'help': cuiOutput.innerHTML += `利用可能なコマンド:<br>save, load, weak, get, setstat, warp, toggleencounter, testencounter, encounterinfo, clear<br>`; break;
        case 'save': try { const saveDataString = btoa(JSON.stringify(gameState)); cuiOutput.innerHTML += `セーブデータ:<br><textarea readonly onclick="this.select()">${saveDataString}</textarea>`; } catch (e) { cuiOutput.innerHTML += `エラー: ${e.message}<br>`; } break;
        case 'load': if (args.length === 0) { cuiOutput.innerHTML += `エラー: データがありません<br>`; break; } try { const loadedState = JSON.parse(atob(args[0])); gameState = { ...gameState, ...loadedState }; teleport(gameState.currentMapId, gameState.playerX / TILE, gameState.playerY / TILE); cuiOutput.innerHTML += `ロード成功！<br>`; setTimeout(() => closeSpecialMenu(), 500); } catch (e) { cuiOutput.innerHTML += `エラー: ${e.message}<br>`; } break;
        case 'weak': isWeakMode = !isWeakMode; cuiOutput.innerHTML += `敵弱体化モード: ${isWeakMode ? 'ON' : 'OFF'}<br>`; break;
        case 'get': if (args.length < 2) { cuiOutput.innerHTML += '使い方: get [item|equip] [key] [qty]<br>'; break; } const [type, key, qtyStr] = args; const qty = (qtyStr === 'inf') ? 99 : (parseInt(qtyStr) || 1); if (type === 'item' && ITEM_CATALOG[key]) { gameState.inventory[key] = (gameState.inventory[key] || 0) + qty; cuiOutput.innerHTML += `${ITEM_CATALOG[key].name} x${qty} を入手<br>`; } else if (type === 'equip' && EQUIPMENT_CATALOG[key]) { gameState.equipment[key] = (gameState.equipment[key] || 0) + qty; cuiOutput.innerHTML += `${EQUIPMENT_CATALOG[key].name} x${qty} を入手<br>`; } else { cuiOutput.innerHTML += `エラー: "${key}" が見つかりません。<br>`; } break;
        case 'setstat': if (args.length < 3) { cuiOutput.innerHTML += '使い方: setstat [name] [stat] [value]<br>'; break; } const [name, stat, valueStr] = args; const value = parseInt(valueStr); if (isNaN(value)) { cuiOutput.innerHTML += 'エラー: 数値を入力してください。<br>'; break; } if (stat.toLowerCase() === 'gold') { gameState.gold = value; cuiOutput.innerHTML += `所持金を ${value} に設定<br>`; break; } const member = gameState.party.find(p => p.name === name); if (!member) { cuiOutput.innerHTML += `エラー: ${name} はパーティにいません。<br>`; break; } switch(stat.toLowerCase()) { case 'hp': member.hp = value; break; case 'maxhp': member.maxHP = value; member.baseMaxHP = value; break; case 'atk': member.baseAtk = value; break; case 'def': member.baseDef = value; break; case 'exp': member.exp = value; break; case 'level': member.level = value; break; default: cuiOutput.innerHTML += `エラー: 不明なステータス<br>`; return; } cuiOutput.innerHTML += `${name} の ${stat} を ${value} に設定<br>`; break;
        case 'warp': if (args.length !== 3) { cuiOutput.innerHTML += `使い方: warp [マップID] [X] [Y]<br>`; break; } const [mapId, x, y] = args; if (MAP_DATA[mapId] !== undefined) { teleport(mapId, parseInt(x), parseInt(y)); cuiOutput.innerHTML += `${mapId}の(${x}, ${y})へワープしました。<br>`; setTimeout(() => closeSpecialMenu(), 500); } else { cuiOutput.innerHTML += `エラー: マップID "${mapId}" が見つかりません。<br>`; } break;
        case 'toggleencounter': gameState.showEncounterAreas = !gameState.showEncounterAreas; cuiOutput.innerHTML += `エンカウントエリア表示: ${gameState.showEncounterAreas ? 'ON' : 'OFF'}<br>`; break;
        case 'testencounter': cuiOutput.innerHTML += `エンカウントテスト: スライムを召喚<br>`; triggerRandomEncounter(['slime']); break;
        case 'encounterinfo': cuiOutput.innerHTML += `現在のエンカウント設定:<br>確率: 15%<br>クールダウン: 2秒<br>エンカウント可能タイル: ${Object.keys(tiles).filter(k => tiles[k].encounter).join(', ')}<br>現在のクールダウン: ${encounterCooldown.toFixed(1)}秒<br>`; break;
        case 'clear': cuiOutput.innerHTML = ''; break;
        default: cuiOutput.innerHTML += `不明なコマンド: ${cmd}<br>`;
    }
    cuiOutput.scrollTop = cuiOutput.scrollHeight;
}
function setupTouchControls() { const dpad={up:document.querySelector('.d-pad-up'),down:document.querySelector('.d-pad-down'),left:document.querySelector('.d-pad-left'),right:document.querySelector('.d-pad-right')},actions={a:document.querySelector('.action-a')},keyMap={up:'arrowup',down:'arrowdown',left:'arrowleft',right:'arrowright',a:'z'}; for(const dir in dpad){dpad[dir].addEventListener('touchstart',e=>{e.preventDefault();keys[keyMap[dir]]=true;},{passive:false});dpad[dir].addEventListener('touchend',e=>{e.preventDefault();keys[keyMap[dir]]=false;});} for(const act in actions){actions[act].addEventListener('touchstart',e=>{e.preventDefault();keys[keyMap[act]]=true;},{passive:false});actions[act].addEventListener('touchend',e=>{e.preventDefault();keys[keyMap[act]]=false;});}}




function handleMenuKeys(e) {
    if (!menuState.active || menuState.items.length === 0) return;
    e.preventDefault();
    let oldCursor = menuState.cursor;
    if (e.key === 'ArrowUp' || e.key === 'w') { menuState.cursor = (menuState.cursor - 1 + menuState.items.length) % menuState.items.length; } else if (e.key === 'ArrowDown' || e.key === 's') { menuState.cursor = (menuState.cursor + 1) % menuState.items.length; } else if (inBattle && (e.key === 'ArrowLeft' || e.key === 'a')) { menuState.cursor = Math.max(0, menuState.cursor - 2); } else if (inBattle && (e.key === 'ArrowRight' || e.key === 'd')) { menuState.cursor = Math.min(menuState.items.length - 1, menuState.cursor + 2); } else if (e.key === 'Enter' || e.key === 'z') { menuState.items[menuState.cursor].click(); }
    if (oldCursor !== menuState.cursor) { updateMenuSelection(); }
}




document.addEventListener('keydown', e => {
    if (inSpecialMenu && document.activeElement === cuiInput) return;
    const key = e.key.toLowerCase();
    keys[key] = true;
    if (key === 'escape' || key === 'x') { if (inSpecialMenu) { closeSpecialMenu(); return; } if (inRollMenu) { closeRollMenu(); return; } if (inShop) { closeShop(); return; } if (inInn) { closeInn(); return; } if (inResult) { closeBattleResult(); return; } if (inMenu) { closeMenu(); return; } }
    if (inMenu && !inSpecialMenu) { clearTimeout(sequenceTimer); inputSequence += key; if (inputSequence.includes(secretCommand)) { openSpecialMenu(); inputSequence = ''; e.preventDefault(); return; } sequenceTimer = setTimeout(() => { inputSequence = ''; }, 1000); }
    if (menuState.active) { handleMenuKeys(e); return; }
    if (key === 'x' || key === 'escape') { if (!inMenu && !showingDialog && !inBattle && !inShop && !inInn && !inResult && !inRollMenu) { openMenu(); } return; }
});




document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
cuiInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && inSpecialMenu) {
        e.preventDefault();
        handleCuiCommand(cuiInput.value);
        cuiInput.value = '';
    }
});
window.onload = () => {
    generateTitleStars();
    storeOriginalData();
    initializeFirebase().then(() => { 
        teleport('village', 4, 5); // Default start
        setupTouchControls(); 
        setupSettings(); 
        touchControls.classList.toggle('active', gameState.controlType === 'touch' && !gameState.inTitle); 
        requestAnimationFrame(now => { last = now; loop(now); }); 
    }); 
};




// =========================================================================
// 12. MODDING / DATA PACK FUNCTIONS
// =========================================================================
const sampleModData = `{
  "packInfo": {
    "name": "追加コンテンツサンプル",
    "author": "Game Master",
    "version": "1.0"
  },
  "equipment": {
    "mithril_sword": {
      "name": "ミスリルのつるぎ",
      "type": "weapon",
      "atk": 25,
      "def": 0,
      "price": 1200
    }
  },
  "items": {
    "elixir": {
      "name": "エリクサー",
      "price": 500,
      "description": "HPをかんぜんにかいふくする。",
      "type": "consumable_full_heal"
    }
  },
  "enemies": {
    "ghost": {
      "name": "ゴースト",
      "hp": 70,
      "maxHP": 70,
      "exp": 40,
      "atk": 20,
      "def": 12,
      "gold": 60,
      "skin": "#e0e0e0",
      "body": "#ffffff",
      "drawType": "humanoid"
    }
  },
  "shops": {
    "feronia": {
      "weapons": ["iron_sword", "mithril_sword"],
      "armor": ["chain_mail"],
      "items": ["potion", "antidote", "attack_key", "defense_key", "elixir"]
    }
  }
}`;




let originalGameData = {};
let loadedPacks = [];




function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }




function storeOriginalData() {
    originalGameData = {
        ITEM_CATALOG: deepClone(ITEM_CATALOG),
        ROLL_CATALOG: deepClone(ROLL_CATALOG),
        EQUIPMENT_CATALOG: deepClone(EQUIPMENT_CATALOG),
        SHOP_CATALOG: deepClone(SHOP_CATALOG),
        ENEMY_CATALOG: deepClone(ENEMY_CATALOG),
        MAP_DATA: deepClone(MAP_DATA),
        MAP_TRANSITIONS: deepClone(MAP_TRANSITIONS),
    };
}




function loadSampleMod() {
    document.getElementById('mod-input').value = sampleModData;
    showStatus("サンプルMODデータを入力しました。");
}




function loadDataPack() {
    const jsonInput = document.getElementById('mod-input').value;
    if (!jsonInput) { showStatus("データが入力されていません。"); return; }
    try {
        const data = JSON.parse(jsonInput);




        if (data.items) Object.assign(ITEM_CATALOG, data.items);
        if (data.rolls) Object.assign(ROLL_CATALOG, data.rolls);
        if (data.equipment) Object.assign(EQUIPMENT_CATALOG, data.equipment);
        if (data.enemies) Object.assign(ENEMY_CATALOG, data.enemies);
        if (data.shops) Object.assign(SHOP_CATALOG, data.shops);
        if (data.maps) Object.assign(MAP_DATA, data.maps);
        if (data.transitions) Object.assign(MAP_TRANSITIONS, data.transitions);




        const packInfo = data.packInfo || { name: '無名パック', version: '?' };
        loadedPacks.push(packInfo);
        
        showStatus(`データパック「${packInfo.name}」をロードしました！`);
        updateModMenu();
        document.getElementById('mod-input').value = '';
    } catch (e) {
        console.error("Data pack loading error:", e);
        showStatus("データパックの読み込みに失敗しました。JSONの形式を確認してください。");
    }
}




function unloadAllMods() {
    ITEM_CATALOG = deepClone(originalGameData.ITEM_CATALOG);
    ROLL_CATALOG = deepClone(originalGameData.ROLL_CATALOG);
    EQUIPMENT_CATALOG = deepClone(originalGameData.EQUIPMENT_CATALOG);

    SHOP_CATALOG = deepClone(originalGameData.SHOP_CATALOG);
    ENEMY_CATALOG = deepClone(originalGameData.ENEMY_CATALOG);
    MAP_DATA = deepClone(originalGameData.MAP_DATA);
    MAP_TRANSITIONS = deepClone(originalGameData.MAP_TRANSITIONS);
    
    loadedPacks = [];
    showStatus("すべてのMODをリセットしました。");
    updateModMenu();
    // Reload current map to apply changes
    teleport(gameState.currentMapId, gameState.playerX / TILE, gameState.playerY / TILE);
}




function exportCurrentData() {
    const exportData = {
        packInfo: { name: "My Custom Pack", author: "You", version: "1.0" },
        items: ITEM_CATALOG,
        rolls: ROLL_CATALOG,
        equipment: EQUIPMENT_CATALOG,
        enemies: ENEMY_CATALOG,
        shops: SHOP_CATALOG,
        maps: MAP_DATA,
        transitions: MAP_TRANSITIONS
    };
    const jsonString = JSON.stringify(exportData, null, 2);
    const textarea = document.getElementById('mod-input');
    textarea.value = jsonString;
    textarea.select();
    showStatus("現在のゲームデータをエクスポートしました。");
}




function updateModMenu() {
    const list = document.getElementById('loaded-packs-list');
    list.innerHTML = '';
    if (loadedPacks.length === 0) {
        list.innerHTML = '<li>なし</li>';
    } else {
        loadedPacks.forEach(pack => {
            const li = document.createElement('li');
            li.textContent = `${pack.name} (v${pack.version || '?'})`;
            list.appendChild(li);
        });
    }
}




</script>
</body>
</html>



