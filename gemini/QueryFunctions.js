/**
 * Generates a prompt for Gemini to extract transaction data from a user's message.
 * This prompt is designed to return structured JSON, not SQL, for safety.
 * @param {string} userMessage The raw message from the user.
 * @returns {string} The complete prompt to be sent to the Gemini API.
 */
function generateDataExtractionPrompt(userMessage) {
  // We use a template literal (the backticks ``) to easily insert the user's message.
  // We also provide multiple examples (few-shot prompting) to guide the AI.
  return `You are an expert data extraction API. Your job is to parse a user's message and extract transaction details.
Your output MUST be a valid JSON object and nothing else. Do not add any explanatory text.

The user's message is: "${userMessage}"

Based on the message, determine if it is an 'income' or 'expense' transaction.
Extract the items into a JSON object with a "type" and an "items" array.
Each item in the array should have "item_name", "quantity", and "price_per_item".
If a total price is given for multiple items, calculate the price_per_item.

Example 1 Input Message: "i bought 2 milkshakes for 20rs and 1 coffee for 15"
Example 1 Output Format:
{
  "type": "expense",
  "items": [
    { "item_name": "milkshake", "quantity": 2, "price_per_item": 10 },
    { "item_name": "coffee", "quantity": 1, "price_per_item": 15 }
  ]
}

Example 2 Input Message: "received 5000rs salary"
Example 2 Output Format:
{
  "type": "income",
  "items": [
    { "item_name": "salary", "quantity": 1, "price_per_item": 5000 }
  ]
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

module.exports = {
  generateDataExtractionPrompt,
  generateReportQueryPrompt,
};