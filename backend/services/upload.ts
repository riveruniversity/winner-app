import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import { UPLOADS_DIR } from '../config.js';

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'background-' + uniqueSuffix + ext);
  }
});

// Create multer instance
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

export interface UploadedImage {
  filename: string;
  path: string;
  url: string;
}

export async function listUploadedImages(): Promise<UploadedImage[]> {
  try {
    const files = await fs.readdir(UPLOADS_DIR);
    const imageFiles = files.filter(file =>
      /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file)
    );

    return imageFiles.map(filename => ({
      filename,
      path: `/uploads/${filename}`,
      url: `/uploads/${filename}`
    }));
  } catch (error) {
    console.error('Error listing uploaded images:', error);
    return [];
  }
}
