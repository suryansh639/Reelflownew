import ffmpeg from 'fluent-ffmpeg';
import ffprobe from 'ffprobe-static';
import { DeepgramService } from './deepgram';
import { GeminiService, type EducationalAnalysis } from './gemini';

ffmpeg.setFfprobePath(ffprobe.path);

export interface VideoValidationResult {
  isValid: boolean;
  errors: string[];
  duration?: number;
  fileSize: number;
  educationalAnalysis?: EducationalAnalysis;
  transcript?: string;
}

export class VideoValidator {
  private static readonly MAX_DURATION_SECONDS = 60; // 1 minute
  private static readonly MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

  static async validateVideo(file: Express.Multer.File): Promise<VideoValidationResult> {
    const result: VideoValidationResult = {
      isValid: true,
      errors: [],
      fileSize: file.size,
    };

    // Check file size
    if (file.size > this.MAX_FILE_SIZE_BYTES) {
      result.isValid = false;
      result.errors.push(`File size (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds maximum allowed size of 10MB`);
    }

    try {
      // Get video duration
      const duration = await this.getVideoDuration(file.buffer);
      result.duration = duration;

      if (duration > this.MAX_DURATION_SECONDS) {
        result.isValid = false;
        result.errors.push(`Video duration (${duration}s) exceeds maximum allowed duration of ${this.MAX_DURATION_SECONDS} seconds`);
      }

      // If basic validation fails, don't proceed with educational analysis
      if (!result.isValid) {
        return result;
      }

      // Check if services are configured
      const isDeepgramConfigured = await DeepgramService.isConfigured();
      const isGeminiConfigured = await GeminiService.isConfigured();

      if (!isDeepgramConfigured || !isGeminiConfigured) {
        result.errors.push('Educational content validation is not configured');
        return result;
      }

      // Transcribe video
      console.log('Transcribing video with Deepgram...');
      const transcript = await DeepgramService.transcribeVideo(file.buffer, file.mimetype);
      result.transcript = transcript;

      if (!transcript.trim()) {
        result.isValid = false;
        result.errors.push('No speech detected in video. Educational videos must contain spoken content.');
        return result;
      }

      // Analyze educational content
      console.log('Analyzing educational content with Gemini...');
      const educationalAnalysis = await GeminiService.analyzeEducationalContent(transcript);
      result.educationalAnalysis = educationalAnalysis;

      if (!educationalAnalysis.is_educational) {
        result.isValid = false;
        result.errors.push(`Video content is not educational. ${educationalAnalysis.reason || 'Please upload educational content only.'}`);
      }

    } catch (error) {
      console.error('Video validation error:', error);
      result.isValid = false;
      result.errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  private static async getVideoDuration(buffer: Buffer): Promise<number> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg();
      
      // Create a readable stream from buffer
      const stream = require('stream').Readable.from(buffer);

      command
        .input(stream)
        .ffprobe((err: any, metadata: any) => {
          if (err) {
            reject(new Error(`Failed to analyze video: ${err.message}`));
            return;
          }

          const duration = metadata.format.duration;
          if (typeof duration !== 'number') {
            reject(new Error('Could not determine video duration'));
            return;
          }

          resolve(Math.round(duration));
        });
    });
  }
}