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

The frontend wraps the Telegram WebApp SDK via the `tgUtil` object in `index.html` (around lines 414-547). All BackButton / MainButton interactions MUST go through this wrapper — direct calls to `tg.BackButton.onClick(...)` or `tg.MainButton.onClick(...)` cause handler stacking and visible UI bugs.

Note: `tgUtil._tg` is a **getter** that returns `window.Telegram?.WebApp || null` on every access — there is no cached property and no `init()` method. Every method that touches the SDK reads it via `this._tg?.<API>` and wraps the call in `try/catch` so that running outside Telegram (web preview, dev tools) never throws.

## The pattern (already implemented, do not break)

```js
const tgUtil = {
  // Getter — evaluates `window.Telegram?.WebApp` lazily on each access.
  // Do NOT replace with `_tg: null` + an init() method.
  get _tg() { return window.Telegram?.WebApp || null; },
  _bbHandler: null,  // reference to currently-attached BackButton handler
  _mbHandler: null,  // reference to currently-attached MainButton handler

  setBackButton(handler) {
    const bb = this._tg?.BackButton;
    if (!bb) return;
    try {
      if (this._bbHandler) bb.offClick(this._bbHandler);  // remove OLD handler by reference
      this._bbHandler = null;
      if (handler) {
        this._bbHandler = handler;                         // store NEW handler reference
        bb.onClick(handler);
        bb.show();
      } else {
        bb.hide();
      }
    } catch {}
  },

  setMainButton({ text, onClick, color, textColor, isLoading } = {}) {
    const mb = this._tg?.MainButton;
    if (!mb) return;
    try {
      if (this._mbHandler) mb.offClick(this._mbHandler);
      this._mbHandler = null;
      if (!text || !onClick) { mb.hide(); return; }
      mb.setText(text);
      if (color) mb.color = color;
      if (textColor) mb.textColor = textColor;
      if (isLoading) mb.showProgress(false); else mb.hideProgress();
      this._mbHandler = onClick;
      mb.onClick(onClick);
      mb.enable();
      mb.show();
    } catch {}
  },

  hideMainButton() {
    const mb = this._tg?.MainButton;
    try {
      mb?.hide();
      if (this._mbHandler && mb) mb.offClick(this._mbHandler);
      this._mbHandler = null;
    } catch {}
  },
};
```

There is NO `clearHandlers()` method on `tgUtil`. To hide the BackButton + remove its handler, call `tgUtil.setBackButton(null)`. To hide the MainButton + remove its handler, call `tgUtil.hideMainButton()` (or `tgUtil.setMainButton({})`).

## Key rules

1. **Always** pass the same function reference to `onClick` and `offClick`. Passing an arrow function inline (`bb.offClick(() => ...)`) does NOT remove anything because it's a different reference.
2. **Always** clear the old handler before setting a new one — Telegram stacks `onClick` callbacks, they all fire on one tap.
3. To **hide** a button: call `setBackButton(null)` / `setMainButton({})` — wrapper handles hide + handler cleanup.
4. `syncTelegramBackButton()` (in `index.html` around line 1016) is the canonical place to decide which handler the BackButton should have based on current screen / subscreen. Call it from `renderCurrentScreen()`, not from individual render functions.
5. `try/catch` around every SDK call is mandatory — the code must run outside Telegram (web preview) without throwing.

## Common bugs caused by violating this pattern

- BackButton fires N times after navigating N times between subscreens.
- MainButton triggers the wrong action because an old handler from a previous screen is still attached.
- Memory leak — closures captured by old handlers prevent old screen state from being GC'd.

PR #7 introduced the wrappers; PR #8 fixed handler stacking by storing references properly. Do not revert this pattern.

## When adding a new screen with BackButton or MainButton

1. Inside the render function or `attachXxxHandlers`, call `tgUtil.setBackButton(() => goBack())` and / or `tgUtil.setMainButton({ text, onClick })`.
2. Do NOT call `bb.onClick` / `mb.onClick` directly.
3. Do NOT forget to clear when leaving the screen — `renderCurrentScreen` → `syncTelegramBackButton` handles this, just make sure the new screen's logic is wired into `syncTelegramBackButton`.
4. When you finish a MainButton action and want the button to disappear, call `tgUtil.hideMainButton()` — don't access `MainButton.hide()` directly so the stored handler reference is also cleaned up.

## Don't

- Don't introduce a second set of handler bookkeeping outside `tgUtil`.
- Don't rely on `bb.offClick()` with no argument — depending on Telegram client version it may not clear all callbacks.
