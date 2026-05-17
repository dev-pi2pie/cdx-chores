---
title: Code Transformer Error Warning
---

## Error And Warning Lines

```ts
const valid = true;
const failed = false; // [!code error]
const maybe = true; // [!code warning]
const errorRange = false; // [!code error:2]
const stillError = false;
const warningRange = true; // [!code warning:2]
const stillWarning = true;
```
