/* eslint-disable no-use-before-define */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Col, Container, Row } from 'reactstrap';

const CLIENT_ID = '7d1e55e578874bf39f191c0425cca5d9';
const REDIRECT_URI = 'http://localhost:1213/';
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const SCOPES = 'user-modify-playback-state user-read-playback-state';

function SpotifyControl() {
  const [accessToken, setAccessToken] = useState(
    localStorage.getItem('spotifyAccessToken') || '',
  );
  const [currentVolume, setCurrentVolume] = useState(null); // State to hold current volume
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.hash.substring(1));
    const token = urlParams.get('access_token');
    const expiresIn = urlParams.get('expires_in'); // Get token expiration time

    if (token) {
      const expirationTime = Date.now() + expiresIn * 1000; // Convert to milliseconds
      localStorage.setItem('spotifyAccessToken', token);
      localStorage.setItem('spotifyTokenExpiration', expirationTime);
      setAccessToken(token);
      window.history.pushState({}, null, window.location.pathname); // Clean URL
    } else {
      checkTokenExpiration();
    }
  }, []);

  const checkTokenExpiration = () => {
    const expirationTime = Number(
      localStorage.getItem('spotifyTokenExpiration'),
    ); // Convert to number
    if (!expirationTime || Date.now() >= expirationTime) {
      localStorage.removeItem('spotifyAccessToken');
      localStorage.removeItem('spotifyTokenExpiration');
      login(); // Reauthorize user
    }
  };

  useEffect(() => {
    const handleNextTrack = () => playNextTrack();
    const handlePlayTrack = () => playTrack();
    const handlePauseTrack = () => pauseTrack();
    const handleVolumeUP = () => adjustVolume(true);
    const handleVolumeDown = () => adjustVolume(false);

    window.electron.ipcRenderer.on('nextTrack', handleNextTrack);
    window.electron.ipcRenderer.on('playTrack', handlePlayTrack);
    window.electron.ipcRenderer.on('pauseTrack', handlePauseTrack);
    window.electron.ipcRenderer.on('VolumeUP', handleVolumeUP);
    window.electron.ipcRenderer.on('VolumeDown', handleVolumeDown);

    return () => {
      // window.electron.ipcRenderer.removeListener('nextTrack', handleNextTrack);
      // window.electron.ipcRenderer.removeListener('playTrack', handlePlayTrack);
      // window.electron.ipcRenderer.removeListener(
      //   'pauseTrack',
      //   handlePauseTrack,
      // );
      // window.electron.ipcRenderer.removeListener('VolumeUP', handleVolumeUP);
      // window.electron.ipcRenderer.removeListener(
      //   'VolumeDown',
      //   handleVolumeDown,
      // );
    };
  }, []);

  const login = () => {
    window.location.href = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=${SCOPES}&response_type=token&show_dialog=true`;
  };

  const playNextTrack = async () => {
    if (!accessToken) return;

    try {
      const response = await fetch(
        'https://api.spotify.com/v1/me/player/next',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.status === 204) {
        console.log('Skipped to the next track!');
      } else {
        const errorData = await response.json();
        console.error('Error skipping track:', errorData);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const playTrack = async () => {
    if (!accessToken) return;

    try {
      const response = await fetch(
        'https://api.spotify.com/v1/me/player/play',
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.status === 204) {
        console.log('Playback started');
      } else {
        const errorData = await response.json();
        console.error('Error starting playback:', errorData);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const pauseTrack = async () => {
    if (!accessToken) return;

    try {
      const response = await fetch(
        'https://api.spotify.com/v1/me/player/pause',
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.status === 204) {
        console.log('Playback paused');
      } else {
        const errorData = await response.json();
        console.error('Error pausing track:', errorData);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchCurrentVolume = async () => {
    if (!accessToken) return;

    try {
      const response = await fetch('https://api.spotify.com/v1/me/player', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log(data);

        setCurrentVolume(data.device.volume_percent); // Set current volume
      }
    } catch (error) {
      console.error('Error fetching current volume:', error);
    }
  };

  const adjustVolume = async (increase) => {
    // await fetchCurrentVolume();
    if (!accessToken) return;

    const newVolume = increase ? 75 : 25;

    try {
      const response = await fetch(
        `https://api.spotify.com/v1/me/player/volume?volume_percent=${newVolume}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.status === 204) {
        // setCurrentVolume(newVolume); // Update state with new volume
        console.log(
          `Volume ${increase ? 'increased' : 'decreased'} to ${newVolume}%`,
        );
      } else {
        const errorData = await response.json();
        console.error('Error adjusting volume:', errorData);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <Container className="d-flex flex-column align-items-center justify-content-center min-vh-100 bg-dark text-white">
      <h1 className="mb-4">Spotify Controller</h1>
      {accessToken ? (
        <Row className="w-50 text-center">
          <Col xs="6" className="mb-2">
            <Button color="success" block onClick={() => playTrack()}>
              Play
            </Button>
          </Col>
          <Col xs="6" className="mb-2">
            <Button color="danger" block onClick={() => pauseTrack()}>
              Pause
            </Button>
          </Col>
          <Col xs="6" className="mb-2">
            <Button color="primary" block onClick={() => playNextTrack()}>
              Next
            </Button>
          </Col>
          <Col xs="6" className="mb-2">
            <Button color="warning" block onClick={() => adjustVolume(true)}>
              Vol +
            </Button>
          </Col>
          <Col xs="6" className="mb-2">
            <Button color="info" block onClick={() => adjustVolume(false)}>
              Vol -
            </Button>
          </Col>
          <Col xs="6" className="mb-2">
            <Button
              color="secondary"
              block
              onClick={() => navigate('/Setting')}
            >
              Settings
            </Button>
          </Col>
        </Row>
      ) : (
        <Button color="success" size="lg" onClick={login}>
          Login to Spotify
        </Button>
      )}
    </Container>
  );
}

export default SpotifyControl;
