import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import FormInput from '@/components/FormInput/FormInput';
import Button from '@/components/Button/Button';
import Banner from '@/components/Banner/Banner';
import { useInjectReducer } from '@/commonUtils/useInjectReducer';
import { useSignup } from '@/hooks/auth/useSignup';
import reducer, { submissionStarted, submissionFailed } from './reducer';
import { parseSignupOutcome } from './parser';

const EMPTY_FORM = { firstName: '', lastName: '', email: '', password: '' };

export default function SignupContainer() {
  useInjectReducer('signup', reducer);

  const dispatch = useDispatch();
  const { error } = useSelector((state) => state.signup);
  const { signup, isLoading, goToLogin } = useSignup();

  const [form, setForm] = useState(EMPTY_FORM);
  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch(submissionStarted());

    const result = await signup(form);
    const outcome = parseSignupOutcome(result);
    if (!outcome.ok) {
      dispatch(submissionFailed(outcome.error));
      return;
    }
    goToLogin();
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 [background:radial-gradient(circle_at_top_left,#f3e8ff,transparent_55%),radial-gradient(circle_at_bottom_right,#fce7f3,transparent_55%),linear-gradient(to_bottom_right,#faf5ff,#fdf2f8)]">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_24px_-12px_rgba(147,51,234,0.2)] [animation:dc-pop-in_0.4s_ease_both] sm:p-8">
        <h1 className="mb-1 bg-gradient-to-br from-purple-600 to-pink-500 bg-clip-text text-center text-[1.75rem] font-extrabold text-transparent">DevConnect</h1>
        <p className="mb-6 text-center text-sm text-gray-500">Create your developer profile</p>

        <Banner variant="error" className="text-center mb-3">{error}</Banner>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <FormInput label="First name" required value={form.firstName} onChange={update('firstName')} />
          <FormInput label="Last name" value={form.lastName} onChange={update('lastName')} />
        </div>

        <FormInput
          label="Email"
          type="email"
          required
          value={form.email}
          onChange={update('email')}
          wrapperClassName="mb-4"
        />
        <FormInput
          label="Password"
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={update('password')}
          wrapperClassName="mb-6"
        />

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? 'Creating account...' : 'Sign Up'}
        </Button>

        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-purple-600">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
