const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

let bot;

const initBot = () => {
  try {
    bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });
    console.log('✅ Telegram bot initialized');
    return bot;
  } catch (error) {
    console.error('❌ Bot initialization failed:', error);
    throw error;
  }
};

const getBot = () => {
  if (!bot) {
    throw new Error('Bot not initialized. Call initBot() first.');
  }
  return bot;
};

const uploadToTelegram = async (fileBuffer, fileName, mimeType) => {
  try {
    const bot = getBot();
    const channelId = process.env.TELEGRAM_CHANNEL_ID;
    
    const message = await bot.sendDocument(channelId, fileBuffer, {
      caption: `📁 ${fileName}\n📅 ${new Date().toISOString()}\n📦 ${mimeType}`
    }, {
      filename: fileName,
      contentType: mimeType
    });

    return {
      fileId: message.document.file_id,
      messageId: message.message_id,
      channelId: channelId
    };
  } catch (error) {
    console.error('Telegram upload error:', error);
    throw new Error('Failed to upload file to Telegram');
  }
};

const getFileFromTelegram = async (fileId) => {
  try {
    const bot = getBot();
    const fileData = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileData.file_path}`;
    return fileUrl;
  } catch (error) {
    console.error('Telegram file retrieval error:', error);
    throw new Error('Failed to get file from Telegram');
  }
};

const streamFileFromTelegram = async (fileId) => {
  try {
    const fileUrl = await getFileFromTelegram(fileId);
    const response = await axios({
      method: 'get',
      url: fileUrl,
      responseType: 'stream'
    });
    return response;
  } catch (error) {
    console.error('Telegram file streaming error:', error);
    throw new Error('Failed to stream file from Telegram');
  }
};

const deleteFromTelegram = async (channelId, messageId) => {
  try {
    const bot = getBot();
    await bot.deleteMessage(channelId, messageId);
    return true;
  } catch (error) {
    console.error('Telegram delete error:', error);
    return false;
  }
};

module.exports = {
  initBot,
  getBot,
  uploadToTelegram,
  getFileFromTelegram,
  streamFileFromTelegram,
  deleteFromTelegram
};
