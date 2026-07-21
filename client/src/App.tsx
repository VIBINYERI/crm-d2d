import { NavLink, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Doors from './pages/Doors';
import LeadDetail from './pages/LeadDetail';
import MapView from './pages/MapView';
import Week from './pages/Week';
import QuickAdd from './pages/QuickAdd';
import Settings from './pages/Settings';

const tabs = [
  { to: '/', label: 'Home', icon: '⌂' },
  { to: '/doors', label: 'Doors', icon: '🚪' },
  { to: '/add', label: 'Add', icon: '+' },
  { to: '/map', label: 'Map', icon: '📍' },
  { to: '/week', label: 'Week', icon: '🗓' },
];

export default function App() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col bg-slate-50">
      <main className="flex-1 pb-24">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/doors" element={<Doors />} />
          <Route path="/doors/:id" element={<LeadDetail />} />
          <Route path="/add" element={<QuickAdd />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/week" element={<Week />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-2xl border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                tab.to === '/add'
                  ? 'flex flex-col items-center py-2'
                  : `flex flex-col items-center py-2 text-xs ${
                      isActive ? 'font-semibold text-blue-700' : 'text-slate-500'
                    }`
              }
            >
              {tab.to === '/add' ? (
                <span className="flex h-11 w-11 -translate-y-3 items-center justify-center rounded-full bg-blue-700 text-2xl font-bold text-white shadow-lg">
                  +
                </span>
              ) : (
                <>
                  <span className="text-lg leading-none">{tab.icon}</span>
                  <span className="mt-1">{tab.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
