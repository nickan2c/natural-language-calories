import { useState, useRef, useEffect } from 'react';

function ChatInput({ onSubmit, loading, messages }) {
  const [text, setText] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (text.trim() && !loading) {
      onSubmit(text.trim());
      setText('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>hey bestie, what did you eat today?</p>
            <p className="chat-empty-hint">you can also say things like "sup", "how's my week", or "12k steps yesterday"</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble ${msg.role}`}>
            <div className="chat-bubble-content">
              {msg.text}
            </div>
            {msg.detail && (
              <div className="chat-bubble-detail">{msg.detail}</div>
            )}
          </div>
        ))}
        {loading && (
          <div className="chat-bubble bot">
            <div className="chat-bubble-content chat-typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-bar" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="log food, chat, update steps..."
          disabled={loading}
          autoComplete="off"
        />
        <button type="submit" disabled={!text.trim() || loading}>
          Send
        </button>
      </form>
    </div>
  );
}

export default ChatInput;
