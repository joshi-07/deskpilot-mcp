/**
 * DeskPilot MCP - Interactive Frontend Controller
 */

const messagesContainer = document.getElementById('messagesContainer');
const userInput = document.getElementById('userInput');
const jsonPayload = document.getElementById('jsonPayload');
const activeToolName = document.getElementById('activeToolName');
const securityStatus = document.getElementById('securityStatus');

// Telemetry Elements
const sysRamPercent = document.getElementById('sysRamPercent');
const sysRamFill = document.getElementById('sysRamFill');
const sysUptime = document.getElementById('sysUptime');
const sysPlatform = document.getElementById('sysPlatform');
const sysCpus = document.getElementById('sysCpus');

// Session log history
const sessionHistory = [];

// Quick trigger helper from sidebar
function runPrompt(promptText) {
  userInput.value = promptText;
  handleSend(new Event('submit'));
}

async function handleSend(e) {
  if (e) e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  // Append User Message
  appendMessage('user', text);
  sessionHistory.push({ role: 'user', text, timestamp: new Date().toISOString() });
  userInput.value = '';

  // Show Loading Placeholder
  const loadingId = appendLoadingIndicator();

  try {
    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });

    const data = await res.json();
    removeLoadingIndicator(loadingId);

    if (data.error) {
      appendMessage('assistant', `⚠️ Error executing request: ${data.error}`);
      return;
    }

    sessionHistory.push({ role: 'assistant', data, timestamp: new Date().toISOString() });

    // Append Assistant Message with Agent Thought, Steps, and Speech option
    appendAssistantResponse(data);

    // Update MCP Inspector panel
    if (data.mcpCall) {
      activeToolName.textContent = data.mcpCall.tool;
      jsonPayload.textContent = JSON.stringify(data.mcpCall, null, 2);
    }

  } catch (err) {
    removeLoadingIndicator(loadingId);
    appendMessage('assistant', `Connection error: ${err.message}. Make sure server is running on port 3000.`);
  }
}

function appendMessage(sender, content) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${sender}-message`;
  
  const headerDiv = document.createElement('div');
  headerDiv.className = 'message-header';
  headerDiv.innerHTML = `<span class="sender-tag">${sender === 'user' ? 'You' : 'DeskPilot Agent'}</span><span class="time-stamp">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;

  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'message-content';
  bodyDiv.innerHTML = `<p>${escapeHtml(content)}</p>`;

  msgDiv.appendChild(headerDiv);
  msgDiv.appendChild(bodyDiv);
  messagesContainer.appendChild(msgDiv);
  scrollToBottom();
}

function appendAssistantResponse(data) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message assistant-message';

  const headerDiv = document.createElement('div');
  headerDiv.className = 'message-header';
  headerDiv.innerHTML = `<span class="sender-tag">DeskPilot Agent</span><span class="time-stamp">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;

  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'message-content';

  let html = '';

  // 1. Antigravity-Style Step Trace
  if (data.steps && Array.isArray(data.steps)) {
    html += `
      <div class="agent-steps-container">
        <div class="agent-steps-header">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <span>Agentic Execution Trace</span>
        </div>
        ${data.steps.map(s => `
          <div class="step-item">
            <span class="step-bullet">●</span>
            <span class="step-text"><strong>${escapeHtml(s.name)}:</strong> ${escapeHtml(s.detail)}</span>
          </div>
        `).join('')}
      </div>
    `;
  } else if (data.agentThought) {
    html += `<div class="thought-box"><strong>Agent Reasoning:</strong> ${escapeHtml(data.agentThought)}</div>`;
  }

  // 2. Primary Response Content
  html += `<p>${escapeHtml(data.reply)}</p>`;

  // 3. Human-in-the-Loop Approval Gate (if applicable)
  if (data.interactiveAction && data.interactiveAction.type === 'approval_gate') {
    const act = data.interactiveAction;
    const actId = `act_${Date.now()}`;
    html += `
      <div class="interactive-action-card" id="${actId}">
        <div class="action-card-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
          <span>${escapeHtml(act.title)}</span>
        </div>
        <div class="action-card-desc">${escapeHtml(act.description)}</div>
        <div class="action-btn-group">
          <button class="btn-approve" onclick="confirmAction('${actId}', '${act.tool}', ${escapeAttribute(JSON.stringify(act.args))})">
            ✓ ${escapeHtml(act.confirmLabel || 'Approve & Execute')}
          </button>
          <button class="btn-dismiss" onclick="dismissAction('${actId}')">✕ Dismiss</button>
        </div>
      </div>
    `;
  }

  // 4. ElevenLabs Voice Action Pill
  if (data.elevenLabsMetadata) {
    html += `
      <div class="voice-badge-play" onclick="playVoiceNarration('${escapeAttribute(data.reply)}')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        <span>Play via ElevenLabs Neural Voice (Rachel)</span>
      </div>
    `;
  }

  bodyDiv.innerHTML = html;
  msgDiv.appendChild(headerDiv);
  msgDiv.appendChild(bodyDiv);
  messagesContainer.appendChild(msgDiv);
  scrollToBottom();
}

async function confirmAction(elementId, tool, args) {
  const card = document.getElementById(elementId);
  if (!card) return;

  card.innerHTML = `<span style="color:#93c5fd; font-size:12px;">⏳ Applying approved changes to host system...</span>`;

  try {
    const res = await fetch('/api/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, arguments: args })
    });
    const result = await res.json();
    if (result.success) {
      card.innerHTML = `
        <div style="color:#10b981; font-size:12px; font-weight:600; display:flex; align-items:center; gap:6px;">
          <span>✓ Changes Applied Successfully</span>
          <span style="color:#64748b; font-weight:normal;">(Status: Clean)</span>
        </div>
      `;
      // Update Inspector
      activeToolName.textContent = tool;
      jsonPayload.textContent = JSON.stringify(result.result, null, 2);
    } else {
      card.innerHTML = `<span style="color:#ef4444; font-size:12px;">Execution Failed: ${result.error}</span>`;
    }
  } catch (err) {
    card.innerHTML = `<span style="color:#ef4444; font-size:12px;">Network error: ${err.message}</span>`;
  }
}

function dismissAction(elementId) {
  const card = document.getElementById(elementId);
  if (card) {
    card.innerHTML = `<span style="color:#64748b; font-size:12px; font-style:italic;">Action dismissed by user.</span>`;
  }
}

function appendLoadingIndicator() {
  const id = `loading_${Date.now()}`;
  const div = document.createElement('div');
  div.id = id;
  div.className = 'message assistant-message';
  div.innerHTML = `
    <div class="message-content" style="display:flex; align-items:center; gap:8px; color: #94a3b8; font-size:13px;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
        <line x1="12" y1="2" x2="12" y2="6"></line>
        <line x1="12" y1="18" x2="12" y2="22"></line>
        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
        <line x1="2" y1="12" x2="6" y2="12"></line>
        <line x1="18" y1="12" x2="22" y2="12"></line>
      </svg>
      <span>Evaluating intent & invoking MCP protocol tool...</span>
    </div>
  `;
  messagesContainer.appendChild(div);
  scrollToBottom();
  return id;
}

function removeLoadingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function playVoiceNarration(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  } else {
    alert('Browser speech synthesis is not supported on this device.');
  }
}

function toggleVoiceSpeech() {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    alert('Voice input requires a browser supporting Web Speech Recognition (such as Google Chrome).');
    return;
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.start();

  const voiceBtn = document.getElementById('voiceBtn');
  voiceBtn.style.color = '#ef4444';

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    userInput.value = transcript;
    voiceBtn.style.color = '';
    handleSend(new Event('submit'));
  };

  recognition.onerror = () => {
    voiceBtn.style.color = '';
  };
}

// Sidebars Toggle
function toggleSidebar(side) {
  const ws = document.getElementById('mainWorkspace');
  if (side === 'left') {
    ws.classList.toggle('collapsed-left');
  } else if (side === 'right') {
    ws.classList.toggle('collapsed-right');
  }
}

// Tool Tester Modal Logic
const SAMPLE_TOOL_ARGS = {
  calendar_triage: { date: 'today', detectConflicts: true },
  smart_file_organizer: { targetFolder: 'Downloads', dryRun: true },
  expense_tracker: { merchant: 'Zepto Grocery', amount: 480, category: 'Groceries' },
  eisenhower_prioritizer: {
    tasks: [
      { title: 'Finish wHACKiest 2026 Presentation', urgent: true, important: true },
      { title: 'Study Computer Networks', urgent: false, important: true }
    ]
  },
  system_health: { detailed: true }
};

let currentTestingTool = 'calendar_triage';

function openToolTester(toolName) {
  currentTestingTool = toolName;
  document.getElementById('testerToolName').textContent = toolName;
  const sample = SAMPLE_TOOL_ARGS[toolName] || {};
  document.getElementById('testerArgs').value = JSON.stringify(sample, null, 2);
  document.getElementById('testerResult').textContent = '// Click execute to run JSON-RPC tool...';
  document.getElementById('toolTesterModal').classList.remove('hidden');
}

function closeToolTester(e) {
  if (e && e.target !== e.currentTarget && !e.target.classList.contains('btn-close')) return;
  document.getElementById('toolTesterModal').classList.add('hidden');
}

async function executeTesterTool() {
  const resultBox = document.getElementById('testerResult');
  resultBox.textContent = 'Executing MCP tool...';
  try {
    const rawArgs = document.getElementById('testerArgs').value;
    const args = JSON.parse(rawArgs);
    const res = await fetch('/api/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: currentTestingTool, arguments: args })
    });
    const data = await res.json();
    resultBox.textContent = JSON.stringify(data, null, 2);
    
    // Also update Inspector
    activeToolName.textContent = currentTestingTool;
    jsonPayload.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    resultBox.textContent = `Error: ${err.message}`;
  }
}

// Reset Conversation
function clearChat() {
  messagesContainer.innerHTML = `
    <div class="message assistant-message">
      <div class="message-header">
        <span class="sender-tag">DeskPilot Agent</span>
        <span class="time-stamp">Ready</span>
      </div>
      <div class="message-content">
        <p>Conversation reset. Ready for next query or workflow trigger.</p>
      </div>
    </div>
  `;
}

// Export Session Log
function exportLog() {
  const blob = new Blob([JSON.stringify(sessionHistory, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `deskpilot-mcp-session-${Date.now()}.json`;
  a.click();
}

function copyJsonPayload() {
  navigator.clipboard.writeText(jsonPayload.textContent);
  alert('Raw JSON payload copied to clipboard.');
}

// Live Workstation Telemetry Polling
async function pollMetrics() {
  try {
    const res = await fetch('/api/system/metrics');
    if (!res.ok) return;
    const data = await res.json();
    if (sysRamPercent && sysRamFill) {
      sysRamPercent.textContent = `${data.usedMemPercent}%`;
      sysRamFill.style.width = `${data.usedMemPercent}%`;
    }
    if (sysUptime) sysUptime.textContent = `Uptime: ${data.uptimeHours}h`;
    if (sysPlatform) sysPlatform.textContent = `Platform: ${data.platform} (${data.architecture})`;
    if (sysCpus) sysCpus.textContent = `CPUs: ${data.cpus} cores`;
  } catch (e) {
    // Ignore transient poll failures
  }
}

// Poll telemetry every 4 seconds
setInterval(pollMetrics, 4000);
pollMetrics();

function scrollToBottom() {
  requestAnimationFrame(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function escapeAttribute(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
