import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChargerStatus } from '../types';
import websocketService from '../services/websocket';

type MetricKey = 'all' | 'voltage' | 'current' | 'power' | 'temperature' | 'status' | 'error';
type HudPhase = 'select' | 'hud';

const GUIDE_STORAGE_KEY = 'evsmart.hud.guide.dismissed';

const GUIDE_STEPS = [
  'Connect: live EV charger telemetry streams into this HUD in real time.',
  'View: open this page in the Meta Browser on your Quest headset — it renders as a floating virtual panel in your room.',
  'Fullscreen: tap Enter Fullscreen HUD to fill your entire virtual view with the panel.',
  'Hands-free: say commands like show voltage, show power, next charger.',
  'Fallback: use on-screen controls if voice or permissions are unavailable.',
];

const Hud: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [chargers, setChargers] = useState<ChargerStatus[]>([]);
  const [phase, setPhase] = useState<HudPhase>('select');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [fullscreenError, setFullscreenError] = useState<string>('');
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);
  const [selectedChargerId, setSelectedChargerId] = useState<string>('');
  const [voiceSupported, setVoiceSupported] = useState<boolean>(false);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [voiceError, setVoiceError] = useState<string>('');
  const [guideVisible, setGuideVisible] = useState<boolean>(searchParams.get('guide') === '1');
  const [guideStep, setGuideStep] = useState<number>(0);
  const [guideDontShowAgain, setGuideDontShowAgain] = useState<boolean>(false);
  const [focusMetric, setFocusMetric] = useState<MetricKey>('all');
  const [assistantMessage, setAssistantMessage] = useState<string>('');
  const hudRootRef = useRef<HTMLElement>(null);
  const recognitionRef = useRef<any>(null);

  const handsFreeRequested = searchParams.get('handsFree') === '1';

  useEffect(() => {
    const dismissed = window.localStorage.getItem(GUIDE_STORAGE_KEY) === '1';
    if (dismissed) {
      setGuideVisible(false);
    } else if (searchParams.get('guide') === '1') {
      setGuideVisible(true);
    }
  }, [searchParams]);

  useEffect(() => {
    // Keep a live socket subscription so the HUD updates without page refresh.
    websocketService.connect();
    const unsubscribe = websocketService.subscribe((items) => setChargers(items));
    setIsSocketConnected(websocketService.getConnectionStatus());

    const intervalId = window.setInterval(() => {
      setIsSocketConnected(websocketService.getConnectionStatus());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const VoiceCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setVoiceSupported(Boolean(VoiceCtor));
  }, []);

  useEffect(() => {
    return () => {
      stopVoiceControl();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const enterFullscreen = async () => {
    try {
      const root = hudRootRef.current as any;
      if (!root) return;

      const requestFn =
        root.requestFullscreen ||
        root.webkitRequestFullscreen ||
        root.mozRequestFullScreen ||
        root.msRequestFullscreen;

      if (typeof requestFn !== 'function') {
        setFullscreenError('Fullscreen is not available in this browser.');
        return;
      }

      await requestFn.call(root);
      setIsFullscreen(true);
      setFullscreenError('');
      setAssistantMessage('Entered fullscreen HUD. On Quest, this fills your virtual view.');
    } catch {
      setFullscreenError('Unable to enter fullscreen on this browser.');
    }
  };

  const exitFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    setIsFullscreen(false);
  };

  const pickCharger = (id: string) => {
    setSelectedChargerId(id);
    setPhase('hud');
    if (handsFreeRequested && voiceSupported && !voiceEnabled) {
      startVoiceControl();
    }
  };

  const skipPicker = () => {
    setPhase('hud');
    if (handsFreeRequested && voiceSupported && !voiceEnabled) {
      startVoiceControl();
    }
  };

  const cycleCharger = (direction: 1 | -1) => {
    if (chargers.length === 0) return;
    const currentId = selectedChargerId || chargers[0].id;
    const idx = chargers.findIndex((c) => c.id === currentId);
    const nextIndex = (idx + direction + chargers.length) % chargers.length;
    setSelectedChargerId(chargers[nextIndex].id);
    setAssistantMessage(`Selected ${chargers[nextIndex].id}`);
  };

  const applyGuidePreference = () => {
    if (guideDontShowAgain) {
      window.localStorage.setItem(GUIDE_STORAGE_KEY, '1');
    }
    setGuideVisible(false);
    setGuideStep(0);
  };

  const nextGuideStep = () => {
    if (guideStep >= GUIDE_STEPS.length - 1) {
      applyGuidePreference();
      return;
    }
    setGuideStep((prev) => prev + 1);
  };

  const previousGuideStep = () => {
    setGuideStep((prev) => Math.max(0, prev - 1));
  };

  const selectChargerFromCommand = (command: string): boolean => {
    const matched = chargers.find((item) => command.includes(item.id.toLowerCase()));
    if (!matched) {
      return false;
    }
    setSelectedChargerId(matched.id);
    setAssistantMessage(`Showing ${matched.id}`);
    return true;
  };

  const handleVoiceCommand = (raw: string) => {
    const command = raw.toLowerCase();
    setVoiceTranscript(command);

    if (selectChargerFromCommand(command)) return;

    if (command.includes('fullscreen') || command.includes('full screen')) {
      isFullscreen ? exitFullscreen() : enterFullscreen();
      return;
    }

    if (command.includes('exit fullscreen') || command.includes('close fullscreen')) {
      exitFullscreen();
      return;
    }

    if (command.includes('next')) {
      cycleCharger(1);
      return;
    }

    if (command.includes('previous') || command.includes('back')) {
      cycleCharger(-1);
      return;
    }

    if (command.includes('close guide') || command.includes('hide guide')) {
      setGuideVisible(false);
      return;
    }

    if (command.includes('show guide')) {
      setGuideVisible(true);
      return;
    }

    if (!activeCharger) return;

    if (command.includes('show voltage')) {
      setFocusMetric('voltage');
      setAssistantMessage(`Voltage: ${activeCharger.voltage.toFixed(1)} volts`);
      return;
    }

    if (command.includes('show current')) {
      setFocusMetric('current');
      setAssistantMessage(`Current: ${activeCharger.current.toFixed(1)} amps`);
      return;
    }

    if (command.includes('show power')) {
      setFocusMetric('power');
      setAssistantMessage(`Power: ${activeCharger.power.toFixed(1)} kilowatts`);
      return;
    }

    if (command.includes('show temperature')) {
      setFocusMetric('temperature');
      setAssistantMessage(`Temperature: ${activeCharger.temperature.toFixed(1)} degrees`);
      return;
    }

    if (command.includes('show status') || command.includes('health status')) {
      setFocusMetric('status');
      setAssistantMessage(`Status: ${activeCharger.status}`);
      return;
    }

    if (command.includes('show error') || command.includes('fault code')) {
      setFocusMetric('error');
      setAssistantMessage(activeCharger.errorCode ? `Error code: ${activeCharger.errorCode}` : 'No active error code');
      return;
    }

    if (command.includes('show all')) {
      setFocusMetric('all');
      setAssistantMessage('Showing full health panel.');
      return;
    }

    setAssistantMessage('Command not recognised. Try: show voltage, show status, next charger, fullscreen.');
  };

  const startVoiceControl = () => {
    try {
      const VoiceCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!VoiceCtor) {
        setVoiceError('Voice API is not available in this browser.');
        return;
      }

      const recognition = new VoiceCtor();
      recognition.lang = 'en-GB';
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const result = event.results[event.results.length - 1];
        if (!result || !result[0]) {
          return;
        }
        handleVoiceCommand(String(result[0].transcript || ''));
      };

      recognition.onerror = () => {
        setVoiceError('Voice recognition error. You can still use the HUD buttons.');
      };

      recognition.onend = () => {
        // Keep recognition active when hands-free mode is enabled.
        if (voiceEnabled && recognitionRef.current) {
          recognitionRef.current.start();
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setVoiceEnabled(true);
      setVoiceError('');
    } catch {
      setVoiceError('Unable to start voice control.');
    }
  };

  const stopVoiceControl = () => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onend = null;
      recognition.stop();
      recognitionRef.current = null;
    }
    setVoiceEnabled(false);
  };

  const activeCharger = useMemo(() => {
    if (selectedChargerId) {
      const selected = chargers.find((item) => item.id === selectedChargerId);
      if (selected) {
        return selected;
      }
    }

    // Charger in use will always show first.
    const charging = chargers.find((item) => item.status === 'charging');
    if (charging) {
      return charging;
    }
    return chargers[0];
  }, [chargers, selectedChargerId]);

  if (phase === 'select') {
    return (
      <section className="hud-screen" ref={hudRootRef}>
        <div className="hud-panel hud-picker">
          <h1>Choose Your Charger</h1>
          <p className="hud-subtitle">Select the charger you are attending to begin your session.</p>
          <p className="hud-xr-status" style={{ marginTop: 12 }}>
            On Quest: open this page in the Meta Browser — it renders as a floating virtual panel in your room.
          </p>
          {chargers.length === 0 ? (
            <div style={{ marginTop: 20 }}>
              <p className="hud-xr-status">Connecting to live telemetry...</p>
              <button
                type="button"
                className="hud-button"
                style={{ marginTop: 14 }}
                onClick={skipPicker}
              >
                Continue anyway
              </button>
            </div>
          ) : (
            <>
              <ul className="hud-picker-list">
                {chargers.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="hud-picker-card"
                      onClick={() => pickCharger(c.id)}
                    >
                      <span className="hud-picker-name">{c.id}</span>
                      <span className={`status-pill status-pill--${c.status}`}>{c.status}</span>
                      {c.status === 'charging' && (
                        <span className="hud-picker-meta">{c.power.toFixed(1)} kW &middot; {c.temperature.toFixed(1)} °C</span>
                      )}
                      {c.status === 'fault' && c.errorCode && (
                        <span className="hud-picker-meta hud-picker-meta--fault">{c.errorCode}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="hud-button"
                style={{ marginTop: 14, opacity: 0.7 }}
                onClick={skipPicker}
              >
                Skip — use default charger
              </button>
            </>
          )}
        </div>
      </section>
    );
  }

  if (!activeCharger) {
    return (
      <section className="hud-screen" ref={hudRootRef}>
        <div className="hud-panel">
          <h1>Live Charger HUD</h1>
          <p>Waiting for charger telemetry...</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`hud-screen${isFullscreen ? ' hud-screen--fullscreen' : ''}`}
      aria-label="Smart glasses live charger overlay"
      ref={hudRootRef}
    >
      <div className={`hud-panel${isFullscreen ? ' hud-panel--fullscreen' : ''}`}>
        <header className="hud-header">
          <div>
            <h1>{activeCharger.id}</h1>
            <p className="hud-subtitle">Field Engineer Overlay</p>
          </div>
          <div className="hud-header-right">
            <span className={`status-pill status-pill--${activeCharger.status}`}>
              {activeCharger.status}
            </span>
            <span className={`status-pill ${isSocketConnected ? 'status-pill--online' : 'status-pill--offline'}`}>
              {isSocketConnected ? 'socket connected' : 'socket reconnecting'}
            </span>
          </div>
        </header>

        <div className="hud-controls">
          <button
            type="button"
            className="hud-button"
            onClick={isFullscreen ? exitFullscreen : enterFullscreen}
          >
            {isFullscreen ? 'Exit Fullscreen HUD' : 'Enter Fullscreen HUD'}
          </button>
          <span className="hud-xr-status">
            {isFullscreen ? 'Fullscreen active — filling virtual view' : 'Quest: page renders as floating virtual panel'}
          </span>

          <button
            type="button"
            className="hud-button"
            onClick={voiceEnabled ? stopVoiceControl : startVoiceControl}
            disabled={!voiceSupported}
          >
            {voiceEnabled ? 'Disable Voice' : 'Enable Voice'}
          </button>
          <button type="button" className="hud-button" onClick={() => cycleCharger(1)}>
            Next Charger
          </button>
          <button type="button" className="hud-button" onClick={() => setGuideVisible((prev) => !prev)}>
            {guideVisible ? 'Hide Guide' : 'Show Guide'}
          </button>
        </div>

        {fullscreenError ? <p className="hud-error">{fullscreenError}</p> : null}
        {voiceError ? <p className="hud-error">{voiceError}</p> : null}
        {voiceTranscript ? <p className="hud-xr-status">Heard: {voiceTranscript}</p> : null}
        {assistantMessage ? <p className="hud-xr-status">Assistant: {assistantMessage}</p> : null}

        {guideVisible ? (
          <section className="hud-guide" aria-label="Guided hands-free controls">
            <h2>Hands-Free Guide</h2>
            <p>{GUIDE_STEPS[guideStep]}</p>
            <div className="hud-guide-controls">
              <button type="button" className="hud-button" onClick={previousGuideStep} disabled={guideStep === 0}>
                Back
              </button>
              <button type="button" className="hud-button" onClick={nextGuideStep}>
                {guideStep === GUIDE_STEPS.length - 1 ? 'Finish' : 'Next'}
              </button>
              <button type="button" className="hud-button" onClick={applyGuidePreference}>
                Skip
              </button>
            </div>
            <label className="hud-guide-checkbox">
              <input
                type="checkbox"
                checked={guideDontShowAgain}
                onChange={(event) => setGuideDontShowAgain(event.target.checked)}
              />
              Don't show again
            </label>
            <p>Voice commands: show voltage, show current, show power, show temperature, show status, show error, next charger, fullscreen.</p>
          </section>
        ) : null}

        <div className="hud-grid">
          <article className={focusMetric === 'all' || focusMetric === 'voltage' ? 'is-active' : ''}>
            <h2>Voltage</h2>
            <p>{activeCharger.voltage.toFixed(1)} V</p>
          </article>
          <article className={focusMetric === 'all' || focusMetric === 'current' ? 'is-active' : ''}>
            <h2>Current</h2>
            <p>{activeCharger.current.toFixed(1)} A</p>
          </article>
          <article className={focusMetric === 'all' || focusMetric === 'power' ? 'is-active' : ''}>
            <h2>Power</h2>
            <p>{activeCharger.power.toFixed(1)} kW</p>
          </article>
          <article className={focusMetric === 'all' || focusMetric === 'temperature' ? 'is-active' : ''}>
            <h2>Temperature</h2>
            <p>{activeCharger.temperature.toFixed(1)} C</p>
          </article>
        </div>

        <footer className="hud-footer">
          <span>Updated: {activeCharger.lastUpdated.toLocaleTimeString()}</span>
          {activeCharger.errorCode ? <span>Error: {activeCharger.errorCode}</span> : null}
        </footer>
      </div>
    </section>
  );
};

export default Hud;