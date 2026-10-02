// Shared design values. Components own their csslit templates.
// Brand blues: solidjs/solid-site, public/img/logo/without-wordmark/logo.svg.
// Each color is light-dark(light, dark); :root declares color-scheme.
// Dark chrome uses close charcoal surfaces; labels and avatars carry
// the stronger color accents.
export const colors = {
  ink: "light-dark(#24364b, #e3e7ec)",
  muted: "light-dark(#53667f, #aeb8c4)",
  primary: "light-dark(#1f3b77, #87a9dd)",
  primaryHover: "light-dark(#1a336b, #9cb9e5)",
  paper: "light-dark(#ffffff, #2c3138)",
  canvas: "light-dark(#f5f8fc, #24282e)",
  sidebar: "light-dark(#edf3fa, #272c33)",
  soft: "light-dark(#e8f0fa, #313740)",
  hover: "light-dark(#e1ecf8, #3b434d)",
  selected: "light-dark(#d5e6f7, #424c59)",
  border: "light-dark(#dce5ef, #424b56)",
  borderSubtle: "light-dark(#edf2f8, #3b434d)",
  borderHover: "light-dark(#9bb8d7, #68798a)",
  accent: "light-dark(#4377bb, #91b5e9)",
  focus: "light-dark(#518ac8, #9ec6f2)",
  selection: "light-dark(#dcf2fd, #4a6282)",
  success: "light-dark(#315aa9, #9bbbea)",
  pending: "light-dark(#a48443, #e0c58b)",
  pendingBorder: "light-dark(#c9bc82, #82775f)",
  danger: "light-dark(#995844, #f0a895)",
  dangerSurface: "light-dark(#fff5ee, #4b3b3b)",
  dangerBorder: "light-dark(#eaccc0, #78585a)",
  rejectedMove: "light-dark(#c74848, #f28f95)",
  handle: "light-dark(#758ba5, #97a7b9)",
  neutralDot: "light-dark(#aabace, #9aa8b9)",
  orangeDot: "light-dark(#cca975, #d9b47f)",
  blueDot: "light-dark(#518ac8, #6db1ef)",
  skyDot: "light-dark(#76b3e1, #8cc6ee)",
  // Label chips: text/bg ≥ 7:1; dark bg vs paper ≥ 1.5:1 so chips pop.
  goldSurface: "light-dark(#ece7d5, #4e3f0e)",
  goldText: "light-dark(#554920, #f7e8b6)",
  peachSurface: "light-dark(#f0e2d9, #6e300c)",
  peachText: "light-dark(#6b3c24, #fdcfb4)",
  blueSurface: "light-dark(#e1ecf8, #0f3a85)",
  blueText: "light-dark(#1f3b77, #c2d3f0)",
  purpleSurface: "light-dark(#ebe5f0, #640e81)",
  purpleText: "light-dark(#6b3276, #e2c6ec)",
  skySurface: "light-dark(#e5f3fc, #0b4a65)",
  skyText: "light-dark(#20546f, #b4e7fd)",
  avatarSand: "light-dark(#d3aa67, #84642e)",
  avatarSandText: "light-dark(#3d2c13, #fff2d1)",
  avatarSky: "light-dark(#82b9df, #416e91)",
  avatarSkyText: "light-dark(#163954, #e9f5ff)",
  avatarRose: "light-dark(#dba0af, #875168)",
  avatarRoseText: "light-dark(#4d1f2b, #ffe9f1)",
  avatarBlue: "light-dark(#93aae1, #4a649b)",
  avatarBlueText: "light-dark(#1a315f, #eff4ff)",
  overlay: "light-dark(#1e304965, #1c2533a8)",
  shadowSoft: "light-dark(#243e6103, #17223016)",
  shadowHover: "light-dark(#243e6109, #17223030)",
  shadowDialog: "light-dark(#1e365630, #17223070)",
  shadowDrag: "light-dark(#1e365625, #17223050)",
} as const;

// Sizes are cap heights with the adjusted Public Sans face.
export const fontSize = {
  caption: 8,
  body: 9,
  control: 10,
  dialogTitle: 13,
  brand: 14,
  headingCompact: 16,
  heading: 18,
} as const;

// Explicit line spacing for text that can wrap. Single-line elements rely on
// text-box trimming and their font size instead.
export const lineHeight = {
  caption: 14,
  body: 16,
  control: 18,
  dialogTitle: 20,
  headingCompact: 24,
  heading: 26,
} as const;

export const breakpoints = {
  phone: 500,
  compact: 800,
  wide: 1500,
} as const;

export const boardLane = {
  minWidth: 230,
  maxWidth: 288,
  columnsPerView: 4,
} as const;

// Spacing scale. Use these values for padding, margin, and gap.
// Bordered elements subtract the border width from the padding so content
// sits on the scale from the outer edge: padding = inset − border.
// Example: 1px border + target inset 12 → padding 11px.
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radius = {
  small: 6,
  control: 8,
  card: 9,
  dialog: 10,
} as const;

// Shared interactive control box. Height is content-driven:
// fontSize + 2×pad + 2×border. Pad is inset − border (12 − 1) so content
// lands at 12 from the outer edge. Borderless controls keep the same box via
// a transparent border. Icons paint at 11px with a 9px layout box.
export const control = {
  pad: 11,
  fontSize: 9,
} as const;

// Square icon-only control box: 2×inset + 9px icon layout.
// md is bordered (pad 11 + border 1 = 12); sm is borderless (pad 8).
export const iconBox = {
  sm: 25,
  md: 33,
} as const;

// Button padding scale (all sides), already border-adjusted where needed.
// md matches control.pad so default buttons share the input/select box height.
export const buttonPad = {
  none: 0,
  xs: 3,
  sm: 7,
  md: 11,
  lg: 15,
} as const;

// Button label sizes. Wrapping text buttons set their own line height.
export const buttonText = {
  caption: fontSize.caption,
  body: fontSize.body,
  control: control.fontSize,
  dialogTitle: fontSize.dialogTitle,
} as const;

export const motion = {
  cardFeedbackMs: 1800,
} as const;
