import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useInjectReducer } from '@/commonUtils/useInjectReducer';
import { useProfile } from '@/hooks/profile/useProfile';
import { useImageUpload } from '@/hooks/profile/useImageUpload';
import ImageUploadPanel from '@/widgets/ImageUploadPanel/ImageUploadPanel';
import ProfileForm from '@/widgets/ProfileForm/ProfileForm';
import AiFeedbackPanel from '@/widgets/AiFeedbackPanel/AiFeedbackPanel';
import LinkedAccounts from '@/widgets/LinkedAccounts/LinkedAccounts';
import BlockedUsers from '@/widgets/BlockedUsers/BlockedUsers';
import reducer, {
  saveStarted,
  saveSucceeded,
  saveFailed,
  imageUploadSucceeded,
  imageUploadFailed,
} from './reducer';
import {
  parseUserToForm,
  parseUserSkills,
  parseUserTechStack,
  parseUserExperience,
  serializeProfilePayload,
  parseUpdateError,
  parseImageUploadError,
} from './parser';
import './Profile.scss';

export default function ProfileContainer() {
  useInjectReducer('profile', reducer);

  const dispatch = useDispatch();
  const { message, error, imageError } = useSelector((state) => state.profile ?? {});
  const { user, updateProfile, saving } = useProfile();
  const { uploadPhoto, uploadingPhoto, uploadCover, uploadingCover } = useImageUpload();

  const [form, setForm] = useState(null);
  const [skillsInput, setSkillsInput] = useState('');
  const [techStackInput, setTechStackInput] = useState('');
  const [experience, setExperience] = useState([]);

  useEffect(() => {
    // Initializing local editable form state from async-loaded query data is
    // the documented exception to "don't setState in effects" (React docs:
    // "Adjusting state when a prop changes") — `user` arrives once the
    // profile query resolves, and the form below is then locally controlled.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (user) {
      setForm(parseUserToForm(user));
      setSkillsInput(parseUserSkills(user));
      setTechStackInput(parseUserTechStack(user));
      setExperience(parseUserExperience(user));
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [user]);

  if (!form) return null;

  const handleFieldChange = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleImageUpload = (uploadFn) => async (file) => {
    const result = await uploadFn(file);
    if (result.error) {
      dispatch(imageUploadFailed(parseImageUploadError(result)));
    } else {
      dispatch(imageUploadSucceeded());
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch(saveStarted());
    const payload = serializeProfilePayload({ form, skillsInput, techStackInput, experience });
    const result = await updateProfile(payload);
    if (result.error) {
      dispatch(saveFailed(parseUpdateError(result)));
    } else {
      dispatch(saveSucceeded());
    }
  };

  return (
    <div className="dc-profile">
      <h1 className="dc-profile-heading">Your Profile</h1>
      <p className="dc-profile-subheading">This is how other developers will see you</p>

      {message && <p className="dc-profile-message">{message}</p>}
      {error && <p className="dc-profile-error">{error}</p>}
      {imageError && <p className="dc-profile-error">{imageError}</p>}

      <AiFeedbackPanel />

      <ImageUploadPanel
        photoUrl={form.photoUrl}
        coverImageUrl={form.coverImageUrl}
        onPhotoChange={handleImageUpload(uploadPhoto)}
        onCoverChange={handleImageUpload(uploadCover)}
        uploadingPhoto={uploadingPhoto}
        uploadingCover={uploadingCover}
      />

      <ProfileForm
        form={form}
        skillsInput={skillsInput}
        techStackInput={techStackInput}
        experience={experience}
        saving={saving}
        onFieldChange={handleFieldChange}
        onSkillsChange={(e) => setSkillsInput(e.target.value)}
        onTechStackChange={(e) => setTechStackInput(e.target.value)}
        onExperienceChange={setExperience}
        onSubmit={handleSubmit}
      />

      {/* Phase 4: OAuth / enrichment ─────────────────────────────────── */}
      <LinkedAccounts />

      <BlockedUsers />
    </div>
  );
}
