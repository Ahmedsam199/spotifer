import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Form, FormGroup, Label, Input, Container } from 'reactstrap';

function Settings() {
  const isMac = navigator.platform.includes('Mac');
  const shorts = JSON.parse(localStorage.getItem('shortcuts'));
  const defaultShortcuts = shorts ?? {
    nextTrack: isMac ? 'Command+3' : 'Ctrl+3',
    playTrack: isMac ? 'Command+5' : 'Ctrl+5',
    pauseTrack: isMac ? 'Command+4' : 'Ctrl+4',
    VolumeDown: isMac ? 'Command+1' : 'Ctrl+1',
    VolumeUP: isMac ? 'Command+2' : 'Ctrl+2',
  };

  const [shortcuts, setShortcuts] = useState(defaultShortcuts);
  const [recording, setRecording] = useState(null); // Track active input field
  const pressedKeys = new Set(); // Store currently pressed keys

  useEffect(() => {
    window.electron.ipcRenderer.sendMessage('get-shortcuts');
    window.electron.ipcRenderer.on('current-shortcuts', (_, data) => {
      if (data && typeof data === 'object') {
        setShortcuts({
          ...defaultShortcuts, // Ensure fallback to defaults
          ...data, // Override with stored values
        });
      }
    });

    return () => {};
  }, [isMac]);

  const handleKeyDown = (event) => {
    if (!recording) return;

    event.preventDefault();
    event.stopPropagation(); // Prevent execution of existing shortcuts

    pressedKeys.add(
      event.key === 'Meta'
        ? 'Command'
        : event.key === 'Control'
          ? 'Ctrl'
          : event.key === ' '
            ? 'Space'
            : event.key,
    );
  };

  const handleKeyUp = (event) => {
    if (!recording) return;
    event.preventDefault();

    const shortcut = Array.from(pressedKeys).join('+'); // Convert Set to formatted shortcut

    // Prevent duplicate shortcut assignment
    if (Object.values(shortcuts).includes(shortcut)) {
      alert(`Shortcut "${shortcut}" is already assigned. Choose another.`);
      pressedKeys.clear();
      return;
    }

    setShortcuts((prev) => ({
      ...prev,
      [recording]: shortcut,
    }));

    pressedKeys.clear();
    setRecording(null);
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [recording]);

  const navigate = useNavigate();

  const handleSubmit = (event) => {
    event.preventDefault();
    localStorage.setItem('shortcuts', JSON.stringify(shortcuts));
    window.electron.ipcRenderer.sendMessage('set-shortcuts', shortcuts);
    navigate('/');
  };

  return (
    <Container>
      <h1 className="my-4">Modify Keyboard Shortcuts</h1>
      <Form onSubmit={handleSubmit}>
        {Object.keys(shortcuts).map((key) => (
          <FormGroup key={key}>
            <Label for={key}>{key.replace(/([A-Z])/g, ' $1').trim()}:</Label>
            <Input
              type="text"
              name={key}
              id={key}
              value={
                recording === key ? 'Recording... Press Keys' : shortcuts[key]
              }
              onFocus={() => setRecording(key)} // Start recording on focus
              readOnly // Prevent manual typing
            />
          </FormGroup>
        ))}
        <Button color="primary" type="submit">
          Save Changes
        </Button>
        <Button onClick={() => navigate('/')} color="secondary" className="m-1">
          Cancel
        </Button>
      </Form>
    </Container>
  );
}

export default Settings;
