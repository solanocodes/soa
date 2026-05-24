import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || '',
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY || '',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY || '',
  },
});

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET || 'soa-media';

export async function uploadFile(
  file: Express.Multer.File,
  folder: string = 'uploads'
): Promise<{ url: string; key: string }> {
  const ext = path.extname(file.originalname);
  const key = `${folder}/${uuidv4()}${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  const url = `${process.env.CLOUDFLARE_R2_ENDPOINT}/${BUCKET}/${key}`;
  return { url, key };
}

export async function uploadMessageAttachment(file: Express.Multer.File) {
  return uploadFile(file, 'messages');
}

export async function uploadWinScreenshot(file: Express.Multer.File) {
  return uploadFile(file, 'wins');
}

export async function uploadAvatar(file: Express.Multer.File) {
  return uploadFile(file, 'avatars');
}
