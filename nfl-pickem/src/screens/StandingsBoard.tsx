import React from 'react';
import { StandingRow, playerColorById, playerInkById, playerInitials } from '../leagueMath';

export interface BoardRow extends StandingRow {
  lastWeek: string | null; // e.g. "2–1" for the latest graded week
}

interface StandingsBoardProps {
  rows: BoardRow[];
  selectedUser: string;
  archive?: boolean;
}

// Ties share a rank label ("T3") when wins and pct match a neighbor.
const rankLabels = (rows: BoardRow[]) =>
  rows.map((row, index) => {
    const same = (other?: BoardRow) =>
      !!other && other.wins === row.wins && Math.abs(other.winPct - row.winPct) < 1e-9;
    let first = index;
    while (first > 0 && same(rows[first - 1])) first--;
    const tied = same(rows[index - 1]) || same(rows[index + 1]);
    return `${tied ? 'T' : ''}${rows[first].rank}`;
  });

const pct = (row: BoardRow) => `${row.winPct.toFixed(1)}%`;

function Avatar({ row, size = 32 }: { row: BoardRow; size?: number }) {
  return (
    <span
      className="sb-avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: playerColorById(row.userId),
        color: playerInkById(row.userId),
      }}
    >
      {playerInitials(row.name)}
    </span>
  );
}

function Movement({ movement, archive }: { movement: number; archive?: boolean }) {
  if (archive) return <span className="sb-move" />; // keeps the grid column
  if (movement > 0) return <span className="sb-move up">▲{movement}</span>;
  if (movement < 0) return <span className="sb-move down">▼{-movement}</span>;
  return <span className="sb-move flat">–</span>;
}

function Badges({ row, selectedUser, archive }: { row: BoardRow; selectedUser: string; archive?: boolean }) {
  return (
    <>
      {row.isLeader && <span className="sb-crown" title="Leader">👑</span>}
      {row.isLast && !archive && <span className="sb-last">🤡 last</span>}
      {row.userId === selectedUser && <span className="sb-you">YOU</span>}
    </>
  );
}

// One roomy row per player, the pct as the headline number
export default function StandingsBoard({ rows, selectedUser, archive }: StandingsBoardProps) {
  const ranks = rankLabels(rows);
  return (
    <ol className="sb-lb">
      {rows.map((row, index) => (
        <li
          key={row.userId}
          className={`sb-lb-row${row.isLeader ? ' lead' : ''}${row.userId === selectedUser ? ' me' : ''}`}
        >
          <span className="sb-lb-rank disp tnum">{ranks[index]}</span>
          <Avatar row={row} />
          <span className="sb-lb-who">
            <span className="sb-lb-name">
              {row.name}
              <Badges row={row} selectedUser={selectedUser} archive={archive} />
            </span>
            <span className="sb-lb-sub tnum">
              {row.record}
              {row.lastWeek && <span className="sb-lb-lastwk"> · last wk {row.lastWeek}</span>}
            </span>
          </span>
          <Movement movement={row.movement} archive={archive} />
          <span className="sb-lb-pct disp tnum">{pct(row)}</span>
        </li>
      ))}
    </ol>
  );
}
