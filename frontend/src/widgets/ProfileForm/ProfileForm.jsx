import FormInput from '@/components/FormInput/FormInput';
import Button from '@/components/Button/Button';
import TechStackEditor from '@/widgets/TechStackEditor/TechStackEditor';
import ExperienceEditor from '@/widgets/ExperienceEditor/ExperienceEditor';

export default function ProfileForm({
  form,
  skillsInput,
  techStackInput,
  experience,
  saving,
  onFieldChange,
  onSkillsChange,
  onTechStackChange,
  onExperienceChange,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-6 text-left shadow-sm">
      <div className="grid grid-cols-2 gap-4">
        <FormInput
          label="First name"
          value={form.firstName}
          onChange={onFieldChange('firstName')}
        />
        <FormInput
          label="Last name"
          value={form.lastName}
          onChange={onFieldChange('lastName')}
        />
      </div>

      <FormInput
        label="Bio"
        type="textarea"
        value={form.bio}
        onChange={onFieldChange('bio')}
        rows={3}
        maxLength={500}
      />

      <FormInput
        label="Skills (comma separated)"
        value={skillsInput}
        onChange={onSkillsChange}
        placeholder="React, Node.js, MongoDB"
      />

      <TechStackEditor value={techStackInput} onChange={onTechStackChange} />

      <ExperienceEditor entries={experience} onChange={onExperienceChange} />

      <div className="grid grid-cols-2 gap-4">
        <FormInput
          label="GitHub URL"
          value={form.githubUrl}
          onChange={onFieldChange('githubUrl')}
        />
        <FormInput
          label="LinkedIn URL"
          value={form.linkedinUrl}
          onChange={onFieldChange('linkedinUrl')}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormInput
          label="Age"
          type="number"
          value={form.age}
          onChange={onFieldChange('age')}
          min={18}
          max={75}
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Gender</label>
          <select
            value={form.gender}
            onChange={onFieldChange('gender')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-purple-300"
          >
            <option value="">Prefer not to say</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? 'Saving...' : 'Save changes'}
      </Button>
    </form>
  );
}
