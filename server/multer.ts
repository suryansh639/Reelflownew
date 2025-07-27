import multer from 'multer';
import path from 'path';

// Configure multer to store files in memory for S3 upload
const storage = multer.memoryStorage();

// File filter for videos only
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed!'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for educational videos
  }
});