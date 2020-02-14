
const UNITS = {
  year: 12 * 30 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  hour: 60 * 60 * 1000,
  minute: 60 * 1000,
  second: 1000
};
/**
 * @description Fn to get time passed 
 * @param dtime 
 */
export default function timeAgo(dtime): string {
  let res = "";
  let level = 2;

  for (const [u, t] of Object.entries(UNITS)) {
    if (dtime >= t) {
      let n;
      if (level > 1) {
        n = Math.floor(dtime / t);
        dtime -= n * t;
      } else {
        n = Math.round(dtime / t);
      }
      if (n > 1) res += `${n} ${u}s `;
      else res += `${n} ${u} `;
      if (!--level) break;
    }
  }

  return res + "ago";
}
