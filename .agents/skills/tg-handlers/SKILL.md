---
name: tg-handlers
description: Correct pattern for attaching and removing Telegram WebApp BackButton / MainButton handlers in index.html. Use when the task involves Telegram native UI, BackButton, MainButton, popup, haptic, or anything in window.Telegram.WebApp.
triggers:
  - BackButton
  - MainButton
  - tgUtil
  - Telegram
  - WebApp
  - haptic
  - popup
  - back button
  - main button
  - setBackButton
  - setMainButton
---

# Skill: Telegram WebApp handler hygiene

The frontend wraps the Telegram WebApp SDK via the `tgUtil` object in `index.html` (around lines 396-510). All BackButton / MainButton interactions MUST go through this wrapper — direct calls to `window.Telegram.WebApp.BackButton.onClick(...)` cause handler stacking and visible UI bugs.

## The pattern (already implemented, do not break)

```js
const tgUtil = {
  _bbHandler: null,
  _mbHandler: null,

  setBackButton(handler) {
    const bb = window.Telegram?.WebApp?.BackButton;
    if (!bb) return;
    if (this._bbHandler) bb.offClick(this._bbHandler);   // ← remove OLD handler by reference
    if (!handler) { bb.hide(); this._bbHandler = null; return; }
    this._bbHandler = handler;                            // ← store NEW handler reference
    bb.onClick(handler);
    bb.show();
  },

  setMainButton({ text, onClick, color, textColor, isLoading } = {}) {
    const mb = window.Telegram?.WebApp?.MainButton;
    if (!mb) return;
    if (this._mbHandler) mb.offClick(this._mbHandler);
    if (!text || !onClick) { mb.hide(); this._mbHandler = null; return; }
    mb.setParams({ text, color, text_color: textColor, is_active: !isLoading, is_visible: true });
    this._mbHandler = onClick;
    mb.onClick(onClick);
    if (isLoading) mb.showProgress(); else mb.hideProgress();
  },

  clearHandlers() {
    const bb = window.Telegram?.WebApp?.BackButton;
    const mb = window.Telegram?.WebApp?.MainButton;
    if (this._bbHandler && bb) bb.offClick(this._bbHandler);
    if (this._mbHandler && mb) mb.offClick(this._mbHandler);
    this._bbHandler = null;
    this._mbHandler = null;
  },
};
```

## Key rules

1. **Always** pass the same function reference to `onClick` and `offClick`. Passing an arrow function inline (`bb.offClick(() => ...)`) does NOT remove anything because it's a different reference.
2. **Always** clear the old handler before setting a new one — Telegram stacks `onClick` callbacks, they all fire on one tap.
3. To **hide** a button: call `setBackButton(null)` / `setMainButton({})` — wrapper handles hide + handler cleanup.
4. `syncTelegramBackButton()` (in `index.html` around line 996) is the canonical place to decide which handler the BackButton should have based on current screen / subscreen. Call it from `renderCurrentScreen()`, not from individual render functions.

## Common bugs caused by violating this pattern

- BackButton fires N times after navigating N times between subscreens.
- MainButton triggers the wrong action because an old handler from a previous screen is still attached.
- Memory leak — closures captured by old handlers prevent old screen state from being GC'd.

PR #7 introduced the wrappers; PR #8 fixed handler stacking by storing references properly. Do not revert this pattern.

## When adding a new screen with BackButton or MainButton

1. Inside the render function or `attachXxxHandlers`, call `tgUtil.setBackButton(() => goBack())` and / or `tgUtil.setMainButton({ text, onClick })`.
2. Do NOT call `bb.onClick` / `mb.onClick` directly.
3. Do NOT forget to clear when leaving the screen — `renderCurrentScreen` → `syncTelegramBackButton` handles this, just make sure the new screen's logic is wired into `syncTelegramBackButton`.

## Don't

- Don't introduce a second set of handler bookkeeping outside `tgUtil`.
- Don't rely on `bb.offClick()` with no argument — depending on Telegram client version it may not clear all callbacks.
