(function () {
  'use strict';

  const uiLang = chrome.i18n.getUILanguage().toLowerCase().split('-')[0];
  const RTL_LANGS = ['ar', 'he', 'fa', 'ur'];
  if (RTL_LANGS.includes(uiLang)) {
    document.body.setAttribute('dir', 'rtl');
  }

  function t(key, subs) {
    if (subs) return chrome.i18n.getMessage(key, subs);
    return chrome.i18n.getMessage(key) || key;
  }

  const $ = id => document.getElementById(id);

  const els = {
    spTitle:             $('spTitle'),
    spSettingsToggle:    $('spSettingsToggle'),
    spSettingsPanel:     $('spSettingsPanel'),
    spApiKeyLabel:       $('spApiKeyLabel'),
    spApiKeyInput:       $('spApiKeyInput'),
    spShowHideKey:       $('spShowHideKey'),
    spKeyBadge:          $('spKeyBadge'),
    spSaveKeyBtn:        $('spSaveKeyBtn'),
    spTestKeyBtn:        $('spTestKeyBtn'),
    spTestResult:        $('spTestResult'),
    spKeyConfirm:        $('spKeyConfirm'),
    spModelLabel:        $('spModelLabel'),
    spModelDisplay:      $('spModelDisplay'),
    spToneLabel:         $('spToneLabel'),
    spToneSelect:        $('spToneSelect'),
    spOptStandard:       $('spOptStandard'),
    spOptPolished:       $('spOptPolished'),
    spOptStrictCorporate:$('spOptStrictCorporate'),
    spModeDuToSie:       $('spModeDuToSie'),
    spModeSieToDu:       $('spModeSieToDu'),
    spNoKeyWarning:      $('spNoKeyWarning'),
    spNoKeyWarningText:  $('spNoKeyWarningText'),
    spNoKeyWarningLink:  $('spNoKeyWarningLink'),
    spNotGermanWarning:  $('spNotGermanWarning'),
    spNotGermanWarningText:$('spNotGermanWarningText'),
    spInputLabel:        $('spInputLabel'),
    spInputTextarea:     $('spInputTextarea'),
    spInputCharCount:    $('spInputCharCount'),
    spConvertBtn:        $('spConvertBtn'),
    spOutputLabel:       $('spOutputLabel'),
    spOutputTextarea:    $('spOutputTextarea'),
    spOutputCharCount:   $('spOutputCharCount'),
    spDiffToggle:        $('spDiffToggle'),
    spDiffView:          $('spDiffView'),
    spDiffInput:         $('spDiffInput'),
    spDiffOutput:        $('spDiffOutput'),
    spDiffInputLabel:    $('spDiffInputLabel'),
    spDiffOutputLabel:   $('spDiffOutputLabel'),
    spCopyBtn:           $('spCopyBtn'),
    spClearBtn:          $('spClearBtn'),
    spHistorySection:    $('spHistorySection'),
    spHistoryToggle:     $('spHistoryToggle'),
    spHistoryTitle:      $('spHistoryTitle'),
    spHistoryClearBtn:   $('spHistoryClearBtn'),
    spHistoryChevron:    $('spHistoryChevron'),
    spHistoryList:       $('spHistoryList'),
  };

  let currentMode = 'du_to_sie';
  let currentIntensity = 'standard';
  let apiKey = '';
  let isConverting = false;
  let activeAbortController = null;
  let settingsOpen = false;
  let diffEnabled = false;
  let historyOpen = false;
  let lastInputText = '';
  let lastOutputText = '';

  function localizeUI() {
    els.spTitle.textContent            = t('sidePanelTitle');
    els.spSettingsToggle.textContent   = t('settingsTitle');
    els.spSettingsToggle.setAttribute('aria-label', t('ariaSettingsToggle'));
    els.spApiKeyLabel.textContent      = t('apiKeyLabel');
    els.spApiKeyInput.placeholder      = t('apiKeyPlaceholder');
    els.spShowHideKey.textContent      = t('showKeyButton');
    els.spSaveKeyBtn.textContent       = t('saveKeyButton');
    els.spTestKeyBtn.textContent       = t('testKeyButton');
    els.spModelLabel.textContent       = t('modelLabel');
    els.spModelDisplay.textContent     = t('modelValue');
    els.spToneLabel.textContent        = t('toneIntensityLabel');
    els.spOptStandard.textContent      = t('toneStandard');
    els.spOptPolished.textContent      = t('tonePolished');
    els.spOptStrictCorporate.textContent = t('toneStrictCorporate');
    els.spModeDuToSie.textContent      = t('modeToggleDuToSie');
    els.spModeSieToDu.textContent      = t('modeToggleSieToDu');
    els.spModeDuToSie.setAttribute('aria-label', t('modeToggleDuToSie'));
    els.spModeSieToDu.setAttribute('aria-label', t('modeToggleSieToDu'));
    els.spNoKeyWarningText.textContent = t('noApiKeyWarning');
    els.spNoKeyWarningLink.textContent = t('noApiKeyWarningLink');
    els.spNotGermanWarningText.textContent = t('mayNotBeGermanWarning');
    els.spInputLabel.textContent       = t('inputLabel');
    els.spInputTextarea.placeholder    = t('inputPlaceholder');
    els.spConvertBtn.textContent       = t('convertButton');
    els.spOutputLabel.textContent      = t('outputLabel');
    els.spOutputTextarea.placeholder   = t('outputPlaceholder');
    els.spDiffToggle.textContent       = t('diffToggleButton');
    els.spDiffToggle.setAttribute('aria-label', t('ariaDiffToggle'));
    els.spCopyBtn.textContent          = t('copyButton');
    els.spCopyBtn.setAttribute('aria-label', t('ariaCopyOutput'));
    els.spClearBtn.textContent         = t('clearButton');
    els.spClearBtn.setAttribute('aria-label', t('ariaClearAll'));
    els.spHistoryTitle.textContent     = t('historyTitle');
    els.spHistoryClearBtn.textContent  = t('historyClearButton');
    els.spDiffInputLabel.textContent   = t('diffInputLabel');
    els.spDiffOutputLabel.textContent  = t('diffOutputLabel');
    updateCharCount(els.spInputTextarea, els.spInputCharCount);
    updateCharCount(els.spOutputTextarea, els.spOutputCharCount);
  }

  function updateCharCount(textarea, countEl) {
    countEl.textContent = t('charactersCount', [String(textarea.value.length)]);
  }

  function setMode(mode) {
    currentMode = mode;
    els.spModeDuToSie.classList.toggle('active', mode === 'du_to_sie');
    els.spModeSieToDu.classList.toggle('active', mode === 'sie_to_du');
    chrome.storage.local.set({ conversionMode: mode });
  }

  function updateKeyBadge(hasKey) {
    els.spKeyBadge.textContent = hasKey ? '✅' : '❌';
    els.spKeyBadge.title = hasKey ? t('keyStatusPresent') : t('keyStatusMissing');
  }

  function updateNoKeyWarning() {
    els.spNoKeyWarning.hidden = !!apiKey;
    updateConvertBtn();
  }

  function updateConvertBtn() {
    const hasInput = els.spInputTextarea.value.trim().length > 0;
    els.spConvertBtn.disabled = !hasInput || !apiKey || isConverting;
  }

  function toggleSettings() {
    settingsOpen = !settingsOpen;
    els.spSettingsPanel.hidden = !settingsOpen;
  }

  function toggleShowHideKey() {
    const isPass = els.spApiKeyInput.type === 'password';
    els.spApiKeyInput.type = isPass ? 'text' : 'password';
    els.spShowHideKey.textContent = isPass ? t('hideKeyButton') : t('showKeyButton');
  }

  function saveApiKey() {
    const val = els.spApiKeyInput.value.trim();
    if (!val) return;
    apiKey = val;
    chrome.storage.local.set({ apiKey: val }, () => {
      updateKeyBadge(true);
      updateNoKeyWarning();
      const masked = val.slice(0, 8) + '...';
      els.spKeyConfirm.textContent = t('keySavedConfirm') + ' ' + masked;
      setTimeout(() => { els.spKeyConfirm.textContent = ''; }, 3000);
    });
  }

  function testApiKey() {
    const keyToTest = els.spApiKeyInput.value.trim() || apiKey;
    if (!keyToTest) { showTestResult('invalid'); return; }
    els.spTestResult.textContent = t('testKeyTesting');
    els.spTestResult.className = 'sp-test-result';
    els.spTestKeyBtn.disabled = true;
    window.callDuSieAPI({
      text: 'Hallo, wie geht es dir?',
      mode: 'du_to_sie',
      intensity: 'standard',
      apiKey: keyToTest,
      onChunk: () => {},
      onDone: () => { showTestResult('valid'); els.spTestKeyBtn.disabled = false; },
      onError: () => { showTestResult('invalid'); els.spTestKeyBtn.disabled = false; }
    });
  }

  function showTestResult(state) {
    els.spTestResult.textContent = state === 'valid' ? t('testKeyValid') : t('testKeyInvalid');
    els.spTestResult.className = 'sp-test-result ' + state;
    setTimeout(() => {
      els.spTestResult.textContent = '';
      els.spTestResult.className = 'sp-test-result';
    }, 4000);
  }

  function startConversion() {
    if (isConverting) { if (activeAbortController) activeAbortController.abort(); return; }
    const inputText = els.spInputTextarea.value.trim();
    if (!inputText || !apiKey) return;

    isConverting = true;
    els.spConvertBtn.textContent = t('converting');
    els.spConvertBtn.disabled = true;
    els.spOutputTextarea.value = '';
    lastOutputText = '';
    updateCharCount(els.spOutputTextarea, els.spOutputCharCount);
    els.spNotGermanWarning.hidden = true;

    if (diffEnabled) {
      els.spDiffView.hidden = true;
      els.spOutputTextarea.hidden = false;
    }

    let fullText = '';

    activeAbortController = window.callDuSieAPI({
      text: inputText,
      mode: currentMode,
      intensity: currentIntensity,
      apiKey,
      onChunk: (chunk) => {
        fullText += chunk;
        els.spOutputTextarea.value = fullText;
        els.spOutputTextarea.scrollTop = els.spOutputTextarea.scrollHeight;
        updateCharCount(els.spOutputTextarea, els.spOutputCharCount);
      },
      onDone: (result) => {
        els.spOutputTextarea.value = result;
        lastInputText = inputText;
        lastOutputText = result;
        updateCharCount(els.spOutputTextarea, els.spOutputCharCount);
        if (diffEnabled) {
          renderDiff(inputText, result);
        }
        saveToHistory(inputText, result);
        finishConversion();
      },
      onError: (errMsg) => {
        els.spOutputTextarea.value = errMsg;
        updateCharCount(els.spOutputTextarea, els.spOutputCharCount);
        finishConversion();
      },
      onNotGerman: () => {
        els.spNotGermanWarning.hidden = false;
      }
    });
  }

  function finishConversion() {
    isConverting = false;
    activeAbortController = null;
    els.spConvertBtn.textContent = t('convertButton');
    updateConvertBtn();
  }

  function copyOutput() {
    const val = els.spOutputTextarea.value;
    if (!val) return;
    navigator.clipboard.writeText(val).then(() => {
      els.spCopyBtn.textContent = t('copiedButton');
      setTimeout(() => { els.spCopyBtn.textContent = t('copyButton'); }, 1500);
    }).catch(() => {});
  }

  function clearAll() {
    if (isConverting && activeAbortController) {
      activeAbortController.abort();
      finishConversion();
    }
    els.spInputTextarea.value = '';
    els.spOutputTextarea.value = '';
    lastInputText = '';
    lastOutputText = '';
    els.spNotGermanWarning.hidden = true;
    updateCharCount(els.spInputTextarea, els.spInputCharCount);
    updateCharCount(els.spOutputTextarea, els.spOutputCharCount);
    updateConvertBtn();
    if (diffEnabled) {
      clearDiff();
    }
  }

  function onIntensityChange() {
    currentIntensity = els.spToneSelect.value;
    chrome.storage.local.set({ toneIntensity: currentIntensity });
  }

  els.spInputTextarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!els.spConvertBtn.disabled) startConversion();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = els.spInputTextarea.selectionStart;
      const end = els.spInputTextarea.selectionEnd;
      const val = els.spInputTextarea.value;
      els.spInputTextarea.value = val.slice(0, start) + '\t' + val.slice(end);
      els.spInputTextarea.selectionStart = els.spInputTextarea.selectionEnd = start + 1;
      updateCharCount(els.spInputTextarea, els.spInputCharCount);
      updateConvertBtn();
    }
  });

  function tokenize(text) {
    const parts = text.split(/(\s+)/);
    return parts.map(p => ({ text: p, isSpace: /^\s+$/.test(p) }));
  }

  function computeLCS(tokA, tokB) {
    const wordsA = tokA.filter(t => !t.isSpace).map(t => t.text);
    const wordsB = tokB.filter(t => !t.isSpace).map(t => t.text);
    const m = wordsA.length;
    const n = wordsB.length;

    const MAX = 500;
    const safeM = Math.min(m, MAX);
    const safeN = Math.min(n, MAX);
    const table = [];
    for (let i = 0; i <= safeM; i++) {
      table.push(new Int16Array(safeN + 1));
    }

    for (let i = 1; i <= safeM; i++) {
      for (let j = 1; j <= safeN; j++) {
        if (wordsA[i - 1] === wordsB[j - 1]) {
          table[i][j] = table[i - 1][j - 1] + 1;
        } else {
          table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
        }
      }
    }

    const lcsA = new Set();
    const lcsB = new Set();
    let i = safeM, j = safeN;
    while (i > 0 && j > 0) {
      if (wordsA[i - 1] === wordsB[j - 1]) {
        lcsA.add(i - 1);
        lcsB.add(j - 1);
        i--; j--;
      } else if (table[i - 1][j] >= table[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    return { wordsA, wordsB, lcsA, lcsB };
  }

  function buildDiffFragment(text, lcsIndices, type) {
    const tokens = tokenize(text);
    const fragment = document.createDocumentFragment();
    let wordIdx = 0;

    for (const token of tokens) {
      if (token.isSpace) {
        fragment.appendChild(document.createTextNode(token.text));
      } else {
        if (lcsIndices.has(wordIdx)) {
          fragment.appendChild(document.createTextNode(token.text));
        } else {
          const span = document.createElement('span');
          span.className = type === 'removed' ? 'sp-diff-removed' : 'sp-diff-added';
          span.textContent = token.text;
          fragment.appendChild(span);
        }
        wordIdx++;
      }
    }
    return fragment;
  }

  function renderDiff(inputText, outputText) {
    const tokA = tokenize(inputText);
    const tokB = tokenize(outputText);

    const { wordsA, wordsB, lcsA, lcsB } = computeLCS(tokA, tokB);

    const inputFrag = buildDiffFragment(inputText, lcsA, 'removed');
    const outputFrag = buildDiffFragment(outputText, lcsB, 'added');

    els.spDiffInput.textContent = '';
    els.spDiffOutput.textContent = '';
    els.spDiffInput.appendChild(inputFrag);
    els.spDiffOutput.appendChild(outputFrag);

    els.spOutputTextarea.hidden = true;
    els.spDiffView.hidden = false;
  }

  function clearDiff() {
    els.spDiffInput.textContent = '';
    els.spDiffOutput.textContent = '';
    els.spDiffView.hidden = true;
    els.spOutputTextarea.hidden = false;
  }

  function toggleDiff() {
    diffEnabled = !diffEnabled;
    els.spDiffToggle.textContent = diffEnabled ? t('diffToggleButtonOff') : t('diffToggleButton');

    if (diffEnabled) {
      if (lastInputText && lastOutputText) {
        renderDiff(lastInputText, lastOutputText);
      }
    } else {
      clearDiff();
    }
  }

  function saveToHistory(inputText, outputText) {
    const entry = {
      timestamp: new Date().toISOString(),
      mode: currentMode,
      intensity: currentIntensity,
      inputPreview: inputText.slice(0, 120),
      inputFull: inputText,
      outputFull: outputText
    };
    chrome.storage.local.get(['conversionHistory'], (data) => {
      let history = data.conversionHistory || [];
      history.unshift(entry);
      if (history.length > 10) history = history.slice(0, 10);
      chrome.storage.local.set({ conversionHistory: history }, () => {
        if (historyOpen) renderHistory(history);
      });
    });
  }

  function renderHistory(history) {
    els.spHistoryList.textContent = '';

    if (!history || history.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sp-history-empty';
      empty.textContent = t('historyEmpty');
      els.spHistoryList.appendChild(empty);
      return;
    }

    history.forEach((entry) => {
      const card = document.createElement('div');
      card.className = 'sp-history-entry';

      const meta = document.createElement('div');
      meta.className = 'sp-history-entry-meta';

      const date = new Date(entry.timestamp);
      const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const dateNode = document.createTextNode(dateStr);
      meta.appendChild(dateNode);

      const badge = document.createElement('span');
      badge.className = 'sp-history-badge';
      badge.textContent = entry.mode === 'du_to_sie' ? t('historyModeDuToSie') : t('historyModeSieToDu');
      meta.appendChild(badge);

      const intensityText = document.createTextNode(
        ' · ' + (
          entry.intensity === 'polished' ? t('historyIntensityPolished') :
          entry.intensity === 'strict_corporate' ? t('historyIntensityStrictCorporate') :
          t('historyIntensityStandard')
        )
      );
      meta.appendChild(intensityText);

      const preview = document.createElement('div');
      preview.className = 'sp-history-preview';
      preview.textContent = entry.inputPreview || '';

      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'sp-btn sp-btn-secondary sp-btn-xs sp-history-restore';
      restoreBtn.textContent = t('historyRestoreButton');
      restoreBtn.addEventListener('click', () => {
        els.spInputTextarea.value = entry.inputFull;
        els.spOutputTextarea.value = entry.outputFull;
        lastInputText = entry.inputFull;
        lastOutputText = entry.outputFull;
        setMode(entry.mode);
        els.spToneSelect.value = entry.intensity;
        currentIntensity = entry.intensity;
        updateCharCount(els.spInputTextarea, els.spInputCharCount);
        updateCharCount(els.spOutputTextarea, els.spOutputCharCount);
        updateConvertBtn();
        if (diffEnabled && entry.inputFull && entry.outputFull) {
          renderDiff(entry.inputFull, entry.outputFull);
        }
      });

      card.appendChild(meta);
      card.appendChild(preview);
      card.appendChild(restoreBtn);
      els.spHistoryList.appendChild(card);
    });
  }

  function toggleHistory() {
    historyOpen = !historyOpen;
    els.spHistoryList.hidden = !historyOpen;
    els.spHistoryChevron.classList.toggle('open', historyOpen);

    if (historyOpen) {
      chrome.storage.local.get(['conversionHistory'], (data) => {
        renderHistory(data.conversionHistory || []);
      });
    }
  }

  function clearHistory() {
    chrome.storage.local.set({ conversionHistory: [] }, () => {
      renderHistory([]);
    });
  }

  els.spSettingsToggle.addEventListener('click', toggleSettings);
  els.spShowHideKey.addEventListener('click', toggleShowHideKey);
  els.spSaveKeyBtn.addEventListener('click', saveApiKey);
  els.spTestKeyBtn.addEventListener('click', testApiKey);
  els.spModeDuToSie.addEventListener('click', () => setMode('du_to_sie'));
  els.spModeSieToDu.addEventListener('click', () => setMode('sie_to_du'));
  els.spNoKeyWarningLink.addEventListener('click', () => {
    if (!settingsOpen) toggleSettings();
    els.spApiKeyInput.focus();
  });
  els.spConvertBtn.addEventListener('click', startConversion);
  els.spCopyBtn.addEventListener('click', copyOutput);
  els.spClearBtn.addEventListener('click', clearAll);
  els.spToneSelect.addEventListener('change', onIntensityChange);
  els.spDiffToggle.addEventListener('click', toggleDiff);
  els.spHistoryToggle.addEventListener('click', toggleHistory);
  els.spHistoryToggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleHistory(); }
  });
  els.spHistoryClearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearHistory();
  });
  els.spInputTextarea.addEventListener('input', () => {
    updateCharCount(els.spInputTextarea, els.spInputCharCount);
    updateConvertBtn();
  });

  function loadSessionState() {
    chrome.storage.session.get(
      ['sidePanelInput', 'sidePanelOutput', 'sidePanelMode', 'sidePanelIntensity'],
      (data) => {
        if (data.sidePanelInput) {
          els.spInputTextarea.value = data.sidePanelInput;
          lastInputText = data.sidePanelInput;
        }
        if (data.sidePanelOutput) {
          els.spOutputTextarea.value = data.sidePanelOutput;
          lastOutputText = data.sidePanelOutput;
        }
        if (data.sidePanelMode) setMode(data.sidePanelMode);
        if (data.sidePanelIntensity) {
          currentIntensity = data.sidePanelIntensity;
          els.spToneSelect.value = currentIntensity;
        }
        updateCharCount(els.spInputTextarea, els.spInputCharCount);
        updateCharCount(els.spOutputTextarea, els.spOutputCharCount);
        updateConvertBtn();

        chrome.storage.session.remove([
          'sidePanelInput', 'sidePanelOutput', 'sidePanelMode', 'sidePanelIntensity'
        ]);
      }
    );
  }

  function init() {
    localizeUI();

    chrome.storage.local.get(['apiKey', 'conversionMode', 'toneIntensity'], (data) => {
      apiKey = data.apiKey || '';
      currentMode = data.conversionMode || 'du_to_sie';
      currentIntensity = data.toneIntensity || 'standard';

      setMode(currentMode);
      els.spToneSelect.value = currentIntensity;
      updateKeyBadge(!!apiKey);
      updateNoKeyWarning();

      if (apiKey) {
        els.spApiKeyInput.value = apiKey;
      }

      updateConvertBtn();
      loadSessionState();
    });
  }

  init();

})();
