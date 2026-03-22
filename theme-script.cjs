const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src', 'pages');

// Map dark-only classes to light-dark combination
const darkToLightMap = {
  // Backgrounds
  'bg-zinc-950': 'bg-zinc-50 dark:bg-zinc-950',
  'bg-zinc-900': 'bg-white dark:bg-zinc-900',
  'bg-zinc-800': 'bg-zinc-100 dark:bg-zinc-800',
  'bg-zinc-900/50': 'bg-zinc-50/50 dark:bg-zinc-900/50',
  'bg-zinc-950/50': 'bg-white/50 dark:bg-zinc-950/50',
  'bg-zinc-950/95': 'bg-white/95 dark:bg-zinc-950/95',
  
  // Text
  'text-white': 'text-zinc-900 dark:text-white',
  'text-zinc-200': 'text-zinc-800 dark:text-zinc-200',
  'text-zinc-300': 'text-zinc-700 dark:text-zinc-300',
  'text-zinc-400': 'text-zinc-500 dark:text-zinc-400',
  'text-zinc-500': 'text-zinc-500 dark:text-zinc-400', // Keep some muted text same
  
  // Borders
  'border-zinc-800': 'border-zinc-200 dark:border-zinc-800',
  'border-zinc-800/50': 'border-zinc-200/50 dark:border-zinc-800/50',
  'border-zinc-700': 'border-zinc-300 dark:border-zinc-700',
  'border-zinc-700/50': 'border-zinc-300/50 dark:border-zinc-700/50',
};

// Map light-only classes to light-dark combination
const lightToDarkMap = {
  // Backgrounds
  'bg-zinc-50': 'bg-zinc-50 dark:bg-zinc-950',
  'bg-white': 'bg-white dark:bg-zinc-900',
  'bg-zinc-100': 'bg-zinc-100 dark:bg-zinc-800',
  
  // Text
  'text-zinc-900': 'text-zinc-900 dark:text-white',
  'text-zinc-800': 'text-zinc-800 dark:text-zinc-100',
  'text-zinc-700': 'text-zinc-700 dark:text-zinc-200',
  'text-zinc-600': 'text-zinc-600 dark:text-zinc-300',
  'text-zinc-500': 'text-zinc-500 dark:text-zinc-400',
  
  // Borders
  'border-zinc-200': 'border-zinc-200 dark:border-zinc-800',
  'border-zinc-300': 'border-zinc-300 dark:border-zinc-700',
};

const regexPatterns = [];

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(srcDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Determine if file is originally dark or light
  // Landing is originally light
  const isLightPage = file === 'LandingPage.tsx';

  const mapToUse = isLightPage ? lightToDarkMap : darkToLightMap;

  // Make sure we don't accidentally replace already dark: versions
  // Use regex string matching to avoid replacing dark:bg-zinc-950 if it exists
  
  for (const [original, replaced] of Object.entries(mapToUse)) {
    // Regex matches the class bounded by quotes, spaces, backticks, or newlines, ignoring already "dark:" prefixed
    const regex = new RegExp(`(?<!dark:)(?<!\\-)\\b${escapeRegExp(original)}\\b(?!-)`, 'g');
    content = content.replace(regex, replaced);
  }

  // Specialty for SimulationPage.tsx (custom colors)
  if (file === 'SimulationPage.tsx') {
    content = content.replace(/(?<!dark:)(?<!\-)\bbg-\[\#202124\]\b/g, 'bg-zinc-50 dark:bg-[#202124]');
    content = content.replace(/(?<!dark:)(?<!\-)\bbg-\[\#3c4043\]\b/g, 'bg-white dark:bg-[#3c4043]');
    content = content.replace(/(?<!dark:)(?<!\-)\bborder-gray-600\b/g, 'border-zinc-200 dark:border-gray-600');
    content = content.replace(/(?<!dark:)(?<!\-)\btext-gray-900\b/g, 'text-zinc-900 dark:text-gray-100');
    content = content.replace(/(?<!dark:)(?<!\-)\bbg-gray-100\b/g, 'bg-zinc-100 dark:bg-zinc-800');
    content = content.replace(/(?<!dark:)(?<!\-)\bbg-gray-50\b/g, 'bg-zinc-50 dark:bg-zinc-900');
    content = content.replace(/(?<!dark:)(?<!\-)\bborder-gray-200\b/g, 'border-zinc-200 dark:border-zinc-800');
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

console.log('Class replacement complete.');
