import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChargerStatus } from '../types';
import { SessionRecording } from '../types';
import { uploadSessionRecording } from '../services/api';
import websocketService from '../services/websocket';

type MetricKey = 'all' | 'voltage' | 'current' | 'power' | 'temperature' | 'status' | 'error';
type HudPhase = 'select' | 'hud';
type RecordingMode = 'screen' | 'camera';

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
  const [recordingSupported, setRecordingSupported] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingMode, setRecordingMode] = useState<RecordingMode | null>(null);
  const [recordingElapsedSeconds, setRecordingElapsedSeconds] = useState<number>(0);
  const [recordingError, setRecordingError] = useState<string>('');
  const [recordingStatus, setRecordingStatus] = useState<string>('');
  const [recordingUrl, setRecordingUrl] = useState<string>('');
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingFileName, setRecordingFileName] = useState<string>('');
  const [operatorName, setOperatorName] = useState<string>('');
  const [isUploadingRecording, setIsUploadingRecording] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>('');
  const [uploadedRecording, setUploadedRecording] = useState<SessionRecording | null>(null);
  const hudRootRef = useRef<HTMLElement>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingEndedAtRef = useRef<number | null>(null);

  const handsFreeRequested = searchParams.get('handsFree') === '1';

  const formatRecordingDuration = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const stopRecordingTracks = () => {
    if (!mediaStreamRef.current) {
      return;
    }

    mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const clearRecordingUrl = () => {
    if (!recordingUrl) {
      return;
    }

    window.URL.revokeObjectURL(recordingUrl);
    setRecordingUrl('');
  };

  const buildRecordingFileName = (startedAt: number | null = recordingStartedAtRef.current) => {
    const chargerId = (selectedChargerId || activeCharger?.id || 'session').replace(/[^a-z0-9_-]+/gi, '-');
    const baseTime = startedAt ? new Date(startedAt) : new Date();
    const timestamp = baseTime.toISOString().replace(/[.:]/g, '-');
    return `${chargerId}-${timestamp}.webm`;
  };

  const getPreferredMimeType = (): string | undefined => {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
      return undefined;
    }

    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];

    return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
  };

  const stopRecording = (statusMessage?: string) => {
    const recorder = mediaRecorderRef.current;

    if (!recorder) {
      stopRecordingTracks();
      setIsRecording(false);
      if (statusMessage) {
        setRecordingStatus(statusMessage);
      }
      return;
    }

    if (statusMessage) {
      setRecordingStatus(statusMessage);
    }

    if (recorder.state === 'inactive') {
      mediaRecorderRef.current = null;
      stopRecordingTracks();
      setIsRecording(false);
      return;
    }

    recorder.stop();
  };

  const startRecording = async () => {
    if (!recordingSupported) {
      setRecordingError('Recording is not available in this browser.');
      return;
    }

    setRecordingError('');
    setRecordingStatus('');
    setUploadError('');
    setUploadedRecording(null);
    clearRecordingUrl();
    setRecordingBlob(null);

    const mediaDevices = navigator.mediaDevices as MediaDevices & {
      getDisplayMedia?: (constraints?: MediaStreamConstraints) => Promise<MediaStream>;
    };

    let stream: MediaStream | null = null;
    let nextMode: RecordingMode = 'camera';

    try {
      if (typeof mediaDevices.getDisplayMedia === 'function') {
        try {
          stream = await mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
          nextMode = 'screen';
        } catch {
          stream = null;
        }
      }

      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        nextMode = 'camera';
      }

      const mimeType = getPreferredMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      mediaStreamRef.current = stream;
      recordingChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      recordingEndedAtRef.current = null;
      setRecordingMode(nextMode);
      setRecordingElapsedSeconds(0);
      setRecordingFileName(buildRecordingFileName(Date.now()));

      stream.getTracks().forEach((track) => {
        track.onended = () => {
          if (mediaRecorderRef.current?.state === 'recording') {
            stopRecording('Recording stopped by the device or browser.');
          }
        };
      });

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setRecordingError('Recording failed in this browser.');
        stopRecordingTracks();
        mediaRecorderRef.current = null;
        setIsRecording(false);
      };

      recorder.onstop = () => {
        recordingEndedAtRef.current = Date.now();
        const completedBlob = new Blob(recordingChunksRef.current, {
          type: recorder.mimeType || 'video/webm',
        });

        mediaRecorderRef.current = null;
        stopRecordingTracks();
        setIsRecording(false);

        if (completedBlob.size === 0) {
          setRecordingError('Recording finished, but no media data was captured.');
          return;
        }

        const nextUrl = window.URL.createObjectURL(completedBlob);
        setRecordingBlob(completedBlob);
        setRecordingUrl(nextUrl);
        setRecordingStatus(`Recording ready. Download or upload ${recordingFileName || buildRecordingFileName()} to keep a copy.`);
      };

      recorder.start(1000);
      setIsRecording(true);
      setRecordingStatus(nextMode === 'screen' ? 'Recording the HUD session.' : 'Recording camera and microphone feed.');
      setAssistantMessage(nextMode === 'screen' ? 'Session recording started from the headset display.' : 'Session recording started from the headset camera.');
    } catch {
      stopRecordingTracks();
      mediaRecorderRef.current = null;
      setIsRecording(false);
      setRecordingMode(null);
      setRecordingError('Unable to access screen, camera, or microphone for recording.');
    }
  };

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
    setRecordingSupported(Boolean(window.MediaRecorder && navigator.mediaDevices?.getUserMedia));
  }, []);

  useEffect(() => {
    return () => {
      stopVoiceControl();
      stopRecording();
      clearRecordingUrl();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isRecording) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      const startedAt = recordingStartedAtRef.current;
      if (!startedAt) {
        return;
      }
      setRecordingElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isRecording]);

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

    if (command.includes('start recording') || command.includes('record session')) {
      startRecording();
      return;
    }

    if (command.includes('stop recording')) {
      stopRecording('Recording stopped from voice control.');
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

  const uploadFinishedRecording = async () => {
    if (!recordingBlob || !activeCharger) {
      setUploadError('Record a session before uploading it.');
      return;
    }

    if (!operatorName.trim()) {
      setUploadError('Enter the operator name before uploading the session.');
      return;
    }

    const startedAt = recordingStartedAtRef.current;
    const endedAt = recordingEndedAtRef.current || Date.now();
    if (!startedAt) {
      setUploadError('Recording start time is missing. Record the session again.');
      return;
    }

    setIsUploadingRecording(true);
    setUploadError('');

    try {
      const uploaded = await uploadSessionRecording({
        video: recordingBlob,
        filename: recordingFileName || buildRecordingFileName(startedAt),
        chargerId: activeCharger.id,
        operatorName: operatorName.trim(),
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        durationSeconds: Math.max(0, Math.round((endedAt - startedAt) / 1000)),
        recordingMode: recordingMode || undefined,
      });

      setUploadedRecording(uploaded);
      setRecordingStatus(`Recording uploaded for ${uploaded.operator_name} on ${uploaded.charger_id}.`);
    } catch {
      setUploadError('Upload failed. Check that the backend is running and retry.');
    } finally {
      setIsUploadingRecording(false);
    }
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
          <button
            type="button"
            className={`hud-button${isRecording ? ' hud-button--recording' : ''}`}
            onClick={isRecording ? () => stopRecording('Recording stopped by the operator.') : startRecording}
            disabled={!recordingSupported}
          >
            {isRecording ? 'Stop Recording' : 'Record Session'}
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
        {recordingError ? <p className="hud-error">{recordingError}</p> : null}
        {uploadError ? <p className="hud-error">{uploadError}</p> : null}
        {voiceTranscript ? <p className="hud-xr-status">Heard: {voiceTranscript}</p> : null}
        {assistantMessage ? <p className="hud-xr-status">Assistant: {assistantMessage}</p> : null}

        <section className="hud-recording" aria-label="Session recording controls">
          <div>
            <h2>Session Recording</h2>
            <p>
              {isRecording
                ? `${recordingMode === 'screen' ? 'Capturing headset display' : 'Capturing camera and microphone'} for ${formatRecordingDuration(recordingElapsedSeconds)}.`
                : 'Use this on the headset to save a local video recording of the maintenance session.'}
            </p>
            <label className="hud-recording-label" htmlFor="operator-name">
              Operator
            </label>
            <input
              id="operator-name"
              className="hud-recording-input"
              type="text"
              value={operatorName}
              onChange={(event) => setOperatorName(event.target.value)}
              placeholder="Engineer name"
            />
          </div>
          <div className="hud-recording-meta">
            <span className={`status-pill ${isRecording ? 'status-pill--recording' : 'status-pill--offline'}`}>
              {isRecording ? 'recording live' : 'idle'}
            </span>
            {recordingStatus ? <span className="hud-xr-status">{recordingStatus}</span> : null}
            {recordingUrl ? (
              <a href={recordingUrl} download={recordingFileName || buildRecordingFileName()} className="hud-button hud-button--link">
                Download Recording
              </a>
            ) : null}
            {recordingBlob ? (
              <button
                type="button"
                className="hud-button"
                onClick={uploadFinishedRecording}
                disabled={isUploadingRecording}
              >
                {isUploadingRecording ? 'Uploading...' : 'Upload Recording'}
              </button>
            ) : null}
            {uploadedRecording ? (
              <a href={uploadedRecording.downloadUrl} className="hud-button hud-button--link" target="_blank" rel="noreferrer">
                Open Stored Video
              </a>
            ) : null}
          </div>
        </section>

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
            <p>Voice commands: show voltage, show current, show power, show temperature, show status, show error, next charger, fullscreen, start recording, stop recording.</p>
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