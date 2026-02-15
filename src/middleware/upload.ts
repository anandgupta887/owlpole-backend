
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure upload directories exist (uploads is in backend root)
// In development: __dirname is backend/src, uploads is backend/uploads (go up 1 level)
// In production: __dirname is backend/dist, uploads is backend/uploads (go up 1 level)
const uploadDir = path.join(__dirname, '..', 'uploads');
const sectors = ['videos', 'audio', 'thumbnails'];

// Try to create directories (works locally, fails gracefully on Vercel)
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  sectors.forEach(sector => {
    const dir = path.join(uploadDir, sector);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
} catch (error) {
  console.warn('Warning: Could not create upload directories (read-only filesystem)');
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let folder = uploadDir;
    if (file.fieldname === 'video') folder = path.join(uploadDir, 'videos');
    else if (file.fieldname === 'audio') folder = path.join(uploadDir, 'audio');
    else if (file.fieldname === 'thumbnail') folder = path.join(uploadDir, 'thumbnails');
    cb(null, folder);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter for security
const fileFilter = (req: any, file: any, cb: any) => {
  const allowedVideoTypes = /mp4|mov|avi|wmv/;
  const allowedAudioTypes = /mp3|wav|m4a|ogg/;
  const allowedImageTypes = /jpeg|jpg|png|webp/;

  const extname = path.extname(file.originalname).toLowerCase();

  if (file.fieldname === 'video' && allowedVideoTypes.test(extname)) {
    return cb(null, true);
  }
  if (file.fieldname === 'audio' && allowedAudioTypes.test(extname)) {
    return cb(null, true);
  }
  if (file.fieldname === 'thumbnail' && allowedImageTypes.test(extname)) {
    return cb(null, true);
  }

  cb(new Error('Neural Error: Unsupported file format for authorization.'));
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit for video
  },
  fileFilter: fileFilter
});

export const onboardingUpload = upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'audio', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]);
