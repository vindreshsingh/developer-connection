import { useEffect, useRef, useState } from 'react';
import {
  useGetMyProfileQuery,
  useUpdateProfileMutation,
  useUploadProfilePhotoMutation,
  useUploadCoverImageMutation,
} from '../store/api';

const emptyExperience = () => ({ title: '', company: '', startDate: '', endDate: '', description: '' });

export default function Profile() {
  const { data: user } = useGetMyProfileQuery();
  const [updateProfile, { isLoading: saving }] = useUpdateProfileMutation();
  const [uploadPhoto, { isLoading: uploadingPhoto }] = useUploadProfilePhotoMutation();
  const [uploadCover, { isLoading: uploadingCover }] = useUploadCoverImageMutation();
  const [form, setForm] = useState(null);
  const [skillsInput, setSkillsInput] = useState('');
  const [techStackInput, setTechStackInput] = useState('');
  const [experience, setExperience] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [imageError, setImageError] = useState('');
  const photoInputRef = useRef(null);
  const coverInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        photoUrl: user.photoUrl || '',
        coverImageUrl: user.coverImageUrl || '',
        bio: user.bio || '',
        githubUrl: user.githubUrl || '',
        linkedinUrl: user.linkedinUrl || '',
        age: user.age || '',
        gender: user.gender || '',
      });
      setSkillsInput((user.skills || []).join(', '));
      setTechStackInput((user.techStack || []).join(', '));
      setExperience(
        (user.experience || []).map((exp) => ({
          title: exp.title || '',
          company: exp.company || '',
          startDate: exp.startDate ? exp.startDate.slice(0, 10) : '',
          endDate: exp.endDate ? exp.endDate.slice(0, 10) : '',
          description: exp.description || '',
        }))
      );
    }
  }, [user]);

  if (!form) return null;

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const updateExperience = (index, key) => (e) => {
    const value = e.target.value;
    setExperience((entries) => entries.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry)));
  };

  const addExperience = () => setExperience((entries) => [...entries, emptyExperience()]);
  const removeExperience = (index) => setExperience((entries) => entries.filter((_, i) => i !== index));

  const handleImageSelect = (uploadFn, inputRef) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError('');
    setMessage('');

    const result = await uploadFn(file);
    if (result.error) {
      setImageError(result.error.data?.error || 'Could not upload image');
    } else {
      setMessage('Image uploaded successfully');
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    const payload = { ...form };
    if (payload.age) payload.age = Number(payload.age);
    else delete payload.age;
    if (!payload.gender) delete payload.gender;
    if (!payload.photoUrl) delete payload.photoUrl;
    if (!payload.coverImageUrl) delete payload.coverImageUrl;
    payload.skills = skillsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    payload.techStack = techStackInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    payload.experience = experience
      .filter((exp) => exp.title.trim() && exp.company.trim() && exp.startDate)
      .map((exp) => ({
        title: exp.title.trim(),
        company: exp.company.trim(),
        startDate: exp.startDate,
        endDate: exp.endDate || null,
        description: exp.description.trim(),
      }));

    const result = await updateProfile(payload);
    if (result.error) {
      setError(result.error.data?.error || 'Could not update profile');
      return;
    }
    setMessage('Profile updated successfully');
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Your Profile</h1>
      <p className="text-gray-500 text-sm mb-6">This is how other developers will see you</p>

      {message && <p className="text-green-600 text-sm mb-3">{message}</p>}
      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
      {imageError && <p className="text-red-500 text-sm mb-3">{imageError}</p>}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4 text-left mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Photos</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Profile photo</label>
            {form.photoUrl && (
              <img src={form.photoUrl} alt="Profile" className="w-20 h-20 rounded-full object-cover mb-2" />
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect(uploadPhoto, photoInputRef)}
              disabled={uploadingPhoto}
              className="text-sm"
            />
            {uploadingPhoto && <p className="text-xs text-gray-400 mt-1">Uploading...</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cover image</label>
            {form.coverImageUrl && (
              <img src={form.coverImageUrl} alt="Cover" className="w-full h-20 rounded-lg object-cover mb-2" />
            )}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect(uploadCover, coverInputRef)}
              disabled={uploadingCover}
              className="text-sm"
            />
            {uploadingCover && <p className="text-xs text-gray-400 mt-1">Uploading...</p>}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4 text-left">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
            <input value={form.firstName} onChange={update('firstName')} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
            <input value={form.lastName} onChange={update('lastName')} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
          <textarea value={form.bio} onChange={update('bio')} rows={3} maxLength={500} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Skills (comma separated)</label>
          <input value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} placeholder="React, Node.js, MongoDB" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tech stack (comma separated)</label>
          <input value={techStackInput} onChange={(e) => setTechStackInput(e.target.value)} placeholder="TypeScript, Express, Docker" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400" />
          {techStackInput.trim() && (
            <div className="flex flex-wrap gap-2 mt-2">
              {techStackInput.split(',').map((tag) => tag.trim()).filter(Boolean).map((tag, i) => (
                <span key={`${tag}-${i}`} className="text-xs bg-purple-100 text-purple-700 rounded-full px-3 py-1">{tag}</span>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">Experience</label>
            <button type="button" onClick={addExperience} className="text-sm text-purple-600 hover:text-purple-700 font-medium">
              + Add entry
            </button>
          </div>

          <div className="space-y-3">
            {experience.map((exp, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Entry {index + 1}</span>
                  <button type="button" onClick={() => removeExperience(index)} className="text-xs text-red-500 hover:text-red-600">
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={exp.title} onChange={updateExperience(index, 'title')} placeholder="Title" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  <input value={exp.company} onChange={updateExperience(index, 'company')} placeholder="Company" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Start date</label>
                    <input type="date" value={exp.startDate} onChange={updateExperience(index, 'startDate')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">End date</label>
                    <input type="date" value={exp.endDate} onChange={updateExperience(index, 'endDate')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  </div>
                </div>
                <textarea value={exp.description} onChange={updateExperience(index, 'description')} rows={2} maxLength={1000} placeholder="Description" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
            ))}
            {experience.length === 0 && <p className="text-sm text-gray-400">No experience entries yet</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GitHub URL</label>
            <input value={form.githubUrl} onChange={update('githubUrl')} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn URL</label>
            <input value={form.linkedinUrl} onChange={update('linkedinUrl')} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
            <input type="number" min={18} max={75} value={form.age} onChange={update('age')} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <select value={form.gender} onChange={update('gender')} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400">
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <button type="submit" disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2.5 rounded-lg transition disabled:opacity-60">
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
