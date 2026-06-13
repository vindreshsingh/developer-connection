import { Link, useParams } from 'react-router-dom';
import Button from '@/components/Button/Button';
import StatusMessage from '@/components/StatusMessage/StatusMessage';
import Spinner from '@/components/Spinner/Spinner';
import { useVerifyEmail } from '@/hooks/auth/useVerifyEmail';
import { parseVerificationView } from './parser';

export default function VerifyEmailContainer() {
  const { token } = useParams();
  const { status, message } = useVerifyEmail(token);
  const view = parseVerificationView(status, message);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 [background:radial-gradient(circle_at_top_left,#f3e8ff,transparent_55%),radial-gradient(circle_at_bottom_right,#fce7f3,transparent_55%),linear-gradient(to_bottom_right,#faf5ff,#fdf2f8)]">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_24px_-12px_rgba(147,51,234,0.2)] [animation:dc-pop-in_0.4s_ease_both] sm:p-8">
        <h1 className="mb-4 bg-gradient-to-br from-purple-600 to-pink-500 bg-clip-text text-[1.75rem] font-extrabold text-transparent">DevConnect</h1>

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
