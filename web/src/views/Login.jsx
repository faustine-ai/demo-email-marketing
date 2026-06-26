import { useState } from 'react';
import { login } from '../lib/store.js';
import { IconLock } from '../components/Icons.jsx';

// Full-screen sign-in. On success it hands the authenticated user back up to
// App, which opens the WebSocket and renders the console.
export default function Login({ onAuthed }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await login(username.trim(), password);
      onAuthed(user);
    } catch (err) {
      setError(err.message || 'Could not sign in');
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-brand">
          <span className="mark">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M6 21 L13 9 L17.5 17 L20.5 12 L26 21" stroke="var(--coral)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <div className="name">RELAY</div>
            <div className="sub">dispatch console</div>
          </div>
        </div>

        <h1>Sign in</h1>
        <p className="login-lead">Authenticate to reach the dispatch console.</p>

        <form onSubmit={submit}>
          <div className="field">
            <label>Username</label>
            <input
              className="input"
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
            />
          </div>
          <div className="field" style={{ marginTop: 16 }}>
            <label>Password</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn primary" style={{ width: '100%', marginTop: 22, justifyContent: 'center' }} disabled={busy || !username.trim() || !password}>
            <IconLock style={{ width: 16, height: 16 }} /> {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="login-hint">
          <span className="mono-tag">Demo credentials</span>
          <div>
            <code>admin</code> / <code>relay</code>
          </div>
        </div>
      </div>
    </div>
  );
}
