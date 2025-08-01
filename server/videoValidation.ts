import ffprobe from 'ffprobe-static';
import ffmpeg from 'fluent-ffmpeg';

export interface VideoValidationResult {
  isValid: boolean;
  duration?: number;
  error?: string;
}

export class VideoValidationService {
  static async validateVideoDuration(filePath: string): Promise<VideoValidationResult> {
    return new Promise((resolve) => {
      ffmpeg.setFfprobePath(ffprobe.path);
      
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          resolve({
            isValid: false,
            error: "Failed to analyze video file"
          });
          return;
        }

        const duration = metadata.format.duration;
        
        if (!duration) {
          resolve({
            isValid: false,
            error: "Could not determine video duration"
          });
          return;
        }

        // Check if duration is more than 60 seconds (1 minute)
        if (duration > 60) {
          resolve({
            isValid: false,
            duration,
            error: "Video duration exceeds 1 minute limit"
          });
          return;
        }

        resolve({
          isValid: true,
          duration
        });
      });
    });
  }

  static validateFileSize(fileSize: number): VideoValidationResult {
    const maxSizeBytes = 50 * 1024 * 1024; // 50MB limit
    
    if (fileSize > maxSizeBytes) {
      return {
        isValid: false,
        error: "File size exceeds 50MB limit"
      };
    }
    
    return {
      isValid: true
    };
  }

  static validateMimeType(mimeType: string): VideoValidationResult {
    const allowedTypes = [
      'video/mp4',
      'video/avi',
      'video/mov',
      'video/wmv',
      'video/webm',
      'video/quicktime'
    ];
    
    if (!allowedTypes.includes(mimeType)) {
      return {
        isValid: false,
        error: "Invalid video format. Allowed formats: MP4, AVI, MOV, WMV, WebM"
      };
    }
    
    return {
      isValid: true
    };
  }
}