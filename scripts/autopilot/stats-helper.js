/**
 * Statistical Helper for Growth Autopilot
 * Provides robust non-parametric metrics (Medians, Percentiles, and Bootstrap Confidence Intervals)
 * for small-sample, highly skewed YouTube view distributions.
 */

function calculateMedian(values = []) {
  const nums = values.map(Number).filter(v => Number.isFinite(v)).sort((a, b) => a - b);
  if (nums.length === 0) return 0;
  const mid = Math.floor(nums.length / 2);
  if (nums.length % 2 !== 0) {
    return nums[mid];
  }
  return (nums[mid - 1] + nums[mid]) / 2;
}

function calculatePercentile(values = [], percentile = 75) {
  const nums = values.map(Number).filter(v => Number.isFinite(v)).sort((a, b) => a - b);
  if (nums.length === 0) return 0;
  const index = (percentile / 100) * (nums.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  if (lower === upper) return nums[lower];
  return nums[lower] * (1 - weight) + nums[upper] * weight;
}

/**
 * Bootstrap Confidence Interval (BCI) for the median
 * Non-parametric; does not assume Gaussian/normal distribution.
 */
function bootstrapMedianCI(values = [], numResamples = 1000, confidence = 0.90) {
  const nums = values.map(Number).filter(v => Number.isFinite(v));
  const n = nums.length;
  if (n === 0) {
    return { sampleSize: 0, median: 0, lowerBound: 0, upperBound: 0, confidence };
  }
  if (n === 1) {
    return { sampleSize: 1, median: nums[0], lowerBound: nums[0], upperBound: nums[0], confidence };
  }

  const sampleMedians = [];
  // Use pseudo-random resampling with replacement
  for (let r = 0; r < numResamples; r++) {
    const resample = new Array(n);
    for (let i = 0; i < n; i++) {
      const randIdx = Math.floor(Math.random() * n);
      resample[i] = nums[randIdx];
    }
    sampleMedians.push(calculateMedian(resample));
  }

  sampleMedians.sort((a, b) => a - b);
  const alpha = 1 - confidence;
  const lowerIdx = Math.max(0, Math.floor((alpha / 2) * numResamples));
  const upperIdx = Math.min(numResamples - 1, Math.ceil((1 - alpha / 2) * numResamples));

  return {
    sampleSize: n,
    median: calculateMedian(nums),
    lowerBound: sampleMedians[lowerIdx],
    upperBound: sampleMedians[upperIdx],
    confidence
  };
}

/**
 * Compare two variants using bootstrap confidence intervals and minimum sample rules
 */
function compareVariants(variantA, variantB, options = {}) {
  const minSampleSize = options.minSampleSize || 5;
  const confidence = options.confidence || 0.90;

  const statsA = bootstrapMedianCI(variantA.data, 1000, confidence);
  const statsB = bootstrapMedianCI(variantB.data, 1000, confidence);

  const result = {
    variantA: { name: variantA.name, ...statsA },
    variantB: { name: variantB.name, ...statsB },
    isConclusive: false,
    winner: null,
    reason: ''
  };

  if (statsA.sampleSize < minSampleSize || statsB.sampleSize < minSampleSize) {
    result.isConclusive = false;
    result.reason = `Inconclusive: insufficient sample size (n=${statsA.sampleSize} vs n=${statsB.sampleSize}, minimum required is ${minSampleSize})`;
    return result;
  }

  // Check confidence interval overlap
  const aWins = statsA.lowerBound > statsB.upperBound;
  const bWins = statsB.lowerBound > statsA.upperBound;

  if (aWins) {
    result.isConclusive = true;
    result.winner = variantA.name;
    result.reason = `Statistically significant: ${variantA.name} median ${statsA.median} (CI [${statsA.lowerBound}, ${statsA.upperBound}]) strictly outperforms ${variantB.name} median ${statsB.median} (CI [${statsB.lowerBound}, ${statsB.upperBound}]) at ${(confidence * 100).toFixed(0)}% confidence.`;
  } else if (bWins) {
    result.isConclusive = true;
    result.winner = variantB.name;
    result.reason = `Statistically significant: ${variantB.name} median ${statsB.median} (CI [${statsB.lowerBound}, ${statsB.upperBound}]) strictly outperforms ${variantA.name} median ${statsA.median} (CI [${statsA.lowerBound}, ${statsA.upperBound}]) at ${(confidence * 100).toFixed(0)}% confidence.`;
  } else {
    result.isConclusive = false;
    result.reason = `Inconclusive: confidence intervals overlap (${variantA.name} [${statsA.lowerBound}, ${statsA.upperBound}] vs ${variantB.name} [${statsB.lowerBound}, ${statsB.upperBound}]). Continue testing.`;
  }

  return result;
}

module.exports = {
  calculateMedian,
  calculatePercentile,
  bootstrapMedianCI,
  compareVariants
};
