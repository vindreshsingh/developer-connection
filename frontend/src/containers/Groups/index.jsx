import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useListGroupsQuery, useCreateGroupMutation, useJoinGroupMutation } from '@/hooks/groups/groupApi';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import Button from '@/components/Button/Button';
import FormInput from '@/components/FormInput/FormInput';

/**
 * Browse / create groups page — shows a filterable list of public groups and
 * a quick-create form. Navigates to /groups/:id on row click or join success.
 */
export default function GroupsContainer() {
  const navigate = useNavigate();

  // ── filter ───────────────────────────────────────────────────────────────
  const [tagInput, setTagInput] = useState('');
  const [appliedTags, setAppliedTags] = useState('');
  const [page, setPage] = useState(1);

  const { data, isFetching, error } = useListGroupsQuery({ tags: appliedTags, page });

  const groups = data?.data ?? [];
  const pagination = data?.pagination;

  const applyFilter = (e) => {
    e.preventDefault();
    setAppliedTags(tagInput.trim().replace(/\s+/g, ','));
    setPage(1);
  };

  // ── create group ─────────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTags, setNewTags] = useState('');
  const [createGroup, { isLoading: isCreating, error: createError }] = useCreateGroupMutation();

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const tags = newTags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    try {
      const result = await createGroup({ name: newName.trim(), description: newDesc.trim(), tags }).unwrap();
      navigate(`/groups/${result.group._id}`);
    } catch {
      // error shown below
    }
  };

  // ── join ─────────────────────────────────────────────────────────────────
  const [joinGroup, { isLoading: isJoining }] = useJoinGroupMutation();

  const handleJoin = async (e, groupId) => {
    e.stopPropagation();
    try {
      await joinGroup(groupId).unwrap();
      navigate(`/groups/${groupId}`);
    } catch {
      // per-card errors are not shown here; navigate regardless if the error
      // is "already a member" (the detail page will still work)
      navigate(`/groups/${groupId}`);
    }
  };

  return (
    <div className="mx-auto max-w-[860px] my-5 px-3 sm:my-8 sm:px-4">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 opacity-0 [animation:dc-fade-in-up_0.45s_ease_forwards] sm:flex-nowrap">
        <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
        <Button onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancel' : '+ New Group'}
        </Button>
      </div>

      {/* ── Create form ─────────────────────────────────────────────────── */}
      {showCreate && (
        <form className="mb-6 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-6" onSubmit={handleCreate}>
          <h2 className="mb-1 text-[1.1rem] font-semibold">Create a group</h2>
          {createError && (
            <p className="mb-4 text-red-600">
              {getApiErrorMessage(createError, 'Could not create group')}
            </p>
          )}
          <FormInput
            label="Name *"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. React Devs"
            required
          />
          <FormInput
            label="Description"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="What is this group about?"
          />
          <FormInput
            label="Tags (comma-separated)"
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            placeholder="e.g. react, typescript, frontend"
          />
          <Button type="submit" disabled={isCreating || !newName.trim()}>
            {isCreating ? 'Creating…' : 'Create Group'}
          </Button>
        </form>
      )}

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <form className="mb-5 flex items-center gap-2" onSubmit={applyFilter}>
        <FormInput
          placeholder="Filter by tags (e.g. react, golang)"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          wrapperClassName="flex-1"
        />
        <Button type="submit" variant="secondary">Filter</Button>
        {appliedTags && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => { setTagInput(''); setAppliedTags(''); setPage(1); }}
          >
            Clear
          </Button>
        )}
      </form>

      {/* ── List ────────────────────────────────────────────────────────── */}
      {error && (
        <p className="mb-4 text-red-600">{getApiErrorMessage(error, 'Could not load groups')}</p>
      )}

      {isFetching ? (
        <p className="py-12 text-center text-gray-500">Loading groups…</p>
      ) : groups.length === 0 ? (
        <p className="py-12 text-center text-gray-500">
          {appliedTags ? 'No groups match those tags.' : 'No groups yet — create one!'}
        </p>
      ) : (
        <ul className="m-0 flex flex-col gap-3 p-0 list-none">
          {groups.map((group) => (
            <li
              key={group._id}
              className="flex cursor-pointer flex-col items-stretch justify-between gap-2 rounded-xl border border-gray-200 bg-white px-5 py-4 transition-[transform,box-shadow] duration-200 ease hover:-translate-y-[3px] hover:shadow-[0_12px_24px_-12px_rgba(147,51,234,0.35)] sm:flex-row sm:items-start sm:gap-4"
              onClick={() => navigate(`/groups/${group._id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/groups/${group._id}`)}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-base font-semibold text-gray-900">{group.name}</span>
                {group.description && (
                  <span className="truncate overflow-hidden text-sm text-gray-500">{group.description}</span>
                )}
                {group.tags?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-[0.35rem]">
                    {group.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-violet-100 px-[0.55rem] py-[0.1rem] text-xs text-violet-800">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-row items-center justify-between gap-2 sm:flex-col sm:items-end sm:justify-start">
                <span className="text-[0.8rem] whitespace-nowrap text-gray-500">
                  {group.memberCount} / {group.maxMembers} members
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isJoining}
                  onClick={(e) => handleJoin(e, group._id)}
                >
                  Join
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Prev
          </Button>
          <span className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="ghost"
            disabled={!pagination.hasNextPage || isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}
