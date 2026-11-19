// Fixora AI Dashboard Script
(function () {
  const vscode = acquireVsCodeApi();

  // Cache DOM references
  const btnReviewSelection = document.getElementById('btn-review-selection');
  const btnReviewFile = document.getElementById('btn-review-file');
  const btnSecurityScan = document.getElementById('btn-security-scan');
  const btnReviewWorkspace = document.getElementById('btn-review-workspace');
  const btnReviewGit = document.getElementById('btn-review-git');
  const btnComplexityAudit = document.getElementById('btn-complexity-audit');
  const btnExportReport = document.getElementById('btn-export-report');
  const btnInstallHook = document.getElementById('btn-install-hook');
  const btnFormatDoc = document.getElementById('btn-format-document');
  const btnToggleLens = document.getElementById('btn-toggle-lens');
  const toggleErrorLens = document.getElementById('toggle-error-lens');
  const toggleComplexityLens = document.getElementById('toggle-complexity-lens');
  const toggleFormatter = document.getElementById('toggle-formatter');
  const toggleLinter = document.getElementById('toggle-linter');
  const btnConfigureKey = document.getElementById('btn-configure-key');
  const findingsList = document.getElementById('findings-list');
  const statusContainer = document.getElementById('status-container');

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const targetTab = btn.getAttribute('data-tab');
      // Filter findings if applicable
      filterFindingsTab(targetTab);
    });
  });

  if (btnReviewWorkspace) {
    btnReviewWorkspace.addEventListener('click', () => {
      vscode.postMessage({ type: 'runReviewWorkspace' });
    });
  }

  if (btnReviewGit) {
    btnReviewGit.addEventListener('click', () => {
      vscode.postMessage({ type: 'runReviewGit' });
    });
  }

  if (btnComplexityAudit) {
    btnComplexityAudit.addEventListener('click', () => {
      vscode.postMessage({ type: 'runComplexityAudit' });
    });
  }

  if (btnExportReport) {
    btnExportReport.addEventListener('click', () => {
      vscode.postMessage({ type: 'exportReport' });
    });
  }

  if (btnInstallHook) {
    btnInstallHook.addEventListener('click', () => {
      vscode.postMessage({ type: 'installGitHook' });
    });
  }

  if (btnFormatDoc) {
    btnFormatDoc.addEventListener('click', () => {
      vscode.postMessage({ type: 'formatDocument' });
    });
  }

  if (btnToggleLens) {
    btnToggleLens.addEventListener('click', () => {
      vscode.postMessage({ type: 'toggleErrorLens' });
    });
  }

  // Feature Toggle Switches
  if (toggleErrorLens) {
    toggleErrorLens.addEventListener('change', (e) => {
      vscode.postMessage({
        type: 'toggleFeature',
        feature: 'errorLens',
        enabled: e.target.checked,
      });
    });
  }

  if (toggleComplexityLens) {
    toggleComplexityLens.addEventListener('change', (e) => {
      vscode.postMessage({
        type: 'toggleFeature',
        feature: 'complexityLens',
        enabled: e.target.checked,
      });
    });
  }

  if (toggleFormatter) {
    toggleFormatter.addEventListener('change', (e) => {
      vscode.postMessage({
        type: 'toggleFeature',
        feature: 'formatter',
        enabled: e.target.checked,
      });
    });
  }

  if (toggleLinter) {
    toggleLinter.addEventListener('change', (e) => {
      vscode.postMessage({
        type: 'toggleFeature',
        feature: 'linter',
        enabled: e.target.checked,
      });
    });
  }

  // Handle User Clicks
  if (btnReviewSelection) {
    btnReviewSelection.addEventListener('click', () => {
      vscode.postMessage({ type: 'runReviewSelection' });
    });
  }

  if (btnReviewFile) {
    btnReviewFile.addEventListener('click', () => {
      vscode.postMessage({ type: 'runReviewFile' });
    });
  }

  if (btnSecurityScan) {
    btnSecurityScan.addEventListener('click', () => {
      vscode.postMessage({ type: 'runSecurityScan' });
    });
  }

  if (btnConfigureKey) {
    btnConfigureKey.addEventListener('click', () => {
      vscode.postMessage({ type: 'configureApiKey' });
    });
  }

  // Handle messages received from the extension host
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (!message) return;

    switch (message.type) {
      case 'stateUpdate':
        updateDashboardState(message.data);
        if (message.data.activeExplanation) {
          renderErrorExplanation(message.data.activeExplanation);
        }
        break;
      case 'reviewCompleted':
        renderFindings(message.data);
        break;
      case 'errorExplained':
        renderErrorExplanation(message.data);
        break;
      case 'reviewError':
        renderError(message.error);
        break;
    }
  });

  function updateDashboardState(data) {
    const totalEl = document.getElementById('stat-total');
    const criticalEl = document.getElementById('stat-critical');
    const warningEl = document.getElementById('stat-warning');
    const fixesEl = document.getElementById('stat-fixes');

    if (totalEl && data.stats) totalEl.textContent = data.stats.totalIssuesDetected || 0;
    if (criticalEl && data.stats) criticalEl.textContent = data.stats.criticalCount || 0;
    if (warningEl && data.stats) warningEl.textContent = data.stats.warningCount || 0;
    if (fixesEl && data.stats) fixesEl.textContent = data.stats.fixesAccepted || 0;

    const keyNotice = document.getElementById('key-notice');
    if (keyNotice) {
      keyNotice.style.display = data.isConfigured ? 'none' : 'block';
    }

    // Sync feature toggle states
    if (toggleErrorLens && typeof data.errorLensEnabled === 'boolean') {
      toggleErrorLens.checked = data.errorLensEnabled;
    }
    if (toggleComplexityLens && typeof data.complexityLensEnabled === 'boolean') {
      toggleComplexityLens.checked = data.complexityLensEnabled;
    }
    if (toggleFormatter && typeof data.formatterEnabled === 'boolean') {
      toggleFormatter.checked = data.formatterEnabled;
    }
    if (toggleLinter && typeof data.linterEnabled === 'boolean') {
      toggleLinter.checked = data.linterEnabled;
    }

    if (statusContainer) {
      if (data.isLoading) {
        statusContainer.innerHTML = `
          <div class="loading-box">
            <div class="spinner"></div>
            <div>${escapeHtml(data.loadingMessage || 'Processing...')}</div>
          </div>
        `;
      } else {
        statusContainer.innerHTML = '';
      }
    }
  }

  function renderFindings(result) {
    if (!findingsList) return;
    findingsList.innerHTML = '';

    if (!result.findings || result.findings.length === 0) {
      findingsList.innerHTML = '<div class="empty-box">No issues detected! Clean code.</div>';
      return;
    }

    result.findings.forEach((finding) => {
      const card = document.createElement('div');
      card.className = `finding-card severity-${finding.severity}`;

      card.innerHTML = `
        <div class="finding-header">
          <span class="finding-title">${escapeHtml(finding.title)}</span>
          <span class="severity-pill ${finding.severity}">${finding.severity}</span>
        </div>
        <div class="finding-meta">
          Line ${finding.line} &bull; ${escapeHtml(finding.category)} &bull; ${escapeHtml(finding.source)}
        </div>
        <div class="finding-explanation">
          ${escapeHtml(finding.explanation)}
        </div>
        ${finding.whyItMatters ? `<div class="finding-impact"><strong>Impact:</strong> ${escapeHtml(finding.whyItMatters)}</div>` : ''}
        ${finding.learningNote ? `<div class="learning-pill"><strong>Concept:</strong> ${escapeHtml(finding.conceptName || 'Programming Note')}: ${escapeHtml(finding.learningNote)}</div>` : ''}
        <div class="finding-actions">
          <button class="fixora-btn secondary jump-btn" data-line="${finding.line}">Go to Line ${finding.line}</button>
          ${finding.suggestedFix ? `<button class="fixora-btn secondary fix-btn">Preview Fix</button>` : ''}
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

      card.querySelector('.fix-btn')?.addEventListener('click', () => {
        vscode.postMessage({
          type: 'previewFix',
          findingId: finding.id,
        });
      });

      findingsList.appendChild(card);
    });
  }

  function renderErrorExplanation(data) {
    if (!findingsList) return;
    const exp = data.explanation;

    const explanationCard = document.createElement('div');
    explanationCard.className = 'finding-card severity-critical explanation-card';
    explanationCard.innerHTML = `
      <div class="finding-header">
        <span class="finding-title" style="color: var(--severity-critical);">Error Explanation</span>
        <span class="severity-pill critical">Debugger</span>
      </div>
      <div class="finding-meta">
        ${data.filePath ? `${escapeHtml(data.filePath.split(/[\\\\/]/).pop())} ${data.line ? `(Line ${data.line})` : ''}` : 'Runtime / Compiler Error'}
      </div>
      <div class="explanation-section">
        <div class="sub-heading">What Happened:</div>
        <div class="finding-explanation">${escapeHtml(exp.whatHappened)}</div>
      </div>
      <div class="explanation-section">
        <div class="sub-heading">Why It Happened:</div>
        <div class="finding-explanation">${escapeHtml(exp.whyItHappened)}</div>
      </div>
      <div class="explanation-section">
        <div class="sub-heading">Root Cause:</div>
        <div class="finding-explanation">${escapeHtml(exp.rootCause)}</div>
      </div>
      <div class="explanation-section">
        <div class="sub-heading">How to Fix:</div>
        <div class="finding-explanation">${escapeHtml(exp.howToFix)}</div>
      </div>
      ${
        exp.correctedCodeSnippet
          ? `
        <div class="explanation-section">
          <div class="sub-heading">Corrected Code:</div>
          <pre class="code-block"><code>${escapeHtml(exp.correctedCodeSnippet)}</code></pre>
          <button class="fixora-btn secondary copy-btn" style="font-size: 0.78em; padding: 4px 8px; margin-top: 4px;">Copy Corrected Code</button>
        </div>`
          : ''
      }
      ${
        exp.conceptName
          ? `
        <div class="learning-pill" style="margin-top: 8px;">
          <strong>Concept: ${escapeHtml(exp.conceptName)}</strong>
          <div>${escapeHtml(exp.learningTakeaway || '')}</div>
        </div>`
          : ''
      }
      <div class="finding-actions" style="margin-top: 10px;">
        <button class="fixora-btn secondary dismiss-btn" style="width: 100%;">Dismiss Explanation</button>
      </div>
    `;

    explanationCard.querySelector('.copy-btn')?.addEventListener('click', () => {
      if (exp.correctedCodeSnippet) {
        navigator.clipboard.writeText(exp.correctedCodeSnippet);
        const btn = explanationCard.querySelector('.copy-btn');
        if (btn) btn.textContent = 'Copied to Clipboard!';
      }
    });

    explanationCard.querySelector('.dismiss-btn')?.addEventListener('click', () => {
      explanationCard.remove();
    });

    // Insert explanation at top of findings list
    findingsList.prepend(explanationCard);
  }

  function filterFindingsTab(tabId) {
    if (!findingsList) return;
    const cards = findingsList.querySelectorAll('.finding-card');
    cards.forEach((card) => {
      if (tabId === 'tab-dashboard' || tabId === 'tab-findings') {
        card.style.display = 'block';
      } else if (tabId === 'tab-history') {
        // Only show history cards if any
        card.style.display = card.classList.contains('history-card') ? 'block' : 'none';
      }
    });
  }

  function renderError(err) {
    if (!findingsList) return;
    findingsList.innerHTML = `<div class="empty-box" style="color: var(--severity-critical);">Error: ${escapeHtml(err)}</div>`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Request initial state on boot
  vscode.postMessage({ type: 'requestInitialState' });
})();
