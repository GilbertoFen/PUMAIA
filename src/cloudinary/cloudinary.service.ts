import { Injectable, Inject } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class CloudinaryService {
  
  // 🔥 ESTA ES LA CLAVE: 
  // Al pedirle '@Inject('CLOUDINARY')', obligamos a NestJS a ejecutar tu 
  // CloudinaryProvider (y tu console.log) antes de arrancar este servicio.
  constructor(@Inject('CLOUDINARY') private readonly cloudinaryConfig: any) {}

  uploadImage(file: Express.Multer.File): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'pumaia_avatars' },
        (error, result) => {
          if (error || !result) return reject(error);
          resolve(result);
        },
      );
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }
}