import { useState } from 'react';
import Button from '@/components/Button/Button';
import FormInput from '@/components/FormInput/FormInput';
import Tag from '@/components/Tag/Tag';
import { useCreateJobMutation } from '@/hooks/jobs/jobApi';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import { JOB_TYPES, LOCATION_MODES } from '@/widgets/JobCard/jobConstants';

export default function JobPostForm({ onSuccess }) {
  const [createJob, { isLoading }] = useCreateJobMutation();

  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('full-time');
  const [locationMode, setLocationMode] = useState('remote');
  const [location, setLocation] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [error, setError] = useState('');

  const skills = skillsInput.split(',').map((s) => s.trim()).filter(Boolean);
  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();
  const isEmpty = !trimmedTitle || !trimmedDescription;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isEmpty || isLoading) return;

    setError('');
    try {
      await createJob({
        title: trimmedTitle,
        company: company.trim(),
        description: trimmedDescription,
        type,
        locationMode,
        location: location.trim(),
        requiredSkills: skills,
        salaryRange: {
          min: salaryMin ? Number(salaryMin) : null,
          max: salaryMax ? Number(salaryMax) : null,
          currency,
        },
      }).unwrap();

      setTitle('');
      setCompany('');
      setDescription('');
      setType('full-time');
      setLocationMode('remote');
      setLocation('');
      setSkillsInput('');
      setSalaryMin('');
      setSalaryMax('');
      setCurrency('USD');
      onSuccess?.();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create job posting'));
    }
  };

  return (
    <form className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm" onSubmit={handleSubmit}>
      <h2 className="text-lg font-semibold text-gray-900">Post a job</h2>

      <FormInput
        placeholder="Title (e.g. Senior Backend Engineer)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
      />
      <FormInput placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={100} />
      <FormInput
        as="textarea"
        placeholder="Describe the role, responsibilities, requirements…"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="resize-y min-h-[6rem]"
        rows={4}
        maxLength={5000}
      />

      <div className="flex flex-wrap gap-3">
        <select
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:shadow-[0_0_0_2px_rgba(192,132,252,0.6)]"
          value={type}
          onChange={(e) => setType(e.target.value)}
          aria-label="Job type"
        >
          {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:shadow-[0_0_0_2px_rgba(192,132,252,0.6)]"
          value={locationMode}
          onChange={(e) => setLocationMode(e.target.value)}
          aria-label="Location mode"
        >
          {LOCATION_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <FormInput
          placeholder="Location (optional)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          wrapperClassName="min-w-[10rem] flex-1"
          maxLength={100}
        />
      </div>

      <div>
        <FormInput
          label="Required skills (comma separated)"
          value={skillsInput}
          onChange={(e) => setSkillsInput(e.target.value)}
          placeholder="React, Node.js, MongoDB"
        />
        {skills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {skills.map((skill, i) => <Tag key={`${skill}-${i}`}>{skill}</Tag>)}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <FormInput
          type="number"
          placeholder="Salary min"
          value={salaryMin}
          onChange={(e) => setSalaryMin(e.target.value)}
          wrapperClassName="min-w-[7rem] flex-1"
          min={0}
        />
        <FormInput
          type="number"
          placeholder="Salary max"
          value={salaryMax}
          onChange={(e) => setSalaryMax(e.target.value)}
          wrapperClassName="min-w-[7rem] flex-1"
          min={0}
        />
        <FormInput
          placeholder="Currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          wrapperClassName="w-24"
          maxLength={10}
        />
      </div>

      {error && <p className="text-[0.8rem] text-red-600">{error}</p>}

      <Button type="submit" disabled={isEmpty || isLoading} className="self-end">
        {isLoading ? 'Posting…' : 'Post Job'}
      </Button>
    </form>
  );
}
