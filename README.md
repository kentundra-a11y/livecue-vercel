# LiveCue Phase 3 Japan

日本のアーティスト公式サイトを優先して、ライブ・チケット情報を更新ボタンで確認するVercel用Webアプリです。

## 優先アーティスト

- くるり（公式LIVEページ）
- Bialystocks（公式LIVEページ）

## 実装済み

- 公式サイトのライブ情報確認
- 「先行」「一般販売」「受付中」などの表示
- Ticketmaster Discovery APIとの併用
- 前回確認との差分（新着）表示
- 公式・販売ページへのリンク
- `.ics` カレンダーファイル出力
- 公式サイトが自動取得を拒否した場合の公式リンク表示

## Vercel設定

Environment Variablesに以下を登録してください。

- Name: `TICKETMASTER_API_KEY`
- Value: Ticketmaster Developer PortalのConsumer Key

公式サイト側の仕様変更やアクセス制限により、自動取得できない場合があります。その場合も公式ページへの確認リンクを表示します。
