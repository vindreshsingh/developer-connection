import { useConnections } from '@/hooks/connections/useConnections';
import ConnectionCard from '@/widgets/ConnectionCard/ConnectionCard';
import { parseConnections, parseConnectionsError } from './parser';

export default function ConnectionsContainer() {
  const { connectionsRaw, error: rawError } = useConnections();

  const connections = parseConnections(connectionsRaw);
  const error = parseConnectionsError(rawError);

  return (
    <div className="mx-auto max-w-[42rem] px-3 py-5 sm:px-4 sm:py-8">
      <h1 className="mb-4 text-2xl font-bold text-gray-900 opacity-0 [animation:dc-fade-in-up_0.45s_ease_forwards]">Your Connections</h1>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      {connections.length === 0 ? (
        <p className="text-sm text-gray-400">No connections yet — keep swiping!</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {connections.map((connection) => (
            <ConnectionCard key={connection._id} connection={connection} />
          ))}
        </div>
      )}
    </div>
  );
}
