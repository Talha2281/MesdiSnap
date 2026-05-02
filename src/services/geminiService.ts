import { GoogleGenAI } from "@google/genai";

const getAI = (userKey?: string) => {
  const apiKey = userKey || (process.env.GEMINI_API_KEY as string);
  if (!apiKey) {
    throw new Error("Gemini API Key is required. Please set it in the environment.");
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeMedicalDocument = async (
  inputMode: 'upload' | 'text',
  inputValue: string,
  fileData: string | null,
  language: 'en' | 'ur' | 'hi',
  userApiKey: string
) => {
  const ai = getAI(userApiKey);
  const modelName = "gemini-3-flash-preview";

  const targetLangName = language === 'ur' ? 'URDU' : language === 'hi' ? 'HINDI' : 'ENGLISH';
  const targetLangScript = language === 'ur' ? 'proper Nastaliq Urdu script' : language === 'hi' ? 'Devanagari Hindi script' : 'English';

  let prompt = `You are a professional medical assistant and expert OCR transcriber.
    
    CORE RULE: You MUST translate and provide ALL information in ${targetLangName}. 
    Even if the document is in English, your entire JSON response (values only) must be in ${targetLangName} using ${targetLangScript}.
    
    TASK: Analyze the provided ${inputMode === 'upload' ? 'image' : 'text'}.
    
    DETECTION: First, determine if this is a:
    1. PRESCRIPTION/MEDICINE LABEL: Contains medication names and instructions.
    2. MEDICAL REPORT: Contains lab results, blood work, or diagnostic summaries.
    
    JSON STRUCTURE (All values MUST be in ${targetLangName}):
    {
      "document_type": "prescription" | "report",
      "summary": "Full detailed summary of the document",
      "medicines": [ // ONLY if type is prescription
        {
          "medicine_name": "Full name",
          "generic_name": "Scientific name",
          "dosage": "Instructions",
          "when_to_take": "Timing",
          "what_it_treats": ["Condition"],
          "extra_notes": "Advice"
        }
      ],
      "report_details": { // ONLY if type is report
        "key_findings": ["Finding 1", "Finding 2"],
        "vitals_or_results": [{"parameter": "Hemoglobin", "value": "14.2", "status": "Normal/High/Low"}],
        "doctor_recommendation": "Summary of advice"
      }
    }
    
    CRITICAL: Return ONLY valid JSON. If image is not a medical document, return {"error": "not_medical"}.`;

  if (inputMode === 'text') {
    prompt += `\n\nAnalyze this: ${inputValue}`;
  }

  let contents: any;
  if (inputMode === 'upload' && fileData) {
    contents = {
      parts: [
        { inlineData: { mimeType: "image/jpeg", data: fileData } },
        { text: prompt }
      ]
    };
  } else {
    contents = prompt;
  }

  const response = await ai.models.generateContent({
    model: modelName,
    contents: contents,
    config: {
      responseMimeType: "application/json"
    }
  });

  const text = response.text || '';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
};

export const chatWithPrescription = async (
  message: string,
  context: any,
  language: 'en' | 'ur' | 'hi',
  userApiKey: string
) => {
  const ai = getAI(userApiKey);
  const modelName = "gemini-2.0-flash";

  const prompt = `The user is asking a follow-up question about a medical document (prescription or lab report).
    Medical Context: ${JSON.stringify(context)}
    User question: ${message}
    Answer in 2-3 sentences in plain, simple language. Respond in ${
      language === 'ur' ? 'Urdu' : language === 'hi' ? 'Hindi' : 'English'
    }.`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
  });

  return response.text || '';
};

export const getHealthInsights = async (
  history: any[],
  language: 'en' | 'ur' | 'hi',
  userApiKey: string
) => {
  const ai = getAI(userApiKey);
  const modelName = "gemini-3-flash-preview";

  const prompt = `You are a motivating health companion. 
    Analyze this user's adherence history: ${JSON.stringify(history)}
    Goal: Provide 1 punchy, empathetic insight about their behavior and 1 piece of advice.
    If they missed a dose, use "Excuse Buster" logic: explain why they MUST take it even if they feel better or are busy.
    Language: ${language === 'ur' ? 'Urdu' : 'English'}.
    Keep it short (max 40 words).`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
  });

  return response.text || '';
};
