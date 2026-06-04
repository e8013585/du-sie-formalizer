(function () {
  'use strict';

  if (window.__duSieFormalizerInjected) return;
  window.__duSieFormalizerInjected = true;

  let floatingCard = null;
  let dismissTimer = null;
  let currentSelectionRange = null;
  let currentOriginalText = '';
  let currentConvertedText = '';
  let currentMode = '';

  document.addEventListener('mousedown', (e) => {
    if (e.button === 2) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && sel.toString().trim()) {
        currentSelectionRange = sel.getRangeAt(0).cloneRange();
      }
    }
  }, true);

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'showLoading') {
      currentMode = message.mode || 'du_to_sie';
      currentOriginalText = '';
      currentConvertedText = '';
      showFloatingCard({ loading: true });
    } else if (message.action === 'showResult') {
      currentMode = message.mode || 'du_to_sie';
      currentOriginalText = message.originalText || '';
      currentConvertedText = message.convertedText || '';
      showFloatingCard({ loading: false, text: currentConvertedText });
    } else if (message.action === 'showError') {
      currentMode = message.mode || 'du_to_sie';
      currentOriginalText = message.originalText || '';
      currentConvertedText = '';
      showFloatingCard({ loading: false, error: message.error });
    }
    sendResponse({ received: true });
  });

  function injectStyles() {
    if (document.getElementById('dusie-styles')) return;
    const style = document.createElement('style');
    style.id = 'dusie-styles';
    style.textContent = `
      #dusie-floating-card {
        position: fixed;
        z-index: 2147483647;
        width: 320px;
        max-width: calc(100vw - 24px);
        background: #ffffff;
        border: 1.5px solid #1A2C5B;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(26,44,91,0.18), 0 2px 8px rgba(0,0,0,0.10);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        color: #1a1a2e;
        overflow: hidden;
        user-select: none;
      }
      @media (prefers-color-scheme: dark) {
        #dusie-floating-card {
          background: #161B22;
          border-color: #C9A84C;
          color: #e6edf3;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        }
      }
      #dusie-floating-card .dusie-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #1A2C5B;
        color: #ffffff;
        padding: 8px 12px;
        cursor: move;
        border-radius: 10px 10px 0 0;
      }
      #dusie-floating-card .dusie-header-title {
        font-weight: 600;
        font-size: 13px;
        letter-spacing: 0.02em;
      }
      #dusie-floating-card .dusie-header-badge {
        font-size: 11px;
        background: #C9A84C;
        color: #1A2C5B;
        border-radius: 4px;
        padding: 1px 6px;
        font-weight: 700;
      }
      #dusie-floating-card .dusie-body {
        padding: 12px;
        user-select: text;
      }
      #dusie-floating-card .dusie-output-box {
        background: #F4F4F8;
        border: 1px solid #dde1ea;
        border-radius: 6px;
        padding: 8px 10px;
        max-height: 150px;
        overflow-y: auto;
        font-size: 13px;
        line-height: 1.5;
        color: #1a1a2e;
        direction: ltr;
        text-align: left;
        white-space: pre-wrap;
        word-break: break-word;
        margin-bottom: 10px;
        user-select: text;
      }
      @media (prefers-color-scheme: dark) {
        #dusie-floating-card .dusie-output-box {
          background: #0D1117;
          border-color: #30363d;
          color: #e6edf3;
        }
      }
      #dusie-floating-card .dusie-spinner {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #1A2C5B;
        font-size: 13px;
        padding: 8px 0;
      }
      @media (prefers-color-scheme: dark) {
        #dusie-floating-card .dusie-spinner { color: #C9A84C; }
      }
      #dusie-floating-card .dusie-spinner-dot {
        width: 18px;
        height: 18px;
        border: 2.5px solid #1A2C5B;
        border-top-color: transparent;
        border-radius: 50%;
        animation: dusie-spin 0.75s linear infinite;
        flex-shrink: 0;
      }
      @media (prefers-color-scheme: dark) {
        #dusie-floating-card .dusie-spinner-dot { border-color: #C9A84C; border-top-color: transparent; }
      }
      @keyframes dusie-spin {
        to { transform: rotate(360deg); }
      }
      #dusie-floating-card .dusie-error-box {
        color: #c0392b;
        background: #fff0f0;
        border: 1px solid #f5c6c6;
        border-radius: 6px;
        padding: 8px 10px;
        font-size: 13px;
        margin-bottom: 10px;
      }
      @media (prefers-color-scheme: dark) {
        #dusie-floating-card .dusie-error-box {
          background: #2d1b1b;
          border-color: #7a3030;
          color: #ff8080;
        }
      }
      #dusie-floating-card .dusie-actions {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      #dusie-floating-card .dusie-btn {
        flex: 1;
        min-width: 70px;
        padding: 7px 10px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: opacity 0.15s, transform 0.1s;
        outline: none;
      }
      #dusie-floating-card .dusie-btn:hover { opacity: 0.85; }
      #dusie-floating-card .dusie-btn:active { transform: scale(0.97); }
      #dusie-floating-card .dusie-btn:focus-visible {
        outline: 2px solid #C9A84C;
        outline-offset: 2px;
      }
      #dusie-floating-card .dusie-btn-primary {
        background: #1A2C5B;
        color: #ffffff;
      }
      #dusie-floating-card .dusie-btn-secondary {
        background: #e8eaf0;
        color: #1A2C5B;
      }
      @media (prefers-color-scheme: dark) {
        #dusie-floating-card .dusie-btn-secondary {
          background: #30363d;
          color: #e6edf3;
        }
      }
      #dusie-floating-card .dusie-btn-dismiss {
        background: transparent;
        color: #888;
        border: 1px solid #ccc;
        flex: 0 0 auto;
      }
      @media (prefers-color-scheme: dark) {
        #dusie-floating-card .dusie-btn-dismiss {
          color: #8b949e;
          border-color: #30363d;
        }
      }
      #dusie-floating-card .dusie-btn-dismiss:hover { color: #333; }
      @media (prefers-color-scheme: dark) {
        #dusie-floating-card .dusie-btn-dismiss:hover { color: #e6edf3; }
      }
      #dusie-floating-card .dusie-unavailable-msg {
        font-size: 11px;
        color: #888;
        margin-top: 6px;
        text-align: center;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function removeFloatingCard() {
    if (floatingCard) {
      floatingCard.remove();
      floatingCard = null;
    }
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
  }

  function getCardPosition() {
    let rect = null;
    if (currentSelectionRange) {
      rect = currentSelectionRange.getBoundingClientRect();
    } else {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        rect = sel.getRangeAt(0).getBoundingClientRect();
      }
    }

    const cardWidth = 320;
    const cardHeight = 250;
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top, left;

    if (rect) {
      if (rect.bottom + cardHeight + margin <= vh) {
        top = rect.bottom + window.scrollY + margin;
      } else {
        top = rect.top + window.scrollY - cardHeight - margin;
      }
      left = rect.left + window.scrollX;
    } else {
      top = vh / 2 - cardHeight / 2 + window.scrollY;
      left = vw / 2 - cardWidth / 2;
    }

    left = Math.max(margin, Math.min(left, vw - cardWidth - margin));
    top = Math.max(window.scrollY + margin, top);

    return { top, left };
  }

  function showFloatingCard({ loading, text, error }) {
    injectStyles();
    removeFloatingCard();

    const card = document.createElement('div');
    card.id = 'dusie-floating-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'false');

    const pos = getCardPosition();
    card.style.top = pos.top + 'px';
    card.style.left = pos.left + 'px';

    const header = document.createElement('div');
    header.className = 'dusie-header';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'dusie-header-title';
    titleSpan.textContent = chrome.i18n.getMessage('floatingCardTitle');

    const badgeSpan = document.createElement('span');
    badgeSpan.className = 'dusie-header-badge';
    badgeSpan.textContent = currentMode === 'du_to_sie' ? 'Du→Sie' : 'Sie→Du';

    header.appendChild(titleSpan);
    header.appendChild(badgeSpan);

    const body = document.createElement('div');
    body.className = 'dusie-body';

    let outputBox = null;
    let unavailableMsg = null;

    if (loading) {
      const spinner = document.createElement('div');
      spinner.className = 'dusie-spinner';
      const dot = document.createElement('div');
      dot.className = 'dusie-spinner-dot';
      const label = document.createElement('span');
      label.textContent = chrome.i18n.getMessage('floatingCardLoading');
      spinner.appendChild(dot);
      spinner.appendChild(label);
      body.appendChild(spinner);

      const actions = document.createElement('div');
      actions.className = 'dusie-actions';
      const dismissBtn = makeButton('dusie-btn dusie-btn-dismiss', chrome.i18n.getMessage('floatingDismissButton'), removeFloatingCard);
      actions.appendChild(dismissBtn);
      body.appendChild(actions);

    } else if (error) {
      const errBox = document.createElement('div');
      errBox.className = 'dusie-error-box';
      const prefix = chrome.i18n.getMessage('floatingErrorPrefix');
      errBox.textContent = prefix + ' ' + error;
      body.appendChild(errBox);

      const actions = document.createElement('div');
      actions.className = 'dusie-actions';

      const retryBtn = makeButton('dusie-btn dusie-btn-primary', chrome.i18n.getMessage('floatingRetryButton'), () => {
        if (currentOriginalText) {
          removeFloatingCard();
          showFloatingCard({ loading: true });
          retryConversion();
        }
      });
      const dismissBtn = makeButton('dusie-btn dusie-btn-dismiss', chrome.i18n.getMessage('floatingDismissButton'), removeFloatingCard);
      actions.appendChild(retryBtn);
      actions.appendChild(dismissBtn);
      body.appendChild(actions);

    } else {
      outputBox = document.createElement('div');
      outputBox.className = 'dusie-output-box';
      outputBox.textContent = text || '';
      body.appendChild(outputBox);

      const actions = document.createElement('div');
      actions.className = 'dusie-actions';

      const replaceBtn = makeButton('dusie-btn dusie-btn-primary', chrome.i18n.getMessage('floatingReplaceButton'), () => {
        const success = replaceSelection(text || '');
        if (!success) {
          if (!unavailableMsg) {
            unavailableMsg = document.createElement('div');
            unavailableMsg.className = 'dusie-unavailable-msg';
            unavailableMsg.textContent = chrome.i18n.getMessage('floatingReplaceUnavailable');
            body.appendChild(unavailableMsg);
          }
        } else {
          removeFloatingCard();
        }
      });

      const copyBtn = makeButton('dusie-btn dusie-btn-secondary', chrome.i18n.getMessage('floatingCopyButton'), () => {
        navigator.clipboard.writeText(text || '').then(() => {
          copyBtn.textContent = chrome.i18n.getMessage('floatingCopiedButton');
          setTimeout(() => {
            copyBtn.textContent = chrome.i18n.getMessage('floatingCopyButton');
          }, 1500);
        }).catch(() => { });
      });

      const dismissBtn = makeButton('dusie-btn dusie-btn-dismiss', chrome.i18n.getMessage('floatingDismissButton'), removeFloatingCard);

      actions.appendChild(replaceBtn);
      actions.appendChild(copyBtn);
      actions.appendChild(dismissBtn);
      body.appendChild(actions);
    }

    card.appendChild(header);
    card.appendChild(body);
    document.documentElement.appendChild(card);
    floatingCard = card;

    dismissTimer = setTimeout(removeFloatingCard, 30000);

    makeDraggable(card, header);
  }

  function makeButton(className, text, onClick) {
    const btn = document.createElement('button');
    btn.className = className;
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function replaceSelection(newText) {
    if (currentSelectionRange) {
      try {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(currentSelectionRange);
      } catch (_) { }
    }

    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(newText);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return true;
      }
    } catch (_) { }

    try {
      if (document.execCommand('insertText', false, newText)) {
        return true;
      }
    } catch (_) { }

    return false;
  }

  async function retryConversion() {
    chrome.storage.local.get(['apiKey', 'toneIntensity'], async (data) => {
      const apiKey = data.apiKey || '';
      const intensity = data.toneIntensity || 'standard';
      if (!apiKey || !currentOriginalText) {
        showFloatingCard({ loading: false, error: chrome.i18n.getMessage('errorNoKey') });
        return;
      }
      try {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2048,
            stream: false,
            system: buildSystemPrompt(),
            messages: [{ role: 'user', content: buildUserPromptLocal(currentOriginalText, currentMode, intensity) }]
          })
        });
        if (!resp.ok) {
          throw new Error(resp.status === 401 ? 'errorInvalidKey' : resp.status === 429 ? 'errorRateLimit' : 'errorApiServer');
        }
        const d = await resp.json();
        const txt = d && d.content && d.content[0] && d.content[0].text;
        if (!txt) throw new Error('errorUnknown');
        currentConvertedText = txt;
        showFloatingCard({ loading: false, text: txt });
      } catch (err) {
        const key = (err && err.message) ? err.message : 'errorUnknown';
        const msg = chrome.i18n.getMessage(key) || chrome.i18n.getMessage('errorUnknown');
        showFloatingCard({ loading: false, error: msg });
      }
    });
  }

  function buildSystemPrompt() {
    return `You are an expert German language specialist focusing on register and formality conversion. Your task is to rewrite German text, converting between informal (Du-form) and formal (Sie-form) address.

Rules you must follow precisely:
- Convert ALL second-person pronouns accurately: Du → Sie, dich → Sie, dir → Ihnen, dein/deine/deinen/deinem/deiner → Ihr/Ihre/Ihren/Ihrem/Ihrer (and vice versa for Sie→Du).
- Convert ALL corresponding verb conjugations correctly. German verb forms change with the pronoun — never apply pronoun substitution without also fixing the verb.
- Convert imperative forms correctly: informal imperatives (Mach!, Komm!, Schreib!) must become formal imperatives (Machen Sie!, Kommen Sie!, Schreiben Sie!) and vice versa.
- Convert possessive pronouns in all cases (nominative, accusative, dative, genitive) accurately.
- Preserve the original meaning, sentence structure, punctuation, paragraph breaks, and formatting exactly. Do not add, remove, or rephrase content beyond what is required for the register change.
- If the text contains mixed Du and Sie (inconsistent register), normalize it entirely to the target register.
- Do not translate the text into another language.
- Do not add explanations, notes, or any text that was not in the original. Return ONLY the converted German text.`;
  }

  function buildUserPromptLocal(text, mode, intensity) {
    let prompt;
    if (mode === 'du_to_sie') {
      prompt = `Konvertiere den folgenden deutschen Text von Du-Form zu Sie-Form:\n\n${text}`;
      if (intensity === 'polished') {
        prompt += '\n\nVerbessere zusätzlich den Satzfluss und entferne umgangssprachliche Ausdrücke, die über die Du/Sie-Umstellung hinausgehen.';
      } else if (intensity === 'strict_corporate') {
        prompt += '\n\nMaximiere die Formalität: Entferne alle Kontraktionen, verwende den höchsten Grad an geschäftlicher Förmlichkeit und schlage am Ende in eckigen Klammern eine formale Anredeformel vor, falls der Text eine Anrede benötigt.';
      }
    } else {
      prompt = `Konvertiere den folgenden deutschen Text von Sie-Form zu Du-Form:\n\n${text}`;
      if (intensity === 'polished') {
        prompt += '\n\nPasse den Ton zusätzlich an einen modernen, freundlichen Startup-Stil an.';
      }
    }
    return prompt;
  }

  function makeDraggable(card, handle) {
    let startX, startY, startLeft, startTop;
    let dragging = false;

    handle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(card.style.left, 10) || 0;
      startTop = parseInt(card.style.top, 10) || 0;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cardW = card.offsetWidth;
      const cardH = card.offsetHeight;
      let newLeft = startLeft + dx;
      let newTop = startTop + dy;
      newLeft = Math.max(0, Math.min(newLeft, vw - cardW));
      newTop = Math.max(window.scrollY, Math.min(newTop, window.scrollY + vh - cardH));
      card.style.left = newLeft + 'px';
      card.style.top = newTop + 'px';
    });

    document.addEventListener('mouseup', () => {
      dragging = false;
    });
  }

})();
