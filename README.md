# typing-miss-analyzer

ミスの原因（隣接キーの同時押し・消した直後の再ミス・ローマ字の型）を分析するタイピング練習アプリ。

- 隣接キーの同時押し（初期値 30ms、または押下の重なり）
- Backspace の直後にもう一度間違えた打鍵
- ローマ字の型（順番の入れ替え、拗音、「ん」）。`shi`/`si` などの表記ゆれはミスにしません。

配列は QWERTY、Colemak-DH、大西配列です。キーマップ変換をオンにすると、OS が QWERTY のままでも物理キーを選んだ配列の文字として扱います。

打鍵と結果はブラウザの localStorage だけに保存します。アカウントはありません。アクセス解析は本番ビルドの Vercel Web Analytics（ページ閲覧のみ）で、打鍵データは送りません。

## 開発

```sh
npm install
npm test
npm run dev
npm run build
```
