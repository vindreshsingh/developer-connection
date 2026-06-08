import './ExperienceEditor.scss';

export default function ExperienceEditor({ entries, onChange }) {
  const update = (index, key) => (e) => {
    const value = e.target.value;
    onChange(entries.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry)));
  };

  const add = () =>
    onChange([...entries, { title: '', company: '', startDate: '', endDate: '', description: '' }]);

  const remove = (index) => onChange(entries.filter((_, i) => i !== index));

  return (
    <div className="dc-experience-editor">
      <div className="dc-experience-editor-header">
        <span className="dc-experience-editor-label">Experience</span>
        <button type="button" className="dc-experience-editor-add" onClick={add}>
          + Add entry
        </button>
      </div>

      <div className="dc-experience-editor-list">
        {entries.length === 0 && (
          <p className="dc-experience-editor-empty">No experience entries yet</p>
        )}
        {entries.map((exp, index) => (
          <div key={index} className="dc-experience-editor-entry">
            <div className="dc-experience-editor-entry-header">
              <span className="dc-experience-editor-entry-label">Entry {index + 1}</span>
              <button type="button" className="dc-experience-editor-remove" onClick={() => remove(index)}>
                Remove
              </button>
            </div>

            <div className="dc-experience-editor-grid-2">
              <input
                value={exp.title}
                onChange={update(index, 'title')}
                placeholder="Title"
                className="dc-experience-editor-input"
              />
              <input
                value={exp.company}
                onChange={update(index, 'company')}
                placeholder="Company"
                className="dc-experience-editor-input"
              />
            </div>

            <div className="dc-experience-editor-grid-2">
              <div>
                <label className="dc-experience-editor-date-label">Start date</label>
                <input
                  type="date"
                  value={exp.startDate}
                  onChange={update(index, 'startDate')}
                  className="dc-experience-editor-input"
                />
              </div>
              <div>
                <label className="dc-experience-editor-date-label">End date</label>
                <input
                  type="date"
                  value={exp.endDate}
                  onChange={update(index, 'endDate')}
                  className="dc-experience-editor-input"
                />
              </div>
            </div>

            <textarea
              value={exp.description}
              onChange={update(index, 'description')}
              rows={2}
              maxLength={1000}
              placeholder="Description"
              className="dc-experience-editor-input"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
