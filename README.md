# ticket supabase edge function

## デプロイ手順
> `service-account.json`が必要です。そのままでは動かないです。

### 1. Firebaseの設定
- firebaseのアカウントを作成ます。
- その後新規プロジェクトを作成
- iOSアプリと連動させる

### 2. FCMのAPNs設定
iOSで通知を設定するためにApple Push Notification Service(APNs)を使用しています。

[Establishing a token-based connection to APNs](https://developer.apple.com/documentation/usernotifications/establishing-a-token-based-connection-to-apns)

- APNs認証キーをアップロード
- キーIDを設定
- チームIDを設定
### 3. `service-account.json`をダウンロード
- firebaseプロジェクト設定
  - サービスアカウントのタブ
    - Firebase Admin SDK
    - 新しい秘密鍵を作成でダウンロード

### 4. `ticket_supabase`リポジトリをクローン
- ターミナルを開く
- 以下のコマンドを実行してクローン
  - `git clone https://github.com/ObaShion/ticket_supabase.git`
- `service-account.json`をプロジェクトに入れる
  - ```zsh
    .
    └── supabase
        ├── config.toml
        └── functions
            ├── service-account.json # <-ここにドラッグ&ドロップ!
            └── ticket_notification
                ├── deno.json
                └── index.ts
    ```
### 5. supabaseにデプロイ
- ticket_supabaseのルートに移動する
  - 例: `cd /Users/ObaShion/dev/ticket_supabase`
- supabase CLI のインストール
  - `npm install supabase --save-dev`
- supabaseアカウントにログイン
  - `supabase login`
- プロジェクトとリンクさせる
  - `supabase projects list`
- デプロイコマンドを実行
  - `supabase functions deploy ticket_notification --no-verify-jwt`
