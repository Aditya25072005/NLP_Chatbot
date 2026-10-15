/* ============================================
   FoodieBot — Frontend Application Logic
   ============================================ */

(() => {
  'use strict';

  // --- DOM refs ---
  const chatMessages = document.getElementById('chat-messages');
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  const clearBtn = document.getElementById('clear-btn');
  const welcomeScreen = document.getElementById('welcome-screen');
  const chips = document.querySelectorAll('.chip');

  // --- State ---
  const sessionId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  let isLoading = false;

  // =============================================
  //  Markdown → HTML (lightweight parser)
  // =============================================
  function renderMarkdown(text) {
    let html = text;

    // Code blocks (``` ... ```)
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headings
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold & Italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Horizontal rule
    html = html.replace(/^---$/gm, '<hr>');

    // Unordered lists — group consecutive lines starting with - or *
    html = html.replace(/(?:^[*-] .+\n?)+/gm, (block) => {
      const items = block.trim().split('\n').map(l => `<li>${l.replace(/^[*-]\s/, '')}</li>`).join('');
      return `<ul>${items}</ul>`;
    });

    // Ordered lists — group consecutive lines starting with digit.
    html = html.replace(/(?:^\d+\. .+\n?)+/gm, (block) => {
      const items = block.trim().split('\n').map(l => `<li>${l.replace(/^\d+\.\s/, '')}</li>`).join('');
      return `<ol>${items}</ol>`;
    });

    // Paragraphs — wrap remaining bare text lines
    html = html.replace(/^(?!<[a-z])((?!^\s*$).+)$/gm, '<p>$1</p>');

    // Clean up extra whitespace between tags
    html = html.replace(/<\/p>\s*<p>/g, '</p><p>');

    return html.trim();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // =============================================
  //  UI Helpers
  // =============================================
  function getTimeString() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  function hideWelcome() {
    if (welcomeScreen) {
      welcomeScreen.style.animation = 'fadeOut 0.3s ease forwards';
      setTimeout(() => {
        welcomeScreen.remove();
      }, 300);
    }
  }

  function updateSendBtn() {
    sendBtn.disabled = !messageInput.value.trim() || isLoading;
  }

  // =============================================
  //  Message Rendering
  // =============================================
  function addUserMessage(text) {
    hideWelcome();
    const row = document.createElement('div');
    row.className = 'message-row user';
    row.innerHTML = `
      <div class="msg-avatar">😊</div>
      <div>
        <div class="msg-bubble">${escapeHtml(text)}</div>
        <div class="msg-time">${getTimeString()}</div>
      </div>
    `;
    chatMessages.appendChild(row);
    scrollToBottom();
  }

  function addBotMessage(text) {
    const row = document.createElement('div');
    row.className = 'message-row bot';
    row.innerHTML = `
      <div class="msg-avatar">🍳</div>
      <div>
        <div class="msg-bubble">${renderMarkdown(text)}</div>
        <div class="msg-time">${getTimeString()}</div>
      </div>
    `;
    chatMessages.appendChild(row);
    scrollToBottom();
  }

  function addErrorMessage(text) {
    const row = document.createElement('div');
    row.className = 'message-row bot';
    row.innerHTML = `
      <div class="msg-avatar">⚠️</div>
      <div>
        <div class="msg-bubble error-bubble">${escapeHtml(text)}</div>
        <div class="msg-time">${getTimeString()}</div>
      </div>
    `;
    chatMessages.appendChild(row);
    scrollToBottom();
  }

  function showTypingIndicator() {
    const el = document.createElement('div');
    el.className = 'typing-indicator';
    el.id = 'typing-indicator';
    el.innerHTML = `
      <div class="msg-avatar">🍳</div>
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>
    `;
    chatMessages.appendChild(el);
    scrollToBottom();
  }

  function removeTypingIndicator() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
  }

  // =============================================
  //  API Call
  // =============================================
  async function sendMessage(text) {
    if (!text.trim() || isLoading) return;

    isLoading = true;
    updateSendBtn();
    addUserMessage(text);
    showTypingIndicator();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId }),
      });

      removeTypingIndicator();

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error (${res.status})`);
      }

      const data = await res.json();
      addBotMessage(data.reply);
    } catch (err) {
      removeTypingIndicator();
      addErrorMessage(err.message || 'Something went wrong. Please try again.');
    } finally {
      isLoading = false;
      updateSendBtn();
      messageInput.focus();
    }
  }

  // =============================================
  //  Event Listeners
  // =============================================

  // Send on button click
  sendBtn.addEventListener('click', () => {
    const text = messageInput.value.trim();
    if (text) {
      messageInput.value = '';
      messageInput.style.height = 'auto';
      sendMessage(text);
    }
  });

  // Send on Enter (Shift+Enter for newline)
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  // Auto-resize textarea
  messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    updateSendBtn();
  });

  // Suggestion chips
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const msg = chip.getAttribute('data-message');
      if (msg) {
        messageInput.value = '';
        sendMessage(msg);
      }
    });
  });

  // Clear chat
  clearBtn.addEventListener('click', () => {
    // Remove all messages and typing indicators
    chatMessages.innerHTML = '';
    // Re-create welcome screen
    const welcome = document.createElement('div');
    welcome.className = 'welcome-screen';
    welcome.id = 'welcome-screen';
    welcome.innerHTML = `
      <div class="welcome-avatar">🍕</div>
      <h2 class="welcome-title">Hey there, foodie! 👋</h2>
      <p class="welcome-subtitle">I'm <strong>FoodieBot</strong> — your personal AI food assistant. Ask me about recipes, cooking tips, meal ideas, or anything food-related!</p>
      <div class="suggestion-chips">
        <button class="chip" data-message="Give me a quick 15-minute pasta recipe 🍝">Quick pasta recipe 🍝</button>
        <button class="chip" data-message="What's a healthy breakfast idea? 🥗">Healthy breakfast 🥗</button>
        <button class="chip" data-message="Suggest an Indian dinner recipe 🍛">Indian dinner 🍛</button>
        <button class="chip" data-message="What can I make with chicken and rice? 🍗">Chicken & rice ideas 🍗</button>
      </div>
    `;
    chatMessages.appendChild(welcome);
    // Re-bind chip events
    welcome.querySelectorAll('.chip').forEach((c) => {
      c.addEventListener('click', () => {
        const msg = c.getAttribute('data-message');
        if (msg) {
          messageInput.value = '';
          sendMessage(msg);
        }
      });
    });
    messageInput.focus();
  });

  // Focus input on load
  messageInput.focus();

  // Inject fadeOut keyframe (used when hiding welcome)
  const style = document.createElement('style');
  style.textContent = `@keyframes fadeOut { to { opacity: 0; transform: translateY(-10px); pointer-events: none; } }`;
  document.head.appendChild(style);
})();
