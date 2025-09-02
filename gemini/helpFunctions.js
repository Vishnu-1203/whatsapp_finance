/**
 * Generates a prompt to classify user intent and extract transaction data.
 * This is the first prompt to run for any user message.
 * @param {string} userMessage The raw message from the user.
 * @returns {string} The complete prompt to be sent to the Gemini API.
 */
function parseUserIntent(userMessage) {
  return `You are an expert intent classifier and data extraction API. Your job is to analyze a user's message and determine their intent, which can be 'CREATE', 'READ', 'BOTH', or 'OTHER'. You must also extract transaction data if the intent involves creating a record.

Your output MUST be a valid JSON object and nothing else. Do not add any explanatory text or any symbols or words like json or any markdown or such, the output should be pure JSON.

The user's message is: "${userMessage}"

- If the user wants to log, add, or record new information (like an expense or income), the intent is 'CREATE'.
- If the user is asking a question or requesting a summary/report about their finances, the intent is 'READ'.
- If the user is doing both of the above in the same message, the intent is 'BOTH'.
- If the message is a greeting, a general non-financial question, or anything that doesn't fit the above categories, the intent is 'OTHER'.

If the intent is 'CREATE' or 'BOTH', you MUST also extract the transaction details into a 'transaction' object. If the intent is 'READ' or 'OTHER', there will be no 'transaction' object.

---
Example 1 Input Message: "i bought 2 milkshakes for 20rs and 1 coffee for 15"
Example 1 Output Format:
{
  "intent": "CREATE",
  "transaction": {
    "type": "expense",
    "items": [
      { "item_name": "milkshake", "quantity": 2, "price_per_item": 10 },
      { "item_name": "coffee", "quantity": 1, "price_per_item": 15 }
    ]
  }
}
---
Example 2 Input Message: "how much did i spend this week?"
Example 2 Output Format:
{
  "intent": "READ"
}
---
Example 3 Input Message: "received 5000rs salary"
Example 3 Output Format:
{
  "intent": "CREATE",
  "transaction": {
    "type": "income",
    "items": [
      { "item_name": "salary", "quantity": 1, "price_per_item": 5000 }
    ]
  }
}
---
Example 4 Input Message: "Log that I bought a pizza for 250. Also, what were my total expenses last month?"
Example 4 Output Format:
{
  "intent": "BOTH",
  "transaction": {
    "type": "expense",
    "items": [
      { "item_name": "pizza", "quantity": 1, "price_per_item": 250 }
    ]
  }
}
---
Example 5 Input Message: "hey how are you doing"
Example 5 Output Format:
{
  "intent": "OTHER"
}
---
Example 6 Input Message: "what is your name?"
Example 6 Output Format:
{
  "intent": "OTHER"
}`;
}

/**
 * Generates a prompt for Gemini to create a SQL SELECT query for reporting.
 * @param {string} userMessage The user's question about their data.
 * @param {number} userId The ID of the user, to ensure the query is scoped to them.
 * @returns {string} The complete prompt to be sent to the Gemini API.
 */
function generateReportQueryPrompt(userMessage, userId) {
  return `You are a PostgreSQL expert who writes read-only, parameterized SQL queries. Given the database schema and a user's question, you must generate a JSON object containing a SQL SELECT query and its corresponding parameters array.

Your output MUST be a valid JSON object and nothing else. Do not add any explanatory text or markdown.

The JSON object must have two keys:
1. "query": A string containing the SQL query with placeholders (e.g., $1, $2).
2. "params": An array containing the values for these placeholders in the correct order.

Crucially, the query MUST include a "WHERE user_id = $1" clause, and the first element in the 'params' array MUST be the user's ID.

Database Schema:
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    type VARCHAR(10) NOT NULL, -- 'income' or 'expense'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

---
Example 1 User Question: "how much did i spend this month"
Example 1 Output:
{
  "query": "SELECT SUM(total_amount) as total FROM transactions WHERE user_id = $1 AND type = $2 AND created_at >= date_trunc('month', current_date);",
  "params": ["${userId}", "expense"]
}
---
Example 2 User Question: "what were my last 5 income transactions"
Example 2 Output:
{
  "query": "SELECT total_amount, created_at FROM transactions WHERE user_id = $1 AND type = $2 ORDER BY created_at DESC LIMIT 5;",
  "params": ["${userId}", "income"]
}
---
User Question: "${userMessage}"`;
}

/**
 * Generates a prompt for Gemini to convert structured query results into a natural language response.
 * @param {Array<Object>} queryResult The data returned from the database query.
 * @param {string} userMessage The original message/question from the user.
 * @returns {string} The complete prompt to be sent to the Gemini API.
 */
function generateResponseMessagePrompt(queryResult, userMessage) {
  const resultString = JSON.stringify(queryResult, null, 2);

  return `You are a helpful financial assistant. You will be given a user's original question and the data retrieved from a database to answer that question. Your task is to formulate a clear, friendly, and natural language response for the user.

Your output MUST be only the text response to be sent to the user, and nothing else. Do not add any explanatory text or markdown. Be concise and directly answer the question.

---
User's Original Question: "${userMessage}"
---
Data from Database (in JSON format):
${resultString}
---

Here are some examples of how to respond:

---
Example 1 User Question: "how much did i spend this month"
Example 1 Data: [{ "total": "1550.75" }]
Example 1 Your Response: You've spent a total of ₹1550.75 this month.
---
Example 2 User Question: "what were my last 2 expenses"
Example 2 Data: [{ "total_amount": "250.00", "created_at": "2024-09-01T10:00:00.000Z" }, { "total_amount": "75.00", "created_at": "2024-08-30T15:30:00.000Z" }]
Example 2 Your Response: Here are your last 2 expenses:\n- ₹250.00 on September 1\n- ₹75.00 on August 30
---
Example 3 User Question: "did i buy any coffee this week"
Example 3 Data: []
Example 3 Your Response: I couldn't find any records of you buying coffee this week.
---

Now, based on the user's question and the data provided above, generate the response. Your Response:`;
}

/**
 * Generates a prompt for Gemini to create a friendly introductory message for new or confused users.
 * @param {string} userMessage The original message from the user, which triggered this introductory response.
 * @returns {string} The complete prompt to be sent to the Gemini API.
 */
function generateIntroductoryMessagePrompt(userMessage) {
  return `You are a friendly financial assistant chatbot for WhatsApp. A user has sent a message that isn't a command to log a transaction or ask a financial question. Your task is to introduce yourself and briefly explain what you can do, while acknowledging their original message.

The user's original message was: "${userMessage}"

Your output MUST be only the text response to be sent to the user, and nothing else. Do not add any explanatory text or markdown.

Keep the tone friendly, helpful, and concise.

Here are the key points to include:
- Greet the user.
- State that you are a financial assistant.
- Mention that you can help track expenses and income.
- Give a simple example of how to log an expense (e.g., "I bought coffee for 20").
- Give a simple example of how to ask a question (e.g., "How much did I spend this week?").

Example Response (if user sent "hey"):
Hello there! I'm your personal finance assistant on WhatsApp. I can help you track your daily expenses and income.

You can tell me things like "I spent 50 on snacks" or ask me "What were my total expenses last month?".

How can I help you today?`;
}

function extractJson(text) {
  // Look for JSON inside ```json ... ``` or just ``` ... ```
  const jsonRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
  const match = text.match(jsonRegex);

  let jsonString;

  if (match && match[1]) {
    // If a markdown block is found, use its content
    jsonString = match[1].trim();
  } else {
    // Otherwise, fall back to the original method of finding the first and last brace
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
      console.error("Could not find JSON in the following text:", text);
      throw new Error("Could not find a valid JSON object in the response.");
    }
    jsonString = text.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("Failed to parse the following string as JSON:", jsonString);
    throw e; // Re-throw the original error
  }
}

/**
 * Extracts a SQL query from a text response, handling potential markdown code blocks.
 * It also performs a basic validation to ensure the query is a SELECT statement.
 * @param {string} text The raw text response from the Gemini API.
 * @returns {string} The cleaned SQL query.
 * @throws {Error} If a valid SELECT query cannot be found.
 */
function extractSqlQuery(text) {
  // Regular expression to find content within ```sql ... ``` or just ``` ... ```
  const sqlRegex = /```(?:sql)?\s*([\s\S]*?)\s*```/;
  const match = text.match(sqlRegex);

  let query;
  if (match && match[1]) {
    // If a markdown block is found, use its content
    query = match[1].trim();
  } else {
    // Otherwise, assume the whole text is the query and trim any surrounding whitespace/newlines
    query = text.trim();
  }

  // Basic validation: check if it's a SELECT query.
  if (!query.toLowerCase().startsWith('select')) {
    throw new Error("The extracted text does not appear to be a valid SELECT SQL query.");
  }

  return query;
}


module.exports = {extractJson, extractSqlQuery,
  parseUserIntent,
  generateReportQueryPrompt,
  generateResponseMessagePrompt,
  generateIntroductoryMessagePrompt
};
