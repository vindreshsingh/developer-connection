import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useListGroupsQuery, useCreateGroupMutation, useJoinGroupMutation } from '@/hooks/groups/groupApi';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import Button from '@/components/Button/Button';
import FormInput from '@/components/FormInput/FormInput';
import './Groups.scss';

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
    <div className="dc-groups">
      <div className="dc-groups-header">
        <h1 className="dc-groups-title">Groups</h1>
        <Button onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancel' : '+ New Group'}
        </Button>
      </div>

      {/* ── Create form ─────────────────────────────────────────────────── */}
      {showCreate && (
        <form className="dc-groups-create-form" onSubmit={handleCreate}>
          <h2 className="dc-groups-create-title">Create a group</h2>
          {createError && (
            <p className="dc-groups-error">
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
      <form className="dc-groups-filter" onSubmit={applyFilter}>
        <FormInput
          placeholder="Filter by tags (e.g. react, golang)"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          wrapperClassName="dc-groups-filter-input"
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
        <p className="dc-groups-error">{getApiErrorMessage(error, 'Could not load groups')}</p>
      )}

      {isFetching ? (
        <p className="dc-groups-loading">Loading groups…</p>
      ) : groups.length === 0 ? (
        <p className="dc-groups-empty">
          {appliedTags ? 'No groups match those tags.' : 'No groups yet — create one!'}
        </p>
      ) : (
        <ul className="dc-groups-list">
          {groups.map((group) => (
            <li
              key={group._id}
              className="dc-groups-card"
              onClick={() => navigate(`/groups/${group._id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/groups/${group._id}`)}
            >
              <div className="dc-groups-card-main">
                <span className="dc-groups-card-name">{group.name}</span>
                {group.description && (
                  <span className="dc-groups-card-desc">{group.description}</span>
                )}
                {group.tags?.length > 0 && (
                  <div className="dc-groups-card-tags">
                    {group.tags.map((tag) => (
                      <span key={tag} className="dc-groups-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="dc-groups-card-meta">
                <span className="dc-groups-card-count">
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
        <div className="dc-groups-pagination">
          <Button
            variant="ghost"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Prev
          </Button>
          <span className="dc-groups-pagination-info">
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
