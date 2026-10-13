const express = require('express');
const { generateChatResponse, MAX_MESSAGE_LENGTH, MAX_HISTORY_ITEMS } = require('../services/gemini');

const router = express.Router();

/**
 * POST /api/chat
 * Handles multi-turn chat interaction with Google Gemini.
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, history } = req.body || {};

    // Validate message presence and type
    if (typeof message !== 'string') {
      return res.status(400).json({
        error: 'Invalid request: "message" field is required and must be a string.'
      });
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return res.status(400).json({
        error: 'Message cannot be empty.'
      });
    }

    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        error: `Message exceeds the allowed limit of ${MAX_MESSAGE_LENGTH} characters.`
      });
    }

    // Validate history if present
    let validatedHistory = [];
    if (history !== undefined) {
      if (!Array.isArray(history)) {
        return res.status(400).json({
          error: 'Invalid request: "history" field must be an array of messages.'
        });
      }

      if (history.length > 50) {
        return res.status(400).json({
          error: 'History length exceeds permissible limit (maximum 50 messages).'
        });
      }

      for (const item of history) {
        if (!item || typeof item !== 'object') {
          return res.status(400).json({
            error: 'Each history entry must be an object with "role" and "content" properties.'
          });
        }

        if (item.role !== 'user' && item.role !== 'assistant') {
          return res.status(400).json({
            error: `Invalid role "${item.role}" in history. Allowed roles are "user" and "assistant".`
          });
        }

        if (typeof item.content !== 'string' || !item.content.trim()) {
          return res.status(400).json({
            error: 'History item content must be a non-empty string.'
          });
        }

        if (item.content.length > MAX_MESSAGE_LENGTH * 2) {
          return res.status(400).json({
            error: 'Individual history messages must not exceed maximum character limits.'
          });
        }
      }

      validatedHistory = history;
    }

    // Call Gemini service
    const reply = await generateChatResponse({
      message: trimmedMessage,
      history: validatedHistory
    });

    return res.status(200).json({ reply });
  } catch (error) {
    const status = error.statusCode || 500;
    const message = error.isOperational
      ? error.message
      : 'An unexpected internal server error occurred.';

    return res.status(status).json({ error: message });
  }
});

module.exports = router;
