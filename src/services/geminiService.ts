import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

interface BrainGenerationAnswers {
  [key: string]: string;
}

interface ChatMessage {
  sender: string;
  text: string;
}

/**
 * Generate twin personality/brain from onboarding questionnaire
 */
export const generateTwinBrain = async (answers: BrainGenerationAnswers): Promise<any> => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    const prompt = `
      Analyze the following personality questionnaire answers and create a detailed digital brain profile for an AI twin.
      The profile should include:
      1. Personality traits (MBTI-like or descriptive)
      2. Communication style
      3. Core values and beliefs
      4. Tone of voice guidelines
      5. Background story summary

      User Answers:
      ${JSON.stringify(answers, null, 2)}

      Output the result as a clean JSON object.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Basic JSON extraction if Gemini wraps it in code blocks
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
  } catch (error) {
    console.error('Gemini Service Error:', error);
    throw new Error('Failed to generate twin brain');
  }
};

/**
 * Generate a conversational response from the AI twin
 */
export const generateResponse = async (
  twinData: any,
  userMessage: string,
  history: ChatMessage[] = []
): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const chat = model.startChat({
      history: history.map(h => ({
        role: h.sender === 'USER' ? 'user' : 'model',
        parts: [{ text: h.text }]
      })),
      generationConfig: {
        maxOutputTokens: 500,
      },
    });

    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini Chat Error:', error);
    throw new Error('Failed to generate response');
  }
};
