"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/store";

type LibraryNote = {
  id: number;
  nickname: string;
  body: string;
  created_at: string;
};

export default function LibraryNotes({
  nickname,
  visitorId,
  refreshToken,
  onPosted,
  onClose,
}: {
  nickname: string;
  visitorId: string;
  refreshToken: number;
  onPosted: () => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState<LibraryNote[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!supabase) {
      setError("노트 서버에 연결되지 않았어요.");
      setLoading(false);
      return;
    }
    const { data, error: failure } = await supabase.rpc(
      "capy_library_notes_list",
    );
    if (failure)
      setError("노트를 불러오지 못했어요. 잠시 후 다시 열어 주세요.");
    else {
      setNotes(Array.isArray(data) ? (data as LibraryNote[]) : []);
      setError("");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || saving || !supabase) return;
    setSaving(true);
    setError("");
    const { error: failure } = await supabase.rpc("capy_library_note_post", {
      p_visitor_id: visitorId.replace(/^visitor-/, ""),
      p_nickname: nickname.slice(0, 12),
      p_body: body,
    });
    setSaving(false);
    if (failure) {
      setError(
        failure.message.includes("잠시")
          ? failure.message
          : "노트를 남기지 못했어요. 다시 시도해 주세요.",
      );
      return;
    }
    setDraft("");
    onPosted();
    void load();
  };

  return (
    <div className="capy-library-overlay" onClick={onClose}>
      <section
        className="capy-library-notes"
        role="dialog"
        aria-modal="true"
        aria-label="꾸벅 도서관 방명록"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="capy-library-close"
          onClick={onClose}
          aria-label="책장 닫기"
          autoFocus
        >
          ×
        </button>
        <small>THE SLEEPY LIBRARY</small>
        <h2>책장에 남긴 작은 노트 📚</h2>
        <p>
          읽고 싶은 책, 좋아하는 문장, 오늘의 마음을 적어 둬요. 이 노트는
          모두에게 보여요.
        </p>
        <form onSubmit={submit}>
          <label htmlFor="capy-library-draft">{nickname}의 책갈피</label>
          <textarea
            id="capy-library-draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, 180))}
            placeholder="오늘은 어떤 문장을 남길까요?"
            maxLength={180}
            rows={3}
          />
          <div>
            <span>{draft.length}/180</span>
            <button type="submit" disabled={!draft.trim() || saving}>
              {saving ? "꽂는 중…" : "책장에 꽂기 ✦"}
            </button>
          </div>
        </form>
        {error && (
          <p className="capy-library-error" role="alert">
            {error}
          </p>
        )}
        <div className="capy-library-note-list" aria-live="polite">
          {loading ? (
            <p>책장을 살펴보는 중…</p>
          ) : notes.length === 0 ? (
            <p>아직 비어 있어요. 첫 책갈피를 남겨 주세요!</p>
          ) : (
            notes.map((note) => (
              <article key={note.id}>
                <span>
                  ✦ {note.nickname}{" "}
                  <time dateTime={note.created_at}>
                    {new Date(note.created_at).toLocaleDateString("ko-KR")}
                  </time>
                </span>
                <p>{note.body}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
