require("dotenv").config();
const express=require("express");

const dbFunctions=require("./database/db");
const {parseUserIntent,generateReportQueryPrompt,extractJson,generateResponseMessagePrompt,generateIntroductoryMessagePrompt}=require("./gemini/helpFunctions");
const {geminiRequest}=require("./gemini/gemini");
const {sendWhatsappText}=require("./whatsapp/api")
const {processTableContentForReporting}=require("./calcFunctions")

const app=express();
app.use(express.json());

const PORT=process.env.PORT||3000;
const WHATSAPP_VERIFY_TOKEN=process.env.WHATSAPP_VERIFY_TOKEN;


app.get("/",(req,res)=>{
  console.log("Root endpoint was hit");
  res.status(200).send("Server is up and running!");
})

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

  // It's helpful to stringify the body to see the full structure in logs
  console.log("post hit");

  // Check if this is a message from a user
  if (body.object === 'whatsapp_business_account') {
    const value = body.entry?.[0]?.changes?.[0]?.value;

    // Check if the notification is a user message
    if (value?.messages?.[0]) {
      const message = value.messages[0];
      const userMessage = message.text?.body;
      const userPhone = message.from;

      // Ensure we have a message and phone number to process
      if (userMessage && userPhone) {
        try {
            console.log(`Message: "${userMessage}", From: ${userPhone}`);

            const userId = await dbFunctions.findOrCreateUserByPhone(userPhone);
            console.log(`Database user ID: ${userId}`);

            const initialJson = extractJson(await geminiRequest(parseUserIntent(userMessage)));
            console.log(initialJson, "initial json");

            const choice = initialJson.intent;
            console.log(choice, "choice");

            switch (choice) {
              case "CREATE": {
                  console.log("INTENT CREATE");
                  await dbFunctions.createTransaction(userId, initialJson);
                  await sendWhatsappText(userPhone, "Your transaction has been logged successfully!");
                  console.log("Transaction Over");
                break;
              }
              case "READ": {
                console.log("INTENT READ");
                const queryObject=await geminiRequest(generateReportQueryPrompt(userMessage,userId));
                const extractedQueryObject= extractJson(queryObject);
                const tableContent= await dbFunctions.executeQuery(extractedQueryObject.query,extractedQueryObject.params);
                console.log("TABLE CONTENT:\n", tableContent);
                const processedContent = processTableContentForReporting(tableContent, userMessage);
                const resportUser=await geminiRequest(generateResponseMessagePrompt(processedContent,userMessage));
                await sendWhatsappText(userPhone, resportUser);
                console.log("Report Over");
                break;
              }

              case "BOTH": {
                console.log("INTENT BOTH");
                // 1. CREATE the transaction first.
                // The initial JSON from parseUserIntent has what we need.
                await dbFunctions.createTransaction(userId, initialJson);
                console.log("Transaction part of BOTH intent is created.");

                // 2. READ the report data.
                // We reuse the same functions as the READ case, passing the full original message.
                // The AI is smart enough to find the question within the message.
                const queryObject = await geminiRequest(generateReportQueryPrompt(userMessage, userId));
                const extractedQueryObject = extractJson(queryObject);

                const tableContent = await dbFunctions.executeQuery(extractedQueryObject.query, extractedQueryObject.params);
                console.log("TABLE CONTENT FOR BOTH:\n", tableContent);
                const processedContent = processTableContentForReporting(tableContent, userMessage);

                // 3. Generate a single, combined response for the user.
                // By passing the full original message, the AI knows to acknowledge the transaction
                // AND provide the report.
                const finalMessage = await geminiRequest(generateResponseMessagePrompt(processedContent, userMessage));

                // 4. Send the final message.
                await sendWhatsappText(userPhone, finalMessage);
                console.log("Both intent handled and report sent.");
                break;
              }
              case "OTHER":{
                console.log("INTENT OTHER");
                const response=await geminiRequest(generateIntroductoryMessagePrompt(userMessage));
                await sendWhatsappText(userPhone, response)

                break;
                }

              default:
                console.log("intent cannot be classified");
                break;
            }
              
        
        } catch (error) {
          console.error('Error processing message:', error);
          // Let the user know something went wrong.
          try {
            await sendWhatsappText(userPhone, "I'm sorry, I ran into an error and couldn't process your request. Please try again.");
          } catch (sendError) {
            console.error('Failed to send error message to user:', sendError);
          }
          }
      }
    } else if (value?.statuses?.[0]) {
      // This is a status update for a message we sent
      const status = value.statuses[0];
      console.log(`Status update: Message to ${status.recipient_id} is now ${status.status}`);
    } else {
      // A different kind of notification we aren't handling
      console.log("Received a webhook notification that was not a message or status update.");
    }
  }

  res.sendStatus(200); // Acknowledge receipt of the message
});
app.listen(PORT,()=>{
    console.log(process.env.WHATSAPP_VERIFY_TOKEN)

    console.log(`Server is listening on port ${PORT}`)
});
