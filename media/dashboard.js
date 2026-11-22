// Revion — Intelligent Code Review & Debugging
// Client-side Webview Component Architecture
(function () {
  const vscode = acquireVsCodeApi();

  // State cache
  let currentState = {
    isConfigured: false,
    providerType: 'gemini',
    activeModel: 'gemini-2.0-flash',
    learningMode: false,
    activeFile: null,
    stats: null,
    currentReview: null,
    activeExplanation: null,
    history: [],
    chatMessages: [],
    isLoading: false,
    activeFilter: 'all',
  };

  // DOM Elements
  const progressBar = document.getElementById('progress-bar');
  const modelPill = document.getElementById('model-pill');
  const modelPillText = document.getElementById('model-pill-text');
  const statusDot = document.getElementById('status-dot');
  const btnSettings = document.getElementById('btn-settings');
  const btnClearAll = document.getElementById('btn-clear-all');

  // Tabs
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const issuesBadge = document.getElementById('issues-badge');

  // Onboarding
  const onboardingCard = document.getElementById('onboarding-card');
  const inputApiKey = document.getElementById('input-api-key');
  const btnConnectKey = document.getElementById('btn-connect-key');
  const btnUseOllama = document.getElementById('btn-use-ollama');
  const btnTrySample = document.getElementById('btn-try-sample');

  // Assistant Chat
  const contextChip = document.getElementById('context-chip');
  const contextFileName = document.getElementById('context-file-name');
  const chatStream = document.getElementById('chat-stream');
  const composerTextarea = document.getElementById('composer-textarea');
  const btnSendMessage = document.getElementById('btn-send-message');
  const promptChips = document.querySelectorAll('.prompt-chip');

  // Review & Toggles
  const toggleErrorLens = document.getElementById('toggle-error-lens');
  const toggleComplexityLens = document.getElementById('toggle-complexity-lens');
  const toggleLinter = document.getElementById('toggle-linter');
  const toggleFormatter = document.getElementById('toggle-formatter');

  // Audit Buttons
  const btnReviewFile = document.getElementById('btn-review-file');
  const btnReviewSelection = document.getElementById('btn-review-selection');
  const btnSecurityScan = document.getElementById('btn-security-scan');
  const btnComplexityAudit = document.getElementById('btn-complexity-audit');
  const btnReviewWorkspace = document.getElementById('btn-review-workspace');
  const btnReviewGit = document.getElementById('btn-review-git');
  const btnExplainTerminal = document.getElementById('btn-explain-terminal');
  const btnFormatDoc = document.getElementById('btn-format-document');
  const btnInstallHook = document.getElementById('btn-install-hook');
  const btnExportReport = document.getElementById('btn-export-report');

  // Findings & History
  const filterChips = document.querySelectorAll('.filter-chip');
  const findingsList = document.getElementById('findings-list');
  const historyList = document.getElementById('history-list');
  const btnClearHistory = document.getElementById('btn-clear-history');

  // 1. Navigation Tabs Switching
  navTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-tab');
      switchTab(targetId);
    });
  });

  function switchTab(tabId) {
    navTabs.forEach((t) => t.classList.toggle('active', t.getAttribute('data-tab') === tabId));
    tabPanels.forEach((p) => p.classList.toggle('active', p.id === tabId));
  }

  // 2. Header & Settings Actions
  if (modelPill) {
    modelPill.addEventListener('click', () => {
      vscode.postMessage({ type: 'selectModel', model: '' });
    });
  }

  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      vscode.postMessage({ type: 'openSettings' });
    });
  }

  if (btnClearAll) {
    btnClearAll.addEventListener('click', () => {
      vscode.postMessage({ type: 'clearDiagnostics' });
    });
  }

  // 3. Onboarding Actions
  if (btnConnectKey && inputApiKey) {
    btnConnectKey.addEventListener('click', () => {
      const key = inputApiKey.value.trim();
      if (key) {
        vscode.postMessage({ type: 'submitApiKey', apiKey: key });
        inputApiKey.value = '';
      }
    });

    inputApiKey.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        btnConnectKey.click();
      }
    });
  }

  if (btnUseOllama) {
    btnUseOllama.addEventListener('click', () => {
      vscode.postMessage({ type: 'switchToOllama' });
    });
  }

  if (btnTrySample) {
    btnTrySample.addEventListener('click', () => {
      vscode.postMessage({ type: 'runSampleReview' });
    });
  }

  // 4. Feature Toggle Switches
  const bindToggle = (el, feature) => {
    if (!el) return;
    el.addEventListener('change', (e) => {
      vscode.postMessage({
        type: 'toggleFeature',
        feature: feature,
        enabled: e.target.checked,
      });
    });
  };

  bindToggle(toggleErrorLens, 'errorLens');
  bindToggle(toggleComplexityLens, 'complexityLens');
  bindToggle(toggleLinter, 'linter');
  bindToggle(toggleFormatter, 'formatter');

  // 5. Review Audit Buttons
  const bindAction = (btn, actionType) => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      vscode.postMessage({ type: actionType });
    });
  };

  bindAction(btnReviewFile, 'runReviewFile');
  bindAction(btnReviewSelection, 'runReviewSelection');
  bindAction(btnSecurityScan, 'runSecurityScan');
  bindAction(btnComplexityAudit, 'runComplexityAudit');
  bindAction(btnReviewWorkspace, 'runReviewWorkspace');
  bindAction(btnReviewGit, 'runReviewGit');
  bindAction(btnExplainTerminal, 'explainTerminalError');
  bindAction(btnFormatDoc, 'formatDocument');
  bindAction(btnInstallHook, 'installGitHook');
  bindAction(btnExportReport, 'exportReport');

  // 6. Assistant Prompt Composer & Chat
  if (btnSendMessage && composerTextarea) {
    btnSendMessage.addEventListener('click', () => {
      submitUserPrompt();
    });

    composerTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitUserPrompt();
      }
    });

    // Auto-grow textarea
    composerTextarea.addEventListener('input', () => {
      composerTextarea.style.height = 'auto';
      composerTextarea.style.height = Math.min(120, Math.max(38, composerTextarea.scrollHeight)) + 'px';
    });
  }

  promptChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt && composerTextarea) {
        composerTextarea.value = prompt;
        composerTextarea.focus();
        submitUserPrompt();
      }
    });
  });

  function submitUserPrompt() {
    if (!composerTextarea) return;
    const text = composerTextarea.value.trim();
    if (!text) return;

    // Render user message immediately
    appendChatMessage('user', text);
    composerTextarea.value = '';
    composerTextarea.style.height = '38px';

    vscode.postMessage({ type: 'sendChatMessage', text });
  }

  function appendChatMessage(sender, text, codeBlocks) {
    if (!chatStream) return;

    // Remove empty welcome placeholder if present
    const placeholder = chatStream.querySelector('.chat-welcome');
    if (placeholder) placeholder.remove();

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender}`;

    const header = document.createElement('div');
    header.className = 'bubble-header';
    header.innerHTML = `
      <span>${sender === 'user' ? 'You' : 'Revion Assistant'}</span>
      <span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    `;
    bubble.appendChild(header);

    const body = document.createElement('div');
    body.className = 'bubble-text';
    body.innerHTML = renderMarkdown(text);
    bubble.appendChild(body);

    if (codeBlocks && codeBlocks.length > 0) {
      codeBlocks.forEach((cb) => {
        const block = document.createElement('div');
        block.className = 'chat-code-block';
        block.innerHTML = `
          <button class="code-copy-btn">Copy</button>
          <code>${escapeHtml(cb.code || cb)}</code>
        `;
        block.querySelector('.code-copy-btn')?.addEventListener('click', (e) => {
          navigator.clipboard.writeText(cb.code || cb);
          e.target.textContent = 'Copied!';
          setTimeout(() => (e.target.textContent = 'Copy'), 2000);
        });
        bubble.appendChild(block);
      });
    }

    chatStream.appendChild(bubble);
    chatStream.scrollTop = chatStream.scrollHeight;
  }

  // 7. Findings & Filtering
  filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      filterChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      currentState.activeFilter = chip.getAttribute('data-severity') || 'all';
      renderFindings(currentState.currentReview);
    });
  });

  function renderFindings(result) {
    if (!findingsList) return;
    findingsList.innerHTML = '';

    if (!result || !result.findings || result.findings.length === 0) {
      findingsList.innerHTML = `
        <div class="empty-box">
          <div>✓ No active issues detected</div>
          <div style="font-size: 10.5px; margin-top: 4px; opacity: 0.7;">Run an audit from the Review tab to scan your code.</div>
        </div>
      `;
      if (issuesBadge) issuesBadge.textContent = '0';
      return;
    }

    const filter = currentState.activeFilter;
    const filtered = filter === 'all'
      ? result.findings
      : result.findings.filter((f) => f.severity === filter);

    if (issuesBadge) {
      issuesBadge.textContent = String(result.findings.length);
    }

    if (filtered.length === 0) {
      findingsList.innerHTML = `<div class="empty-box">No ${filter} issues found.</div>`;
      return;
    }

    filtered.forEach((finding) => {
      const card = document.createElement('div');
      card.className = `finding-card severity-${finding.severity}`;

      card.innerHTML = `
        <div class="finding-header">
          <span class="finding-title">${escapeHtml(finding.title)}</span>
          <span class="severity-pill ${finding.severity}">${finding.severity}</span>
        </div>
        <div class="finding-meta">
          Line ${finding.line} &bull; ${escapeHtml(finding.category || 'General')} &bull; ${escapeHtml(finding.source || 'Revion')}
        </div>
        <div class="finding-explanation">
          ${escapeHtml(finding.explanation)}
        </div>
        ${finding.whyItMatters ? `<div class="finding-impact"><strong>Impact:</strong> ${escapeHtml(finding.whyItMatters)}</div>` : ''}
        ${finding.learningNote ? `<div class="finding-impact" style="border-left: 2px solid var(--revion-info);"><strong>Concept:</strong> ${escapeHtml(finding.conceptName || 'Guidance')}: ${escapeHtml(finding.learningNote)}</div>` : ''}
        <div class="finding-actions">
          <button class="btn btn-secondary btn-sm jump-btn">Go to Line ${finding.line}</button>
          ${finding.suggestedFix ? `<button class="btn btn-secondary btn-sm preview-btn">Preview Diff</button>` : ''}
          ${finding.suggestedFix ? `<button class="btn btn-sm apply-btn">Apply Fix</button>` : ''}
        </div>
      `;

      card.querySelector('.jump-btn')?.addEventListener('click', () => {
        vscode.postMessage({
          type: 'jumpToCode',
          filePath: finding.filePath,
          line: finding.line,
          column: finding.column,
        });
      });

      card.querySelector('.preview-btn')?.addEventListener('click', () => {
        vscode.postMessage({
          type: 'previewFix',
          findingId: finding.id,
        });
      });

      card.querySelector('.apply-btn')?.addEventListener('click', () => {
        vscode.postMessage({
          type: 'applyFix',
          findingId: finding.id,
        });
      });

      findingsList.appendChild(card);
    });
  }

  // 8. History Component
  if (btnClearHistory) {
    btnClearHistory.addEventListener('click', () => {
      vscode.postMessage({ type: 'clearHistory' });
    });
  }

  function renderHistory(historyItems) {
    if (!historyList) return;
    historyList.innerHTML = '';

    if (!historyItems || historyItems.length === 0) {
      historyList.innerHTML = `<div class="empty-box">No past review runs saved yet.</div>`;
      return;
    }

    historyItems.forEach((item) => {
      const el = document.createElement('div');
      el.className = 'history-item';
      const timeStr = new Date(item.timestamp).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      el.innerHTML = `
        <div class="history-header">
          <span>${escapeHtml(item.fileName)}</span>
          <span style="font-size: 10px; color: var(--revion-muted);">${timeStr}</span>
        </div>
        <div class="history-meta">
          ${item.totalIssues} issue(s) &bull; ${item.criticalCount} critical &bull; ${item.warningCount} warning
        </div>
      `;

      el.addEventListener('click', () => {
        vscode.postMessage({
          type: 'loadHistoryRun',
          recordId: item.id,
        });
        // Switch to issues tab
        switchTab('tab-issues');
      });

      historyList.appendChild(el);
    });
  }

  // 9. Error Explanation Card
  function renderErrorExplanation(data) {
    if (!findingsList) return;
    const exp = data.explanation;

    const card = document.createElement('div');
    card.className = 'finding-card severity-critical';
    card.innerHTML = `
      <div class="finding-header">
        <span class="finding-title" style="color: var(--revion-critical);">Error Diagnosis</span>
        <span class="severity-pill critical">Debugger</span>
      </div>
      <div class="finding-meta">
        ${data.filePath ? `${escapeHtml(data.filePath.split(/[\\\\/]/).pop())} ${data.line ? `(Line ${data.line})` : ''}` : 'Runtime / Compiler Trace'}
      </div>
      <div class="finding-explanation"><strong>What Happened:</strong> ${escapeHtml(exp.whatHappened)}</div>
      <div class="finding-explanation"><strong>Root Cause:</strong> ${escapeHtml(exp.rootCause)}</div>
      <div class="finding-explanation"><strong>Resolution:</strong> ${escapeHtml(exp.howToFix)}</div>
      ${exp.correctedCodeSnippet ? `
        <div class="chat-code-block">
          <button class="code-copy-btn">Copy</button>
          <code>${escapeHtml(exp.correctedCodeSnippet)}</code>
        </div>
      ` : ''}
      <div class="finding-actions" style="margin-top: 8px;">
        <button class="btn btn-secondary btn-sm dismiss-btn" style="width: 100%;">Dismiss</button>
      </div>
    `;

    card.querySelector('.code-copy-btn')?.addEventListener('click', (e) => {
      navigator.clipboard.writeText(exp.correctedCodeSnippet);
      e.target.textContent = 'Copied!';
      setTimeout(() => (e.target.textContent = 'Copy'), 2000);
    });

    card.querySelector('.dismiss-btn')?.addEventListener('click', () => {
      card.remove();
    });

    findingsList.prepend(card);
    switchTab('tab-issues');
  }

  // 10. Message Listener from Extension Host
  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg) return;

    switch (msg.type) {
      case 'stateUpdate':
        updateState(msg.data);
        break;

      case 'reviewCompleted':
        currentState.currentReview = msg.data;
        renderFindings(msg.data);
        switchTab('tab-issues');
        break;

      case 'chatResponse':
        appendChatMessage('assistant', msg.message.text, msg.message.codeBlocks);
        break;

      case 'errorExplained':
        renderErrorExplanation(msg.data);
        break;

      case 'reviewError':
        appendChatMessage('assistant', `⚠️ Review Error: ${msg.error}`);
        break;
    }
  });

  function updateState(data) {
    Object.assign(currentState, data);

    // Update Progress Bar
    if (progressBar) {
      progressBar.classList.toggle('active', Boolean(data.isLoading));
      const activeEl = progressBar.querySelector('.progress-bar-active');
      if (activeEl) activeEl.style.display = data.isLoading ? 'block' : 'none';
    }

    // Update Model Pill & Status Dot
    if (modelPillText) {
      modelPillText.textContent = data.activeModel || (data.providerType === 'ollama' ? 'Ollama' : 'Gemini 2.0 Flash');
    }
    if (statusDot) {
      statusDot.classList.toggle('disconnected', !data.isConfigured);
    }

    // Update Onboarding Card
    if (onboardingCard) {
      onboardingCard.style.display = data.isConfigured ? 'none' : 'block';
    }

    // Update Active File Context
    if (contextChip && contextFileName) {
      if (data.activeFile) {
        contextChip.style.display = 'flex';
        contextFileName.textContent = `${data.activeFile.name} : Ln ${data.activeFile.line}`;
      } else {
        contextChip.style.display = 'none';
      }
    }

    // Sync Feature Toggles
    if (toggleErrorLens && typeof data.errorLensEnabled === 'boolean') {
      toggleErrorLens.checked = data.errorLensEnabled;
    }
    if (toggleComplexityLens && typeof data.complexityLensEnabled === 'boolean') {
      toggleComplexityLens.checked = data.complexityLensEnabled;
    }
    if (toggleLinter && typeof data.linterEnabled === 'boolean') {
      toggleLinter.checked = data.linterEnabled;
    }
    if (toggleFormatter && typeof data.formatterEnabled === 'boolean') {
      toggleFormatter.checked = data.formatterEnabled;
    }

    // Render findings if present
    if (data.currentReview) {
      renderFindings(data.currentReview);
    }

    // Render history
    if (data.history) {
      renderHistory(data.history);
    }

    // Render explanation if present
    if (data.activeExplanation) {
      renderErrorExplanation(data.activeExplanation);
    }
  }

  // Utilities
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderMarkdown(text) {
    if (!text) return '';
    let rendered = escapeHtml(text);
    // Basic formatting: **bold**, `code`, \n
    rendered = rendered.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    rendered = rendered.replace(/`(.*?)`/g, '<code style="color: var(--revion-info); background: rgba(128,128,128,0.1); padding: 1px 4px; border-radius: 3px;">$1</code>');
    rendered = rendered.replace(/\n/g, '<br>');
    return rendered;
  }

  // Request initial state on load
  vscode.postMessage({ type: 'requestInitialState' });
})();
