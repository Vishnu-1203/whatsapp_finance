const axios = require('axios');

// Read the credentials from the environment variables
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

/**
 * Sends a plain text WhatsApp message.
 * Use this for replying to a user within the 24-hour session window.
 * @param {string} to The recipient's phone number (e.g., "918086195819").
 * @param {string} text The text message to send.
 */
async function sendWhatsappText(to, text) {
  const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

  // This is the payload for a plain text message
  const body = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'text',
    text: {
      preview_url: false, // Optional: set to true to allow link previews
      body: text,
    },
  };

  const headers = {
    'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
    'Content-Type': 'application/json',
  };

  try {
    console.log(`Sending text message to ${to}: "${text}"`);
    await axios.post(url, body, { headers: headers });
    console.log('Text message sent successfully!');
  } catch (error) {
    console.error('Error sending WhatsApp text message:', error.response ? error.response.data : error.message);
    throw error;
  }
}

/**
 * Sends a WhatsApp template message.
 * @param {string} to The recipient's phone number.
 * @param {string} templateName The name of the template to send (e.g., 'hello_world').
 */
async function sendWhatsappTemplate(to, templateName) {
  // This is the URL from your curl command
  const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

  // This is the data payload (-d) from your curl command
  const body = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: 'en_US',
      },
    },
  };

  // These are the headers (-H) from your curl command
  const headers = {
    'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
    'Content-Type': 'application/json',
  };

  try {
    console.log(`Sending template '${templateName}' to ${to}`);
    await axios.post(url, body, { headers: headers });
    console.log('Template message sent successfully!');
  } catch (error) {
    console.error('Error sending WhatsApp template:', error.response ? error.response.data : error.message);
    throw error; // Re-throw the error to let the calling function know something went wrong
  }
}

module.exports = { sendWhatsappTemplate, sendWhatsappText };