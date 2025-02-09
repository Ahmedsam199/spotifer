import {
  MemoryRouter as Router,
  Routes,
  Route,
  HashRouter,
} from 'react-router-dom';
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
      window?.electron?.ipcRenderer.sendMessage(
        'set-shortcuts',
        JSON.parse(localStorage.getItem('shortcuts')),
      );
    }
  }, []);
  useEffect(() => {
    const handleAuthSuccess = (event, accessToken) => {
      console.log('🎯 Access token received in renderer:', accessToken);
      localStorage.setItem('spotifyAccessToken', event);

      window.location.reload(); // Reload to reflect changes
    };

    // Add the listener
    window.electron.ipcRenderer.on('spotify-auth-success', handleAuthSuccess);

    // Cleanup the listener when the component unmounts
    return () => {
      window.electron.ipcRenderer.removeListener(
        'spotify-auth-success',
        handleAuthSuccess,
      );
    };
  }, []);
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Hello />} />
        <Route path="/Setting" element={<Settings />} />
      </Routes>
    </HashRouter>
  );
}
