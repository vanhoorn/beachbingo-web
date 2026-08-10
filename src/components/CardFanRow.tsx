import React from "react";

interface CardFanRowProps<T> {
  cards: T[];
  renderCard: (card: T, index: number) => React.ReactNode;
  cardWidth: number;
  cardHeight: number;
  overlapFraction?: number;
  maxAngle?: number;
}

export function CardFanRow<T,>({
  cards,
  renderCard,
  cardWidth,
  cardHeight,
  overlapFraction = 0.35,
  maxAngle = 7,
}: CardFanRowProps<T>) {
  if (!cards.length) return null;
  const n = cards.length;
  const step = cardWidth * (1 - overlapFraction);
  const totalW = cardWidth + step * (n - 1);
  const extraTop = Math.round(cardHeight * 0.08 + 4);

  return (
    <div style={{
      position: "relative",
      width: Math.ceil(totalW),
      height: cardHeight + extraTop,
      flexShrink: 0,
    }}>
      {cards.map((card, idx) => {
        const frac = n > 1 ? (idx - (n - 1) / 2) / ((n - 1) / 2) : 0;
        const angle = frac * maxAngle;
        return (
          <div
            key={idx}
            style={{
              position: "absolute",
              left: idx * step,
              bottom: 0,
              transform: `rotate(${angle}deg)`,
              transformOrigin: "bottom center",
            }}
          >
            {renderCard(card, idx)}
          </div>
        );
      })}
    </div>
  );
}
