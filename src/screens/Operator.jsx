import { useState, useEffect, useRef } from 'react';
import { MonitorPlay, Play, Pause, Square, Send, Trash2, Settings, Type, Clock, Save } from 'lucide-react';

const channel = new BroadcastChannel('church_display_channel');

export default function Operator() {
  const [inputMinutes, setInputMinutes] = useState('5');
  const [inputSeconds, setInputSeconds] = useState('0');

  const [remainingSeconds, setRemainingSeconds] = useState(300);
  const [totalSeconds, setTotalSeconds] = useState(300);
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState('');
  const [theme, setTheme] = useState({ bg: '#000000', text: '#ef4444' });
  const [msgInput, setMsgInput] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('');
  const [screens, setScreens] = useState([]);
  const [showScreenModal, setShowScreenModal] = useState(false);

  // New Features State
  const [displayMode, setDisplayMode] = useState('timer'); // 'timer' | 'clock'
  const [enableOvertime, setEnableOvertime] = useState(false);
  const [enableBlinkingBarrier, setEnableBlinkingBarrier] = useState(true);

  // Presets State
  const defaultPresets = [
    { name: '5 Mins', minutes: '5', seconds: '0' },
    { name: '10 Mins', minutes: '10', seconds: '0' },
    { name: '15 Mins', minutes: '15', seconds: '0' },
    { name: '20 Mins', minutes: '20', seconds: '0' }
  ];

  const [presets, setPresets] = useState(() => {
    const saved = localStorage.getItem('church_timer_presets');
    const parsed = saved ? JSON.parse(saved) : null;
    return parsed && parsed.length > 0 ? parsed : defaultPresets;
  });

  const workerRef = useRef(null);
  const stateRef = useRef({
    remainingSeconds: 300,
    isRunning: false,
    message: '',
    theme: { bg: '#000000', text: '#ef4444' },
    displayMode: 'timer',
    enableOvertime: false,
    enableBlinkingBarrier: true,
    totalSeconds: 300
  });

  // Keep ref in sync
  useEffect(() => {
    stateRef.current = { remainingSeconds, isRunning, message, theme, displayMode, enableOvertime, enableBlinkingBarrier, totalSeconds };
  }, [remainingSeconds, isRunning, message, theme, displayMode, enableOvertime, enableBlinkingBarrier, totalSeconds]);

  // Sync state to display
  const broadcastSync = (stateDelta = {}) => {
    channel.postMessage({
      type: 'SYNC',
      state: stateDelta
    });
  };

  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data.type === 'REQUEST_SYNC') {
        channel.postMessage({
          type: 'SYNC',
          state: stateRef.current
        });
      }
    };
    channel.addEventListener('message', handleMessage);
    return () => channel.removeEventListener('message', handleMessage);
  }, []);

  // Set up Web Worker for reliable background interval
  useEffect(() => {
    const code = `
      let interval;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          interval = setInterval(() => self.postMessage('tick'), 1000);
        } else if (e.data === 'stop') {
          clearInterval(interval);
        }
      };
    `;
    const blob = new Blob([code], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    workerRef.current = new Worker(url);

    return () => {
      workerRef.current.terminate();
      URL.revokeObjectURL(url);
    };
  }, []);

  // Timer Logic
  useEffect(() => {
    if (!workerRef.current) return;

    workerRef.current.onmessage = () => {
      setRemainingSeconds(prev => {
        if (prev <= 1 && !stateRef.current.enableOvertime) {
          workerRef.current.postMessage('stop');
          setIsRunning(false);
          broadcastSync({ remainingSeconds: 0, isRunning: false });
          return 0;
        }
        broadcastSync({ remainingSeconds: prev - 1 });
        return prev - 1;
      });
    };

    if (isRunning) {
      workerRef.current.postMessage('start');
    } else {
      workerRef.current.postMessage('stop');
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.postMessage('stop');
      }
    };
  }, [isRunning]);

  useEffect(() => {
    localStorage.setItem('church_timer_presets', JSON.stringify(presets));
  }, [presets]);

  const handleStart = () => {
    if (remainingSeconds === 0 && !enableOvertime) {
      const totalSecs = (parseInt(inputMinutes) || 0) * 60 + (parseInt(inputSeconds) || 0);
      setRemainingSeconds(totalSecs);
      setTotalSeconds(totalSecs);
      setIsRunning(true);
      broadcastSync({ remainingSeconds: totalSecs, totalSeconds: totalSecs, isRunning: true });
    } else {
      setIsRunning(true);
      broadcastSync({ isRunning: true });
    }
  };

  const handlePause = () => {
    setIsRunning(false);
    broadcastSync({ isRunning: false });
  };

  const handleReset = () => {
    setShowResetModal(true);
  };

  const confirmReset = () => {
    setShowResetModal(false);
    setIsRunning(false);
    const totalSecs = (parseInt(inputMinutes) || 0) * 60 + (parseInt(inputSeconds) || 0);
    setRemainingSeconds(totalSecs);
    setTotalSeconds(totalSecs);
    broadcastSync({ isRunning: false, remainingSeconds: totalSecs, totalSeconds: totalSecs });
  };

  const cancelReset = () => {
    setShowResetModal(false);
  };

  const handleSendMessage = (text) => {
    setMessage(text);
    broadcastSync({ message: text });
  };

  const handleClearMessage = () => {
    setMessage('');
    setMsgInput('');
    broadcastSync({ message: '' });
  };

  const handleThemeChange = (key, value) => {
    const newTheme = { ...theme, [key]: value };
    setTheme(newTheme);
    broadcastSync({ theme: newTheme });
  };

  const handleDisplayModeToggle = () => {
    const newMode = displayMode === 'timer' ? 'clock' : 'timer';
    setDisplayMode(newMode);
    broadcastSync({ displayMode: newMode });
  };

  const handleSettingToggle = (setting) => {
    if (setting === 'overtime') {
      const newVal = !enableOvertime;
      setEnableOvertime(newVal);
      broadcastSync({ enableOvertime: newVal });
    } else if (setting === 'barrier') {
      const newVal = !enableBlinkingBarrier;
      setEnableBlinkingBarrier(newVal);
      broadcastSync({ enableBlinkingBarrier: newVal });
    }
  };

  const formatTime = (secs) => {
    const isNegative = secs < 0;
    const absSecs = Math.abs(secs);
    const m = Math.floor(absSecs / 60).toString().padStart(2, '0');
    const s = (absSecs % 60).toString().padStart(2, '0');
    return isNegative ? `+${m}:${s}` : `${m}:${s}`;
  };

  const defaultMessages = ["Please Round up", "Your Time is up", "5 Minutes Left", "Welcome to Church"];
  const [quickMessages, setQuickMessages] = useState(() => {
    const saved = localStorage.getItem('church_quick_messages');
    return saved ? JSON.parse(saved) : defaultMessages;
  });

  useEffect(() => {
    localStorage.setItem('church_quick_messages', JSON.stringify(quickMessages));
  }, [quickMessages]);

  const handleSaveQuickMessage = () => {
    if (msgInput.trim() && !quickMessages.includes(msgInput.trim())) {
      setQuickMessages([...quickMessages, msgInput.trim()]);
    }
  };

  const handleDeleteQuickMessage = (msgToDelete, e) => {
    e.stopPropagation();
    setQuickMessages(quickMessages.filter(msg => msg !== msgToDelete));
  };

  const handleSavePreset = () => {
    if (presets.length >= 10) {
      alert("You can only save up to 10 presets. Please delete one first.");
      return;
    }
    setPresetNameInput('');
    setShowPresetModal(true);
  };

  const confirmSavePreset = () => {
    if (presetNameInput.trim()) {
      setPresets([...presets, { name: presetNameInput.trim(), minutes: inputMinutes || '0', seconds: inputSeconds || '0' }]);
    }
    setShowPresetModal(false);
  };

  const cancelSavePreset = () => {
    setShowPresetModal(false);
  };

  const handleLoadPreset = (preset) => {
    setInputMinutes(preset.minutes);
    setInputSeconds(preset.seconds);
    const totalSecs = parseInt(preset.minutes) * 60 + parseInt(preset.seconds);

    // Auto reset and load if stopped
    if (!isRunning) {
      setRemainingSeconds(totalSecs);
      setTotalSeconds(totalSecs);
      broadcastSync({ remainingSeconds: totalSecs, totalSeconds: totalSecs });
    }
  };

  const handleDeletePreset = (index, e) => {
    e.stopPropagation();
    setPresets(presets.filter((_, i) => i !== index));
  };

  const handleOpenDisplay = async () => {
    try {
      if ('getScreenDetails' in window) {
        const screenDetails = await window.getScreenDetails();
        if (screenDetails.screens.length > 1) {
          setScreens(screenDetails.screens);
          setShowScreenModal(true);
          return;
        }
      }
    } catch (err) {
      console.error("Screen detection failed or permission denied:", err);
    }
    // Fallback: just open it normally
    window.open('/display', 'displayWindow', 'width=1280,height=720');
  };

  const openOnScreen = (screen) => {
    const features = `left=${screen.availLeft},top=${screen.availTop},width=${screen.availWidth},height=${screen.availHeight}`;
    window.open('/display', 'displayWindow', features);
    setShowScreenModal(false);
  };

  return (
    <div className="operator-layout">
      <div className="operator-header">
        <h1><Settings className="text-primary" /> Operator Dashboard</h1>
        <button
          className="btn btn-primary"
          onClick={handleOpenDisplay}
        >
          <MonitorPlay size={18} />
          Open Display Window
        </button>
      </div>

      <div className="grid-container">
        {/* Timer Control Panel */}
        <div className="glass-panel">
          <h2 className="section-title"><Play size={20} /> Timer Controls</h2>

          <div className="controls-row" style={{ marginBottom: '16px' }}>
            <button
              className={`btn ${displayMode === 'timer' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => displayMode !== 'timer' && handleDisplayModeToggle()}
              style={{ flex: 1 }}
            >
              Countdown
            </button>
            <button
              className={`btn ${displayMode === 'clock' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => displayMode !== 'clock' && handleDisplayModeToggle()}
              style={{ flex: 1 }}
            >
              <Clock size={18} /> Local Time
            </button>
          </div>

          <div className="timer-display">
            {formatTime(remainingSeconds)}
          </div>

          <div className="timer-inputs">
            <div className="timer-input-group">
              <input
                type="number"
                className="input timer-input"
                value={inputMinutes}
                onChange={e => setInputMinutes(e.target.value)}
                min="0"
              />
              <label>Minutes</label>
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', lineHeight: '1', paddingTop: '2px', color: 'rgba(255,255,255,0.8)' }}>:</div>
            <div className="timer-input-group">
              <input
                type="number"
                className="input timer-input"
                value={inputSeconds}
                onChange={e => setInputSeconds(e.target.value)}
                min="0" max="59"
              />
              <label>Seconds</label>
            </div>
          </div>

          <div className="controls-row" style={{ marginBottom: '16px' }}>
            {!isRunning ? (
              <button className="btn btn-primary" onClick={handleStart} disabled={displayMode === 'clock'}>
                <Play size={18} /> Start
              </button>
            ) : (
              <button className="btn btn-secondary" onClick={handlePause} disabled={displayMode === 'clock'}>
                <Pause size={18} /> Pause
              </button>
            )}
            <button className="btn btn-secondary" onClick={handleReset} disabled={displayMode === 'clock'}>
              <Square size={18} /> Reset
            </button>
          </div>

          {/* Presets Section */}
          <div style={{ marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' }}>Timer Presets</span>
              <button className="btn btn-secondary" onClick={handleSavePreset} style={{ padding: '4px 8px', fontSize: '0.8rem' }}>
                <Save size={14} /> Save Current
              </button>
            </div>
            <div className="preset-list">
              {presets.map((preset, i) => (
                <div key={i} className="preset-chip" onClick={() => handleLoadPreset(preset)}>
                  <span>{preset.name} ({preset.minutes}:{preset.seconds.toString().padStart(2, '0')})</span>
                  <button className="delete-preset" onClick={(e) => handleDeletePreset(i, e)}>&times;</button>
                </div>
              ))}
              {presets.length === 0 && <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', padding: '4px' }}>No presets saved</span>}
            </div>
          </div>
        </div>

        {/* Messaging Panel */}
        <div className="glass-panel">
          <h2 className="section-title"><Type size={20} /> Messaging</h2>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)', marginBottom: '8px', display: 'block' }}>Quick Messages</label>
            <div className="quick-messages">
              {quickMessages.map((msg, i) => (
                <div
                  key={i}
                  className="quick-message-chip"
                  onClick={() => { setMsgInput(msg); handleSendMessage(msg); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <span>{msg}</span>
                  <button
                    onClick={(e) => handleDeleteQuickMessage(msg, e)}
                    style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 0, fontSize: '1.2rem', lineHeight: 1 }}
                    title="Delete message"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              type="text"
              className="input"
              placeholder="Type a custom message..."
              value={msgInput}
              onChange={e => setMsgInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage(msgInput)}
            />
            <button className="btn btn-secondary" onClick={handleSaveQuickMessage} title="Save to Quick Messages">
              Save
            </button>
          </div>

          <div className="controls-row" style={{ justifyContent: 'flex-start' }}>
            <button className="btn btn-primary" onClick={() => handleSendMessage(msgInput)}>
              <Send size={18} /> Display Message
            </button>
            <button className="btn btn-secondary" onClick={handleClearMessage}>
              <Trash2 size={18} /> Clear
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleOpenDisplay}
              title="Move an already open display to a different screen"
              style={{ marginLeft: 'auto' }}
            >
              <MonitorPlay size={18} />
              Switch Screen
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        <div className="glass-panel">
          <h2 className="section-title"><Settings size={20} /> Advanced Settings</h2>

          <div className="color-picker-group">
            <span>Background Color</span>
            <input
              type="color"
              className="color-picker"
              value={theme.bg}
              onChange={e => handleThemeChange('bg', e.target.value)}
            />
          </div>

          <div className="color-picker-group">
            <span>Text Color</span>
            <input
              type="color"
              className="color-picker"
              value={theme.text}
              onChange={e => handleThemeChange('text', e.target.value)}
            />
          </div>

          <div className="color-picker-group" style={{ padding: '16px 12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span>Enable Overtime</span>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>Continue counting up past 0:00</span>
            </div>
            <input
              type="checkbox"
              style={{ width: '20px', height: '20px' }}
              checked={enableOvertime}
              onChange={() => handleSettingToggle('overtime')}
            />
          </div>

          <div className="color-picker-group" style={{ padding: '16px 12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span>Blinking Warning</span>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>Flash border when 5% time remains</span>
            </div>
            <input
              type="checkbox"
              style={{ width: '20px', height: '20px' }}
              checked={enableBlinkingBarrier}
              onChange={() => handleSettingToggle('barrier')}
            />
          </div>
        </div>

      </div>

      {showResetModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Reset Timer</h3>
            <p className="modal-body">Are you sure you want to reset the timer? This will stop the countdown immediately.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={cancelReset}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmReset}>Yes, Reset</button>
            </div>
          </div>
        </div>
      )}

      {showPresetModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Save Preset</h3>
            <p className="modal-body" style={{ marginBottom: '16px' }}>Enter a name for this preset (e.g., 'Sermon'):</p>
            <input
              type="text"
              className="input"
              value={presetNameInput}
              onChange={e => setPresetNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmSavePreset()}
              style={{ marginBottom: '24px' }}
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={cancelSavePreset}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmSavePreset}>Save</button>
            </div>
          </div>
        </div>
      )}

      {showScreenModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <h3 className="modal-title">Select Display Screen</h3>
            <p className="modal-body" style={{ marginBottom: '16px' }}>Choose which screen to open the display on:</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {screens.map((screen, index) => (
                <button
                  key={index}
                  className={`btn ${screen.isInternal ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={() => openOnScreen(screen)}
                  style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
                >
                  <MonitorPlay size={18} style={{ marginRight: '12px', flexShrink: 0 }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 'bold' }}>
                      {screen.label || `Screen ${index + 1}`} {screen.isInternal ? '(Internal)' : '(External)'}
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                      Resolution: {screen.width}x{screen.height}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowScreenModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
