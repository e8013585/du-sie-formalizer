(function (global) {
  'use strict';

  const MODEL = 'claude-sonnet-4-20250514';
  const API_URL = 'https://api.anthropic.com/v1/messages';
  const API_VERSION = '2023-06-01';

  const SYSTEM_PROMPT = `You are an expert German language specialist focusing on register and formality conversion. Your task is to rewrite German text, converting between informal (Du-form) and formal (Sie-form) address.

Rules you must follow precisely:
- Convert ALL second-person pronouns accurately: Du → Sie, dich → Sie, dir → Ihnen, dein/deine/deinen/deinem/deiner → Ihr/Ihre/Ihren/Ihrem/Ihrer (and vice versa for Sie→Du).
- Convert ALL corresponding verb conjugations correctly. German verb forms change with the pronoun — never apply pronoun substitution without also fixing the verb.
- Convert imperative forms correctly: informal imperatives (Mach!, Komm!, Schreib!) must become formal imperatives (Machen Sie!, Kommen Sie!, Schreiben Sie!) and vice versa.
- Convert possessive pronouns in all cases (nominative, accusative, dative, genitive) accurately.
- Preserve the original meaning, sentence structure, punctuation, paragraph breaks, and formatting exactly. Do not add, remove, or rephrase content beyond what is required for the register change.
- If the text contains mixed Du and Sie (inconsistent register), normalize it entirely to the target register.
- Do not translate the text into another language.
- Do not add explanations, notes, or any text that was not in the original. Return ONLY the converted German text.`;

  function buildUserPrompt(text, mode, intensity) {
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

  function likelyNotGerman(text) {
    const sample = text.slice(0, 100).toLowerCase();
    const germanWords = ['der', 'die', 'das', 'und', 'ist', 'sie', 'du', 'ich', 'nicht', 'mit', 'auf'];
    return !germanWords.some(w => {
      const re = new RegExp(`(^|[^a-zäöüß])${w}([^a-zäöüß]|$)`);
      return re.test(sample);
    });
  }

  function statusToErrorKey(status) {
    if (status === 401) return 'errorInvalidKey';
    if (status === 429) return 'errorRateLimit';
    if (status === 500 || status === 529) return 'errorApiServer';
    return 'errorUnknown';
  }

  function callDuSieAPI({ text, mode, intensity, apiKey, onChunk, onDone, onError, onNotGerman }) {
    const controller = new AbortController();

    if (!apiKey) {
      onError(chrome.i18n.getMessage('errorNoKey'));
      return controller;
    }

    if (likelyNotGerman(text) && typeof onNotGerman === 'function') {
      onNotGerman();
    }

    const userPrompt = buildUserPrompt(text, mode, intensity);

    const body = JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      stream: true,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }]
    });

    (async () => {
      let response;
      try {
        response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': API_VERSION,
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body,
          signal: controller.signal
        });
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        onError(chrome.i18n.getMessage('errorNetwork'));
        return;
      }

      if (!response.ok) {
        onError(chrome.i18n.getMessage(statusToErrorKey(response.status)));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullText = '';
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            if (!trimmed.startsWith('data:')) continue;

            const jsonStr = trimmed.slice(5).trim();
            let parsed;
            try {
              parsed = JSON.parse(jsonStr);
            } catch (_) {
              continue;
            }

            if (parsed.type === 'content_block_delta' && parsed.delta && parsed.delta.type === 'text_delta') {
              const chunk = parsed.delta.text || '';
              fullText += chunk;
              onChunk(chunk);
            } else if (parsed.type === 'message_stop') {
            } else if (parsed.type === 'error') {
              const msg = (parsed.error && parsed.error.message) ? parsed.error.message : chrome.i18n.getMessage('errorUnknown');
              onError(msg);
              return;
            }
          }
        }
        if (buffer.trim()) {
          const trimmed = buffer.trim();
          if (trimmed.startsWith('data:')) {
            const jsonStr = trimmed.slice(5).trim();
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.type === 'content_block_delta' && parsed.delta && parsed.delta.type === 'text_delta') {
                const chunk = parsed.delta.text || '';
                fullText += chunk;
                onChunk(chunk);
              }
            } catch (_) { }
          }
        }
        onDone(fullText);
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        onError(chrome.i18n.getMessage('errorNetwork'));
      }
    })();

    return controller;
  }

  async function callDuSieAPIOnce({ text, mode, intensity, apiKey }) {
    if (!apiKey) throw new Error('errorNoKey');

    const userPrompt = buildUserPrompt(text, mode, intensity);

    const body = JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      stream: false,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }]
    });

    let response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': API_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body
      });
    } catch (_) {
      throw new Error('errorNetwork');
    }

    if (!response.ok) {
      throw new Error(statusToErrorKey(response.status));
    }

    let data;
    try {
      data = await response.json();
    } catch (_) {
      throw new Error('errorUnknown');
    }

    const content = data && data.content && data.content[0];
    if (!content || content.type !== 'text') {
      throw new Error('errorUnknown');
    }
    return content.text;
  }

  global.callDuSieAPI = callDuSieAPI;
  global.callDuSieAPIOnce = callDuSieAPIOnce;
  global.likelyNotGerman = likelyNotGerman;
  global.DS_MODEL = MODEL;

}(typeof window !== 'undefined' ? window : self));
