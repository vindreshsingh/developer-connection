import FormInput from '@/components/FormInput/FormInput';
import Button from '@/components/Button/Button';
import TechStackEditor from '@/widgets/TechStackEditor/TechStackEditor';
import ExperienceEditor from '@/widgets/ExperienceEditor/ExperienceEditor';
import './ProfileForm.scss';

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
    <form onSubmit={onSubmit} className="dc-profile-form">
      <div className="dc-profile-form-grid-2">
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

      <div className="dc-profile-form-grid-2">
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

      <div className="dc-profile-form-grid-2">
        <FormInput
          label="Age"
          type="number"
          value={form.age}
          onChange={onFieldChange('age')}
          min={18}
          max={75}
        />
        <div>
          <label className="dc-profile-form-label">Gender</label>
          <select
            value={form.gender}
            onChange={onFieldChange('gender')}
            className="dc-profile-form-select"
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
