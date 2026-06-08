import { useRef } from 'react';
import ImagePreview from '@/components/ImagePreview/ImagePreview';
import FileInput from '@/components/FileInput/FileInput';
import './ImageUploadPanel.scss';

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
    <div className="dc-image-upload-panel">
      <h2 className="dc-image-upload-panel-title">Photos</h2>
      <div className="dc-image-upload-panel-grid">
        <div>
          <span className="dc-image-upload-panel-label">Profile photo</span>
          {photoUrl && <ImagePreview src={photoUrl} alt="Profile" shape="circle" className="mb-2" />}
          <FileInput
            ref={photoInputRef}
            onChange={handlePhotoSelect}
            disabled={uploadingPhoto}
          />
          {uploadingPhoto && <p className="dc-image-upload-panel-hint">Uploading...</p>}
        </div>
        <div>
          <span className="dc-image-upload-panel-label">Cover image</span>
          {coverImageUrl && (
            <ImagePreview src={coverImageUrl} alt="Cover" shape="banner" className="mb-2" />
          )}
          <FileInput
            ref={coverInputRef}
            onChange={handleCoverSelect}
            disabled={uploadingCover}
          />
          {uploadingCover && <p className="dc-image-upload-panel-hint">Uploading...</p>}
        </div>
      </div>
    </div>
  );
}
