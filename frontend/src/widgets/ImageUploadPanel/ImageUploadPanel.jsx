import { useRef } from 'react';
import ImagePreview from '@/components/ImagePreview/ImagePreview';
import FileInput from '@/components/FileInput/FileInput';

export default function ImageUploadPanel({
  photoUrl,
  coverImageUrl,
  onPhotoChange,
  onCoverChange,
  uploadingPhoto,
  uploadingCover,
}) {
  const photoInputRef = useRef(null);
  const coverInputRef = useRef(null);

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onPhotoChange(file);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handleCoverSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onCoverChange(file);
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  return (
    <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Photos</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="mb-1 block text-sm font-medium text-gray-700">Profile photo</span>
          {photoUrl && <ImagePreview src={photoUrl} alt="Profile" shape="circle" className="mb-2" />}
          <FileInput
            ref={photoInputRef}
            onChange={handlePhotoSelect}
            disabled={uploadingPhoto}
          />
          {uploadingPhoto && <p className="mt-1 text-xs text-gray-400">Uploading...</p>}
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium text-gray-700">Cover image</span>
          {coverImageUrl && (
            <ImagePreview src={coverImageUrl} alt="Cover" shape="banner" className="mb-2" />
          )}
          <FileInput
            ref={coverInputRef}
            onChange={handleCoverSelect}
            disabled={uploadingCover}
          />
          {uploadingCover && <p className="mt-1 text-xs text-gray-400">Uploading...</p>}
        </div>
      </div>
    </div>
  );
}
