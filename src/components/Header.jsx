import { useState } from "react";

export default function Header({ kidName, onNameChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(kidName);

  function commit() {
    const trimmed = draft.trim();
    onNameChange(trimmed || kidName);
    setEditing(false);
  }

  if (editing) {
    return (
      <header className="app-header">
        <input
          className="name-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(kidName);
              setEditing(false);
            }
          }}
          autoFocus
        />
      </header>
    );
  }

  return (
    <header className="app-header">
      <h1
        onClick={() => {
          setDraft(kidName);
          setEditing(true);
        }}
        title="Tap to edit name"
      >
        {kidName}'s Collection Fund
      </h1>
    </header>
  );
}
