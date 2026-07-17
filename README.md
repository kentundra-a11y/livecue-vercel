# LiveCue Phase 2

Ticketmaster Discovery APIから実際の公演情報を取得する、Vercel公開用のWebアプリです。

## 実装済み

- お気に入りアーティスト登録・表示切替
- 更新ボタンによる実データ取得
- 前回取得との差分（新着）表示
- Ticketmasterの販売開始・終了日時の表示
- 公演日時・会場・販売ページ表示
- `.ics` カレンダーファイルの出力
- APIキーをブラウザに露出させないサーバー側プロキシ

## 公開方法

1. Ticketmaster Developer PortalでAPIキーを取得します。
2. このフォルダをGitHubへアップロードします。
3. VercelでリポジトリをImportします。
4. VercelのEnvironment Variablesに次を登録します。
   - Name: `TICKETMASTER_API_KEY`
   - Value: 取得したAPIキー
5. Deployを押します。
6. 発行されたURLをChromeで開きます。

## 注意

Ticketmaster APIで取得できる日本国内公演は限定的です。イープラス、ローチケ、チケットぴあ、ファンクラブ独自先行などを網羅するものではありません。次段階では、アーティスト公式ニュースURLの確認・手動登録・期限通知を追加する予定です。
