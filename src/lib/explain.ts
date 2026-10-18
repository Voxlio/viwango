import type { Zone } from './levels/types.ts';
import type { PriceLocation, MarketState } from './levels/types.ts';
import { formatDate, plural, relativeTime } from './format.ts';

/**
 * Plain-English explanations.
 *
 * These are pure string builders — no model, no API, no randomness. The
 * sentences are assembled from the numbers the algorithm already produced, so
 * they can never claim something the data does not support. Wording varies a
 * little with the data (how many touches, how stale, whether the higher
 * timeframe agrees) so three zones do not read identically, but the same input
 * always produces the same sentence.
 */

export function explainZone(zone: Zone, precision: number, nowSeconds = Date.now() / 1000): string {
  const kindWord = zone.kind === 'floor' ? 'floor' : 'ceiling';
  const turnVerb = zone.kind === 'floor' ? 'bounced up from' : 'turned down at';
  const date = formatDate(zone.lastTouch);
  const recency = relativeTime(zone.lastTouch, nowSeconds);
  const touches = zone.touches;

  const sentences: string[] = [];

  // 1. What happened here.
  sentences.push(
    `Price ${turnVerb} this area ${touches} ${plural(touches, 'time')}. The last was on ${date} (${recency}).`,
  );

  // 2. Why that matters, scaled to the touch count.
  if (touches >= 5) {
    sentences.push(
      `That is a lot of evidence. A reaction from this ${kindWord} is more likely than from a zone tested only once or twice.`,
    );
  } else if (touches >= 3) {
    sentences.push(
      `A bounce from here is more likely than from a zone with fewer touches, because the market keeps respecting this price.`,
    );
  } else {
    sentences.push(
      `Two touches is a hint rather than proof. Watch how price behaves if it comes back — a third turn would make this ${kindWord} much more reliable.`,
    );
  }

  // 3. Freshness.
  const ageDays = (nowSeconds - zone.lastTouch) / 86_400;
  if (ageDays > 120) {
    sentences.push(
      `The last test was over four months ago. Old zones still matter, but the market has had time to change its mind, so treat this one as softer.`,
    );
  } else if (ageDays < 2) {
    sentences.push(`It was tested within the last two days, so it is still "fresh" in market terms.`);
  }

  // 4. Higher-timeframe agreement.
  if (zone.confirmedHigherTf) {
    sentences.push(
      `The same ${kindWord} also shows up one timeframe higher, which is the strongest kind of agreement this tool can find.`,
    );
  }

  // 5. The band reminder, with the actual range.
  const spread = zone.high - zone.low;
  if (spread > 0) {
    sentences.push(
      `This is a zone, not a single line: anywhere between ${zone.low.toFixed(precision)} and ${zone.high.toFixed(precision)} counts as being at the ${kindWord}.`,
    );
  }

  return sentences.join(' ');
}

export function explainMarketState(
  state: MarketState,
  location: PriceLocation,
  position: number,
): string {
  const stateText = {
    RANGE:
      'Price is moving sideways: the highs are not climbing and the lows are not falling. In a range, the top tends to act as a ceiling and the bottom as a floor.',
    UPTREND:
      'Price is making higher highs and higher lows. That means buyers keep stepping in earlier, and dips are being bought.',
    DOWNTREND:
      'Price is making lower highs and lower lows. Sellers keep stepping in sooner, and rallies are being sold.',
  }[state];

  const percentIntoRange = Math.round(position * 100);

  const locationText = {
    near_floor: `Price is in the bottom quarter of its recent range (about ${percentIntoRange}% of the way up). It is sitting near a floor, where buyers have stepped in before.`,
    middle: `Price is in the middle of the range (about ${percentIntoRange}% of the way up), so there is no clear edge. Waiting for it to reach a floor or ceiling is usually better than guessing in the middle.`,
    near_ceiling: `Price is in the top quarter of its recent range (about ${percentIntoRange}% of the way up). It is close to a ceiling, where sellers have taken over before.`,
  }[location];

  const trendCaveat =
    state === 'UPTREND'
      ? ' Careful: in an uptrend a ceiling is more likely to be broken, so a rejection there is not guaranteed.'
      : state === 'DOWNTREND'
        ? ' Careful: in a downtrend a floor is more likely to be broken, so a bounce there is not guaranteed.'
        : '';

  return `${stateText} ${locationText}${trendCaveat}`;
}

/** One-line summary for the "where is price" chip. */
export function locationLabel(location: PriceLocation): string {
  return {
    near_floor: 'Near a floor',
    middle: 'In the middle',
    near_ceiling: 'Near a ceiling',
  }[location];
}

export function stateLabel(state: MarketState): string {
  return {
    RANGE: 'Range',
    UPTREND: 'Uptrend',
    DOWNTREND: 'Downtrend',
  }[state];
}

/** Friendly, non-technical sentence for an API error code. */
export function explainError(code: string, message: string): string {
  switch (code) {
    case 'RATE_LIMIT':
      return 'The free data provider is temporarily limiting requests. Wait about a minute, then press "Find levels" again. Your previous results stay on screen.';
    case 'CONFIG':
      return message;
    case 'NO_DATA':
      return `${message} Candles may be missing because the market is closed, the symbol is not covered, or the timeframe is too long for the free plan.`;
    case 'UNKNOWN_SYMBOL':
    case 'UNKNOWN_TIMEFRAME':
    case 'INVALID_INPUT':
      return message;
    case 'INSUFFICIENT_DATA':
      return message;
    default:
      return message || 'Something went wrong. Please try again in a moment.';
  }
}
