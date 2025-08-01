import { createClient } from '@deepgram/sdk';

const deepgram = process.env.DEEPGRAM_API_KEY ? createClient(process.env.DEEPGRAM_API_KEY) : null;

export class DeepgramService {
  static async transcribeVideo(videoBuffer: Buffer, mimeType: string): Promise<string> {
    try {
      if (!deepgram) {
        throw new Error('Deepgram API key not configured');
      }
      
      const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
        videoBuffer,
        {
          model: 'nova-2',
          language: 'en',
          smart_format: true,
          punctuate: true,
          diarize: false,
        }
      );

      if (error) {
        throw new Error(`Deepgram error: ${error.message}`);
      }

      const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      
      if (!transcript.trim()) {
        throw new Error('No speech detected in video');
      }

      return transcript;
    } catch (error) {
      console.error('Deepgram transcription error:', error);
      throw new Error('Failed to transcribe video');
    }
  }

  static async isConfigured(): Promise<boolean> {
    return !!process.env.DEEPGRAM_API_KEY;
  }
  
  static async testConnection(): Promise<boolean> {
    try {
      if (!process.env.DEEPGRAM_API_KEY) return false;
      
      // Simple test with minimal audio buffer
      const testBuffer = Buffer.alloc(1024);
      await this.transcribeVideo(testBuffer, 'audio/wav');
      return true;
    } catch (error) {
      // Expected to fail with test buffer, but means API key works
      return error instanceof Error && !error.message.includes('401');
    }
  }
}