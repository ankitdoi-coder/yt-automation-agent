'use strict';

const PROFILES = Object.freeze({
  'reel-9x16': Object.freeze({
    name: 'reel-9x16',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    scale: 1,
    offsetY: 0,
    showCtaButtons: true,
  }),
  'shorts-9x16': Object.freeze({
    name: 'shorts-9x16',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    scale: 1,
    offsetY: 0,
    showCtaButtons: false,
  }),
  'feed-1x1': Object.freeze({
    name: 'feed-1x1',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    scale: 1,
    offsetY: 0,
    showCtaButtons: false,
  }),
  'feed-4x5': Object.freeze({
    name: 'feed-4x5',
    width: 1080,
    height: 1350,
    aspectRatio: '4:5',
    scale: 1,
    offsetY: 0,
    showCtaButtons: true,
  }),
});

function resolveProfile(profileName = 'shorts-9x16', options = {}) {
  const key = (profileName === undefined || profileName === null || profileName === '')
    ? 'shorts-9x16'
    : String(profileName).trim();

  const base = PROFILES[key];
  if (!base) {
    throw new Error(
      `Unknown quiz-renderer profile "${key}". Valid profiles: ${Object.keys(PROFILES).join(', ')}`
    );
  }

  const opts = options && typeof options === 'object' ? options : {};
  const showCtaButtons = typeof opts.showCtaButtons === 'boolean'
    ? opts.showCtaButtons
    : base.showCtaButtons;

  const parsedScale = opts.scale !== undefined ? Number(opts.scale) : NaN;
  const scale = Number.isFinite(parsedScale) && parsedScale > 0 ? parsedScale : base.scale;

  const parsedOffsetY = opts.offsetY !== undefined ? Number(opts.offsetY) : NaN;
  const offsetY = Number.isFinite(parsedOffsetY) ? parsedOffsetY : base.offsetY;

  return {
    ...base,
    scale,
    offsetY,
    showCtaButtons,
  };
}

module.exports = {
  PROFILES,
  resolveProfile,
};
