const { PluginBase } = require('../../base');
const { request } = require('../../../core/http-client');
const { logger } = require('../../../core/logger');

const log = logger.child('plugin:discord');

class DiscordBotPlugin extends PluginBase {
  constructor(manifest) {
    super(manifest);
    this.token = process.env.DISCORD_BOT_TOKEN || '';
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL || '';

    this.registerCommand({
      name: 'discord-send',
      aliases: ['discord'],
      description: 'Send a message to Discord via webhook',
      usage: 'discord-send <message>',
      run: (args) => this.sendWebhook(args.join(' ')),
    });

    this.registerCommand({
      name: 'discord-status',
      description: 'Check Discord bot configuration status',
      usage: 'discord-status',
      run: () => this.checkStatus(),
    });
  }

  async sendWebhook(message) {
    if (!message.trim()) return { type: 'text', content: 'No message provided.' };
    if (!this.webhookUrl) {
      return { type: 'error', content: 'Discord webhook URL not configured. Set DISCORD_WEBHOOK_URL env var.' };
    }

    try {
      const res = await request(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'Jarvis',
          content: message,
        }),
        timeout: 5000,
      });

      if (res.status >= 200 && res.status < 300) {
        return { type: 'text', content: 'Message sent to Discord.' };
      }
      return { type: 'error', content: `Discord error: ${res.status}` };
    } catch (err) {
      return { type: 'error', content: `Discord send failed: ${err.message}` };
    }
  }

  checkStatus() {
    return {
      type: 'card',
      title: 'Discord Bot Status',
      content: [
        `Bot Token: ${this.token ? 'Configured' : 'Not set'}`,
        `Webhook URL: ${this.webhookUrl ? 'Configured' : 'Not set'}`,
      ].join('\n'),
    };
  }
}

module.exports = DiscordBotPlugin;
