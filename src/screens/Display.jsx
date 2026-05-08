import { useState, useEffect, useRef } from 'react';
import { Maximize } from 'lucide-react';

const channel = new BroadcastChannel('church_display_channel');

export default function Display() {
  const [state, setState] = useState({
    remainingSeconds: 0,
    totalSeconds: 300,
    message: '',
    theme: { bg: '#000000', text: '#ef4444' },
    displayMode: 'timer',
    enableBlinkingBarrier: false
  });
  
  const [localTime, setLocalTime] = useState(new Date());
  const measureRef = useRef(null);
  const [needsScroll, setNeedsScroll] = useState(false);

  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data.type === 'SYNC') {
        setState(prev => ({ ...prev, ...e.data.state }));
      }
    };
    
    channel.addEventListener('message', handleMessage);
    channel.postMessage({ type: 'REQUEST_SYNC' });
    
    return () => channel.removeEventListener('message', handleMessage);
  }, []);

  // Update local time every second for the clock mode
  useEffect(() => {
    const interval = setInterval(() => {
      setLocalTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (state.message && measureRef.current) {
      const el = measureRef.current;
      const style = window.getComputedStyle(el);
      const fontSize = parseFloat(style.fontSize);
      const lineHeight = fontSize * 0.95;
      const height = el.getBoundingClientRect().height;
      
      // If height is greater than 2 lines worth of height, we scroll
      setNeedsScroll(height > lineHeight * 2.5);
    } else {
      setNeedsScroll(false);
    }
  }, [state.message, state.theme.text]);

  const formatTime = (secs) => {
    const isNegative = secs < 0;
    const absSecs = Math.abs(secs);
    const m = Math.floor(absSecs / 60).toString().padStart(2, '0');
    const s = (absSecs % 60).toString().padStart(2, '0');
    return isNegative ? `+${m}:${s}` : `${m}:${s}`;
  };

  const getLocalTimeString = () => {
    let hours = localTime.getHours();
    const minutes = localTime.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    return `${hours}:${minutes} ${ampm}`;
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const isBlinking = state.enableBlinkingBarrier && state.displayMode === 'timer' && state.totalSeconds > 0 && state.remainingSeconds <= (state.totalSeconds * 0.05);

  const timerClass = `display-timer ${state.message ? (needsScroll ? 'shrunk-scroll' : 'shrunk') : 'normal'}`;
  const messageClass = `display-message ${needsScroll ? 'scrolling' : 'static'}`;

  return (
    <div 
      className={`display-layout ${isBlinking ? 'blinking-barrier' : ''}`} 
      style={{ backgroundColor: state.theme.bg }}
    >
      <button 
        className="btn btn-secondary fullscreen-btn" 
        onClick={handleFullscreen}
        style={{ color: state.theme.text, borderColor: state.theme.text }}
      >
        <Maximize size={24} />
      </button>

      <div 
        className={timerClass}
        style={{ color: state.theme.text }}
      >
        {state.displayMode === 'clock' ? getLocalTimeString() : formatTime(state.remainingSeconds)}
      </div>

      {state.message && (
        <div className={`display-message-container ${needsScroll ? 'scroll-container' : 'static-container'}`}>
          <div 
            className={messageClass}
            style={{ color: state.theme.text }}
          >
            {state.message}
          </div>
        </div>
      )}
      
      {state.message && (
        <div 
          className="measure-message" 
          ref={measureRef}
        >
          {state.message}
        </div>
      )}
    </div>
  );
}
