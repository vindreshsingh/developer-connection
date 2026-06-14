import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { useInjectReducer } from '@/commonUtils/useInjectReducer';
import { useGetJobsQuery, useGetMyApplicationsQuery } from '@/hooks/jobs/jobApi';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import { classNames } from '@/commonUtils/classNames';
import Button from '@/components/Button/Button';
import Tag from '@/components/Tag/Tag';
import JobCard from '@/widgets/JobCard/JobCard';
import JobPostForm from '@/widgets/JobPostForm/JobPostForm';
import { JOB_TYPE_LABELS, JOB_TYPES } from '@/widgets/JobCard/jobConstants';
import reducer, { tabChanged, pageChanged, typeChanged, skillsChanged } from './reducer';

const TABS = [
  { value: 'browse', label: 'Browse Jobs' },
  { value: 'applications', label: 'My Applications' },
];

export default function JobsContainer() {
  useInjectReducer('jobs', reducer);

  const dispatch = useDispatch();
  const tab = useSelector((state) => state.jobs?.tab ?? 'browse');
  const page = useSelector((state) => state.jobs?.page ?? 1);
  const type = useSelector((state) => state.jobs?.type ?? '');
  const skills = useSelector((state) => state.jobs?.skills ?? '');
  const [showForm, setShowForm] = useState(false);

  const { data, isFetching, error } = useGetJobsQuery(
    { type: type || undefined, skills: skills || undefined, page },
    { skip: tab !== 'browse' },
  );
  const { data: appsData, isFetching: isFetchingApps, error: appsError } = useGetMyApplicationsQuery(
    { page },
    { skip: tab !== 'applications' },
  );

  const jobs = data?.data ?? [];
  const pagination = data?.pagination;
  const applications = appsData?.data ?? [];
  const appsPagination = appsData?.pagination;

  return (
    <div className="mx-auto my-5 flex max-w-[640px] flex-col gap-4 px-3 sm:my-8 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-3 opacity-0 [animation:dc-fade-in-up_0.45s_ease_forwards]">
        <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              className={classNames(
                'rounded-md px-3 py-1.5 text-[0.85rem] font-medium text-gray-500 transition-colors hover:text-gray-700',
                tab === t.value && 'bg-white text-violet-800 shadow-sm',
              )}
              onClick={() => dispatch(tabChanged(t.value))}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'browse' && (
        <>
          {showForm ? (
            <JobPostForm onSuccess={() => setShowForm(false)} />
          ) : (
            <Button variant="outline" className="self-start" onClick={() => setShowForm(true)}>
              + Post a job
            </Button>
          )}

          <div className="flex flex-wrap gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
            <select
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:shadow-[0_0_0_2px_rgba(192,132,252,0.6)]"
              value={type}
              onChange={(e) => dispatch(typeChanged(e.target.value))}
              aria-label="Filter by job type"
            >
              <option value="">All types</option>
              {JOB_TYPES.map((t) => <option key={t} value={t}>{JOB_TYPE_LABELS[t]}</option>)}
            </select>
            <input
              className="min-w-[10rem] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:shadow-[0_0_0_2px_rgba(192,132,252,0.6)]"
              placeholder="Filter by skills (comma separated)"
              value={skills}
              onChange={(e) => dispatch(skillsChanged(e.target.value))}
            />
          </div>

          {error && <p className="text-red-600">{getApiErrorMessage(error, 'Could not load jobs')}</p>}

          {isFetching ? (
            <p className="py-12 text-center text-gray-500">Loading jobs…</p>
          ) : jobs.length === 0 ? (
            <p className="py-12 text-center text-gray-500">No job postings match your filters yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {jobs.map((job) => <JobCard key={job._id} job={job} />)}
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-2 flex items-center justify-center gap-4">
              <Button
                variant="ghost"
                disabled={page <= 1 || isFetching}
                onClick={() => dispatch(pageChanged(Math.max(1, page - 1)))}
              >
                ← Prev
              </Button>
              <span className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="ghost"
                disabled={!pagination.hasNextPage || isFetching}
                onClick={() => dispatch(pageChanged(page + 1))}
              >
                Next →
              </Button>
            </div>
          )}
        </>
      )}

      {tab === 'applications' && (
        <>
          {appsError && (
            <p className="text-red-600">{getApiErrorMessage(appsError, 'Could not load your applications')}</p>
          )}

          {isFetchingApps ? (
            <p className="py-12 text-center text-gray-500">Loading applications…</p>
          ) : applications.length === 0 ? (
            <p className="py-12 text-center text-gray-500">You haven&apos;t applied to any jobs yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {applications.map((application) => (
                <Link
                  key={application._id}
                  to={`/jobs/${application.jobId?._id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white p-4 text-inherit no-underline shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900">{application.jobId?.title}</h3>
                    {application.jobId?.company && (
                      <p className="text-sm text-gray-500">{application.jobId.company}</p>
                    )}
                  </div>
                  <Tag>{application.status}</Tag>
                </Link>
              ))}
            </div>
          )}

          {appsPagination && appsPagination.totalPages > 1 && (
            <div className="mt-2 flex items-center justify-center gap-4">
              <Button
                variant="ghost"
                disabled={page <= 1 || isFetchingApps}
                onClick={() => dispatch(pageChanged(Math.max(1, page - 1)))}
              >
                ← Prev
              </Button>
              <span className="text-sm text-gray-500">
                Page {appsPagination.page} of {appsPagination.totalPages}
              </span>
              <Button
                variant="ghost"
                disabled={!appsPagination.hasNextPage || isFetchingApps}
                onClick={() => dispatch(pageChanged(page + 1))}
              >
                Next →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
