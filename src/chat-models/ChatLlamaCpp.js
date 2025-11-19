import { LlamaCpp } from '../llms/LlamaCpp.js';
import { ChatUserMessage, ChatModelResponse } from 'node-llama-cpp';

/**
 * Chat-optimized version of LlamaCpp
 */
export class ChatLlamaCpp extends LlamaCpp {
  /**
   * Convert messages to prompt format and invoke
   */
  async invoke(messages, options = {}) {
    // Convert chat messages to prompt
    const prompt = this._formatMessagesToPrompt(messages);
    return await super.invoke(prompt, options);
  }

  /**
   * Format array of messages into a single prompt
   */
  _formatMessagesToPrompt(messages) {
    if (typeof messages === 'string') {
      return messages;
    }

    return messages
      .map((msg) => {
        const role = msg.role || 'user';
        const content = msg.content || msg;
        return `${role}: ${content}`;
      })
      .join('\n');
  }
}