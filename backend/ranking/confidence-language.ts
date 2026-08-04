export function confidencePhrase(score: number): string {
  if (score >= 0.85) return '高度可信';
  if (score >= 0.7) return '较可能';
  if (score >= 0.55) return '存在一定可能';
  if (score >= 0.4) return '判断不稳定';
  return '不建议作为正式候选';
}
