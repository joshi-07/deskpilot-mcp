/**
 * DeskPilot MCP - Interactive Frontend Controller
 */

const messagesContainer = document.getElementById('messagesContainer');
const userInput = document.getElementById('userInput');
const jsonPayload = document.getElementById('jsonPayload');
const activeToolName = document.getElementById('activeToolName');
const securityStatus = document.getElementById('securityStatus');

let isSpeaking = false;

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

    // Append Assistant Message with Agent Thought and Speech option
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
  if (data.agentThought) {
    html += `<div class="thought-box"><strong>Agent Reasoning:</strong> ${escapeHtml(data.agentThought)}</div>`;
  }
  html += `<p>${escapeHtml(data.reply)}</p>`;

  // ElevenLabs Voice Action Pill
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

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function escapeAttribute(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
