---
title: CJK Font Smoke — Language Tagged
lang: en
pdf:
  content-langs:
    - en
    - ja
    - zh-Hant
---

# CJK Font Smoke

This document checks mixed English, Japanese, Traditional Chinese, and code font handling.

## Japanese

[これは日本語の本文です。読みやすい本文フォントを確認します。]{lang=ja}

## Traditional Chinese

[這是一段繁體中文內容，用來確認中文字體設定是否適合閱讀。]{lang=zh-Hant}

## Code

```ts
const label = "日本語と繁體中文";
console.log(label);
```
