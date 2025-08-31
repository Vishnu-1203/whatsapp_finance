require("dotenv").config();
const express=require("express");

const dbFunctions=require("./database/db");

const app=express();
app.use(express.json());

const PORT=process.env.PORT||3000;
const WHATSAPP_VERIFY_TOKEN=process.env.WHATSAPP_VERIFY_TOKEN;
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  console.log(process.env.WHATSAPP_VERIFY_TOKEN)
  // Check if a token and mode is in the query string of the request
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
      // Respond with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      // Respond with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});

app.post('/webhook', async (req, res) => {
  const body = req.body;


  // Check if this is a message from a user
  if (body.object === 'whatsapp_business_account') {
    try {
      // TODO: Process the message
      // e.g., get the user's message and phone number
      const userMessage = body.entry[0]?.changes[0]?.value?.messages[0]?.text?.body;
      const userPhone = body.entry[0]?.changes[0]?.value?.messages[0]?.from;
      console.log(`Message: "${userMessage}", From: ${userPhone}`);

      const userId = await dbFunctions.findOrCreateUserByPhone(userPhone);
      console.log(`Database user ID: ${userId}`);
    } catch (error) {
      console.error('Error processing webhook:', error);
    }
  }

  res.sendStatus(200); // Acknowledge receipt of the message
});
app.listen(PORT,()=>{
    console.log(process.env.WHATSAPP_VERIFY_TOKEN)

    console.log(`Server is listening on port ${PORT}`)
});
