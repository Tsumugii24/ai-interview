export const SIMULATION_SESSION_TOKEN_COST = 10;
export const AI_REPORT_TOKEN_COST = 15;

export const TOKEN_PACKS = [
  {
    id: 'boost-100',
    title: 'Boost 100',
    tokens: 100,
    price: '4',
    description: 'A small one-time top-up when your monthly quota runs low.',
  },
  {
    id: 'boost-300',
    title: 'Boost 300',
    tokens: 300,
    price: '9',
    description: 'A balanced pack for extra practice sessions and report generation.',
  },
  {
    id: 'boost-800',
    title: 'Boost 800',
    tokens: 800,
    price: '19',
    description: 'A larger reserve for intensive interview preparation.',
  },
] as const;
