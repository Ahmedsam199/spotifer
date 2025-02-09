import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import icon from '../../assets/icon.svg';
import './App.css';
import SpotifyNextTrack from './NextTrack';
import Settings from './Settings';
import 'bootstrap/dist/css/bootstrap.css';
import { useEffect } from 'react';

function Hello() {
  return (
    <div className="bg-dark">
      <SpotifyNextTrack />
    </div>
  );
}

export default function App() {
  useEffect(() => {
    if (JSON.parse(localStorage.getItem('shortcuts'))) {
      window.electron.ipcRenderer.sendMessage(
        'set-shortcuts',
        JSON.parse(localStorage.getItem('shortcuts')),
      );
    }
  }, []);
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hello />} />
        <Route path="/Setting" element={<Settings />} />
      </Routes>
    </Router>
  );
}
