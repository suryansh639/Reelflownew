import { createClient } from '@deepgram/sdk';

const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);

export class DeepgramService {
  static async transcribeVideo(videoBuffer: Buffer, mimeType: string): Promise<string> {
    try {
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
}