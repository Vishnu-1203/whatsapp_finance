/**
 * Generates a prompt to classify user intent and extract transaction data.
 * This is the first prompt to run for any user message.
 * @param {string} userMessage The raw message from the user.
 * @returns {string} The complete prompt to be sent to the Gemini API.
 */
function parseUserIntent(userMessage) {
  return `You are an expert intent classifier and data extraction API. Your job is to analyze a user's message and determine their intent, which can be 'CREATE', 'READ', or 'BOTH'. You must also extract transaction data if the intent involves creating a record.

Your output MUST be a valid JSON object and nothing else. Do not add any explanatory text or any symbols or words like json or any markdown or such, the output should be pure JSON.

The user's message is: "${userMessage}"

- If the user wants to log, add, or record new information (like an expense or income), the intent is 'CREATE'.
- If the user is asking a question or requesting a summary/report, the intent is 'READ'.
- If the user is doing both of the above in the same message, the intent is 'BOTH'.

If the intent is 'CREATE' or 'BOTH', you MUST also extract the transaction details into a 'transaction' object.

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
}`;
}

/**
 * Generates a prompt for Gemini to create a SQL SELECT query for reporting.
 * @param {string} userMessage The user's question about their data.
 * @param {number} userId The ID of the user, to ensure the query is scoped to them.
 * @returns {string} The complete prompt to be sent to the Gemini API.
 */
function generateReportQueryPrompt(userMessage, userId) {
  return `You are a PostgreSQL expert who writes read-only SQL queries. Given the database schema and a user's question, generate a single, valid SQL SELECT query to answer it.
Your output MUST be only the SQL query and nothing else. Do not add any explanatory text or markdown.

The user's ID is: ${userId}

Database Schema:
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    type VARCHAR(10) NOT NULL, -- 'income' or 'expense'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

User Question: "${userMessage}"`;
}
function extractJson(text) {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("Could not find a valid JSON object in the response.");
  }

  const jsonString = text.substring(firstBrace, lastBrace + 1);
  return JSON.parse(jsonString);
}
module.exports = {extractJson,
  parseUserIntent,
  generateReportQueryPrompt,
};

