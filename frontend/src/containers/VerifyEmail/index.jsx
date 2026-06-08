import { Link, useParams } from 'react-router-dom';
import Button from '@/components/Button/Button';
import StatusMessage from '@/components/StatusMessage/StatusMessage';
import Spinner from '@/components/Spinner/Spinner';
import { useVerifyEmail } from '@/hooks/auth/useVerifyEmail';
import { parseVerificationView } from './parser';
import './VerifyEmail.scss';

export default function VerifyEmailContainer() {
  const { token } = useParams();
  const { status, message } = useVerifyEmail(token);
  const view = parseVerificationView(status, message);

  return (
    <div className="dc-verify-page">
      <div className="dc-verify-card">
        <h1 className="dc-verify-title">DevConnect</h1>

        {view.status === 'loading' && <Spinner label="Verifying your email..." />}

        {view.status !== 'loading' && (
          <>
            <StatusMessage variant={view.status === 'success' ? 'success' : 'error'}>
              {view.message}
            </StatusMessage>
            {view.status === 'success' ? (
              <Link to="/login">
                <Button className="w-full">{view.ctaLabel}</Button>
              </Link>
            ) : (
              <Link to="/login" className="text-purple-600 font-medium">
                {view.ctaLabel}
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
