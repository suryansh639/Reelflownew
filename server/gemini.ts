import { GoogleGenAI } from '@google/genai';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface EducationalAnalysis {
  is_educational: boolean;
  topic?: string;
  confidence?: number;
  reason?: string;
}

export class GeminiService {
  static async analyzeEducationalContent(transcript: string): Promise<EducationalAnalysis> {
    try {
      const model = 'gemini-2.5-flash';

      const prompt = `You are an expert at identifying educational video content.

Below is the transcript of a short video:

"""
${transcript}
"""

Determine whether this video is educational in nature (e.g., teaching something, explaining a topic, sharing useful knowledge, tutorials, how-to guides, academic content, skill development, informative content).

Educational content includes:
- Tutorials and how-to videos
- Academic lectures or lessons
- Skill demonstrations
- Scientific explanations
- Historical information
- Language learning
- Professional development
- Technical explanations
- DIY instructions
- Educational storytelling

Non-educational content includes:
- Entertainment content
- Personal vlogs without educational value
- Pure gaming content
- Music videos
- Comedy skits
- Social media trends
- Promotional content

Reply with a JSON object:
{
  "is_educational": true or false,
  "topic": "Short description of the subject if educational",
  "confidence": 0.0 to 1.0,
  "reason": "Brief explanation of the decision"
}`;

      const result = await genAI.models.generateContent({
        model,
        contents: prompt,
      });

      const text = result.text || '';

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format from Gemini');
      }

      const analysis: EducationalAnalysis = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (typeof analysis.is_educational !== 'boolean') {
        throw new Error('Invalid analysis result');
      }

      return analysis;
    } catch (error) {
      console.error('Gemini analysis error:', error);
      throw new Error('Failed to analyze educational content');
    }
  }

  static async isConfigured(): Promise<boolean> {
    return !!process.env.GEMINI_API_KEY;
  }
}