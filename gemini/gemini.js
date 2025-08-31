const {GoogleGenerativeAI}=require('@google/generative-ai');
require("dotenv").config();
const genAI=new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const {parseUserIntent} =require("./helpFunctions")

async function geminiRequest(prompt){
    try{

    console.log("sending to gemini...");
    const model=genAI.getGenerativeModel({model:"gemini-1.5-flash-latest"});
    const result=await model.generateContent(prompt);
    const text= result.response.text();
    console.log(text,"gemini response received.");
    return text;
}
    catch(error){
        console.log(error);
    }
}
geminiRequest(parseUserIntent("i bought a milkshake for 20 rs"))
module.exports={geminiRequest};