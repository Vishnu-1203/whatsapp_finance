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
  return `You are a PostgreSQL expert who writes read-only, parameterized SQL queries. Your primary goal is to provide rich, detailed data for reporting. Given the database schema and a user's question, you must generate a JSON object containing a SQL SELECT query and its corresponding parameters array.

Your output MUST be a valid JSON object and nothing else. Do not add any explanatory text or markdown.

The JSON object must have two keys:
1. "query": A string containing the SQL query with placeholders (e.g., $1, $2).
2. "params": An array containing the values for these placeholders in the correct order.

Core Requirements:
- The query MUST be filtered by the user's ID using "WHERE t.user_id = $1". The first element in the 'params' array MUST be the user's ID: ${userId}.
- To provide rich context, your query should almost always return detailed transaction data by JOINing \`transactions\` (aliased as \`t\`) with \`transaction_items\` (aliased as \`ti\`).
- **CRITICAL: To prevent incorrect totals from table joins, you MUST calculate the total sum using a subquery in the SELECT statement.** This subquery should select the sum from the \`transactions\` table and use the same filters as the main query.
- For queries filtering by item details (e.g., "spending on food"), the subquery for the total sum must also correctly filter the transactions before summing. Use an \`IN (SELECT transaction_id FROM ...)\` clause for this.
- For queries involving a LIMIT (e.g., "last 5 transactions"), it is better to use a Common Table Expression (CTE) to first select the limited transactions and then calculate the sum based on that CTE.

Database Schema:

CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    type VARCHAR(10) NOT NULL, -- 'income' or 'expense'
    description TEXT, -- Optional overall description for the transaction
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE transaction_items (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
    price_per_item NUMERIC(10, 2) NOT NULL,
    -- total_price is auto-calculated as quantity * price_per_item
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_transaction
        FOREIGN KEY(transaction_id)
        REFERENCES transactions(id)
        ON DELETE CASCADE
);

---
Example 1 User Question: "how much did i spend this month"
Example 1 Output:
{
  "query": "SELECT t.total_amount, t.created_at, ti.item_name, ti.quantity, ti.price_per_item, (SELECT SUM(total_amount) FROM transactions WHERE user_id = $1 AND type = $2 AND created_at >= date_trunc('month', current_date)) as total_sum FROM transactions t JOIN transaction_items ti ON t.id = ti.transaction_id WHERE t.user_id = $1 AND type = $2 AND created_at >= date_trunc('month', current_date) ORDER BY t.created_at DESC;",
  "params": [${userId}, "expense"]
}
---
Example 2 User Question: "what were my last 5 income transactions"
Example 2 Output:
{
  "query": "WITH LimitedTransactions AS (SELECT id, total_amount, created_at FROM transactions WHERE user_id = $1 AND type = $2 ORDER BY created_at DESC LIMIT 5) SELECT lt.total_amount, lt.created_at, ti.item_name, ti.quantity, ti.price_per_item, (SELECT SUM(total_amount) FROM LimitedTransactions) as total_sum FROM LimitedTransactions lt JOIN transaction_items ti ON lt.id = ti.transaction_id ORDER BY lt.created_at DESC;",
  "params": [${userId}, "income"]
}
---
Example 3 User Question: "show my spending on food"
Example 3 Output:
{
  "query": "SELECT t.total_amount, t.created_at, ti.item_name, ti.quantity, ti.price_per_item, (SELECT SUM(t_inner.total_amount) FROM transactions t_inner WHERE t_inner.user_id = $1 AND t_inner.type = $2 AND t_inner.id IN (SELECT transaction_id FROM transaction_items WHERE item_name ILIKE $3)) as total_sum FROM transactions t JOIN transaction_items ti ON t.id = ti.transaction_id WHERE t.user_id = $1 AND t.type = $2 AND ti.item_name ILIKE $3 ORDER BY t.created_at DESC;",
  "params": [${userId}, "expense", "%food%"]
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

  return `You are a helpful financial assistant. You will be given a user's original question and the data retrieved from a database. Your task is to formulate a clear, friendly, and natural language response.

Your output MUST be only the text response to be sent to the user, and nothing else. Do not add any explanatory text or markdown. Be concise and directly answer the question.

---
User's Original Question: "${userMessage}"
---
Data from Database (in JSON format):
${resultString}
---

**CRITICAL INSTRUCTIONS FOR INTERPRETING THE DATA:**

1.  **The Final Total is Already Calculated:** The \`total_sum\` field contains the final, correct total for the user's entire question. You MUST use this value for any summary total. It is the same in every row.

2.  **DO NOT SUM THE \`total_amount\` COLUMN:** The \`total_amount\` field is for a single transaction and is repeated for each item in that transaction. Summing this column yourself will result in a wildly incorrect, inflated number.

3.  **How to Answer:**
    *   If the user asks for a simple total (e.g., "how much did I spend?"), your primary job is to take the value from \`total_sum\` and present it.
    *   If the user asks for a list or a breakdown, you can show the individual items using \`item_name\` and \`price_per_item\`. Then, present the final total using the single \`total_sum\` value.

---
Example 1 User Question: "What are my total expenses today?"
Example 1 Data:
[
  {
    "total_amount": "350.00",
    "item_name": "lunch",
    "total_sum": "15150.00"  // <-- USE THIS
  },
  {
    "total_amount": "14800.00",
    "item_name": "mouse",
    "total_sum": "15150.00"  // <-- USE THIS
  },
  {
    "total_amount": "14800.00",
    "item_name": "keyboard",
    "total_sum": "15150.00"  // <-- USE THIS
  }
]
Example 1 Your Response: Your total expenses today are ₹15,150.00.
---
Example 2 User Question: "list my expenses from yesterday"
Example 2 Data:
[
  {
    "total_amount": "350.00",
    "item_name": "lunch",
    "price_per_item": "350.00",
    "total_sum": "425.00"
  },
  {
    "total_amount": "75.00",
    "item_name": "coffee",
    "price_per_item": "75.00",
    "total_sum": "425.00"
  }
]
Example 2 Your Response: Yesterday, you spent a total of ₹425.00. Here's the breakdown:\n- lunch: ₹350.00\n- coffee: ₹75.00
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
  return `You are "Finance Bot", a friendly and helpful financial assistant on WhatsApp. A user has sent a message that isn't a direct command to log a transaction or ask for a financial report. Your task is to respond appropriately while gently guiding the user back to your core features.

The user's original message was: "${userMessage}"

Your output MUST be only the text response to be sent to the user, and nothing else. Do not add any explanatory text or markdown.

Follow these steps for your response:
1.  Acknowledge the user's message. If it's a question, provide a brief, helpful answer. If it's a greeting, respond warmly.
2.  After your initial answer/greeting, smoothly transition into your main purpose.
3.  Introduce yourself as "Finance Bot" and explain that you help track income and expenses.
4.  Give a simple example of how to log an expense (e.g., "I bought coffee for 20").
5.  Give a simple example of how to ask a question (e.g., "How much did I spend this week?").
6.  Keep the overall tone friendly, helpful, and concise.

---
Example 1 (Greeting)
User Message: "hey"
Your Response:
Hello there! I'm your personal finance assistant on WhatsApp. I can help you track your daily expenses and income.

You can tell me things like "I spent 50 on snacks" or ask me "What were my total expenses last month?".

How can I help you today?
---
Example 2 (General Question)
User Message: "what is your name?"
Your Response:
You can call me Finance Bot! I'm here to help you manage your finances.

To get started, you can log an expense like "I bought a book for 150" or ask for a summary like "What did I spend on this week?".
---
Example 3 (Finance-related Question)
User Message: "what is inflation?"
Your Response:
Inflation is the rate at which the general level of prices for goods and services is rising, and subsequently, purchasing power is falling.

Tracking your expenses is a great first step to managing your money during inflationary periods! As Finance Bot, I can help you with that. Just tell me things like "spent 100 on fuel" and I'll keep a record for you.
---

Now, generate a response based on the user's message: "${userMessage}"`;
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
