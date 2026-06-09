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
import './Signup.scss';

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
    <div className="dc-auth-page">
      <form onSubmit={handleSubmit} className="dc-auth-card">
        <h1 className="dc-auth-title">DevConnect</h1>
        <p className="dc-auth-subtitle">Create your developer profile</p>

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

        <p className="dc-auth-footer">
          Already have an account?{' '}
          <Link to="/login" className="dc-auth-link">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
