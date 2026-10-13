/**
 * universe.ai — Frontend Application Logic
 * Vanilla JavaScript, In-Memory Conversation State, Matrix Dot Loader & Safe Rendering
 */

(() => {
  'use strict';

  // In-memory conversation state (No database, no localStorage, reset on refresh)
  let conversationHistory = [];
  let isRequestPending = false;

  // DOM Elements
  const bgVideo = document.getElementById('bgVideo');
  const chatViewport = document.getElementById('chatViewport');
  const welcomeView = document.getElementById('welcomeView');
  const messagesStream = document.getElementById('messagesStream');
  const chatForm = document.getElementById('chatForm');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const newChatBtn = document.getElementById('newChatBtn');
  const logoBtn = document.getElementById('logoBtn');
  const suggestionCards = document.querySelectorAll('.suggestion-card');

  // SVG Icons
  const ICONS = {
    sparkle: `
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M10 2v16m-8-8h16m-2.5-5.5l-11 11m0-11l11 11" />
      </svg>
    `,
    assistantLogo: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="3" fill="#a78bfa" />
        <ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="#818cf8" stroke-width="1.5" transform="rotate(-30 12 12)" />
      </svg>
    `,
    copy: `
      <svg class="btn-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
        <rect x="7" y="7" width="9" height="9" rx="2" />
        <path d="M4 13V5a2 2 0 0 1 2-2h8" />
      </svg>
    `,
    check: `
      <svg class="btn-icon" viewBox="0 0 20 20" fill="none" stroke="#34d399" stroke-width="2.2" aria-hidden="true">
        <polyline points="4 11 8 15 16 6" />
      </svg>
    `,
    error: `
      <svg class="error-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
        <circle cx="10" cy="10" r="8" />
        <line x1="10" y1="6" x2="10" y2="10" />
        <line x1="10" y1="14" x2="10.01" y2="14" stroke-width="2.5" />
      </svg>
    `
  };

  /**
   * Initializes background video playback and handles errors smoothly.
   */
  function initBackgroundVideo() {
    if (!bgVideo) return;

    // Autoplay handling
    const playPromise = bgVideo.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay may be restricted or video file not yet placed
        console.info('[universe.ai] Background video autoplay unavailable. Cosmic fallback layer is active.');
      });
    }

    bgVideo.addEventListener('error', () => {
      console.info('[universe.ai] Background video not found or could not load. Using cosmic dark fallback background.');
    });
  }

  /**
   * Builds the official 4x4 Matrix dot loader from transitions.dev.
   * Preserves namespaced .t-* selectors and motion tokens.
   *
   * @param {'scan'|'twinkle'|'orbit'|'pulse'} variant - Delay pattern
   * @param {boolean} rounded - If true, corners are gaps
   * @returns {HTMLElement}
   */
  function buildMatrixDotLoader(variant = 'orbit', rounded = true) {
    const CORNERS = [0, 3, 12, 15];
    const RING = [1, 2, 7, 11, 14, 13, 8, 4];
    const INNER = [5, 6, 9, 10];
    const TWINKLE = [7, 2, 11, 5, 14, 9, 0, 12, 3, 15, 6, 10, 13, 1, 8, 4];

    const cycle = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--matrix-cycle')
    ) || 1200;

    const loader = document.createElement('div');
    loader.className = 't-matrix';
    loader.setAttribute('data-variant', variant);
    if (rounded) {
      loader.setAttribute('data-rounded', 'true');
    }

    for (let idx = 0; idx < 16; idx++) {
      const dot = document.createElement('i');
      const col = idx % 4;

      if (rounded && CORNERS.includes(idx)) {
        dot.className = 'is-gap';
      } else if (variant === 'scan') {
        dot.style.setProperty('--d', String(Math.round(col * (cycle / 10))));
      } else if (variant === 'twinkle') {
        dot.style.setProperty('--d', String(Math.round(TWINKLE[idx] * (cycle / 16))));
      } else if (variant === 'orbit') {
        const k = RING.indexOf(idx);
        if (k !== -1) {
          dot.style.setProperty('--d', String(Math.round(k * (cycle / 8))));
        } else {
          dot.style.animation = 'none'; // centre holds steady under the ring
        }
      } else if (variant === 'pulse') {
        const ring = INNER.includes(idx) ? 0 : 1;
        dot.style.setProperty('--d', String(Math.round(ring * (cycle * 0.16))));
      }

      loader.appendChild(dot);
    }

    return loader;
  }

  /**
   * Safely parses and sanitizes Markdown content using marked + DOMPurify.
   * Guarantees that model-generated output cannot execute arbitrary scripts.
   *
   * @param {string} rawMarkdown
   * @returns {string} Sanitized HTML string
   */
  function sanitizeMarkdown(rawMarkdown) {
    if (!rawMarkdown) return '';

    try {
      if (window.marked && window.DOMPurify) {
        // Configure marked options
        window.marked.setOptions({
          gfm: true,
          breaks: true,
          pedantic: false
        });

        const parsedHtml = window.marked.parse(rawMarkdown);

        // Sanitize with DOMPurify
        return window.DOMPurify.sanitize(parsedHtml, {
          ALLOWED_TAGS: [
            'p', 'br', 'strong', 'b', 'em', 'i', 'code', 'pre', 'blockquote',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table',
            'thead', 'tbody', 'tr', 'th', 'td', 'a', 'span', 'hr'
          ],
          ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class'],
        });
      }
    } catch (e) {
      console.warn('[universe.ai] Markdown parser failed, falling back to safe text formatting:', e);
    }

    // Safe plain text fallback
    const tempDiv = document.createElement('div');
    tempDiv.textContent = rawMarkdown;
    return tempDiv.innerHTML.replace(/\n/g, '<br/>');
  }

  /**
   * Scrolls the chat viewport to the newest message.
   */
  function scrollToBottom() {
    requestAnimationFrame(() => {
      chatViewport.scrollTo({
        top: chatViewport.scrollHeight,
        behavior: 'smooth'
      });
    });
  }

  /**
   * Dynamically resizes the message textarea up to max height.
   */
  function resizeTextarea() {
    messageInput.style.height = 'auto';
    const newHeight = Math.min(messageInput.scrollHeight, 180);
    messageInput.style.height = `${newHeight}px`;

    // Toggle send button disabled state
    const hasText = messageInput.value.trim().length > 0;
    sendBtn.disabled = !hasText || isRequestPending;
  }

  /**
   * Appends a user message to the conversation stream.
   *
   * @param {string} text - User prompt
   */
  function appendUserMessage(text) {
    // Hide welcome view if visible
    if (welcomeView.style.display !== 'none') {
      welcomeView.style.display = 'none';
      document.body.classList.add('is-chatting');
    }

    const row = document.createElement('div');
    row.className = 'message-row user';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = text; // Safe textContent avoids any HTML injection

    row.appendChild(bubble);
    messagesStream.appendChild(row);
    scrollToBottom();
  }

  /**
   * Displays the thinking state row containing the transitions.dev Matrix dot loader.
   *
   * @returns {HTMLElement} The created thinking row element
   */
  function showThinkingIndicator() {
    // Remove any existing thinking row if present
    hideThinkingIndicator();

    const row = document.createElement('div');
    row.className = 'message-row assistant thinking';
    row.id = 'activeThinkingRow';

    const avatar = document.createElement('div');
    avatar.className = 'assistant-avatar';
    avatar.innerHTML = ICONS.assistantLogo;

    const card = document.createElement('div');
    card.className = 'assistant-card';

    const indicator = document.createElement('div');
    indicator.className = 'thinking-indicator';

    // Insert the 4x4 matrix dot loader (orbit pattern)
    const matrixLoader = buildMatrixDotLoader('orbit', true);
    indicator.appendChild(matrixLoader);

    const label = document.createElement('span');
    label.className = 'thinking-label';
    label.textContent = 'Exploring the universe...';
    indicator.appendChild(label);

    card.appendChild(indicator);
    row.appendChild(avatar);
    row.appendChild(card);

    messagesStream.appendChild(row);
    scrollToBottom();

    return row;
  }

  /**
   * Removes the active thinking indicator row from the DOM.
   */
  function hideThinkingIndicator() {
    const existing = document.getElementById('activeThinkingRow');
    if (existing) {
      existing.remove();
    }
  }

  /**
   * Appends an assistant response message to the conversation stream.
   *
   * @param {string} rawMarkdown - Assistant markdown response
   */
  function appendAssistantMessage(rawMarkdown) {
    hideThinkingIndicator();

    const row = document.createElement('div');
    row.className = 'message-row assistant';

    const avatar = document.createElement('div');
    avatar.className = 'assistant-avatar';
    avatar.innerHTML = ICONS.assistantLogo;

    const card = document.createElement('div');
    card.className = 'assistant-card';

    const textContainer = document.createElement('div');
    textContainer.className = 'message-text-content';
    textContainer.innerHTML = sanitizeMarkdown(rawMarkdown);

    // Actions bar with Copy response button
    const actionsBar = document.createElement('div');
    actionsBar.className = 'message-actions-bar';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn-copy';
    copyBtn.type = 'button';
    copyBtn.setAttribute('aria-label', 'Copy response to clipboard');
    copyBtn.innerHTML = `${ICONS.copy} <span>Copy</span>`;

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(rawMarkdown);
        copyBtn.classList.add('copied');
        copyBtn.innerHTML = `${ICONS.check} <span>Copied</span>`;
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.innerHTML = `${ICONS.copy} <span>Copy</span>`;
        }, 2000);
      } catch (err) {
        console.error('[universe.ai] Clipboard copy failed:', err);
      }
    });

    actionsBar.appendChild(copyBtn);
    card.appendChild(textContainer);
    card.appendChild(actionsBar);

    row.appendChild(avatar);
    row.appendChild(card);

    messagesStream.appendChild(row);
    scrollToBottom();
  }

  /**
   * Appends an error alert to the conversation stream.
   *
   * @param {string} errorMessage
   */
  function appendErrorMessage(errorMessage) {
    hideThinkingIndicator();

    const row = document.createElement('div');
    row.className = 'message-row assistant error-row';

    const avatar = document.createElement('div');
    avatar.className = 'assistant-avatar';
    avatar.innerHTML = ICONS.assistantLogo;

    const card = document.createElement('div');
    card.className = 'assistant-card';

    const errorContent = document.createElement('div');
    errorContent.className = 'error-content';
    errorContent.innerHTML = `${ICONS.error} <span>${sanitizeMarkdown(errorMessage)}</span>`;

    card.appendChild(errorContent);
    row.appendChild(avatar);
    row.appendChild(card);

    messagesStream.appendChild(row);
    scrollToBottom();
  }

  /**
   * Sends the current user message to /api/chat.
   *
   * @param {string} [customText] - Optional prompt override (e.g. from suggestions)
   */
  async function handleSendMessage(customText) {
    const textToSend = typeof customText === 'string'
      ? customText.trim()
      : messageInput.value.trim();

    if (!textToSend || isRequestPending) return;

    // Set lock
    isRequestPending = true;
    sendBtn.disabled = true;

    // Reset textarea
    if (!customText) {
      messageInput.value = '';
      resizeTextarea();
    }

    // 1. Append user message to UI
    appendUserMessage(textToSend);

    // 2. Show Matrix dot loader
    showThinkingIndicator();

    try {
      // 3. Send to backend endpoint
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: textToSend,
          history: conversationHistory,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data.error || `Server responded with status ${response.status}`;
        appendErrorMessage(errorMsg);
        return;
      }

      const reply = data.reply || 'No response received from Gemini.';

      // 4. Update in-memory history (browser session only)
      conversationHistory.push({ role: 'user', content: textToSend });
      conversationHistory.push({ role: 'assistant', content: reply });

      // 5. Render AI response
      appendAssistantMessage(reply);
    } catch (err) {
      console.error('[universe.ai] Chat request error:', err);
      appendErrorMessage('Network connection to the server failed. Please ensure the local server is running.');
    } finally {
      isRequestPending = false;
      resizeTextarea();
      // Keep textarea focused on non-touch devices
      if (window.matchMedia('(pointer: fine)').matches) {
        messageInput.focus();
      }
    }
  }

  /**
   * Resets the entire conversation back to the clean welcome screen.
   * Clears browser in-memory history and unblurs background.
   */
  function handleNewChat() {
    conversationHistory = [];
    isRequestPending = false;

    // Clear messages stream
    messagesStream.innerHTML = '';

    // Show welcome hero
    welcomeView.style.display = 'flex';
    document.body.classList.remove('is-chatting');

    // Reset composer
    messageInput.value = '';
    resizeTextarea();
    messageInput.focus();

    scrollToBottom();
  }

  /**
   * Event Listeners Registration
   */
  function bindEvents() {
    // Textarea input and auto-resize
    messageInput.addEventListener('input', resizeTextarea);

    // Keyboard handling: Enter to send, Shift+Enter for new line
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });

    // Form submission
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSendMessage();
    });

    // New Chat button
    newChatBtn.addEventListener('click', handleNewChat);
    logoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleNewChat();
    });

    // Suggested prompt cards
    suggestionCards.forEach((card) => {
      card.addEventListener('click', () => {
        const prompt = card.getAttribute('data-prompt');
        if (prompt) {
          handleSendMessage(prompt);
        }
      });
    });

    // Window resize observer for responsive layout adjustments
    window.addEventListener('resize', () => {
      resizeTextarea();
    });
  }

  // Initialize application
  function init() {
    initBackgroundVideo();
    bindEvents();
    resizeTextarea();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
