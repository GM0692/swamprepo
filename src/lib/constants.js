export const PHASES = ['Untap', 'Upkeep', 'Draw', 'Main 1', 'Combat', 'Main 2', 'End Step'];
export const STARTING_LIFE = 40;
export const ZONE_KEYS = ['library', 'hand', 'battlefield', 'graveyard', 'exile', 'commandZone'];
export const ZONE_LABEL = {
  library: 'Library',
  hand: 'Hand',
  battlefield: 'Battlefield',
  graveyard: 'Graveyard',
  exile: 'Exile',
  commandZone: 'Command Zone',
};

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function timeNow() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function moveLabel(from, to, name) {
  const key = `${from}->${to}`;
  const table = {
    'library->hand': `Drew ${name}`,
    'library->battlefield': `${name} put directly onto the battlefield`,
    'library->graveyard': `${name} milled to graveyard`,
    'library->exile': `${name} exiled from library`,
    'hand->battlefield': `Played ${name}`,
    'hand->graveyard': `Discarded ${name}`,
    'hand->exile': `Exiled ${name} from hand`,
    'hand->library': `${name} put back into library`,
    'battlefield->graveyard': `${name} destroyed`,
    'battlefield->hand': `${name} bounced to hand`,
    'battlefield->exile': `${name} exiled from the battlefield`,
    'battlefield->commandZone': `${name} moved to Command Zone`,
    'battlefield->library': `${name} shuffled into library`,
    'graveyard->hand': `${name} returned to hand`,
    'graveyard->battlefield': `${name} reanimated`,
    'graveyard->commandZone': `${name} moved to Command Zone`,
    'graveyard->exile': `${name} exiled from graveyard`,
    'graveyard->library': `${name} shuffled back into library`,
    'exile->hand': `${name} returned to hand from exile`,
    'exile->battlefield': `${name} put into play from exile`,
    'commandZone->battlefield': `Cast commander ${name}`,
    'commandZone->hand': `${name} moved to hand`,
  };
  return table[key] || `${name} moved from ${ZONE_LABEL[from]} to ${ZONE_LABEL[to]}`;
}

export function totalIn(cards, zoneKey) {
  return cards.reduce((s, c) => s + c.zones[zoneKey], 0);
}

export function makeActiveGame(deck, opponentCount) {
  const cards = [];
  deck.mainboard.forEach((c) => {
    cards.push({
      name: c.name, total: c.qty, isCommander: false,
      zones: { library: c.qty, hand: 0, battlefield: 0, graveyard: 0, exile: 0, commandZone: 0 },
    });
  });
  deck.commander.forEach((name) => {
    cards.push({
      name, total: 1, isCommander: true,
      zones: { library: 0, hand: 0, battlefield: 0, graveyard: 0, exile: 0, commandZone: 1 },
    });
  });

  const life = { you: STARTING_LIFE };
  for (let i = 1; i <= opponentCount; i++) life[`opp${i}`] = STARTING_LIFE;

  return {
    deckId: deck.id,
    deckName: deck.name,
    commanderNames: deck.commander,
    opponentCount,
    startedAt: new Date().toISOString(),
    handConfirmed: false,
    turn: 1,
    phaseIndex: 0,
    life,
    cards,
    commanderCastCounts: {},
    log: [],
  };
}
