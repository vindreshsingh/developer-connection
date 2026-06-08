import { useGetConnectionsQuery } from '../store/api';

export default function Connections() {
  const { data, error: queryError } = useGetConnectionsQuery();
  const connections = data?.data || [];
  const error = queryError?.data?.error || '';

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Your Connections</h1>
      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      {connections.length === 0 ? (
        <p className="text-gray-400 text-sm">No connections yet — keep swiping!</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {connections.map((c) => (
            <div key={c._id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-left">
              <div className="flex items-center gap-3 mb-2">
                {c.photoUrl ? (
                  <img src={c.photoUrl} alt={c.firstName} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 font-bold flex items-center justify-center">
                    {c.firstName?.[0]}
                    {c.lastName?.[0]}
                  </div>
                )}
                <p className="font-semibold text-gray-900">
                  {c.firstName} {c.lastName}
                </p>
              </div>
              {c.bio && <p className="text-sm text-gray-500 line-clamp-2">{c.bio}</p>}
              {c.skills?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {c.skills.slice(0, 5).map((skill) => (
                    <span key={skill} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
