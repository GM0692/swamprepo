// Standard pairwise Elo extended for free-for-all multiplayer: the winner
// scores 1 against every other player, every pair of non-winners scores a
// mutual 0.5 draw, and each player's total swing is averaged over N-1 pairs
// so rating movement doesn't scale with pod size. winnerId === null (a
// table-wide draw) falls back naturally — everyone treats everyone as a draw.
export function computeEloUpdates(memberElos, winnerId, K = 24) {
  const uids = Object.keys(memberElos);
  const deltas = {};
  uids.forEach((a) => {
    const others = uids.filter((b) => b !== a);
    if (others.length === 0) { deltas[a] = 0; return; }
    const total = others.reduce((sum, b) => {
      const expected = 1 / (1 + 10 ** ((memberElos[b] - memberElos[a]) / 400));
      let actual = 0.5;
      if (winnerId != null) actual = a === winnerId ? 1 : (b === winnerId ? 0 : 0.5);
      return sum + K * (actual - expected);
    }, 0);
    deltas[a] = Math.round(total / others.length);
  });
  return deltas;
}
