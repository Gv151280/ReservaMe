const TONOS = {
  blue: ['var(--blue-light)', 'var(--blue-dark)'],
  green: ['var(--green-light)', 'var(--green-dark)'],
  purple: ['var(--purple-light)', 'var(--purple-dark)'],
  amber: ['var(--amber-light)', 'var(--amber-dark)'],
  coral: ['var(--coral-light)', 'var(--coral-dark)'],
};

export default function StickerIcon({ tono = 'purple', glyph = '📅', size = 52 }) {
  const [bg, fg] = TONOS[tono] || TONOS.purple;
  return (
    <div
      className="sticker"
      style={{ background: bg, color: fg, width: size, height: size, fontSize: size * 0.46 }}
    >
      {glyph}
    </div>
  );
}

export const GLYPH = { proyector: '📽️', libro: '📚', calendario: '📅' };
