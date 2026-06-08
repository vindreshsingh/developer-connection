import './Spinner.scss';

export default function Spinner({ label = 'Loading...' }) {
  return <p className="dc-spinner-text">{label}</p>;
}
