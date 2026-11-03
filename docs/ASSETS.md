# Asset provenance

- Island, trees, flowers, houses, avatar and furniture: original procedural geometry authored for ISOLA in `src/components/world-scene.tsx`.
- Landing illustration, archive book/frame/bottle illustrations: original CSS in `src/app/globals.css`.
- App icon: original SVG in `public/icon.svg`; PNG variants rasterized from the same source.
- Village, club interior, club guard, and capybara character illustrations in `public/capy-world/`: generated for this project with OpenAI ImageGen and converted to WebP. These are original project assets, not copied from another game.
- Directional walking frames in `public/capy-world/walk/`: generated with OpenAI ImageGen from `capy-hero-v1.webp`, then extracted from the pose sheets into six transparent WebP frames. Prompt direction: preserve the exact character identity and costume while rendering separate front three-quarter, right-facing side, and rear three-quarter walking poses with alternating feet on a transparent background. The side frames were regenerated to keep both poses facing the same direction.
- The club beat in `src/lib/club-beat.ts` is synthesized in the browser with Web Audio; no licensed track or third-party audio file is included.
- Interface icons: lucide-react, ISC license (see installed package).
- Typography: system fonts (Avenir Next / Apple SD Gothic Neo / Noto Sans KR when locally available; system-ui fallback). No external font requests.
- Sample archive comments are original illustrative text. Book/film titles and creator names identify works; cover art, film posters and whisky trademarks are not copied.

No downloaded stock images, third-party game assets, or user-provided media are used.
