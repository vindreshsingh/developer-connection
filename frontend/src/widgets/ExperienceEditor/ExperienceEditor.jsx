export default function ExperienceEditor({ entries, onChange }) {
  const update = (index, key) => (e) => {
    const value = e.target.value;
    onChange(entries.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry)));
  };

  const add = () =>
    onChange([...entries, { title: '', company: '', startDate: '', endDate: '', description: '' }]);

  const remove = (index) => onChange(entries.filter((_, i) => i !== index));

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Experience</span>
        <button type="button" className="cursor-pointer border-none bg-none text-sm font-medium text-purple-600 hover:text-purple-700" onClick={add}>
          + Add entry
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {entries.length === 0 && (
          <p className="text-sm text-gray-400">No experience entries yet</p>
        )}
        {entries.map((exp, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">Entry {index + 1}</span>
              <button type="button" className="cursor-pointer border-none bg-none text-xs text-red-500 hover:text-red-600" onClick={() => remove(index)}>
                Remove
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                value={exp.title}
                onChange={update(index, 'title')}
                placeholder="Title"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400"
              />
              <input
                value={exp.company}
                onChange={update(index, 'company')}
                placeholder="Company"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Start date</label>
                <input
                  type="date"
                  value={exp.startDate}
                  onChange={update(index, 'startDate')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">End date</label>
                <input
                  type="date"
                  value={exp.endDate}
                  onChange={update(index, 'endDate')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400"
                />
              </div>
            </div>

            <textarea
              value={exp.description}
              onChange={update(index, 'description')}
              rows={2}
              maxLength={1000}
              placeholder="Description"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
