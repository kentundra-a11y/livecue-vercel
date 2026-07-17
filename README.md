# LiveCue Phase 5 Auto Alerts

日本のアーティスト公式サイトを毎日自動確認し、24時間以内に始まるチケット販売をメールで通知するVercel用Webアプリです。

## 主な機能

- くるり・Bialystocks公式サイトの自動確認
- 今日以降に開催される公演だけを表示
- 過去公演・終了したチケット告知を除外
- 毎朝8時ごろ（日本時間）の自動巡回
- 24時間以内に販売開始する情報をメール通知
- 手動登録なし
- 画面からの即時更新とカレンダー登録

## Vercel環境変数

- `TICKETMASTER_API_KEY`: Ticketmaster Consumer Key
- `RESEND_API_KEY`: Resendの送信専用APIキー
- `ALERT_EMAIL`: 通知を受け取るメールアドレス
- `CRON_SECRET`: 十分に長い任意の秘密文字列
- `ALERT_FROM`: 任意。独自ドメインを使う場合の送信元

`ALERT_FROM`を設定しない場合は `LiveCue <onboarding@resend.dev>` を使います。Resendの制限により、初期状態ではResendアカウント所有者のメールアドレスにのみ送信できる場合があります。

Vercel HobbyプランのCron制限に合わせ、1日1回実行します。販売開始日時が公式サイトから取得できない情報は自動メールの対象になりません。
