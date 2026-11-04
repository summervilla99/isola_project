"use client";

import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";

type SunsetPostcardProps = {
  names: string[];
  onClose: () => void;
};

const beachImage = "/capy-world/beach-v1.webp";
const capyImage = "/capy-world/animal/player-back-v1.webp";

function postcardNames(names: string[]) {
  const label = names.join(" · ");
  return label.length > 52 ? `${label.slice(0, 49)}…` : label;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("엽서 이미지를 불러오지 못했어요."));
    image.src = src;
  });
}

export default function SunsetPostcard({
  names,
  onClose,
}: SunsetPostcardProps) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const date = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());
  const pictured = Math.min(names.length, 5);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key !== "Tab") return;
      if (event.shiftKey && document.activeElement === closeButton.current) {
        event.preventDefault();
        saveButton.current?.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === saveButton.current
      ) {
        event.preventDefault();
        closeButton.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, []);

  const savePostcard = async () => {
    setSaving(true);
    setError("");
    try {
      const [beach, capy] = await Promise.all([
        loadImage(beachImage),
        loadImage(capyImage),
      ]);
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 780;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("이미지를 만들 수 없어요.");

      context.fillStyle = "#fff4e5";
      context.fillRect(0, 0, 1200, 780);
      context.drawImage(beach, 0, 0, 1200, 675);
      context.fillStyle = "#fff8e9";
      context.font = "bold 18px sans-serif";
      context.fillText("CAPYBARA STORY  /  LIGHTHOUSE BEACH", 35, 45);

      for (let index = 0; index < pictured; index += 1) {
        const center = 600 + (index - (pictured - 1) / 2) * 112;
        context.drawImage(capy, center - 67, 548, 134, 67);
      }

      context.fillStyle = "#5e4b51";
      context.font = "bold 27px sans-serif";
      context.fillText("오늘의 노을은 우리가 같이 봤어.", 35, 718);
      context.font = "18px sans-serif";
      context.fillText(postcardNames(names), 35, 752);
      context.textAlign = "right";
      context.fillText(date, 1165, 752);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("이미지를 저장할 수 없어요.");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `capybara-sunset-${Date.now()}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="capy-postcard-backdrop" onPointerDown={onClose}>
      <div
        className="capy-postcard-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="capy-postcard-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          ref={closeButton}
          className="capy-postcard-close"
          type="button"
          aria-label="노을 엽서 닫기"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <div className="capy-postcard-scene" aria-hidden="true">
          <span>CAPYBARA STORY / LIGHTHOUSE BEACH</span>
          {Array.from({ length: pictured }, (_, index) => (
            <img
              key={index}
              src={capyImage}
              alt=""
              style={{ left: `${50 + (index - (pictured - 1) / 2) * 9.3}%` }}
            />
          ))}
        </div>
        <div className="capy-postcard-paper">
          <p className="capy-postcard-eyebrow">FROM THE SLOW SIDE OF THE SEA</p>
          <h2 id="capy-postcard-title">오늘의 노을은 우리가 같이 봤어.</h2>
          <p className="capy-postcard-names">{postcardNames(names)}</p>
          <time>{date}</time>
        </div>
        <div className="capy-postcard-actions">
          <span>지금 함께 노을을 보는 카피바라 {names.length}마리</span>
          <button
            ref={saveButton}
            type="button"
            onClick={savePostcard}
            disabled={saving}
          >
            <Download size={17} /> {saving ? "만드는 중…" : "이미지 저장"}
          </button>
        </div>
        {error && (
          <p className="capy-postcard-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
