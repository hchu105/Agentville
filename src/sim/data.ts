import type { AgentDef, BuildingId, JobTemplate, Step } from './types'

// The scenario: Moss & Kiln, a five-person ceramics shop on Etsy.
// Rae runs the website and branding, and runs an agent team to get it done.

export const SHOP = {
  name: 'Moss & Kiln',
  owner: 'Rae',
  tagline: 'Small-batch stoneware · Asheville, NC',
}

export const AGENTS: AgentDef[] = [
  {
    id: 'pip',
    name: 'Pip',
    role: 'Copywriter',
    blurb: 'Writes listings, product stories and SEO titles in the Moss & Kiln voice.',
    color: '#C8643B',
    accent: '#7A2E1F',
    look: {
      skin: '#C68E6B',
      hair: '#2B1D16',
      hairStyle: 'curly',
      top: '#C8643B',
      sleeves: 'long',
      bottom: '#E6DDCC',
      shoes: '#F2EFE8',
      glasses: true,
      prop: 'notebook',
      propColor: '#2F3B4C',
      height: 1,
    },
  },
  {
    id: 'juno',
    name: 'Juno',
    role: 'Photo Editor',
    blurb: 'Retouches product shots, builds banners and keeps the shop looking consistent.',
    color: '#5E9A92',
    accent: '#2F4A47',
    look: {
      skin: '#E8C3A4',
      hair: '#161514',
      hairStyle: 'beanie',
      hat: '#2F4A47',
      top: '#5E9A92',
      sleeves: 'long',
      bottom: '#2D2C2A',
      shoes: '#8A5A3C',
      prop: 'camera',
      propColor: '#1E1E1E',
      height: 1.03,
    },
  },
  {
    id: 'scout',
    name: 'Scout',
    role: 'Researcher',
    blurb: 'Watches trends, competitor pricing and search terms across Etsy and the web.',
    color: '#D9A93A',
    accent: '#6B4E0E',
    look: {
      skin: '#F0CBAA',
      hair: '#B5562C',
      hairStyle: 'bun',
      top: '#D9A93A',
      sleeves: 'long',
      bottom: '#55623F',
      shoes: '#ECE8E0',
      prop: 'backpack',
      propColor: '#8B4A35',
      height: 0.97,
    },
  },
  {
    id: 'bea',
    name: 'Bea',
    role: 'Mail & Social',
    blurb: 'Drafts newsletters, answers customer messages and schedules posts.',
    color: '#9497DE',
    accent: '#2F3277',
    look: {
      skin: '#7A4B32',
      hair: '#1E1612',
      hairStyle: 'long',
      top: '#9497DE',
      sleeves: 'short',
      bottom: '#E7E1D5',
      shoes: '#2A2826',
      glasses: true,
      prop: 'tote',
      propColor: '#C99A5B',
      height: 1.01,
    },
  },
]

export type WorkPose = 'type' | 'read' | 'operate' | 'counter'

export interface Spot {
  /** local to the station, before rotation */
  x: number
  z: number
  /** local heading: 0 faces the station's front (+z), PI faces back into it */
  h: number
  seat?: number
}

export interface BuildingDef {
  id: BuildingId
  name: string
  tool: string
  x: number
  z: number
  rot: number
  /** keep-out radius for walking */
  r: number
  work: Spot & { pose: WorkPose }
}

// Stations are tools: furniture islands on an open floor.
// An agent walking to the Post counter is an email tool call.
export const BUILDINGS: BuildingDef[] = [
  { id: 'desk', name: "Rae's Desk", tool: 'Approvals & delivery', x: -3.68, z: -3.68, rot: 0, r: 1.9, work: { x: 0, z: 0.8, h: Math.PI, pose: 'counter' } },
  { id: 'library', name: 'Library', tool: 'Brand guide & docs', x: 3.36, z: -4.32, rot: Math.PI / 2, r: 1.9, work: { x: 0.75, z: 0.3, h: 0, pose: 'read', seat: 0.42 } },
  { id: 'studio', name: 'Photo Studio', tool: 'Image editing', x: -5.76, z: 0.96, rot: Math.PI / 2, r: 1.9, work: { x: 0, z: 1.45, h: Math.PI, pose: 'operate' } },
  { id: 'lookout', name: 'Lookout', tool: 'Web & trend research', x: -2.4, z: 4.88, rot: 0, r: 1.7, work: { x: 0.25, z: 0.45, h: Math.PI, pose: 'operate' } },
  { id: 'post', name: 'Post Counter', tool: 'Email & messages', x: 5.44, z: -0.32, rot: 0, r: 1.8, work: { x: 0, z: 0.65, h: Math.PI, pose: 'counter' } },
  { id: 'market', name: 'Shop Table', tool: 'Etsy listings', x: 2.24, z: 5.12, rot: Math.PI / 2, r: 1.9, work: { x: 0.2, z: 0.6, h: Math.PI, pose: 'type', seat: 0.46 } },
]

// Where free agents hang out, next to the job board.
export const LOUNGE = {
  x: 0,
  z: 0,
  rot: 0,
  r: 2.2,
  seats: [-1.12, -0.38, 0.38, 1.12].map((x) => ({ x, z: -0.5, h: 0, seat: 0.44 }) as Spot),
}

// Agents wait for approval in a row in front of Rae's desk.
export const DESK_QUEUE: Spot[] = [-0.95, -0.32, 0.32, 0.95].map((x) => ({ x, z: 1.05, h: Math.PI }))

const tool = (building: BuildingId, label: string, seconds: number, cost: number): Step => ({
  kind: 'tool',
  building,
  label,
  seconds,
  cost,
})

export const JOBS: JobTemplate[] = [
  {
    id: 'listings',
    title: 'Write listings for the Autumn Glaze mugs',
    agentId: 'pip',
    steps: [
      tool('library', 'Reading brand voice guide', 4, 0.04),
      tool('lookout', 'Pulling search terms for "speckled mug"', 5, 0.09),
      tool('market', 'Drafting 6 listings', 6, 0.12),
      {
        kind: 'approval',
        label: 'Publish 6 listings to Etsy',
        risk: 'high',
        preview: [
          'Autumn Glaze Mug · Rust Speckle · 12 oz',
          '"Thrown by hand in Asheville and dipped in our iron-rich autumn glaze. Every speckle lands where the kiln decides."',
          'Tags: speckled mug, handmade stoneware, fall coffee mug, pottery gift +9',
          '+ 5 more listings in the same format',
        ],
      },
      { kind: 'deliver' },
    ],
    deliverable: {
      title: 'Autumn Glaze listings',
      kind: '6 listings · published',
      body: [
        'Autumn Glaze Mug · Rust Speckle · 12 oz: $38',
        'Autumn Glaze Mug · Oat · 12 oz: $38',
        'Autumn Glaze Mug · Moss · 16 oz: $42',
        'Autumn Glaze Espresso Cup · set of 2: $44',
        'Autumn Glaze Pour-over Set: $96',
        'Autumn Glaze Gift Box (mug + coaster): $54',
        'Search terms used: speckled mug (high), handmade stoneware (high), fall coffee mug (rising +38%), pottery gift (seasonal).',
        'Voice check: warm, specific, no exclamation marks, kiln as character. Matches guide v3.',
      ],
    },
  },
  {
    id: 'photos',
    title: 'Retouch 12 new product photos',
    agentId: 'juno',
    steps: [
      tool('studio', 'Color-matching 12 shots to the shop grade', 6, 0.18),
      tool('studio', 'Removing dust and backdrop seams', 5, 0.14),
      tool('library', 'Filing originals in Brand / Photos / 2026-11', 3, 0.01),
      { kind: 'deliver' },
    ],
    deliverable: {
      title: 'Product photos · November batch',
      kind: '12 images · ready to use',
      body: [
        '12 photos graded to "Kiln Morning" preset (warm 5200K, lifted shadows).',
        'Removed backdrop seams on 7 shots, dust on 4, one reflection on the pour-over carafe.',
        'Exported 2000px square for Etsy and 1080×1350 crops for Instagram.',
        'Originals filed in Brand / Photos / 2026-11.',
      ],
    },
  },
  {
    id: 'pricing',
    title: 'Price check: speckled bowls vs. competitors',
    agentId: 'scout',
    steps: [
      tool('lookout', 'Scanning 40 Etsy shops for speckled bowls', 6, 0.11),
      { kind: 'hiccup', building: 'lookout', label: 'Etsy search timed out. Retrying', seconds: 3 },
      tool('lookout', 'Comparing size, glaze and shipping', 5, 0.08),
      tool('library', 'Writing the summary', 4, 0.05),
      { kind: 'deliver' },
    ],
    deliverable: {
      title: 'Speckled bowl pricing',
      kind: 'Research brief',
      body: [
        'Sampled 40 shops selling handmade speckled bowls (5–7 in).',
        'Median price $34. Middle half: $28–$41. Moss & Kiln: $32.',
        'Top sellers bundle in sets of 2 at $58–$64 and mention "dishwasher safe" in the title.',
        'Recommendation: hold single price, add a set-of-2 at $60, add "dishwasher safe" to titles.',
      ],
    },
  },
  {
    id: 'newsletter',
    title: 'Draft the November newsletter',
    agentId: 'bea',
    steps: [
      tool('library', 'Gathering new releases and studio news', 4, 0.03),
      tool('studio', 'Picking a hero image', 3, 0.04),
      tool('post', 'Drafting the email', 5, 0.08),
      {
        kind: 'approval',
        label: 'Send to 1,240 subscribers',
        risk: 'high',
        preview: [
          'Subject: The kiln is warm again',
          'Preview: Autumn Glaze is here, plus first look at holiday sets',
          '"This month we fired four kilns of Autumn Glaze. It came out darker than we planned, and we love it more for it."',
          'CTA: Shop the Autumn Glaze →',
        ],
      },
      { kind: 'deliver' },
    ],
    deliverable: {
      title: 'November newsletter',
      kind: 'Email · sent to 1,240',
      body: [
        'Subject: The kiln is warm again',
        'Sections: Autumn Glaze launch · Studio note from Rae · Holiday sets preview · Market dates',
        'Hero image: rust mug on oak shelf (from November batch).',
        'Scheduled send: Thursday 9:00 AM ET, best open-rate slot from last 6 sends.',
      ],
    },
  },
  {
    id: 'banner',
    title: 'Make a holiday shop banner',
    agentId: 'juno',
    steps: [
      tool('library', 'Checking brand colors and type', 3, 0.02),
      tool('studio', 'Composing banner in 3 sizes', 6, 0.16),
      {
        kind: 'approval',
        label: 'Replace the live shop banner',
        risk: 'low',
        preview: [
          'Banner: "Gifts from the kiln" over a row of gift boxes',
          'Sizes: Etsy 1600×400, mobile 1200×300, Instagram story',
          'Colors: Moss, Oat, Rust. Type: shop serif',
        ],
      },
      tool('market', 'Uploading to the shop', 3, 0.02),
      { kind: 'deliver' },
    ],
    deliverable: {
      title: 'Holiday banner',
      kind: 'Banner · live on shop',
      body: [
        '"Gifts from the kiln" banner live on Etsy (1600×400) and mobile (1200×300).',
        'Instagram story version saved to Brand / Social.',
        'Previous banner archived, so you can roll back anytime.',
      ],
    },
  },
  {
    id: 'replies',
    title: 'Answer 3 customer messages',
    agentId: 'bea',
    steps: [
      tool('market', 'Reading 3 new Etsy messages', 3, 0.02),
      tool('library', 'Checking shipping and care policy', 3, 0.02),
      tool('post', 'Drafting replies', 4, 0.05),
      {
        kind: 'approval',
        label: 'Send 3 replies',
        risk: 'low',
        preview: [
          'To Dana: "Yes, the Oat mugs are dishwasher safe. Hand-washing keeps the speckle brighter."',
          'To Marcus: "Your order ships Monday. Here is your tracking link."',
          'To Lee: "We can do a custom set of 4. Want me to send a quote?"',
        ],
      },
      { kind: 'deliver' },
    ],
    deliverable: {
      title: 'Customer replies',
      kind: '3 messages · sent',
      body: [
        'Dana (dishwasher question): answered with care tip.',
        'Marcus (shipping): tracking sent, ships Monday.',
        'Lee (custom set of 4): offered a quote. Flagged for Rae to price.',
      ],
    },
  },
  {
    id: 'trends',
    title: 'Find holiday gift trends for 2026',
    agentId: 'scout',
    steps: [
      tool('lookout', 'Reading gift guides and search trends', 6, 0.12),
      tool('lookout', 'Clustering what is rising', 4, 0.07),
      tool('library', 'Writing the brief', 4, 0.04),
      { kind: 'deliver' },
    ],
    deliverable: {
      title: 'Holiday gift trends',
      kind: 'Research brief',
      body: [
        'Rising: "matcha set" (+64%), "pour-over set" (+41%), "personalized mug" (+22%).',
        'Gift guides favor sets under $75 and anything with a story card.',
        'Gap for Moss & Kiln: no matcha bowl yet. Consider a small run in Moss glaze.',
      ],
    },
  },
]

/** Turn free text into a plausible simulated plan. A real runtime would have an LLM plan this. */
export function planCustomJob(text: string, n: number): JobTemplate {
  const t = text.toLowerCase()
  let agentId = 'pip'
  let steps: Step[]
  if (/(photo|image|banner|picture|visual|logo)/.test(t)) {
    agentId = 'juno'
    steps = [tool('library', 'Checking the brand guide', 3, 0.02), tool('studio', 'Working on the images', 6, 0.15)]
  } else if (/(email|newsletter|reply|message|post|instagram|social)/.test(t)) {
    agentId = 'bea'
    steps = [
      tool('library', 'Gathering context', 3, 0.02),
      tool('post', 'Drafting', 5, 0.06),
      { kind: 'approval', label: 'Send it', risk: 'high', preview: [text, 'Draft ready for review.'] },
    ]
  } else if (/(research|price|trend|competitor|find|compare)/.test(t)) {
    agentId = 'scout'
    steps = [tool('lookout', 'Researching', 6, 0.1), tool('library', 'Writing it up', 4, 0.04)]
  } else {
    steps = [
      tool('library', 'Reading brand voice guide', 3, 0.03),
      tool('market', 'Drafting', 5, 0.08),
      { kind: 'approval', label: 'Publish to the shop', risk: 'high', preview: [text, 'Draft ready for review.'] },
    ]
  }
  steps.push({ kind: 'deliver' })
  return {
    id: `custom-${n}`,
    title: text.trim().replace(/^./, (c) => c.toUpperCase()),
    agentId,
    steps,
    deliverable: { title: text.trim(), kind: 'Custom task', body: ['Simulated result. Connect a real agent runtime to fill this in.'] },
  }
}
