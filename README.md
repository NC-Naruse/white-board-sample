# P2P Whiteboard MVP

React + Vite + TypeScript で作成した、1対1向けの P2P ホワイトボードです。描画イベントは WebRTC DataChannel で同期し、Firestore は offer / answer / ICE candidate の受け渡しだけに使います。

## 機能

- ルーム作成
- 共有URLでのルーム参加
- フリーハンド描画
- 色変更
- 線幅変更
- 消しゴム
- 全消し

## 技術構成

- React 19
- Vite 8
- TypeScript
- WebRTC
- Firebase Firestore

## セットアップ

1. 依存関係をインストールします。

```bash
npm install
```

2. Firebase の設定ファイルを作成します。

```bash
cp .env.example .env.local
```

3. `.env.local` に Firebase プロジェクトの値を入れます。

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

4. 開発サーバーを起動します。

```bash
npm run dev
```

## Firestore の前提

- Firestore Database を有効化してください
- MVP では `rooms` コレクション配下にルーム情報と ICE candidate を保存します
- 認証は未実装なので、検証用プロジェクトか開発用ルールで動かす想定です

開発中に最低限動かすための緩いルール例:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      allow read, write: if true;
      match /{document=**} {
        allow read, write: if true;
      }
    }
  }
}
```

本番では必ず認証付きのルールへ差し替えてください。

## 使い方

1. ホスト側で `ルームを作成` を押します
2. 表示された共有URLを相手に渡します
3. ゲスト側は共有URLを開くか、ルームIDを入力して `参加` を押します
4. 接続後は両者の描画が同期されます

## コマンド

```bash
npm run dev
npm run build
npm run lint
```

## 制限事項

- 現状は 1対1 の接続を前提にしています
- 盤面の永続保存は未対応です
- Firestore の設定がない場合は接続せず、画面上に案内を表示します
