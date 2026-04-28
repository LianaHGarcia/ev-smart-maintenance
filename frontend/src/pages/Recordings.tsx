import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createSessionRecordingAnnotation,
  fetchSessionRecording,
  fetchSessionRecordings,
} from '../services/api';
import { SessionRecording } from '../types';

const formatTimestamp = (seconds: number): string => {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

const formatDateTime = (value: string): string => new Date(value).toLocaleString();

const Recordings: React.FC = () => {
  const [recordings, setRecordings] = useState<SessionRecording[]>([]);
  const [selectedRecordingId, setSelectedRecordingId] = useState<string>('');
  const [selectedRecording, setSelectedRecording] = useState<SessionRecording | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [annotationNote, setAnnotationNote] = useState<string>('');
  const [annotationOperator, setAnnotationOperator] = useState<string>('');
  const [annotationTimestamp, setAnnotationTimestamp] = useState<string>('0');
  const [annotationSubmitting, setAnnotationSubmitting] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const selectedRecordingFromList = useMemo(
    () => recordings.find((recording) => recording.recording_id === selectedRecordingId) || null,
    [recordings, selectedRecordingId],
  );

  useEffect(() => {
    let mounted = true;

    const loadRecordings = async () => {
      setLoading(true);
      setError('');
      try {
        const items = await fetchSessionRecordings();
        if (!mounted) {
          return;
        }
        setRecordings(items);
        if (items.length > 0) {
          setSelectedRecordingId((current) => current || items[0].recording_id);
        }
      } catch {
        if (mounted) {
          setError('Unable to load recorded sessions.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadRecordings();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedRecordingId) {
      setSelectedRecording(null);
      return;
    }

    let mounted = true;

    const loadRecording = async () => {
      setDetailLoading(true);
      setError('');
      try {
        const item = await fetchSessionRecording(selectedRecordingId);
        if (mounted) {
          setSelectedRecording(item);
          setAnnotationOperator(item.operator_name);
        }
      } catch {
        if (mounted) {
          setError('Unable to load recording details.');
        }
      } finally {
        if (mounted) {
          setDetailLoading(false);
        }
      }
    };

    loadRecording();

    return () => {
      mounted = false;
    };
  }, [selectedRecordingId]);

  const captureCurrentVideoTime = () => {
    const currentTime = videoRef.current?.currentTime ?? 0;
    setAnnotationTimestamp(currentTime.toFixed(1));
  };

  const jumpToAnnotation = (seconds: number) => {
    if (!videoRef.current) {
      return;
    }
    videoRef.current.currentTime = seconds;
    void videoRef.current.play();
  };

  const submitAnnotation = async () => {
    if (!selectedRecording) {
      return;
    }

    if (!annotationOperator.trim() || !annotationNote.trim()) {
      setError('Operator and annotation note are required.');
      return;
    }

    const timestampSeconds = Number(annotationTimestamp);
    if (Number.isNaN(timestampSeconds) || timestampSeconds < 0) {
      setError('Annotation timestamp must be a valid non-negative number.');
      return;
    }

    setAnnotationSubmitting(true);
    setError('');
    try {
      const updated = await createSessionRecordingAnnotation({
        recordingId: selectedRecording.recording_id,
        operatorName: annotationOperator.trim(),
        timestampSeconds,
        note: annotationNote.trim(),
      });
      setSelectedRecording(updated);
      setRecordings((current) => current.map((item) => (item.recording_id === updated.recording_id ? updated : item)));
      setAnnotationNote('');
    } catch {
      setError('Unable to save the annotation.');
    } finally {
      setAnnotationSubmitting(false);
    }
  };

  return (
    <section className="recordings-page">
      <header className="recordings-page__header">
        <div>
          <h1>Session Recordings</h1>
          <p>Browse uploaded smart-glasses sessions, replay the stored video, and attach timestamped annotations.</p>
        </div>
      </header>

      {error ? <p className="recordings-page__error">{error}</p> : null}

      <div className="recordings-page__layout">
        <aside className="recordings-list-panel">
          <h2>Uploaded Sessions</h2>
          {loading ? <p>Loading recordings...</p> : null}
          {!loading && recordings.length === 0 ? <p>No recordings uploaded yet.</p> : null}
          <ul className="recordings-list">
            {recordings.map((recording) => (
              <li key={recording.recording_id}>
                <button
                  type="button"
                  className={`recordings-list__item${recording.recording_id === selectedRecordingId ? ' is-active' : ''}`}
                  onClick={() => setSelectedRecordingId(recording.recording_id)}
                >
                  <strong>{recording.charger_id}</strong>
                  <span>{recording.operator_name}</span>
                  <span>{formatDateTime(recording.started_at)}</span>
                  <span>{formatTimestamp(recording.duration_seconds)}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="recordings-detail-panel">
          {detailLoading ? <p>Loading selected recording...</p> : null}
          {!detailLoading && !selectedRecording ? <p>Select a recording to view playback and notes.</p> : null}

          {selectedRecording ? (
            <>
              <section className="recordings-detail-card">
                <div className="recordings-detail-card__meta">
                  <h2>{selectedRecording.charger_id}</h2>
                  <div className="recordings-detail-card__chips">
                    <span className="status-pill status-pill--charging">{selectedRecording.recording_mode || 'recorded session'}</span>
                    <span className="status-pill status-pill--online">{selectedRecording.annotations.length} annotations</span>
                  </div>
                </div>
                <p>
                  Recorded by {selectedRecording.operator_name} on {formatDateTime(selectedRecording.started_at)}.
                </p>
                <video
                  ref={videoRef}
                  className="recordings-player"
                  controls
                  src={selectedRecording.downloadUrl}
                  preload="metadata"
                />
                <div className="recordings-detail-card__actions">
                  <a href={selectedRecording.downloadUrl} className="cta-button" target="_blank" rel="noreferrer">
                    Open Video File
                  </a>
                  <button type="button" className="recordings-secondary-button" onClick={captureCurrentVideoTime}>
                    Capture Current Time
                  </button>
                </div>
              </section>

              <section className="recordings-annotations-grid">
                <article className="recordings-annotations-card">
                  <h3>Add Annotation</h3>
                  <label htmlFor="annotation-operator">Operator</label>
                  <input
                    id="annotation-operator"
                    type="text"
                    value={annotationOperator}
                    onChange={(event) => setAnnotationOperator(event.target.value)}
                  />
                  <label htmlFor="annotation-time">Video Time (seconds)</label>
                  <input
                    id="annotation-time"
                    type="number"
                    min="0"
                    step="0.1"
                    value={annotationTimestamp}
                    onChange={(event) => setAnnotationTimestamp(event.target.value)}
                  />
                  <label htmlFor="annotation-note">Annotation</label>
                  <textarea
                    id="annotation-note"
                    rows={5}
                    value={annotationNote}
                    onChange={(event) => setAnnotationNote(event.target.value)}
                    placeholder="Describe what happens at this point in the session."
                  />
                  <button type="button" className="cta-button" onClick={submitAnnotation} disabled={annotationSubmitting}>
                    {annotationSubmitting ? 'Saving...' : 'Save Annotation'}
                  </button>
                </article>

                <article className="recordings-annotations-card">
                  <h3>Timeline Notes</h3>
                  {selectedRecording.annotations.length === 0 ? <p>No annotations yet.</p> : null}
                  <ul className="recordings-annotations-list">
                    {selectedRecording.annotations
                      .slice()
                      .sort((left, right) => left.timestamp_seconds - right.timestamp_seconds)
                      .map((annotation) => (
                        <li key={annotation.annotation_id}>
                          <button type="button" className="recordings-annotations-list__time" onClick={() => jumpToAnnotation(annotation.timestamp_seconds)}>
                            {formatTimestamp(annotation.timestamp_seconds)}
                          </button>
                          <div>
                            <strong>{annotation.operator_name}</strong>
                            <p>{annotation.note}</p>
                            <span>{formatDateTime(annotation.created_at)}</span>
                          </div>
                        </li>
                      ))}
                  </ul>
                </article>
              </section>
            </>
          ) : null}
        </div>
      </div>

      {!loading && selectedRecordingFromList && !selectedRecording ? <p>Selected recording metadata is unavailable.</p> : null}
    </section>
  );
};

export default Recordings;