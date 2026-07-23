# 2.5D Metaverse MVP

ブラウザで動くリアルタイム・マルチプレイヤー・メタバースの最小構成です。
コインを集めて所持金を増やす簡単な経済システムを搭載しています。

## 開発環境（ローカル）での動かし方
1. このフォルダでターミナルを開きます。
2. `npm install` を実行して依存パッケージをインストールします。
3. `npm start` を実行してサーバーを起動します（`http://localhost:3000`で待ち受けます）。
4. ブラウザで `index.html` を直接開くか、VSCodeのLive Server等で開きます。
5. 複数タブを開いて、キャラクターが同期されるか、コインを取って所持金が増えるか確認します。

## デプロイ（公開）手順

### Step 1: バックエンドを Render に公開する
1. [Render(https://render.com/)](https://render.com/) にログインします。
2. 新しい **Web Service** を作成し、このリポジトリ（またはサーバーコードのフォルダ）を連携します。
3. Build Command を `npm install` に、Start Command を `npm start` に設定します。
4. Deploy を実行し、完了後に発行されるURL（例: `https://my-backend.onrender.com`）をコピーします。

### Step 2: フロントエンドの設定を更新する
1. `index.html` の 23行目付近にある `SERVER_URL` を、Renderで発行されたURLに書き換えます。
   ```javascript
   // 変更前
   const SERVER_URL = 'http://localhost:3000';
   // 変更後
   const SERVER_URL = '[https://my-backend.onrender.com](https://my-backend.onrender.com)';