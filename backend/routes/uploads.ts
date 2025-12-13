import express from 'express';
import type { Request, Response } from 'express';

import { upload, listUploadedImages } from '../services/upload.js';

export const uploadsRouter = express.Router();

// Get list of uploaded images
uploadsRouter.get('/uploaded-images', async (req: Request, res: Response) => {
  const images = await listUploadedImages();
  res.json(images);
});

// Image upload endpoint
uploadsRouter.post('/upload-background', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const imagePath = `/uploads/${req.file.filename}`;
    res.json({ success: true, imagePath });
  } catch (error: any) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: error.message });
  }
});
