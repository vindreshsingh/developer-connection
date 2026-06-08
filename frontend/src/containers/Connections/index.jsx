import { useConnections } from '@/hooks/connections/useConnections';
import ConnectionCard from '@/widgets/ConnectionCard/ConnectionCard';
import { parseConnections, parseConnectionsError } from './parser';
import './Connections.scss';

export default function ConnectionsContainer() {
  const { connectionsRaw, error: rawError } = useConnections();

  const connections = parseConnections(connectionsRaw);
  const error = parseConnectionsError(rawError);

  return (
    <div className="dc-connections">
      <h1 className="dc-connections-heading">Your Connections</h1>

      {error && <p className="dc-connections-error">{error}</p>}

      {connections.length === 0 ? (
        <p className="dc-connections-empty">No connections yet — keep swiping!</p>
      ) : (
        <div className="dc-connections-grid">
          {connections.map((connection) => (
            <ConnectionCard key={connection._id} connection={connection} />
          ))}
        </div>
      )}
    </div>
  );
}
