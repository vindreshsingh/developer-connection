import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useInjectReducer } from '@/commonUtils/useInjectReducer';
import {
  useGetJobQuery,
  useApplyToJobMutation,
  useUpdateJobMutation,
  useDeleteJobMutation,
  useGetJobApplicationsQuery,
  useUpdateApplicationStatusMutation,
} from '@/hooks/jobs/jobApi';
import { useCurrentUser } from '@/hooks/auth/useCurrentUser';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import Button from '@/components/Button/Button';
import FormInput from '@/components/FormInput/FormInput';
import Tag from '@/components/Tag/Tag';
import Avatar from '@/components/Avatar/Avatar';
import { APPLICATION_STATUSES, JOB_TYPE_LABELS, formatSalaryRange } from '@/widgets/JobCard/jobConstants';
import reducer, { applicantsPageChanged } from './reducer';

export default function JobDetailContainer() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user } = useCurrentUser();

  const { data, isFetching, error } = useGetJobQuery(jobId, { skip: !jobId });
  const [applyToJob, { isLoading: isApplying }] = useApplyToJobMutation();
  const [updateJob, { isLoading: isUpdating }] = useUpdateJobMutation();
  const [deleteJob, { isLoading: isDeleting }] = useDeleteJobMutation();

  const [coverNote, setCoverNote] = useState('');
  const [applyError, setApplyError] = useState('');
  const [actionError, setActionError] = useState('');

  const job = data?.job;
  const isAuthor = job && job.postedBy._id === user?._id;
  const salary = job && formatSalaryRange(job.salaryRange);

  const handleApply = async (e) => {
    e.preventDefault();
    if (isApplying) return;

    setApplyError('');
    try {
      await applyToJob({ jobId, coverNote: coverNote.trim() }).unwrap();
      setCoverNote('');
    } catch (err) {
      setApplyError(getApiErrorMessage(err, 'Could not submit application'));
    }
  };

  const handleToggleStatus = async () => {
    setActionError('');
    try {
      await updateJob({ jobId, status: job.status === 'open' ? 'closed' : 'open' }).unwrap();
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not update job posting'));
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this job posting?')) return;

    setActionError('');
    try {
      await deleteJob(jobId).unwrap();
      navigate('/jobs');
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not delete job posting'));
    }
  };

  if (isFetching) {
    return <p className="py-12 text-center text-gray-500">Loading job posting…</p>;
  }

  if (error || !job) {
    return (
      <p className="py-12 text-center text-red-600">
        {getApiErrorMessage(error, 'Job posting not found.')}
      </p>
    );
  }

  const posterName = [job.postedBy?.firstName, job.postedBy?.lastName].filter(Boolean).join(' ');

  return (
    <div className="mx-auto my-5 flex max-w-[640px] flex-col gap-4 px-3 sm:my-8 sm:px-4">
      <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{job.title}</h1>
            {job.company && <p className="text-sm text-gray-500">{job.company}</p>}
          </div>
          {job.skillMatchScore > 0 && (
            <span className="flex-shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
              {job.skillMatchScore}% match
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <Tag>{JOB_TYPE_LABELS[job.type] ?? job.type}</Tag>
          <Tag>{job.locationMode}</Tag>
          {job.location && <span>{job.location}</span>}
          {salary && <span>{salary}</span>}
          <Tag className={job.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}>
            {job.status}
          </Tag>
        </div>

        <p className="whitespace-pre-wrap break-words text-gray-800">{job.description}</p>

        {job.requiredSkills?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {job.requiredSkills.map((skill) => <Tag key={skill}>{skill}</Tag>)}
          </div>
        )}

        <Link to={`/profile?userId=${job.postedBy._id}`} className="flex items-center gap-3 text-inherit no-underline">
          <Avatar user={job.postedBy} />
          <div>
            <p className="text-sm font-semibold text-gray-900">{posterName}</p>
            <p className="text-xs text-gray-400">Posted {new Date(job.createdAt).toLocaleDateString()}</p>
          </div>
        </Link>

        {actionError && <p className="text-[0.8rem] text-red-600">{actionError}</p>}

        {isAuthor && (
          <div className="flex gap-2 border-t border-gray-100 pt-3">
            <Button variant="outline" onClick={handleToggleStatus} disabled={isUpdating}>
              {job.status === 'open' ? 'Close posting' : 'Reopen posting'}
            </Button>
            <Button variant="outline" onClick={handleDelete} disabled={isDeleting}>
              Delete
            </Button>
          </div>
        )}
      </div>

      {isAuthor ? (
        <ApplicantsList jobId={jobId} />
      ) : job.myApplication ? (
        <div className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Your application</h2>
          <p className="text-sm text-gray-700">
            Status: <Tag>{job.myApplication.status}</Tag>
          </p>
        </div>
      ) : (
        <form
          className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
          onSubmit={handleApply}
        >
          <h2 className="text-lg font-semibold text-gray-900">Apply for this job</h2>
          <FormInput
            as="textarea"
            label="Cover note (optional)"
            placeholder="Tell the poster why you're a great fit…"
            value={coverNote}
            onChange={(e) => setCoverNote(e.target.value)}
            className="resize-y min-h-[5rem]"
            rows={4}
            maxLength={1000}
          />
          {applyError && <p className="text-[0.8rem] text-red-600">{applyError}</p>}
          <Button type="submit" disabled={isApplying} className="self-end">
            {isApplying ? 'Applying…' : 'Apply'}
          </Button>
        </form>
      )}
    </div>
  );
}

function ApplicantsList({ jobId }) {
  useInjectReducer('jobDetail', reducer);

  const dispatch = useDispatch();
  const page = useSelector((state) => state.jobDetail?.applicantsPage ?? 1);
  const { data, isFetching, error } = useGetJobApplicationsQuery({ jobId, page });
  const [updateStatus] = useUpdateApplicationStatusMutation();
  const [statusError, setStatusError] = useState('');

  const applications = data?.data ?? [];
  const pagination = data?.pagination;

  const handleStatusChange = async (applicationId, status) => {
    setStatusError('');
    try {
      await updateStatus({ jobId, applicationId, status }).unwrap();
    } catch (err) {
      setStatusError(getApiErrorMessage(err, 'Could not update application status'));
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Applicants ({pagination?.total ?? 0})</h2>

      {error && <p className="text-[0.8rem] text-red-600">{getApiErrorMessage(error, 'Could not load applicants')}</p>}
      {statusError && <p className="text-[0.8rem] text-red-600">{statusError}</p>}

      {isFetching ? (
        <p className="py-4 text-center text-sm text-gray-500">Loading applicants…</p>
      ) : applications.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">No applications yet.</p>
      ) : (
        applications.map((application) => {
          const applicant = application.applicantId;
          const name = [applicant?.firstName, applicant?.lastName].filter(Boolean).join(' ');

          return (
            <div
              key={application._id}
              className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 first:border-t-0 first:pt-0"
            >
              <Link to={`/profile?userId=${applicant?._id}`} className="flex min-w-0 items-center gap-3 text-inherit no-underline">
                <Avatar user={applicant} />
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{name}</p>
                  <p className="text-xs text-gray-400">{application.skillMatchScore}% match</p>
                </div>
              </Link>
              <select
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:shadow-[0_0_0_2px_rgba(192,132,252,0.6)]"
                value={application.status}
                onChange={(e) => handleStatusChange(application._id, e.target.value)}
                aria-label={`Application status for ${name}`}
              >
                {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          );
        })
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-2 flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            disabled={page <= 1 || isFetching}
            onClick={() => dispatch(applicantsPageChanged(Math.max(1, page - 1)))}
          >
            ← Prev
          </Button>
          <span className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="ghost"
            disabled={!pagination.hasNextPage || isFetching}
            onClick={() => dispatch(applicantsPageChanged(page + 1))}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}
