export interface LevelConfig {
  level: number;
  name: string;
  subtitle: string;
  themeColor: string;
  enemyHpMultiplier: number;
  enemyFireRateMultiplier: number;
  enemySpeedMultiplier: number;
  aiAggression: number;
  description: string;
}

export const CAMPAIGN_LEVELS: LevelConfig[] = [
  {
    level: 1,
    name: 'Chapter I: The Ivory Bastion',
    subtitle: 'Apprentice Skirmish',
    themeColor: '#38bdf8',
    enemyHpMultiplier: 1.0,
    enemyFireRateMultiplier: 1.0,
    enemySpeedMultiplier: 1.0,
    aiAggression: 1.0,
    description: 'Standard battlefield skirmish against the apprentice order. Master your unit weapons and secure your first perks.',
  },
  {
    level: 2,
    name: 'Chapter II: Crimson Citadel',
    subtitle: 'Fortified Veterans',
    themeColor: '#f97316',
    enemyHpMultiplier: 1.3,
    enemyFireRateMultiplier: 1.25,
    enemySpeedMultiplier: 1.15,
    aiAggression: 1.4,
    description: 'Enemy pieces are reinforced with energized plating and heightened trigger response. Knights and Bishops strike relentlessly.',
  },
  {
    level: 3,
    name: 'Chapter III: Void Grandmaster',
    subtitle: 'Final Royal Ascendancy',
    themeColor: '#a855f7',
    enemyHpMultiplier: 1.65,
    enemyFireRateMultiplier: 1.5,
    enemySpeedMultiplier: 1.3,
    aiAggression: 1.8,
    description: 'Face the supreme Obsidian Grandmaster. Elite marksmanship, brutal projectile speeds, and an impenetrable King defensive phalanx.',
  },
];
