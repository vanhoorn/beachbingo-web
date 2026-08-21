import React from 'react';
import type { KlonPart } from './klontauschCharacterLibrary';

interface KlontauschCharacterPartProps {
  characterId: string;
  part: KlonPart;
  style?: React.CSSProperties;
  className?: string;
}

function partSuffix(part: KlonPart): string {
  switch (part) {
    case 'KOPF':    return 'head';
    case 'KOERPER': return 'body';
    case 'BEINE':   return 'legs';
  }
}

export function KlontauschCharacterPart({
  characterId,
  part,
  style,
  className,
}: KlontauschCharacterPartProps) {
  const src = `/klontausch/${characterId}_${partSuffix(part)}.png`;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      style={{ objectFit: 'contain', width: '100%', height: '100%', display: 'block', ...style }}
      className={className}
    />
  );
}

export function KlontauschSilhouette({
  style,
  className,
}: {
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#1E2D45',
        border: '1px solid #3A5070',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#4A6080',
        fontSize: '2rem',
        ...style,
      }}
      className={className}
    >
      ?
    </div>
  );
}
