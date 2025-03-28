// frontend/components/FileUpload.tsx
import React, { useState } from 'react';
import { uploadToPinata } from '@/lib/ipfs-service';

interface FileUploadProps {
  propertyId: number;
  fileType: 'LEASE' | 'PHOTOS' | 'ENTRY_INVENTORY' | 'EXIT_INVENTORY';
  onUploadSuccess: (cid: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ propertyId, fileType, onUploadSuccess }) => {
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (file) {
      try {
        const cid = await uploadToPinata(file, { propertyId, fileType });
        onUploadSuccess(cid);
        alert(`Fichier uploadé avec succès. CID: ${cid}`);
      } catch (error) {
        console.error('Erreur lors de l\'upload:', error);
      }
    }
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload</button>
    </div>
  );
};