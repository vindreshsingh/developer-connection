import { Link } from 'react-router-dom';
import Tag from '@/components/Tag/Tag';
import { JOB_TYPE_LABELS, formatSalaryRange } from './jobConstants';

export default function JobCard({ job }) {
  const posterName = [job.postedBy?.firstName, job.postedBy?.lastName].filter(Boolean).join(' ');
  const salary = formatSalaryRange(job.salaryRange);

  return (
    <Link
      to={`/jobs/${job._id}`}
      className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-white p-4 text-inherit no-underline shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900">{job.title}</h3>
          {job.company && <p className="text-sm text-gray-500">{job.company}</p>}
        </div>
        {job.skillMatchScore > 0 && (
          <span className="flex-shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
            {job.skillMatchScore}% match
          </span>
        )}
      </div>

      <p className="line-clamp-2 text-sm text-gray-700">{job.description}</p>

      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <Tag>{JOB_TYPE_LABELS[job.type] ?? job.type}</Tag>
        <Tag>{job.locationMode}</Tag>
        {job.location && <span>{job.location}</span>}
        {salary && <span>{salary}</span>}
      </div>

      {job.requiredSkills?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {job.requiredSkills.map((skill) => <Tag key={skill}>{skill}</Tag>)}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Posted by {posterName || 'Unknown'}</span>
        <span>{new Date(job.createdAt).toLocaleDateString()}</span>
      </div>
    </Link>
  );
}
