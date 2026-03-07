import { useEffect, useRef } from 'react';

function LLMLog({ logs }) {
  const logEndRef = useRef(null);

  useEffect(() => {
    // Auto-scroll to bottom when new logs are added
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (logs.length === 0) {
    return (
      <div className="llm-log">
        <div className="log-header">LLM Console</div>
        <div className="log-content log-empty">
          No activity yet. Add some food to see what the LLM is thinking...
        </div>
      </div>
    );
  }

  return (
    <div className="llm-log">
      <div className="log-header">
        LLM Console
        <span className="log-count">{logs.length} entries</span>
      </div>
      <div className="log-content">
        {logs.map((log, index) => (
          <div key={index} className={`log-entry log-${log.type}`}>
            <div className="log-timestamp">[{log.timestamp}]</div>
            <div className="log-label">{log.label}</div>
            <div className="log-message">
              {typeof log.message === 'string'
                ? log.message
                : <pre>{JSON.stringify(log.message, null, 2)}</pre>
              }
            </div>
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

export default LLMLog;
