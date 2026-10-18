const { parseTranscriptCues } = require('./retention-analyzer');

const FILLER_ONLY = /^[\s,.-]*((um+|uh+|er+|ah+|so|okay|ok|right|yeah|like|anyway|basically|actually|you know|i mean|let me see|hold on)[\s,.-]*)+$/i;

/**
 * Detect dead air, pauses, filler words and restarts in transcripts to generate an Edit Decision List (EDL)
 * @param {string|Array} transcript - Transcript content or cues array
 * @param {object} [options] - Options including floor pause threshold
 */
function detectDeadAir(transcript, options = {}) {
  const cues = Array.isArray(transcript) ? transcript : parseTranscriptCues(transcript, options.ext || '.srt');
  if (!cues.length) {
    return { cuts: [], originalDuration: 0, cutDuration: 0, finalDuration: 0 };
  }

  const floor = typeof options.floor === 'number' ? options.floor : 0.45;
  const originalDuration = cues[cues.length - 1].end;
  const cuts = [];

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    // Check filler only
    if (FILLER_ONLY.test(cue.text)) {
      cuts.push({
        kind: 'FILLER',
        start: cue.start,
        end: cue.end,
        duration: Math.round((cue.end - cue.start) * 1000) / 1000,
        why: cue.text.slice(0, 48)
      });
    }

    // Check dead air gap from previous cue
    if (i > 0) {
      const prevEnd = cues[i - 1].end;
      const gap = cue.start - prevEnd;
      if (gap > floor) {
        const keep = floor / 2;
        cuts.push({
          kind: 'DEAD_AIR',
          start: Math.round((prevEnd + keep) * 1000) / 1000,
          end: Math.round((cue.start - keep) * 1000) / 1000,
          duration: Math.round((gap - floor) * 1000) / 1000,
          why: `gap ${gap.toFixed(2)}s > floor ${floor.toFixed(2)}s`
        });
      }
    }

    // Check restarts / false starts (similar opening words)
    if (i > 0) {
      const prevWords = (cues[i - 1].text || '').toLowerCase().replace(/[^a-z ]/g, '').split(/\s+/).slice(0, 4).join(' ');
      const curWords = (cue.text || '').toLowerCase().replace(/[^a-z ]/g, '').split(/\s+/).slice(0, 4).join(' ');
      if (prevWords && curWords && prevWords === curWords && prevWords.split(' ').length >= 3) {
        cuts.push({
          kind: 'RESTART',
          start: cues[i - 1].start,
          end: cues[i - 1].end,
          duration: Math.round((cues[i - 1].end - cues[i - 1].start) * 1000) / 1000,
          why: `false start / take restart: "${prevWords}"`
        });
      }
    }
  }

  const totalCutSeconds = cuts.reduce((acc, c) => acc + Math.max(0, c.duration), 0);
  const finalDuration = Math.max(0, originalDuration - totalCutSeconds);

  return {
    cuts,
    originalDuration: Math.round(originalDuration * 100) / 100,
    totalCutDuration: Math.round(totalCutSeconds * 100) / 100,
    estimatedFinalDuration: Math.round(finalDuration * 100) / 100,
    pacingImprovementPct: originalDuration > 0 ? Math.round((totalCutSeconds / originalDuration) * 1000) / 10 : 0
  };
}

module.exports = {
  detectDeadAir
};
