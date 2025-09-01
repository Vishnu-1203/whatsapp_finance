/**
 * Pre-processes database results before sending them to the AI for summarization.
 * If the user's query asks for a total/sum, this function calculates it reliably.
 * @param {Array<Object>} tableContent The raw data from the database.
 * @param {string} userMessage The user's original message.
 * @returns {Array<Object>} The original content, or a new summary object if a calculation was performed.
 */
function processTableContentForReporting(tableContent, userMessage) {
  const lowerCaseMessage = userMessage.toLowerCase();
  const wantsTotal = lowerCaseMessage.includes('total') || lowerCaseMessage.includes('sum') || lowerCaseMessage.includes('how much');

  // Only perform calculation if the user asked for a total and we have data to process.
  if (wantsTotal && tableContent.length > 0) {
    // Check if the data is already aggregated by the database (e.g., from a SUM() or COUNT() query).
    const firstRow = tableContent[0];
    const isAggregated = 'sum' in firstRow || 'total' in firstRow || 'count' in firstRow;

    if (isAggregated) {
      // Data is already aggregated, use it as is.
      return tableContent;
    } else {
      // Data is a list of transactions, so we need to sum it up reliably here.
      const total = tableContent.reduce((acc, transaction) => {
        // total_amount is a string from the DB, so we must parse it.
        return acc + parseFloat(transaction.total_amount || 0);
      }, 0);

      // Create a new, simple summary object for the AI to format.
      return [{ total_calculated: total.toFixed(2) }];
    }
  }

  // If the user doesn't want a total, or there's no content, return the original data.
  return tableContent;
}

module.exports={processTableContentForReporting}