export const OPENINGS = [
  {
    id: 'italian', name: 'Italian Game', eco: 'C50–C54', color: 'white',
    description: 'Fast development and pressure on f7.',
    lines: [
      { id: 'italian-main', name: 'Giuoco Piano', moves: ['e4','e5','Nf3','Nc6','Bc4','Bc5','c3','Nf6','d3','d6','O-O','O-O'] },
      { id: 'italian-quiet', name: 'Quiet d3 setup', moves: ['e4','e5','Nf3','Nc6','Bc4','Bc5','d3','Nf6','O-O','d6','c3','O-O','Re1'] },
      { id: 'italian-two-knights', name: 'Two Knights Defense', moves: ['e4','e5','Nf3','Nc6','Bc4','Nf6','d3','Bc5','O-O','d6','c3','O-O'] },
      { id: 'italian-evans', name: 'Evans Gambit', moves: ['e4','e5','Nf3','Nc6','Bc4','Bc5','b4','Bxb4','c3','Ba5','d4','exd4','O-O'] },
    ],
  },
  {
    id: 'sicilian', name: 'Sicilian Defense', eco: 'B20–B99', color: 'black',
    description: 'Fight 1.e4 with an asymmetrical pawn structure.',
    lines: [
      { id: 'sicilian-najdorf', name: 'Najdorf', moves: ['e4','c5','Nf3','d6','d4','cxd4','Nxd4','Nf6','Nc3','a6','Be3','e5','Nb3','Be6'] },
      { id: 'sicilian-dragon', name: 'Dragon', moves: ['e4','c5','Nf3','d6','d4','cxd4','Nxd4','Nf6','Nc3','g6','Be3','Bg7','f3','O-O','Qd2'] },
      { id: 'sicilian-classical', name: 'Classical', moves: ['e4','c5','Nf3','d6','d4','cxd4','Nxd4','Nf6','Nc3','Nc6','Bg5','e6','Qd2','Be7'] },
      { id: 'sicilian-alapin', name: 'Alapin response', moves: ['e4','c5','c3','Nf6','e5','Nd5','d4','cxd4','Nf3','Nc6','cxd4','d6'] },
    ],
  },
  {
    id: 'queens-gambit', name: "Queen's Gambit", eco: 'D06–D69', color: 'white',
    description: 'Claim central space and develop with lasting pressure.',
    lines: [
      { id: 'qg-qgd', name: "Queen's Gambit Declined", moves: ['d4','d5','c4','e6','Nc3','Nf6','Bg5','Be7','e3','O-O','Nf3','h6','Bh4'] },
      { id: 'qg-slav', name: 'Slav Defense', moves: ['d4','d5','c4','c6','Nf3','Nf6','Nc3','dxc4','a4','Bf5','e3','e6','Bxc4'] },
      { id: 'qg-accepted', name: "Queen's Gambit Accepted", moves: ['d4','d5','c4','dxc4','Nf3','Nf6','e3','e6','Bxc4','c5','O-O','a6'] },
      { id: 'qg-chigorin', name: 'Chigorin Defense', moves: ['d4','d5','c4','Nc6','Nf3','Bg4','cxd5','Bxf3','gxf3','Qxd5','e3','e5'] },
    ],
  },
  {
    id: 'caro-kann', name: 'Caro–Kann Defense', eco: 'B10–B19', color: 'black',
    description: 'A durable defense with a healthy pawn structure.',
    lines: [
      { id: 'caro-classical', name: 'Classical', moves: ['e4','c6','d4','d5','Nc3','dxe4','Nxe4','Bf5','Ng3','Bg6','h4','h6','Nf3','Nd7'] },
      { id: 'caro-advance', name: 'Advance Variation', moves: ['e4','c6','d4','d5','e5','Bf5','Nf3','e6','Be2','c5','O-O','Nc6'] },
      { id: 'caro-exchange', name: 'Exchange Variation', moves: ['e4','c6','d4','d5','exd5','cxd5','Bd3','Nc6','c3','Nf6','Bf4','Bg4'] },
      { id: 'caro-two-knights', name: 'Two Knights', moves: ['e4','c6','Nc3','d5','Nf3','Bg4','h3','Bxf3','Qxf3','e6','d4','Nf6'] },
    ],
  },
  {
    id: 'london', name: 'London System', eco: 'D02', color: 'white',
    description: 'A dependable setup with clear plans and patterns.',
    lines: [
      { id: 'london-main', name: 'Main setup', moves: ['d4','d5','Nf3','Nf6','Bf4','e6','e3','Bd6','Bg3','O-O','Bd3','c5'] },
      { id: 'london-c5', name: 'Early ...c5', moves: ['d4','Nf6','Nf3','e6','Bf4','c5','e3','Nc6','c3','d5','Nbd2','Bd6'] },
      { id: 'london-kingside', name: 'Kingside attack', moves: ['d4','d5','Bf4','Nf6','e3','e6','Nf3','Bd6','Bg3','O-O','Bd3','c5','Nbd2'] },
    ],
  },
  {
    id: 'kings-indian', name: "King's Indian Defense", eco: 'E60–E99', color: 'black',
    description: 'Invite a broad center, then strike back dynamically.',
    lines: [
      { id: 'kid-classical', name: 'Classical', moves: ['d4','Nf6','c4','g6','Nc3','Bg7','e4','d6','Nf3','O-O','Be2','e5','O-O','Nc6'] },
      { id: 'kid-samisch', name: 'Sämisch', moves: ['d4','Nf6','c4','g6','Nc3','Bg7','e4','d6','f3','O-O','Be3','e5','d5','c6'] },
      { id: 'kid-four-pawns', name: 'Four Pawns Attack', moves: ['d4','Nf6','c4','g6','Nc3','Bg7','e4','d6','f4','O-O','Nf3','c5','d5','e6'] },
    ],
  },
];

export const allLines = () => OPENINGS.flatMap(opening => opening.lines.map(line => ({ ...line, openingId: opening.id, openingName: opening.name, repertoireColor: opening.color })));
