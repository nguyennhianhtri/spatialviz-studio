export type StylePreset = 'warm' | 'soft' | 'mono';
export const renderPalettes = {
  warm: { background:'#eee9e1', ground:'#e9e2d7', wall:'#f6f1e8', cut:'#d3c3ae', wood:'#b9946c', floor:'#d9be97', fabric:'#ddd4c3', accent:'#9aab96', stone:'#e1dcd2', metal:'#60584e', rug:'#c9b6a0' },
  soft: { background:'#eeeae5', ground:'#e6e0d9', wall:'#f6f3ed', cut:'#c9c2b8', wood:'#c9b299', floor:'#e0d0b8', fabric:'#e5ddd9', accent:'#a7b3ae', stone:'#e1dfda', metal:'#6c6963', rug:'#c5ccbf' },
  mono: { background:'#eae9e6', ground:'#ddddd8', wall:'#f5f4ef', cut:'#b5b4ac', wood:'#a5a398', floor:'#d0cec5', fabric:'#e0dfd6', accent:'#777e76', stone:'#d8d9d4', metal:'#444942', rug:'#b9bbb2' },
} as const;
export type RenderPalette = typeof renderPalettes[StylePreset];
