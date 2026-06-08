import { useUploadProfilePhotoMutation, useUploadCoverImageMutation } from './profileApi';

export const useImageUpload = () => {
  const [uploadPhoto, { isLoading: uploadingPhoto }] = useUploadProfilePhotoMutation();
  const [uploadCover, { isLoading: uploadingCover }] = useUploadCoverImageMutation();

  return { uploadPhoto, uploadingPhoto, uploadCover, uploadingCover };
};
