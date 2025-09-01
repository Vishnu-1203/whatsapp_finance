require("dotenv").config();

const { geminiRequest } = require("./gemini/gemini");
const {
  extractSqlQuery,
  generateReportQueryPrompt,
  extractJson,
} = require("./gemini/helpFunctions");

// We wrap the logic in an async function to use 'await'
async function runTest() {
  try {
    const prompt = generateReportQueryPrompt("i want my spendings report, my id is 3", "7");
    // 'await' pauses the function until the promise from geminiRequest is resolved
    const geminiResponseText = await geminiRequest(prompt);
    const sqlQuery = extractJson(geminiResponseText);
    console.log("Extracted SQL Query:\n", sqlQuery.query);
  } catch (error) {
    console.error("Error during test run:", error);
  }
}

// Call the async function to run the test
runTest();