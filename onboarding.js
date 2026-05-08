// ICE LOGIX — Онбординг-сторис (Vanilla JS, browser-ready)
// Интеграция: подключить как <script src="./onboarding.js"></script>
// Использование: window.iceLogixOnboarding.open()
// Версия: 2026.05.08.01

(function (global) {
  'use strict';

  // =====================================================================
  // 1. CSS — вставляются один раз в <head>
  // =====================================================================
  const STYLES = `
.ice-stories-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.95);
  display: flex; align-items: center; justify-content: center;
  animation: iceFadeIn 0.2s ease-out;
}
@keyframes iceFadeIn { from { opacity: 0; } to { opacity: 1; } }
.ice-story-frame {
  position: relative;
  width: 100%; max-width: 420px; height: 100%; max-height: 100vh;
  background: linear-gradient(135deg, #0c4a6e 0%, #155e75 50%, #0e7490 100%);
  overflow: hidden;
  display: flex; flex-direction: column;
}
@media (min-width: 768px) {
  .ice-story-frame { max-height: 90vh; border-radius: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.6); }
}
.ice-progress-container {
  position: absolute; top: 12px; left: 12px; right: 12px; z-index: 10;
  display: flex; gap: 4px;
}
.ice-progress-bar {
  flex: 1; height: 3px; background: rgba(255,255,255,0.25);
  border-radius: 2px; overflow: hidden;
}
.ice-progress-fill {
  height: 100%; width: 0; background: white;
  transition: width 0.1s linear;
}
.ice-progress-fill.complete { width: 100% !important; }
.ice-close-btn {
  position: absolute; top: 18px; right: 18px; z-index: 11;
  width: 32px; height: 32px;
  background: rgba(255,255,255,0.15); backdrop-filter: blur(10px);
  border-radius: 50%; border: 0; color: white;
  font-size: 20px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.ice-tap-zone-left, .ice-tap-zone-right {
  position: absolute; top: 0; bottom: 0; width: 35%; z-index: 5;
}
.ice-tap-zone-left { left: 0; }
.ice-tap-zone-right { right: 0; }
.ice-slide {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; justify-content: center; align-items: center;
  padding: 60px 32px 100px;
  text-align: center;
  opacity: 0; pointer-events: none;
  transition: opacity 0.3s ease;
}
.ice-slide.active { opacity: 1; pointer-events: auto; }
.ice-slide-emoji { font-size: 80px; margin-bottom: 16px; line-height: 1; }
.ice-slide-title {
  font-size: 28px; font-weight: 800; color: white;
  margin-bottom: 12px; line-height: 1.2;
}
.ice-slide-subtitle {
  font-size: 16px; color: rgba(255,255,255,0.85);
  line-height: 1.5; margin-bottom: 16px;
}
.ice-slide-list {
  list-style: none; padding: 0; margin: 16px 0 0 0; text-align: left;
  color: rgba(255,255,255,0.95); font-size: 15px;
}
.ice-slide-list li { padding: 6px 0; line-height: 1.4; }
.ice-slide-card {
  background: rgba(255,255,255,0.15); backdrop-filter: blur(10px);
  border-radius: 16px; padding: 14px 18px;
  border: 1px solid rgba(255,255,255,0.2);
  color: white; font-size: 14px; line-height: 1.5;
  margin-top: 12px; max-width: 100%; word-wrap: break-word;
}
.ice-slide-pre {
  background: rgba(0,0,0,0.3); border-radius: 12px;
  padding: 10px 14px; font-family: 'JetBrains Mono', Menlo, monospace;
  font-size: 12px; color: white; white-space: pre; text-align: left;
  max-width: 100%; overflow-x: auto;
  margin-top: 16px;
}
.ice-slide-table {
  width: 100%; border-collapse: collapse; color: white; font-size: 13px;
}
.ice-slide-table th, .ice-slide-table td {
  padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,0.15);
  text-align: left;
}
.ice-slide-table th { font-weight: 600; color: rgba(255,255,255,0.7); }
.ice-slide-cta {
  position: absolute; bottom: 30px; left: 32px; right: 32px;
  display: flex; flex-direction: column; gap: 10px;
}
.ice-btn-primary {
  width: 100%; padding: 14px 20px;
  background: white; color: #0c4a6e;
  border: 0; border-radius: 14px;
  font-size: 16px; font-weight: 700;
  cursor: pointer; transition: transform 0.1s;
}
.ice-btn-primary:active { transform: scale(0.98); }
.ice-btn-secondary {
  width: 100%; padding: 12px 20px;
  background: rgba(255,255,255,0.15); color: white;
  border: 1px solid rgba(255,255,255,0.3); border-radius: 14px;
  font-size: 14px; font-weight: 600;
  cursor: pointer;
}
.ice-btn-text {
  background: transparent; border: 0; color: rgba(255,255,255,0.7);
  font-size: 13px; cursor: pointer; padding: 6px;
}
.ice-next-hint {
  position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%);
  color: rgba(255,255,255,0.6); font-size: 12px;
  animation: icePulse 2s infinite;
}
@keyframes icePulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
`;

  function injectStyles() {
    if (document.getElementById('ice-onboarding-styles')) return;
    const s = document.createElement('style');
    s.id = 'ice-onboarding-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  // =====================================================================
  // 2. КОНТЕНТ СЛАЙДОВ
  // =====================================================================
  const SLIDES = [
    {
      emoji: '👋',
      title: 'Привет! Мы — ICE LOGIX 🧊',
      subtitle: 'Покупаем за тебя на Poizon, Dewu, Taobao, Zalando, ASOS и других площадках мира',
      bg: 'linear-gradient(135deg, #0c4a6e 0%, #155e75 50%, #0e7490 100%)',
    },
    {
      emoji: '🛍️',
      title: 'Ты выбираешь — мы покупаем',
      subtitle: '',
      bg: 'linear-gradient(135deg, #0c4a6e 0%, #1e40af 100%)',
      list: [
        '🔗 Скидываешь нам ссылку на товар',
        '📦 Мы покупаем, проверяем, отправляем домой',
        '💰 Платишь только итоговую цену — без сюрпризов',
      ],
    },
    {
      emoji: '🌍',
      title: 'География — 4 страны на старте',
      subtitle: '',
      bg: 'linear-gradient(135deg, #134e4a 0%, #0f766e 100%)',
      list: [
        '🇨🇳 <b>Китай</b> — Poizon, Dewu, Taobao, 1688, Tmall',
        '🇵🇱🇪🇺 <b>Польша / ЕС</b> — Zalando, ASOS, About You, H&M',
        '🇷🇺 <b>Россия</b> — Lamoda, WB, Ozon, Avito, ЦУМ',
      ],
      card: '🕒 США, Япония, Корея, ОАЭ, Турция, Вьетнам — <b>скоро будем доставлять</b>',
    },
    {
      emoji: '🔎',
      title: 'Шаг 1: Найди товар',
      subtitle: '',
      bg: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)',
      list: [
        '🛒 Открой нужный магазин (например, Poizon)',
        '📋 Скопируй ссылку на товар',
        '💬 В нашем боте нажми «Новый заказ»',
      ],
      card: '💡 <i>Можно пользоваться калькулятором без регистрации, чтобы прикинуть цену.</i>',
    },
    {
      emoji: '💰',
      title: 'Шаг 2: Получи цену',
      subtitle: '',
      bg: 'linear-gradient(135deg, #14532d 0%, #15803d 100%)',
      list: [
        '🤖 Бот посчитает: цена + доставка + комиссия — всё включено',
        '👀 Сразу видишь полную разбивку',
        '💵 Цена в BYN (1 BYN = 1 ICE)',
      ],
      pre: `📦 Цена товара:        281 BYN
✈️ Доставка ShopbyShop: 42 BYN
🤝 Наша комиссия:       58 BYN
═══════════════════════════
💵 ИТОГО:              381 BYN`,
    },
    {
      emoji: '💳',
      title: 'Шаг 3: Оплати',
      subtitle: '',
      bg: 'linear-gradient(135deg, #581c87 0%, #7e22ce 100%)',
      list: [
        '🏦 Карта (bePaid — Visa/Mastercard/Belkart)',
        '📱 ExpressPay (банковские приложения)',
        '🏛️ ЕРИП — поиск «ICE LOGIX»',
        '⭐ Telegram Stars',
        '🧊 Айсами с баланса (до 50% от заказа)',
      ],
      card: '💡 <i>Предоплата 75%, остаток — после прибытия товара на наш склад.</i>',
    },
    {
      emoji: '🧊',
      title: 'Что такое айсы (ICE)',
      subtitle: 'Внутренняя валюта сервиса',
      bg: 'linear-gradient(135deg, #0c4a6e 0%, #06b6d4 100%)',
      list: [
        '⚖️ <b>1 BYN = 1 ICE</b> — простой курс',
        '💸 Копейки = дробные ICE (0.5 ICE = 50 копеек)',
        '🎁 Получаешь айсы за каждый заказ (кэшбэк)',
        '💰 Тратишь на следующие заказы — до 50% от цены',
      ],
      card: '<b>Источники айсов:</b> ✅ кэшбэк, 👥 рефералы, ⭐ отзывы, 🎉 акции',
    },
    {
      emoji: '📈',
      title: 'Уровни клиентов',
      subtitle: 'Чем больше заказов — тем выгоднее',
      bg: 'linear-gradient(135deg, #831843 0%, #be185d 100%)',
      table: [
        ['Уровень', 'Заказов', 'Бонус'],
        ['🆕 Новичок', '1-3', 'Стандарт'],
        ['🛍️ Шопоголик', '4-10', '−10% комиссия'],
        ['💎 VIP', '11+', '−20% + приоритет'],
      ],
    },
    {
      emoji: '⏰',
      title: 'Сколько ждать',
      subtitle: '',
      bg: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)',
      list: [
        '🇨🇳 <b>Китай</b>: 10-15 дней (быстрая) или 30-45 (морем)',
        '🇵🇱🇪🇺 <b>Польша / ЕС</b>: 5-10 дней',
        '🇷🇺 <b>Россия</b>: 3-7 дней',
      ],
      card: '⚠️ <i>Сроки — рабочие дни. Считаем с момента поступления товара на склад партнёра ShopbyShop.</i>',
    },
    {
      emoji: '🚀',
      title: 'Поехали!',
      subtitle: 'Готов сделать первый заказ?',
      bg: 'linear-gradient(135deg, #0e7490 0%, #06b6d4 60%, #22d3ee 100%)',
      list: [
        '⚡ Регистрация за 30 секунд',
        '🎁 Приветственный бонус: 15 ICE на баланс',
        '🧮 Калькулятор работает без регистрации',
      ],
      cta: [
        { type: 'primary', text: '✨ Сделать первый заказ', action: 'newOrder' },
        { type: 'secondary', text: '🧮 Сначала посчитать', action: 'calculator' },
        { type: 'text', text: 'Закрыть', action: 'close' },
      ],
    },
  ];

  // =====================================================================
  // 3. СОСТОЯНИЕ + РЕНДЕР
  // =====================================================================
  const SLIDE_DURATION_MS = 5000;
  let currentIndex = 0;
  let progressTimer = null;
  let progressStartTs = 0;
  let progressElapsed = 0;
  let isPaused = false;
  let overlayEl = null;

  function getEl(sel) { return overlayEl?.querySelector(sel); }

  function renderOverlay() {
    injectStyles();
    if (overlayEl) return; // уже открыт
    currentIndex = 0;

    const overlay = document.createElement('div');
    overlay.className = 'ice-stories-overlay';
    overlay.innerHTML = `
      <div class="ice-story-frame" id="iceStoryFrame">
        <div class="ice-progress-container">
          ${SLIDES.map((_, i) => `
            <div class="ice-progress-bar"><div class="ice-progress-fill" data-slide="${i}"></div></div>
          `).join('')}
        </div>
        <button class="ice-close-btn" id="iceCloseBtn" aria-label="Закрыть">✕</button>
        <div class="ice-tap-zone-left" id="iceZoneLeft"></div>
        <div class="ice-tap-zone-right" id="iceZoneRight"></div>
        ${SLIDES.map((s, i) => renderSlide(s, i)).join('')}
      </div>
    `;
    document.body.appendChild(overlay);
    overlayEl = overlay;

    getEl('#iceCloseBtn').addEventListener('click', closeOverlay);
    getEl('#iceZoneLeft').addEventListener('click', () => goTo(currentIndex - 1));
    getEl('#iceZoneRight').addEventListener('click', () => goTo(currentIndex + 1));

    const frame = getEl('#iceStoryFrame');
    frame.addEventListener('mousedown', pause);
    frame.addEventListener('touchstart', pause, { passive: true });
    frame.addEventListener('mouseup', resume);
    frame.addEventListener('touchend', resume);
    frame.addEventListener('mouseleave', resume);

    overlay.querySelectorAll('[data-cta]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const action = btn.dataset.cta;
        if (action === 'close') closeOverlay();
        else if (action === 'newOrder') {
          closeOverlay();
          if (window.switchTab) window.switchTab('neworder');
        } else if (action === 'calculator') {
          closeOverlay();
          if (window.switchTab) window.switchTab('calc');
        }
      });
    });

    document.addEventListener('keydown', onKey);
    goTo(0);
  }

  function renderSlide(s, idx) {
    const listHtml = s.list ? `<ul class="ice-slide-list">${s.list.map(item => `<li>${item}</li>`).join('')}</ul>` : '';
    const cardHtml = s.card ? `<div class="ice-slide-card">${s.card}</div>` : '';
    const preHtml = s.pre ? `<div class="ice-slide-pre">${s.pre}</div>` : '';
    let tableHtml = '';
    if (s.table) {
      const [header, ...rows] = s.table;
      tableHtml = `<div class="ice-slide-card" style="padding:8px 10px;"><table class="ice-slide-table"><thead><tr>${header.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    const ctaHtml = s.cta
      ? `<div class="ice-slide-cta">${s.cta.map(c => {
          const cls = c.type === 'primary' ? 'ice-btn-primary' : c.type === 'secondary' ? 'ice-btn-secondary' : 'ice-btn-text';
          return `<button class="${cls}" data-cta="${c.action}">${c.text}</button>`;
        }).join('')}</div>`
      : `<div class="ice-next-hint">Тап для следующего →</div>`;

    const subtitleHtml = s.subtitle ? `<p class="ice-slide-subtitle">${s.subtitle}</p>` : '';

    return `
      <div class="ice-slide" data-slide="${idx}" style="background: ${s.bg};">
        <div class="ice-slide-emoji">${s.emoji}</div>
        <h2 class="ice-slide-title">${s.title}</h2>
        ${subtitleHtml}
        ${listHtml}
        ${cardHtml}
        ${preHtml}
        ${tableHtml}
        ${ctaHtml}
      </div>
    `;
  }

  function goTo(index) {
    if (!overlayEl) return;
    if (index < 0) { currentIndex = 0; return; }
    if (index >= SLIDES.length) { closeOverlay(); return; }
    currentIndex = index;
    overlayEl.querySelectorAll('.ice-slide').forEach(el => el.classList.remove('active'));
    overlayEl.querySelector(`.ice-slide[data-slide="${index}"]`)?.classList.add('active');
    overlayEl.querySelectorAll('.ice-progress-fill').forEach((el, i) => {
      if (i < index) { el.style.width = '100%'; el.classList.add('complete'); }
      else { el.style.width = '0%'; el.classList.remove('complete'); }
    });
    startProgress();
  }

  function startProgress() {
    stopProgress();
    progressStartTs = Date.now();
    progressElapsed = 0;
    const fill = overlayEl?.querySelector(`.ice-progress-fill[data-slide="${currentIndex}"]`);
    const tick = () => {
      if (isPaused || !overlayEl) return;
      const now = Date.now();
      progressElapsed += now - progressStartTs;
      progressStartTs = now;
      const pct = Math.min(100, (progressElapsed / SLIDE_DURATION_MS) * 100);
      if (fill) fill.style.width = `${pct}%`;
      if (pct >= 100) { stopProgress(); goTo(currentIndex + 1); return; }
      progressTimer = requestAnimationFrame(tick);
    };
    progressTimer = requestAnimationFrame(tick);
  }
  function stopProgress() {
    if (progressTimer) { cancelAnimationFrame(progressTimer); progressTimer = null; }
  }

  function pause() { isPaused = true; }
  function resume() {
    if (isPaused) { isPaused = false; progressStartTs = Date.now(); startProgress(); }
  }

  function onKey(e) {
    if (e.key === 'Escape') closeOverlay();
    else if (e.key === 'ArrowRight') goTo(currentIndex + 1);
    else if (e.key === 'ArrowLeft') goTo(currentIndex - 1);
  }

  function closeOverlay() {
    stopProgress();
    document.removeEventListener('keydown', onKey);
    overlayEl?.remove();
    overlayEl = null;
    try { localStorage.setItem('ice_onboarding_shown', '1'); } catch (_e) {}
  }

  // =====================================================================
  // 4. ЭКСПОРТ
  // =====================================================================
  global.iceLogixOnboarding = {
    open: renderOverlay,
    close: closeOverlay,
    hasBeenShown: () => {
      try { return localStorage.getItem('ice_onboarding_shown') === '1'; } catch (_e) { return false; }
    },
    reset: () => { try { localStorage.removeItem('ice_onboarding_shown'); } catch (_e) {} },
    version: '2026.05.08.01',
  };

})(typeof window !== 'undefined' ? window : globalThis);
