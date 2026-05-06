import { useState, useCallback } from 'react';
import SignalForm from './components/SignalForm.jsx';
import SignalDashboard from './components/SignalDashboard.jsx';
import './App.css';

export default function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSignalCreated = useCallback(() => {
    setRefreshTrigger((t) => t + 1);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <span className="logo-kill">Kill</span>
          <span className="logo-shill">Shill</span>
        </div>
        <h1>Trading Signal Tracker</h1>
      </header>
      <main className="app-main">
        <SignalForm onSignalCreated={handleSignalCreated} />
        <SignalDashboard triggerRefresh={refreshTrigger} />
      </main>
    </div>
  );
}
